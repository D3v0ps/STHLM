# bajram-admin/ – Admin-launcher

En liten statisk sida som leder vidare till den riktiga adminpanelen, som körs i Google Apps Script (HtmlService).

URL: https://stockholmsmoske.se/bajram-admin/

## Varför en launcher istället för riktig admin på One.com?

Den riktiga adminpanelen körs i Google Apps Script eftersom:
- Adminlösenord ska aldrig nå frontend-koden på en publik server.
- Apps Script HtmlService undviker CORS-problem helt.
- All session-, login- och behörighetslogik bor server-side hos Google.

Denna launcher har bara en knapp som öppnar Apps Script-panelen i en ny flik.

## Konfigurera innan uppladdning

1. Publicera Apps Script-projektet som Web App (se `/google-apps-script/README.md`).
2. Kopiera Web App-URL:en.
3. Öppna `config.js` i denna mapp.
4. Byt `PASTE_ADMIN_WEB_APP_URL_HERE` mot URL:en. Lägg till `?view=admin` på slutet om det krävs av Apps Script-routern (kolla `Code.gs::doGet`).

## Ladda upp via SFTP

Lägg hela mappens innehåll under `/bajram-admin/` i webroot på One.com.

SFTP-uppgifter förvaras i lösenordshanterare/GitHub Secrets — inte i denna kod.

## Säkerhet

- Denna mapp innehåller inga lösenord, inga tokens, inga hemligheter.
- Adminlösenordet sätts via `setupAdminPassword()` i Apps Script (se `/google-apps-script/README.md`).
- Adminsessioner lever bara i Apps Script CacheService — inte i den här mappen, inte i `localStorage` på publika sidan.
