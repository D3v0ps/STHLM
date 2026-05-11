# Stockholms Moské Festival 2026

Publik landningssida + adminpanel för Stockholms Moskés sommarfestival (bazaar, öppet hus, familjeaktiviteter).

**Live-URL:er** (efter deploy):

- 🌐 Publik: `https://stockholmsmoske.se/festival/`
- 🔒 Admin: `https://stockholmsmoske.se/festival-admin/` → leder till Apps Script

## Översikt

- **Publik sida** är vanilla HTML/CSS/JS. Inga build-steg. Laddas upp via SFTP till One.com.
- **Adminpanel** är en static SPA (vanilla HTML/CSS/JS) på One.com. Pratar med Apps Script via `fetch` POST med `Content-Type: text/plain` (för att undvika CORS-preflight).
- **Backend** är Apps Script Web App. `doPost` dispatchar admin-actions via `adminDispatch_` i `Code.gs`.
- **Databas/CMS** är Google Sheets — admin redigerar antingen via panelen eller direkt i arket.

```
Browser ──HTTP──▶ One.com (statiska filer)
                       │
                       │  JSONP (publik läs) / fetch POST (publik submit + admin)
                       ▼
              Google Apps Script Web App
                  (doGet + doPost)
                       │
                       ▼
                 Google Sheets
```

## Mappstruktur

```
.
├── SPEC.md                         # Datakontrakt + designtokens (single source of truth)
├── README.md                       # Denna fil
├── TODO.md                         # Öppna punkter
├── festival/                   # Publik sida → SFTP till One.com
├── festival-admin/                   # Adminpanel (static SPA) → SFTP till One.com
└── google-apps-script/             # Backend-källkod, kopieras manuellt till Apps Script-editorn
```

Varje undermapp har egen README med deploy-instruktioner.

## Komma igång (första gången)

> Detta är en engångs-setup. Räkna med 30–60 minuter. Behöver: ett Google-konto, SFTP-klient, en text-editor.

### Steg 1: Skapa Google Sheet + Apps Script

Följ instruktionerna i `google-apps-script/README.md` steg 1–5. Det innefattar:

1. Skapa Sheet
2. Skapa Apps Script-projektet (bundet till Sheetet)
3. Klistra in Code.gs, Admin.html, AdminCSS.html, AdminJS.html
4. Kör `setupSpreadsheet()` — skapar alla flikar med default-data
5. Kör `setupAdminPassword('långt-slumpat-lösenord')` — sätter admin-credentials i Script Properties
6. Publicera som Web App, kopiera URL:en

### Steg 2: Konfigurera frontend

1. Öppna `festival/config.js` — byt `PASTE_APPS_SCRIPT_URL_HERE` mot Web App-URL:en.
2. Öppna `festival-admin/config.js` — byt `PASTE_ADMIN_WEB_APP_URL_HERE` mot samma URL (lägg till `?view=admin` på slutet).

### Steg 3: Ladda upp till One.com via SFTP

> SFTP-credentials förvaras i GitHub Secrets eller en lösenordshanterare — ALDRIG i denna kod.

#### Auto-deploy via GitHub Actions (rekommenderas)

Workflow-filen `.github/workflows/deploy.yml` mirrorar `festival/` och `festival-admin/` till One.com via SFTP. Triggers:

- **Automatiskt:** push till `main` som rör `festival/`, `festival-admin/` eller workflow-filen.
- **Manuellt:** GitHub → fliken `Actions` → `Deploy to One.com` → `Run workflow`.

**Engångsuppsättning — lägg till fyra repository secrets:**

GitHub → repo → `Settings` → `Secrets and variables` → `Actions` → `New repository secret`.

| Secret | Värde | Var hittar jag det? |
|---|---|---|
| `SFTP_HOST` | One.coms SSH-server, oftast `ssh.<account-id>.service.one` | One.com kontrollpanel → `Filhantering` → `SFTP/SSH` |
| `SFTP_USER` | SFTP-användarnamn (oftast samma som inloggningen) | Samma vy som ovan |
| `SFTP_PASSWORD` | SFTP-lösenord | Samma vy som ovan (`Visa/skapa lösenord`) |
| `SFTP_WEBROOT` | Sökväg till webroot på servern, t.ex. `/httpd.www` eller `/<din-domän>` — UTAN trailing slash | Samma vy. One.coms standard är `/httpd.www`. |

Workflow:n exkluderar `README.md`, `.gitkeep` och `.DS_Store`. Den använder `--delete`, så filer i `<webroot>/festival/` och `<webroot>/festival-admin/` som inte finns i repot raderas vid deploy.

#### Manuell SFTP (fallback)

Om Actions inte är konfigurerat eller du behöver deploya direkt:

```bash
rsync -avz --delete --exclude README.md --exclude .gitkeep \
  festival/ <user>@<host>:<webroot>/festival/
rsync -avz --delete --exclude README.md --exclude .gitkeep \
  festival-admin/ <user>@<host>:<webroot>/festival-admin/
```

Eller använd valfri SFTP-klient (Cyberduck, FileZilla, Transmit).

### Steg 4: Smoke-test

1. Öppna `https://stockholmsmoske.se/festival/` — ska visa hero, intro, info-kort, formulär.
2. Skicka en testanmälan. Kontrollera att raden hamnar i Sheetets `Submissions`-flik.
3. Öppna `https://stockholmsmoske.se/festival-admin/` → klicka `Öppna adminpanelen` → logga in.
4. Gå till `Översikt` — antalsiffror ska matcha Sheetet.
5. Ändra något i `Eventinformation`, spara, vänta 5 min eller hård-refresha publika sidan — ändringen ska synas.

## Vardaglig användning (Yasser/Karim)

### För Yasser (innehållsadmin)

Du ska sällan behöva röra koden. Allt innehåll redigeras via adminpanelen:

1. Öppna `https://stockholmsmoske.se/festival-admin/`
2. Logga in med adminlösenordet (få från Karim).
3. Använd flikarna:
   - **Översikt** — se status, öppna/stänga formulär
   - **Eventinformation** — datum, tid, plats, texter
   - **Formulärfrågor** — lägg till/ta bort/ändra fält
   - **Anmälningar** — godkänn eller neka, skapa utställare från godkänd anmälan
   - **Utställare** — publicera/avpublicera utställare som syns när formuläret är stängt
   - **Sociala medier** — uppdatera länkar i pop-upen
4. Klicka alltid `Spara` när du är klar med en sektion.
5. Logga ut.

> Ändringar tar **upp till 5 minuter** att slå igenom på publika sidan på grund av cache. För omedelbar effekt: öppna sidan i inkognitofönster.

### För Karim (utvecklare)

Du sätter upp systemet och underhåller koden. Se `google-apps-script/README.md` för deploy-detaljer. Vid kodändringar:

1. Pusha till git som vanligt.
2. Om publika sidan ändrats: `rsync` upp till One.com.
3. Om Apps Script ändrats: kopiera in i Apps Script-editorn, klicka `Distribuera` → `Hantera distributioner` → `Ny version` (URL:en ändras INTE — bara om du skapar en ny distribution).

## Säkerhet — vad du behöver veta

- Adminlösenord lagras hashat (SHA-256 + 32-byte salt) i Apps Script Script Properties. Aldrig i frontend-koden.
- Adminsessioner är 6h och bor i Apps Script CacheService. Token sparas i sessionStorage på klienten — försvinner när du stänger fliken.
- Alla skriv-operationer i admin loggas i `AdminLogs`-fliken. Granska regelbundet.
- Publika formuläret har honeypot-fält (botskydd) + 60s rate-limit per browser.
- Login har rate-limit: 5 försök per 15 min.

> **Vid misstänkt obehörig åtkomst:** byt adminlösenord direkt — kör `setupAdminPassword('nytt-lösenord')` i Apps Script. Den gamla token försvinner när cachen rensas (eller manuellt via `CacheService.getScriptCache().remove(...)`).

## Tekniska val — varför hybrid-arkitektur?

- **Vanilla JS på One.com** istället för React/Vite: överlevnadsbart för framtida ägare som inte kan moderna build-pipelines. Inga `npm install`, inga `dist/`-mappar, inga deployment-bekymmer. Bara filer.
- **Static SPA på One.com för admin** med fetch-anrop till Apps Script: hela panelen körs på samma domän som publika sidan, ingen mellansida som öppnar Apps Script i ny flik. Lösenordet hashas server-side i Apps Script — bara hash + salt lagras (i Script Properties). Token bor i `sessionStorage` (försvinner när fliken stängs). Apps Script `doPost` dispatchar `adminAction` via en whitelistad mappning i `adminDispatch_`.
- **Google Sheets som CMS** istället för en riktig databas: föreningens medlemmar kan redigera direkt i arket även när panelen är nere. Audit-trail är gratis (versionshistorik). Backup är gratis (Drive). Ingen DB-server att underhålla.
- **JSONP för publika läsningar** istället för fetch: Apps Script svarar fragmenterat på CORS-preflight; JSONP funkar överallt. Det är gammalt men robust.
- **`Content-Type: text/plain` för POST** istället för `application/json`: undviker CORS-preflight som Apps Script inte hanterar väl.

## Vad som inte är byggt än (se TODO.md)

- Sport-anmälningssidor (fotboll, basket 3v3) — placeholder finns, fyll på när Pamass återkommer.
- OG-bild (1200x630) — saknas i `assets/`. Yasser tar fram baserat på flyern.
- Fast pris för bazaarplats — saknas. Yasser bestämmer; ändras direkt i Settings, ingen kodändring krävs.

## Underhåll på sikt

- Sheetet och Apps Script-projektet ägs av ett konto som flera personer har access till (rekommenderas: skapa ett Google-grupp-konto eller dela explicit med backuppersoner).
- Vid återkommande arrangemang: duplicera Sheetet, koppla nytt Apps Script-projekt, deploya på ny subkatalog (`/festival-2027/`). Gamla året arkiveras.
- Koden ligger i ett git-repo. Branch-strategi: feature-branches → main. Inga long-running PR:er.

## Kontakt

- Tekniska frågor: Karim (utvecklare)
- Innehållsfrågor: Yasser
- Sport: Pamass
- Allmänt: info@stockholmsmoske.se · 08-509 109 00
