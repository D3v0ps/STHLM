# bajram-admin/ – Adminpanel (static SPA)

En fullständig adminpanel som körs som static SPA på One.com och pratar med
Apps Script Web App via fetch POST. Inga build-steg, inga frameworks.

URL: https://stockholmsmoske.karimkhalil.se/bajram-admin/

## Filer

- `index.html` – login-vy + dashboard-vy med 7 flikar
- `admin.css` – all styling
- `admin.js` – state, fetch-wrapper, login/logout, tab-rendering, CRUD
- `config.js` – pekar på Apps Script Web App-URL

## Flikar

- **Översikt** – status-kort, snabbväxla anmälan av/på
- **Eventinformation** – datum, tid, plats, texter
- **Formulärfrågor** – CRUD med drag-and-drop sortering
- **Anmälningar** – lista, filter, godkänn/neka, skapa utställare, CSV-export
- **Utställare** – publicera/avpublicera utställare
- **Sociala medier** – länkar i pop-upen
- **Fotboll & basket** – sport-sidor (placeholder tills Pamass har info)

## Säkerhet

- Inga lösenord eller tokens i koden.
- Adminlösenordet sätts via `setupAdminPassword()` i Apps Script Script Properties
  (hashat med SHA-256 + 32-byte salt).
- Vid login skapar Apps Script en token i `CacheService` (TTL 6h, sliding).
  Token sparas i `sessionStorage` på klienten — försvinner när fliken stängs.
- Alla skriv-operationer loggas i `AdminLogs`-fliken i Sheetet.
- Login har rate-limit: 5 misslyckade försök per 15 min.

## Hur klienten pratar med backend

```
fetch(adminWebAppUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify({ adminAction: 'saveSettings', args: [token, settings] })
})
```

`text/plain` Content-Type undviker CORS-preflight som Apps Script inte hanterar
väl. Apps Script `doPost` parsar bodyn som JSON, läser `adminAction` och
dispatchar till motsvarande server-funktion via `adminDispatch_` i `Code.gs`.

## Konfigurera

1. Publicera Apps Script-projektet som Web App (se `/google-apps-script/README.md`).
2. Kopiera Web App-URL:en (utan `?view=admin`-suffix).
3. Öppna `config.js` och klistra in URL:en i `adminWebAppUrl`.

## Ladda upp via SFTP

Sker automatiskt via GitHub Actions-workflow `.github/workflows/deploy.yml` vid
push till `main`. Manuell deploy: kör workflow:n via `Run workflow` i Actions-fliken.
