/*
 * Service worker de l'application mobile — écrit à la main plutôt qu'via Serwist/next-pwa : les
 * besoins tiennent en une centaine de lignes (consultation hors ligne + notifications push), et
 * le projet évite les dépendances de build qu'il ne maîtrise pas (même parti pris que pour les
 * tooltips/toasts réimplémentés sans Bootstrap).
 *
 * Portée volontairement limitée à `/mobile` : le dashboard desktop n'a aucun besoin hors ligne, et
 * mettre en cache ses pages exposerait des données à un poste partagé sans bénéfice.
 */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const PAGES_CACHE = `pages-${VERSION}`;
const ASSETS_CACHE = `assets-${VERSION}`;

const OFFLINE_URL = "/offline.html";

const SHELL_ASSETS = [OFFLINE_URL, "/manifest.json", "/icon-192.png", "/logo-2c-energies.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `addAll` échoue en bloc si une seule ressource manque : on tolère les absences pour ne pas
      // laisser un service worker non installé (et donc aucun hors ligne du tout).
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Ressources versionnées par leur nom : immuables, donc servies depuis le cache sans hésiter. */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/splash/");
}

function isMobileNavigation(request, url) {
  return request.mode === "navigate" && url.pathname.startsWith("/mobile");
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Navigation : le réseau d'abord (les données doivent être fraîches quand c'est possible), la
 * dernière version connue ensuite. C'est ce repli qui constitue la consultation hors ligne : la
 * page rendue côté serveur contient déjà les interventions du technicien.
 */
async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGES_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Seules les lectures sont mises en cache. Un POST/PATCH rejoué depuis un cache corromprait des
  // données — la file d'envoi hors ligne est une étape ultérieure, assumée non traitée ici.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }
  if (isMobileNavigation(request, url)) {
    event.respondWith(networkFirstPage(request));
  }
});

/* ------------------------------------------------------------------ Notifications push */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: event.data ? event.data.text() : "Notification" };
  }

  const title = payload.title || "Damaschin CRM";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Regroupe les notifications d'une même entité au lieu d'empiler des doublons.
      tag: payload.tag || undefined,
      data: { url: payload.url || "/mobile" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/mobile";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Réutiliser un onglet déjà ouvert évite d'empiler les fenêtres à chaque notification.
      for (const client of clients) {
        if (client.url.includes("/mobile") && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
