/**
 * Réduit un `user-agent` à quelque chose de lisible dans un tableau.
 *
 * Approximation assumée : l'objectif est de reconnaître « c'est mon iPhone » d'un coup d'œil,
 * pas d'identifier précisément un appareil.
 *
 * Module à part (plutôt qu'au chaud dans la route) parce qu'il sert des deux côtés : la route
 * `/api/settings/notifications/devices` et le rendu serveur de la page Paramètres. Importer une
 * fonction depuis un `route.ts` fonctionne, mais Next traite ces fichiers de façon particulière —
 * autant ne pas s'y exposer.
 */
export function describeDevice(userAgent: string) {
  if (!userAgent) return "Appareil inconnu";

  const platform = /iPhone/i.test(userAgent)
    ? "iPhone"
    : /iPad/i.test(userAgent)
      ? "iPad"
      : /Android/i.test(userAgent)
        ? "Android"
        : /Macintosh/i.test(userAgent)
          ? "Mac"
          : /Windows/i.test(userAgent)
            ? "Windows"
            : "Autre";

  // Chrome et Edge s'annoncent aussi comme Safari : l'ordre des tests est ce qui donne le bon nom.
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /Chrome\//i.test(userAgent)
      ? "Chrome"
      : /Firefox\//i.test(userAgent)
        ? "Firefox"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "";

  return browser ? `${platform} · ${browser}` : platform;
}
