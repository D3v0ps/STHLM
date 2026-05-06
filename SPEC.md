# SPEC – Stockholms Moské Festival 2026

Detta är **single source of truth** för projektet. Alla agenter ska läsa denna fil innan de börjar bygga sina filer. Ändras något här ska det reflekteras i koden.

---

## 1. Projektöversikt

Bygg en publik landningssida + adminpanel för **Stockholms Moské Festival** (bazaar, öppet hus & familjeaktiviteter).

**Hybrid-arkitektur:**

- **Publik sida:** Vanilla HTML/CSS/JS, deployad via SFTP till One.com (subkatalog under `stockholmsmoske.se`).
- **Adminpanel:** Apps Script HtmlService – körs på Google, undviker CORS, säkrare än JWT-i-localStorage på statisk host.
- **Backend:** Google Apps Script Web App.
- **Databas/CMS:** Google Sheets (innehåll redigerbart både via admin-UI och direkt i arket).

Inga build-steg, ingen Node, inga frameworks. Allt vanilla.

---

## 2. URL-struktur

| URL | Innehåll |
|---|---|
| `https://stockholmsmoske.se/bajram-basar/` | Publik landningssida + bazaar-formulär |
| `https://stockholmsmoske.se/bajram-admin/` | Statisk admin-launcher (länkar till Apps Script) |
| `https://script.google.com/macros/s/.../exec` | Apps Script Web App (backend) |
| `https://script.google.com/macros/s/.../exec?view=admin` | Riktig adminpanel (HtmlService) |
| `https://stockholmsmoske.se/bajram-fotboll/` | Framtida (placeholder) |
| `https://stockholmsmoske.se/bajram-basket-3vs3/` | Framtida (placeholder) |

---

## 3. Filträd (slutleverans)

```
/
├── README.md                              # Huvuddokumentation – sätta upp hela systemet
├── TODO.md                                # Öppna punkter för Yasser/Karim/Pamass
├── SPEC.md                                # Denna fil
├── bajram-basar/                          # Publika sidan (SFTP → One.com)
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   ├── config.js                          # APP_CONFIG.appsScriptUrl placeholder
│   ├── README.md                          # Hur man laddar upp via SFTP
│   └── assets/
│       └── .gitkeep                       # Mapp för logo, hero, pattern (tomma initialt)
├── bajram-admin/                          # Admin-launcher (SFTP → One.com)
│   ├── index.html                         # Knapp/redirect till Apps Script-admin
│   ├── admin-launcher.css
│   ├── config.js                          # ADMIN_WEB_APP_URL placeholder
│   └── README.md
└── google-apps-script/                    # Apps Script-projektets källkod (versionshanterad)
    ├── Code.gs                            # All backendlogik
    ├── Admin.html                         # Adminpanelens HTML-stomme
    ├── AdminCSS.html                      # Adminpanelens CSS (inkluderas via include)
    ├── AdminJS.html                       # Adminpanelens JS (google.script.run-anrop)
    └── README.md                          # Hur man deployar Apps Script
```

---

## 4. Designtokens

### Färger (CSS custom properties)

```css
:root {
  /* Navy / royal blue – primärfärg */
  --sm-blue-900: #0f1e4a;   /* djupast – text, footer */
  --sm-blue-800: #172554;
  --sm-blue-700: #1e3a8a;   /* primär bakgrundston, hero */
  --sm-blue-600: #1d4ed8;   /* CTA-knappar, accent */
  --sm-blue-500: #3b82f6;
  --sm-blue-50:  #eff6ff;   /* hover-bakgrunder */

  /* Innehållssektioner */
  --sm-cream: #faf7f2;      /* off-white, varm */
  --sm-white: #ffffff;
  --sm-text: #0f1e4a;
  --sm-text-muted: #475569;
  --sm-border: #e2e8f0;

  /* Accenter (sparsamt) */
  --sm-brass: #c9a961;      /* mässing/guld */
  --sm-success: #16a34a;
  --sm-error: #dc2626;
  --sm-warning: #d97706;

  /* Layout */
  --sm-radius-sm: 8px;
  --sm-radius-md: 12px;
  --sm-radius-lg: 20px;
  --sm-shadow-sm: 0 1px 2px rgba(15,30,74,0.06);
  --sm-shadow-md: 0 4px 12px rgba(15,30,74,0.08);
  --sm-shadow-lg: 0 12px 32px rgba(15,30,74,0.12);

  /* Typografi */
  --sm-font-display: 'Fraunces', Georgia, 'Times New Roman', serif;
  --sm-font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
}
```

### Typografi

- **Display (rubriker):** `Fraunces` från Google Fonts, `wght 400..700`, `opsz 9..144`. Används för hero-rubrik, sektionsrubriker.
- **Body & UI:** `Inter` från Google Fonts, `wght 300..700`. Används för all löpande text och knappar.
- Aldrig blanda fler än två font-familjer.

Google Fonts-länk att inkludera i `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@300..700&display=swap">
```

### Designprinciper – obligatoriska

- ✅ **Värdig, communityorienterad, varm.** Familjevänlig moské-/föreningskänsla.
- ✅ Mobile-first (375px → 768px → 1280px).
- ✅ Generösa luftiga ytor, tydlig typografisk hierarki, varma toner.
- ✅ WCAG AA-kontraster (≥4.5:1 för normal text), tydliga focus-states, semantisk HTML.
- ✅ `prefers-reduced-motion` respekteras (inga onödiga animationer).
- ❌ **Undvik:** generiska gradient-hero, glassmorphism, neon-knappar, "modern landing page"-clichéer, stockfoto-look, AI-genererad känsla.
- ❌ Aldrig: emoji som dekorelement, "wow"-animationer, scroll-jacking.

---

## 5. Datakontrakt

### Google Sheets-flikar

#### `Settings` (Key, Value, Type, Label, Description)

| Key | Default value | Type | Beskrivning |
|---|---|---|---|
| `eventTitle` | `Stockholms Moské Festival` | text | Hero-rubrik |
| `eventSubtitle` | `Bazaar, öppet hus & familjeaktiviteter` | text | Hero-undertitel |
| `eventDate` | `Lördag 13 juni` | text | Datumvisning |
| `eventTime` | `12:00–19:00` | text | Eventets totaltid |
| `bazaarTime` | `13:00–17:00` | text | Bazarens specifika tid |
| `eventLocation` | `Stockholms Moské & Björns trädgård, Medborgarplatsen` | text | Plats |
| `expectedChildren` | `130` | number | Förväntade barn |
| `expectedAdults` | `200` | number | Förväntade vuxna |
| `registrationOpen` | `TRUE` | boolean | Toggle anmälan av/på |
| `showExhibitors` | `TRUE` | boolean | Toggle visa utställarlista |
| `heroButtonText` | `Anmäl intresse till bazaren` | text | Primär CTA-text |
| `introText` | (lång svensk text, se §11) | textarea | Introsektion |
| `whoCanApplyText` | (svensk text, se §11) | textarea | "Vem kan anmäla sig" |
| `selectionText` | (svensk text, se §11) | textarea | "Så görs urvalet" |
| `importantInfoText` | (svensk text, se §11) | textarea | "Viktigt att känna till" |
| `successMessage` | `Tack! Din intresseanmälan har skickats. Vi återkommer efter att urvalet har gåtts igenom.` | text | Efter formulär |
| `closedMessage` | `Anmälan är stängd. Utställare publiceras här när programmet är klart.` | text | När formulär avstängt |

#### `FormQuestions` (Order, Field ID, Label, Helper Text, Placeholder, Type, Required, Active, Options)

Tillåtna `Type`: `text`, `email`, `tel`, `textarea`, `checkbox`, `select`.

`Options` används bara för `select` (kommaseparerad lista). `Required` och `Active` är `TRUE`/`FALSE`.

**Default-frågor (8 st):**

| Order | Field ID | Label | Type | Required |
|---|---|---|---|---|
| 1 | `name` | Namn och efternamn / Ime i prezime | text | TRUE |
| 2 | `company` | Företagsnamn, om tillämpligt / Naziv firme, ako postoji | text | FALSE |
| 3 | `email` | Email | email | TRUE |
| 4 | `phone` | Telefon | tel | TRUE |
| 5 | `websiteSocials` | Webbsida och sociala medier | text | FALSE |
| 6 | `offering` | Vad planerar du att sälja eller presentera? / Šta planirate prodavati ili predstavljati? | textarea | TRUE |
| 7 | `standNeeds` | Behov för stånd / Potrebe za štandom | textarea | TRUE |
| 8 | `consentAccepted` | Jag godkänner villkoren och ansvarar för mitt eget stånd. / Saglasan/na sam sa pravilima događaja i preuzimam odgovornost za svoj štand | checkbox | TRUE |

Helper-texter:
- `offering`: `Beskriv så detaljerat som möjligt. / Molimo opišite što detaljnije.`
- `standNeeds`: `Behöver du bord? Behöver du el? Hur mycket plats behöver du? Övriga behov?`
- `websiteSocials` placeholder: `Instagram, TikTok, hemsida eller annan länk`

#### `Submissions` (ID, Timestamp, Status, Name, Company, Email, Phone, Data JSON, Internal Notes)

`Status` ∈ {`new`, `reviewed`, `approved`, `rejected`, `contacted`}. `Data JSON` är hela formulärsvaret som JSON-sträng (alla fältvärden, även de som inte syns i kolumnerna ovan).

#### `Exhibitors` (Order, Name, Company, Description, Category, Instagram, Website, Published)

`Published` ∈ `TRUE`/`FALSE`. Publika sidan visar bara `Published=TRUE`.

#### `SocialLinks` (Order, Platform, Label, URL, Active)

Default-rader:

| Order | Platform | Label | URL | Active |
|---|---|---|---|---|
| 1 | Instagram | Instagram | https://instagram.com/stockholmsmoske | TRUE |
| 2 | TikTok | TikTok | (tom) | TRUE |
| 3 | Facebook | Facebook | https://facebook.com/sthlmsmoske | TRUE |
| 4 | YouTube | YouTube | https://youtube.com/c/StockholmsMoskéIF | TRUE |
| 5 | Hemsida | Hemsida | https://stockholmsmoske.se | TRUE |

#### `SportsPages` (Slug, Title, Description, Active, Registration Open)

| Slug | Title | Description | Active | Registration Open |
|---|---|---|---|---|
| `bajram-fotboll` | Anmälan till fotboll | Mer information kommer snart. | FALSE | FALSE |
| `bajram-basket-3vs3` | Anmälan till basket 3 mot 3 | Mer information kommer snart. | FALSE | FALSE |

#### `AdminLogs` (Timestamp, Action, Details, Session ID)

Skriv-only audit log. Alla skriv-operationer i admin loggas hit.

---

## 6. API-endpoints

### Publika (JSONP via Apps Script doGet)

```
GET {appsScriptUrl}?action=publicData&callback=jsonp_xxx
→ JSONP wrap kring:
  {
    ok: true,
    data: {
      settings: { eventTitle, eventDate, ... },
      questions: [ { order, fieldId, label, ... } ],
      exhibitors: [ { order, name, ... published=TRUE only } ],
      socialLinks: [ { order, platform, label, url, ... active=TRUE only } ],
      sportsPages: [ { slug, title, ... } ]
    }
  }
```

### Publik POST (formulärinlämning)

Skickas till Apps Script `doPost` med `Content-Type: text/plain;charset=utf-8` (undviker CORS-preflight). Vid no-cors fallback kan svaret inte läsas — visa optimistiskt tackmeddelande.

```
POST {appsScriptUrl}
Body (JSON-string):
{
  action: "submit",
  formType: "bazaar",
  submittedAt: "2026-05-06T20:30:00.000Z",
  data: {
    name: string,
    company: string|null,
    email: string,
    phone: string,
    websiteSocials: string|null,
    offering: string,
    standNeeds: string,
    consentAccepted: true,
    kontakttid: ""             // honeypot, MUST be empty
  }
}

Response (cors-mode): { ok: true, data: { id: "..." } }
```

### Admin (google.script.run – kallas från Admin.html)

Alla funktioner kräver giltig `token` som första/andra argument (utom `loginAdmin` och `setupSpreadsheet`/`setupAdminPassword` som körs manuellt).

```
loginAdmin(password)                                      → { ok, token, expiresAt }
logoutAdmin(token)                                        → { ok }
validateSession(token)                                    → { ok, valid: boolean }
getAdminData(token)                                       → { settings, questions, submissions, exhibitors, socialLinks, sportsPages }
getOverview(token)                                        → { newSubmissionsCount, totalSubmissions, publishedExhibitorsCount, registrationOpen, lastSubmissionAt }
saveSettings(token, settingsObject)                       → { ok }
saveFormQuestions(token, questionsArray)                  → { ok }
saveExhibitors(token, exhibitorsArray)                    → { ok }
saveSocialLinks(token, socialLinksArray)                  → { ok }
saveSportsPages(token, sportsPagesArray)                  → { ok }
getSubmissions(token, filter?)                            → submissionsArray
updateSubmissionStatus(token, submissionId, status, notes) → { ok }
createExhibitorFromSubmission(token, submissionId, additionalData) → { ok, exhibitorId }
deleteExhibitor(token, exhibitorId)                       → { ok }
exportSubmissionsCsv(token)                               → csvString
setupSpreadsheet()                                        → { ok }   // körs manuellt en gång
setupAdminPassword(password)                              → { ok }   // körs manuellt en gång
logAdminAction(action, details, token)                    → { ok }   // intern hjälpare
```

---

## 7. Säkerhet

- **Adminlösenord** lagras som SHA-256-hash + 32-byte salt i Apps Script Script Properties:
  - `ADMIN_PASSWORD_HASH`
  - `ADMIN_PASSWORD_SALT`
  - `SPREADSHEET_ID` (om scriptet inte är bundet)
- **Hashing:** `SHA-256(salt + password)` via `Utilities.computeDigest(SHA_256, salt+password, UTF_8)`.
- **Sessions:** Slumpmässig token (32 bytes hex) lagras i `CacheService.getScriptCache()` med 6h TTL. Token sparas i `sessionStorage` på klienten – aldrig `localStorage`.
- **Constant-time jämförelse** för password-hash (undvik timing-attacker).
- **Rate-limiting login:** Max 5 försök per fingerprint per 15 min via CacheService.
- **Audit log:** Alla skriv-operationer loggas i `AdminLogs`-fliken (timestamp, action, details, sessionId).
- **Publika formuläret:**
  - Honeypot-fält `kontakttid` (dolt med CSS, om ifyllt → silent reject server-side).
  - Rate-limit via `localStorage.lastSubmit` – 60s cooldown på klienten.
  - Server-side även minimal validering (required-fält + e-post-format).
- **Adminpanelen:**
  - Serveras via `HtmlService` från Apps Script (samma origin → ingen CORS).
  - Använder `google.script.run` (inte fetch).
  - Token aldrig i URL.

---

## 8. Validering

### Klient-side (script.js)

- `email`: HTML5 `type="email"` + regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- `phone`: regex `/^(\+46|0)[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d{2,5}$/` (svenskt format, +46 eller 0-prefix)
- Required-fält enligt `FormQuestions.Required`
- `offering` minst 30 tecken (om aktiv)
- Visa fel-meddelanden på svenska under respektive fält (röd text + `aria-describedby`)
- Disable submit-knapp under request, re-enable vid fel
- Honeypot `kontakttid`: om ifyllt → tyst silent fail (visa tack-meddelande som vanligt)

### Server-side (Code.gs)

- Verifiera required-fält enligt aktuella `FormQuestions`
- Verifiera e-post-format
- Honeypot-check: `kontakttid !== ""` → silent reject (returnera ok men logga som spam)
- Rate-limit per IP (om tillgängligt) via CacheService

---

## 9. Innehåll på publika sidan

Sidan har följande sektioner i denna ordning:

1. **Hero** (mörkblå bakgrund, vit display-rubrik):
   - Liten överrubrik: `Islamiska Förbundet · Stockholms Moské`
   - Stor display-rubrik (Fraunces, ca 64–96px desktop): `eventTitle`
   - Undertitel: `eventSubtitle`
   - Datum/tid-band: `eventDate · eventTime`
   - Plats: `eventLocation`
   - Primär CTA: `heroButtonText` → ankarlänk `#anmal` (formuläret)
   - Sekundär CTA: `Läs mer om eventet` → ankarlänk `#info`

2. **Intro** (`#info`, cream-bakgrund): `introText`.

3. **Info-kort** (3 kort i grid, eller inline-cards):
   - Datum, Tid, Plats
   - Förväntade besökare: `expectedChildren` barn + `expectedAdults` vuxna
   - Deltagande: `Gratis – bindande anmälan`

4. **Vem kan anmäla sig?** (`#vem`): `whoCanApplyText`

5. **Så görs urvalet** (`#urval`): `selectionText`

6. **Viktigt att känna till** (`#viktigt`): `importantInfoText`

7. **Anmälningsformulär** (`#anmal`) – om `registrationOpen=TRUE`:
   - Bygg formulär dynamiskt från `questions`
   - Honeypot-fält dolt: `<input type="text" name="kontakttid" tabindex="-1" autocomplete="off" aria-hidden="true">` med CSS `position:absolute; left:-9999px; opacity:0`
   - Submit-knapp: `Skicka intresseanmälan`
   - Efter lyckad submit: visa `successMessage`, dölj formuläret

8. **Utställarlista** (`#utstallare`) – om `registrationOpen=FALSE`:
   - Visa `closedMessage`
   - Lista publicerade utställare som kort (namn, beskrivning, kategori, IG/web-länkar)
   - Om `exhibitors.length === 0`: `Utställare publiceras här när programmet är klart.`

9. **Kontakt + Footer**:
   - `Frågor? info@stockholmsmoske.se · 08-509 109 00`
   - Logotyp + sociala medier
   - Länk: `← Tillbaka till stockholmsmoske.se`

10. **Floating "Följ oss"-knapp** (nere till höger):
    - Klick öppnar linktree-popup med `socialLinks` (active=TRUE)
    - Stängs med ESC, X-knapp, eller klick utanför
    - Använd `<dialog>`-element för accessibility
    - sessionStorage så popupen inte auto-öppnar igen efter manuell stängning

### Default-texter (svenska)

**`introText` (default):**
```
Föreningen arrangerar en festival med bazaar, öppet hus och familjeaktiviteter på Stockholms Moské och Björns trädgård vid Medborgarplatsen. Vi bjuder in företagare, kreativa personer och föreningar som vill sälja eller presentera produkter och tjänster vid ett stånd att anmäla sig.
```

**`whoCanApplyText` (default):**
```
Bazaren är öppen för företagare, kreatörer, föreningar och personer som vill sälja eller presentera produkter och tjänster som passar familjer och besökare. Anmälan är gratis – vi vill bara veta vad du planerar att erbjuda och vilket stånd du behöver.
```

**`selectionText` (default):**
```
Urvalet kommer att göras baserat på hur relevant ditt erbjudande är för besökarna samt hur genomförbart det är. Ju mer information du lämnar om vad du planerar att sälja eller presentera, desto enklare blir bedömningen. Vi hör av oss efter att urvalsprocessen är klar.
```

**`importantInfoText` (default):**
```
• Att delta är gratis.
• Anmälan är bindande – vid sen avanmälan kan en avgift debiteras.
• Varje deltagare ansvarar för sin egen plats.
• Varje deltagare ansvarar för städning efter avslutat evenemang.
• Bazaren är öppen mellan kl. 13:00–17:00; festivalen pågår 12:00–19:00.
```

> **Notera:** Texten om "10 % av försäljning" som fanns i tidigare underlag ska INTE visas på publika sidan – det är inte bekräftat och kan förvirra anmälare.

---

## 10. Adminpanelens flikar

1. **Översikt** – statuskort, öppna/stäng formulär-toggle, snabblänkar
2. **Eventinformation** – alla Settings-fält i tydliga textareas/inputs
3. **Formulärfrågor** – CRUD på FormQuestions (drag-and-drop sortering, type-dropdown, toggles)
4. **Anmälningar** – tabell + detaljvy + status-knappar + skapa-utställare-flöde + CSV-export
5. **Utställare** – CRUD på Exhibitors (publicera/avpublicera, ordna)
6. **Sociala medier** – CRUD på SocialLinks
7. **Fotboll & basket** – CRUD på SportsPages (enklare)

UX-krav (idiotsäker checklist):
- Stora knappar, mycket luft, ingen tät tabelldesign
- Färgkodning: grön=aktiv/öppen, grå=avstängt, röd=destruktivt
- Bekräftelseruta innan destruktiv handling (toggle stäng anmälan, neka anmälan, radera utställare)
- Toast: `✓ Sparat – live om ~1 min`
- Tydligt felmeddelande på svenska
- "Senast ändrad"-tidsstämpel synlig
- Inga tekniska termer i UI:t (inte "API", "JWT", "JSON")
- Mobilvänlig (admins ska kunna godkänna utställare från telefon)
- Manuell `Spara`-knapp per sektion (ingen auto-save – icke-tekniska användare ska känna kontroll)
- Varning vid osparade ändringar innan navigering bort

---

## 11. Acceptanskriterier (klar när ALLT nedan stämmer)

**Funktionalitet:**
- [ ] `bajram-basar/` renderar korrekt på 375px, 768px, 1280px
- [ ] Formuläret bygger sig dynamiskt från FormQuestions
- [ ] Klient-side validering (required, email, phone, min-length) med felmeddelanden på svenska
- [ ] Honeypot-fält finns och döljs korrekt (CSS + `aria-hidden`)
- [ ] Rate-limit 60s via localStorage fungerar
- [ ] Submit POST:ar JSON med `text/plain;charset=utf-8`
- [ ] Vid `registrationOpen=FALSE` visas utställarlista istället för formulär
- [ ] Linktree-popup öppnas/stängs (ESC, X, klick utanför)
- [ ] Fallback-data i `config.js` används om Apps Script är otillgängligt
- [ ] Adminpanel: login fungerar, fel lösenord visar tydligt fel
- [ ] Admin kan ändra Settings, frågor, utställare, sociala länkar – ändringar reflekteras på publika sidan inom ~1 min
- [ ] Admin kan se anmälningar, ändra status, skapa utställare från godkänd anmälan
- [ ] CSV-export fungerar
- [ ] Audit log skrivs vid alla skriv-operationer

**Kvalitet:**
- [ ] Lighthouse: Performance > 90, Accessibility > 95 på mobil
- [ ] Inga console errors
- [ ] WCAG AA-kontraster verifierade
- [ ] Tab-ordning logisk på alla formulär
- [ ] `prefers-reduced-motion` respekteras

**Säkerhet:**
- [ ] Adminlösenord aldrig i frontend-koden
- [ ] Token endast i sessionStorage (inte localStorage)
- [ ] Alla admin-funktioner kräver giltig token server-side
- [ ] Honeypot fungerar och loggas som spam
- [ ] Rate-limit på login (5/15min)

**Dokumentation:**
- [ ] Huvud-README dokumenterar hela setup-flödet
- [ ] `bajram-basar/README.md` dokumenterar SFTP-deploy
- [ ] `google-apps-script/README.md` dokumenterar Apps Script-deploy
- [ ] TODO.md listar öppna punkter

---

## 12. Öppna beslutspunkter (för Yasser/Karim/Pamass)

| Fält | Underlag-text | Flyer-text | Status |
|---|---|---|---|
| Eventnamn | Bajramfirande | Festival / Bazaar | ✋ Använd `Festival` som default i Settings |
| Datum | Sön 31 maj | Lör 13 juni | ✋ Använd `Lördag 13 juni` som default |
| Tid | 13:00–17:00 | 12:00–19:00 | ✋ Använd `12:00–19:00` (event), `13:00–17:00` (bazar) |
| Plats | Stockholms Moské | Stockholms Moské + Björns trädgård | ✋ Använd kombinerade |
| Bazaar-pris | Fast / 10 % | – | ✋ Visa INGET pris förrän Yasser bestämt |

Allt detta ska vara **trivialt att ändra i Settings-fliken** – ingen kodändring krävs.

---

## 13. Kommandon för agenter

Varje agent ska:

1. Läsa hela denna SPEC.md innan kod skrivs.
2. Skriva sina filer med `Write`-verktyget (skapar mappar automatiskt).
3. **Inte** röra filer utanför sitt ansvarsområde.
4. **Inte** committa eller pusha (det gör orchestern efter att alla är klara).
5. Hålla språket svenskt i UI och kommentarer (inte engelska kommentarer i Settings-labels osv).
6. Använda placeholders för Apps Script Web App-URL: `PASTE_APPS_SCRIPT_URL_HERE` i config-filer.
7. Aldrig hårdkoda hemligheter (lösenord, salt) – de bor bara i Apps Script Script Properties.
8. Skriva korta, läsbara JSDoc-kommentarer där icke-trivial logik finns – men inte överkommentera.
