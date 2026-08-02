# Raport Tehnic: Comparație Design System GXON vs dashboard-v2

> **Status (actualizat după prima trecere de implementare):**
> - ✅ **Făcut**: micro-interacția de hover/press pe butoane (`scale(1.002)`/`scale(0.982)`), `.button-ghost:hover`, unificarea celor două definiții conflictuale ale `.button-danger`, redesign complet al cardurilor din Catalogue PAC și Sociétés émettrices (`.entity-card`, radius 10px, fără hover-lift, meta-date pe rânduri etichetă–valoare).
> - ⏳ **Neatins încă**: tot restul de mai jos — token-uri de culoare de bază (`--warning`, `--secondary`, `--danger`, `--light`), `.card` generic (încă 12px/22px, nu 10px/20px), variantele de buton `outline`/`subtle`, backdrop modal, shadow-uri overlay, badge implicit pill, checkbox/switch native, tooltip și toast (0%).
> - Lista de priorități rămase e reluată și în `CLAUDE.md` din rădăcina proiectului, secțiunea „Design system”.

## Metodologie
Analiză directă a fișierelor sursă SCSS din `GXON-v1.5.0-13_February_2026/xhtml/src/assets/scss/` (variabile, componente, layout) și paginilor HTML (`index.html`) pentru structura reală, comparate cu `dashboard-v2/src/app/globals.css` (2488 linii, la momentul raportului) și componentele React din `src/components/layout/` și `src/components/ui/`.

---

## 1. CULORI

### GXON (`_variables.scss`, `_color-palette.scss`)
```
$primary:   #316AFF
$secondary: #FF8110
$success:   #22B07E
$info:      #02B4FA
$warning:   #FDBB1F
$danger:    #FF401C
$light:     #ECF2FD
$dark:      #0C243C
$gray:      #97A1C0
$body-color: #97A1C0
$border-color: #E8EBF1
$headings-color: #0C243C
$body-bg: #fff
$body-secondary-bg: #f9f9f9
```
GXON generează și variante `-bg-subtle` (tint 90%), `-border-subtle` (tint 75%), `-text-emphasis` (shade 60%) pentru fiecare culoare temă, plus un sistem `--bs-btn-primary-hover` = shade 10%, `-active` = shade 12%. Există și 4 teme de culoare alternative (`data-color-theme="orange|pink|purple"`), cu 12 culori social-media mapate ca variabile.

### dashboard-v2 (`globals.css :root`)
```
--primary: #316aff       ✓ identic
--primary-dark: #285de4  (nu corespunde exact shade-color 10%; aproximativ ok)
--heading: #0c243c       ✓ identic
--text: #97a1c0          ✓ identic
--border: #e9ebf3        (GXON: #E8EBF1 — foarte apropiat, neglijabil)
--surface: #fff           ✓ identic
--background: #f8f9fc     (GXON body-secondary-bg: #f9f9f9 — diferă ușor)
--success: #22b07e        ✓ identic
--warning: #ff8110        ✗ GREȘIT — e de fapt $secondary din GXON. Warning real = #FDBB1F
--info: #02b4fa           ✓ identic
```
**Lipsesc complet din v2**: `--secondary` (#FF8110), `--danger` (#FF401C ca variabilă globală), `--light` (#ECF2FD), și toate variantele `-bg-subtle`/`-border-subtle`/`-text-emphasis`.

### Acțiune necesară
- **Corectează `--warning`**: `#ff8110` → `#fdbb1f`.
- **Adaugă `--secondary: #ff8110`**.
- **Adaugă `--danger: #ff401c`** ca variabilă globală — în prezent fiecare componentă își definește propriul roșu ad-hoc (`#a72828`, `#b72f3d`), minim 3 nuanțe diferite de roșu în cod. Unifică.
- **Adaugă `--light: #ecf2fd`**.
- `--border`: `#e9ebf3` → `#e8ebf1`.
- `--background`: `#f8f9fc` → `#f9f9f9`.
- **Generează sistematic variantele `-subtle`** pentru fiecare culoare — în v2 sunt reinventate manual, inconsistent, în zeci de locuri (`rgb(49 106 255 / 10%)`, `#edf2ff`, `#eaf8f3`, `#e9f9ff`, `#fff4e9`...). Centralizează ca `--primary-subtle`, `--success-subtle`, etc.

---

## 2. TIPOGRAFIE

### GXON
```
font-family-base: "Plus Jakarta Sans", sans-serif
font-size-base: 0.875rem (14px)
line-height-base: 1.6
font-weight-base: 500
headings-font-weight: 600
headings-color: #0C243C
```
Scale: `.text-xl 24px / .text-lg 20px / .text-md 18px / .text-sm 15px / .text-xs 14px / .text-1xs 13px / .text-2xs 12px / .text-3xs 10px / .text-4xs 8px`
`.app-page-title`: `font-size: 24px; font-weight: 700; margin-bottom: 5px`

### dashboard-v2
```
font: 500 14px/1.6 var(--font-jakarta), sans-serif;   ✓ identic
h1, h2, h3, strong { color: var(--heading) }
.page-heading h1 { font-size: 27px }   (GXON: 24px)
```

### Acțiune necesară
- **Lipsește scala de utilitare `.text-xl/.text-lg/...text-4xs`** — de adăugat dacă se dorește fidelitate completă.
- Adaugă `font-weight: 600` explicit pe `h1-h6` (verifică dacă browser default 700 diferă de GXON 600).
- `.page-heading h1`: 27px → 24px pentru identitate exactă (diferență mică, opțional).

---

## 3. SPACING / RADIUS / SHADOW

### GXON
```
Border-radius: base .375rem(6px) / sm .25rem(4px) / lg .625rem(10px, carduri) / xl 1rem(16px) / xxl 2rem(32px) / pill 50rem

Box-shadow:
  $box-shadow:        0 .5rem 1rem rgba(0,0,0,.15)
  $box-shadow-sm:      0 .125rem .25rem rgba(0,0,0,.075)
  $box-shadow-lg:      0 0.26rem 1.126rem 0 rgba(45,42,60,.15)   ← folosit la dropdown/modal/popover
  $box-shadow-inset:   inset 0 1px 2px rgba(0,0,0,.075)

$card-box-shadow: 0px 5px 10px 0px rgba(0,0,0,0.02)
$card-border-radius: 10px
$card-spacer-y/x: 20px
```

### dashboard-v2
```
.card { border-radius: 12px; box-shadow: 0 5px 10px rgb(0 0 0 / 2%); padding: 22px; }
```

### Acțiune necesară
- Card border-radius: 12px → **10px**.
- Card padding: 22px → **20px**.
- Card box-shadow: deja aproape identic, OK.
- **Lipsește o scală de radius ca variabile CSS** — fiecare componentă hardcodează 8/9/10/11/12/14/16/18px random, fără sistem. Standardizează pe 6/4/10/16/32/pill.
- **Shadow-urile mari (dropdown/modal/popover) nu folosesc formula GXON** `rgba(45,42,60,.15)` — v2 folosește `rgb(12 36 60 / X%)` (culoare de bază diferită, bleumarin vs gri-mov). Aliniază la `rgba(45, 42, 60, opacity)`.

---

## 4. SIDEBAR

### GXON
```
--app-sidebar-width: 250px; --app-header-height: 70px
.app-menubar { position:fixed; background: body-bg; box-shadow: 0px 30px 30px 10px rgba(0,0,0,0.02) }
.app-navbar-brand { height: header-height; padding: 15px 25px; gap: 15px; border-right+bottom }
.menu-link { border-radius:8px; padding:10px 15px }
.menu-link:hover/.active { color:#fff; background:primary; box-shadow: inset 0 -3px 0 rgba(0,0,0,.2) }
.menu-heading { color:primary; font-size:12px; padding: 20px 15px 12px; uppercase }
mini mode: width 80px
Mobile (<~1200px): left:-260px, .open{left:0}
```

### dashboard-v2 (`.sidebar`, `Sidebar.tsx`)
Structura e foarte apropiată — implementare solidă:
```
--sidebar-width:250px / --header-height:70px  ✓
.sidebar { position:fixed; background:surface; box-shadow: 0 30px 30px 10px rgb(shadow/2%) }  ✓
.sidebar-brand { padding: 12px 24px, gap 11px }   (GXON: 15px 25px)
.nav-link { border-radius:8px; padding:10px 15px }  ✓
.nav-link:hover/.active { identic cu GXON }  ✓
.nav-label { padding: 14px 15px 8px }  (GXON: 20px 15px 12px)
--sidebar-width compact: 80px  ✓
Mobile: translateX(-100%) vs GXON left:-260px — mecanism diferit, rezultat similar  ✓
```

### Acțiune necesară
- `.sidebar-brand` padding: `12px 24px` → `15px 25px`.
- `.nav-label` padding-top: `14px` → `20px 15px 12px`.
- Lipsesc submeniurile expandabile (chevron, indentare) — dacă nu sunt necesare, ignoră.
- `.app-sidebar-end` (a doua bară opțională GXON) — nu există în v2, probabil neesențială.

---

## 5. HEADER

Replicat foarte fidel — `.app-header` din v2 corespunde aproape exact structurii/dimensiunilor GXON (height 70px, border-bottom, box-shadow `0 15px 30px rgba(0,0,0,.02)`, toggler 30px cu span 18×2px). **Nu sunt necesare schimbări majore.**

---

## 6. CARD

### GXON
```
$card-border-radius: 10px; $card-spacer-y/x: 20px
.card-title { font-size:16px; margin-bottom:.25rem }
Structură tipică: majoritatea card-header-elor folosesc `border-0 pb-0` (FĂRĂ linie de separare vizibilă) — aspect "flat"/continuu.
```

### dashboard-v2
```
.card { border-radius:12px; padding:22px; box-shadow: 0 5px 10px rgb(0 0 0/2%) }
.card-header { border-bottom: 1px solid border; padding-bottom:15px }  ← ÎNTOTDEAUNA cu bordură
.card h2 { font-size:18px }  (GXON: 16px)
```

### Acțiune necesară
- **`.card-header` are ÎNTOTDEAUNA bordură** în v2 — GXON omite bordura în marea majoritate a cardurilor reale (`border-0 pb-0`), aspect mai "flat". Recomandare: elimină `border-bottom` din `.card-header` de bază, adaugă-l doar ca variantă opțională unde chiar separă vizual o listă/tabel.
- `.card h2`: 18px → 16px, `font-weight:600`.
- Border-radius 12px → 10px.
- Padding 22px → 20px.

**Notă**: `.entity-card` (Catalogue PAC, Sociétés émettrices) e deja la 10px/pattern flat — folosește-l ca referință vizuală când aliniezi `.card` generic.

---

## 7. BUTOANE

### GXON
```
$input-btn-padding-y: .532rem(~8.5px); -x: 1.2rem(19.2px)
$btn-border-radius: 8px / sm:6px / lg:10px
$btn-font-weight: 500
Variante complete per culoare:
  .btn-{color}          solid, hover=shade10%
  .btn-outline-{color}  border+text, hover=fill solid
  .btn-subtle-{color}   bg=bg-subtle(10% tint), text=color, hover=fill solid
  .btn-action-{color}   text=color, hover=bg-subtle
.btn-icon { 40×40 (sm32/lg48/xl60), flex center, padding 0 }
.btn { transform: scale(1.002) idle; scale(0.982) la :active }  ← micro-interacție "apăsare"
```

### dashboard-v2 (stare la momentul raportului inițial)
```
.button { border-radius:8px; padding:10px 16px; font-weight:700 (!! GXON=500) }
.button-primary/success/danger/ghost — DOAR 4 variante, fără outline/subtle/action
.button-danger { 2 definiții conflictuale în fișier }
```

### Ce s-a făcut deja
- ✅ micro-interacția scale(1.002)/scale(0.982) — adăugată
- ✅ `.button-ghost:hover` — adăugat (nu exista deloc)
- ✅ conflictul `.button-danger` — unificat pe roșu solid `#a72828`/`#851f1f` (notă: nu e încă exact `#ff401c` din GXON, de aliniat quando se introduce `--danger`)

### Acțiune încă necesară
1. **Font-weight**: 700 → **500/600** — încă neaplicat.
2. **Adaugă variantele lipsă `outline` / `subtle` / `action`**.
3. **Construiește `.btn-icon`** unificat (40×40 + variante), în loc de `.icon-button`/`.mini-action` ad-hoc.
4. Hover-urile nu urmează formula shade(10%/12%) — hardcodate ad-hoc (`#198e68`, `#851f1f`). Derivă sistematic din culoarea de bază.

---

## 8. TABELE

GXON folosește `.table` Bootstrap standard (`th{font-weight:500}`, fără uppercase by default). V2 a construit un stil propriu (header 10px uppercase gri pe fundal distinct) — nu e o replică GXON dar arată modern; e o alegere de design validă, nu neapărat o "greșeală".

### Acțiune necesară
- Padding 11-13px/16px vs GXON 10px/15px — diferență neglijabilă.
- **Lipsește `.table-row-rounded`** (colțuri rotunjite pe rânduri) dacă se dorește paritate completă.
- **Duplicare masivă de cod**: `.catalog-table`, `.technical-table`, `.document-table`, `.combination-table`, `.equipment-table` repetă aproape aceeași structură de 5+ ori. Recomandare tehnică: consolidează într-o clasă `.gx-table` reutilizabilă.

---

## 9. FORMULARE / INPUT-URI

### GXON
```
border-radius: 8px (input-border-radius-sm)
focus: 0 .1rem .3rem 0 rgba(primary,.2), 0 0 0 1px var(--bs-primary)   ← shadow jos + bordură solidă 1px
Checkbox/radio: custom complet restilizate, 1.5em, colț rotunjit, SVG checkmark alb pe fundal primary
Form-switch: 2.8em lățime, thumb cu shadow
```

### dashboard-v2
```
border-radius:8px  ✓ identic
focus: 0 0 0 3px rgb(primary/10%)   ← doar glow simplu, diferă de formula GXON
Checkbox: native browser + doar accent-color:primary — vizual complet diferit de GXON
Form-switch: NU EXISTĂ deloc
```

### Acțiune necesară
- **Focus shadow**: schimbă la `0 2px 5px 0 rgba(49,106,255,.2), 0 0 0 1px var(--primary)` pentru match exact.
- **Construiește checkbox/radio custom** (1.5em, radius, checkmark SVG alb pe primary) — diferență vizuală mare față de checkbox-urile native actuale.
- **Construiește form-switch (toggle) custom** — lipsește complet, dacă e nevoie undeva în UI.
- Peste 15 blocuri CSS aproape identice pentru input-uri (`.worksheet-general input`, `.catalog-form input`, etc.) — consolidare recomandată într-o clasă `.gx-input`.

---

## 10. BADGE / TAG / AVATAR

### GXON
```
.badge { height:26px; padding:5px 10px; border-radius: var(--bs-border-radius) = 6px (NU pill by default!) }
.badge-sm/-lg variante
.avatar { 50×50, border-radius:6px (colț rotunjit, NU cerc by default) }, variante xxs-xxl
.avatar-group { suprapunere -10px margin }
avatar-status: punct colorat status, 12px, colț dreapta-jos
```

### dashboard-v2
```
.badge { border-radius:999px (PILL by default — abatere de la GXON) }
.user-avatar { 38px; border-radius:50% (cerc complet, GXON default e colț rotunjit) }
```
Notă: `.entity-card-pill` (Catalogue PAC, Sociétés émettrices) e deja corect la 6px — modelul de urmat pentru `.badge` generic.

### Acțiune necesară
- **`.badge` nu ar trebui să fie implicit pill** — schimbă la `border-radius:6px`, rezervă `999px` doar pentru elemente explicit "pill" (`.worksheet-status`, `.status-dot`, deja corecte).
- Sistemul `.avatar` complet (xxs-xxl, avatar-group, avatar-status) **lipsește** — v2 are doar un caz hardcodat (`.user-avatar`) în header, nu un sistem reutilizabil.
- `avatar-status` (punct de status pe avatar) — inexistent.

---

## 11. MODAL / DIALOG

Există deja un sistem construit (`GxonModal.tsx` + `.gx-modal-*`), structural solid, dar:

### Acțiune necesară
1. **Culoarea backdrop e complet diferită**: GXON `rgba(166,173,191,0.6)` (gri-albăstrui deschis) vs v2 `rgb(12 36 60 / 45%)` (bleumarin foarte închis) + v2 adaugă `backdrop-filter:blur(2px)` (inexistent în GXON). **Schimbă la `rgba(166,173,191,.6)`**, elimină sau păstrează blur ca decizie deliberată. — verificat, încă neaplicat.
2. Border-radius modal: 14px → **10px** (echivalent `--bs-border-radius-lg` GXON).
3. Animația de intrare GXON are 3 etape (translateY -35px→0 la 50%, scale .95 constant, apoi scale 1 la 100%) vs 2 etape simple în v2 — diferență subtilă, opțională de aliniat.
4. **Inconsistență de implementare**: coexistă `GxonModal.tsx` (div+backdrop custom) ȘI `<dialog>` HTML nativ (la `technical-delete-dialog`) — recomandă unificare pe un singur pattern.

---

## 12. DROPDOWN / POPOVER / TOOLTIP

### Acțiune necesară
- **Tooltip-uri: 0% acoperire** — nicio clasă `.tooltip*` în tot globals.css. GXON are sistem complet cu variante colorate. **De construit de la zero** dacă e nevoie de hover-hints.
- `.gx-dropdown-menu` e cel mai apropiat element de GXON (radius 8 vs 6px teoretic, shadow aproape identic) — bine implementat.
- Shadow-urile de dropdown/popover nu urmează formula GXON (`rgba(45,42,60,X%)`) — v2 consecvent `rgb(12 36 60/X%)`. Aliniază global.
- Popover-urile custom (~10 clase aproape identice: `.catalog-form`, `.edit-popover`, `.technical-popover-form`, `.pac-quick-form`, `.tag-form`...) — fără header distinct (`--bs-light` bg) ca în GXON. Consolidare recomandată într-o clasă `.gx-popover`.

---

## 13. NOTIFICĂRI / TOAST / ALERT

### Acțiune necesară
- **Toast (notificare temporară): lipsește complet.** De construit de la zero dacă e nevoie de feedback tip „Salvat cu succes” — fixed positioning, auto-dismiss, `background:rgba(surface,.9)`, shadow lg, font-size 13px.
- Alert are doar 2 variante (`danger`, `success`) — lipsesc `warning`, `info`, `primary`.
- Padding alert: `10px 12px` → `12px 15px` (GXON).

---

## 14. TEMĂ DARK

Implementare solidă, valorile sunt foarte apropiate de GXON. Ajustări fine:
- `--background` (dark): `#22253b` → **`#26283e`** (v2 e prea închis).
- `--border` (dark): `#3a3d56` → `#3a3b4d` (diferență minoră).
- **Lipsesc `-bg-subtle-dark` sistematizate** — nuanțe "subtle" în dark mode sunt hardcodate ad-hoc, diferite de la o componentă la alta (`#38232b`, `#4a2832`, `#173c35`, `#3c2f1d`...). Recomandare: centralizează `--danger-subtle-dark`, `--success-subtle-dark`, etc.

---

# REZUMAT PRIORITIZAT — TOP 10 SCHIMBĂRI CU IMPACT VIZUAL MAXIM

1. **`--warning: #ff8110` → `#fdbb1f`** — eroare clară, dublează accidental valoarea de secondary; afectează toate badge/alert/status warning din aplicație. *(neaplicat)*
2. **Font-weight butoane: 700 → 500/600** — butoanele arată vizibil mai "grase" decât GXON pe fiecare pagină. *(neaplicat)*
3. **Adaugă variantele de buton `outline`/`subtle`/`action`** — lipsa lor sărăcește vizual UI-ul comparat cu GXON. *(neaplicat)*
4. **Unifică roșul "danger"** — conflictul de duplicare a `.button-danger` e rezolvat; culoarea exactă `#ff401c` (variabilă `--danger`) încă de introdus global.
5. **`.badge` să nu fie implicit pill (999px)** — GXON default e colț rotunjit 6px. *(neaplicat pe `.badge` generic; `.entity-card-pill` deja corect)*
6. **Backdrop modal**: `rgba(166,173,191,.6)` în loc de `rgb(12 36 60/45%)` — schimbă complet senzația la deschiderea oricărui modal. *(neaplicat)*
7. **Card generic**: radius 12→10px, padding 22→20px, title 18→16px, decide bordura `.card-header`. *(neaplicat; `.entity-card` deja corect)*
8. **Unifică shadow-urile de overlay** (dropdown/popover/modal) pe formula GXON `rgba(45,42,60,X%)`. *(neaplicat)*
9. **Tooltip (0% acoperire) + Toast (inexistent)** — funcționalități complet lipsă față de GXON. *(neaplicat)*
10. **Checkbox/radio/switch custom** — în prezent elemente native cu doar `accent-color`. *(neaplicat)*

**Deja aplicate din runda de implementare curentă**: micro-interacția scale hover/press pe butoane, `.button-ghost:hover`, unificarea `.button-danger`, redesign complet `.entity-card` (Catalogue PAC + Sociétés émettrices).

---

## Notă tehnică suplimentară
`globals.css` conține duplicare mare de cod — formulare, popover-uri, tabele repetate aproape identic în 8-10 variante cu nume diferite (`.catalog-form`/`.edit-popover`/`.technical-popover-form`/`.pac-quick-form`/`.tag-form`). O consolidare într-un set mic de clase utilitare reutilizabile (`.gx-input`, `.gx-table`, `.gx-popover`, `.gx-card`) ar reduce mult riscul de inconsistență pe măsură ce se fac alinierile de mai sus — altfel fiecare schimbare de valoare trebuie repetată manual în zeci de locuri. (În sesiunea curentă s-au eliminat deja ~100 de linii de CSS mort/duplicat din zona cardurilor PAC/émetteurs — același tipar de acumulare probabil există și în alte zone ale fișierului.)
