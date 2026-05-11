# festival-bazaar/ – Publik landningssida

Statiska filer som laddas upp till One.com via SFTP. Sidan körs på:
https://karimkhalil.se/festival-bazaar/

## Filer i denna mapp

- `index.html` – sidans struktur (statisk fallback-text + hooks för dynamiskt innehåll)
- `styles.css` – all styling (vanilla CSS, inga build-steg)
- `script.js` – laddar innehåll från Apps Script via JSONP, renderar formulär, hanterar submit
- `config.js` – innehåller Apps Script-URL och fallback-data
- `assets/` – logotyp, hero-bild, OG-bild (ladda upp manuellt)

## Konfigurera innan första uppladdning

1. Öppna `config.js`
2. Byt ut `PASTE_APPS_SCRIPT_URL_HERE` mot den riktiga Apps Script Web App-URL:en (du får den efter att du publicerat Apps Script som Web App).

## Ladda upp via SFTP

Använd valfri SFTP-klient (Cyberduck, FileZilla, Transmit) eller kommandorad.

**SFTP-uppgifter:** Förvara dem i en lösenordshanterare eller GitHub Actions Secrets — ALDRIG i denna kod.

Hosta hela mappens innehåll på One.com under sökvägen `/festival-bazaar/` i webroot (eller motsvarande sökväg som ger URL:en `karimkhalil.se/festival-bazaar/`).

**Exempel med rsync över SSH:**

    rsync -avz --delete festival-bazaar/ <user>@<host>:/<webroot>/festival-bazaar/

(Värdena hämtas från lösenordshanteraren/Secrets, inte från koden.)

## Vanliga driftfrågor

- **Innehållet uppdateras inte direkt på sidan.** Sidan cachar publik data i sessionStorage i 5 minuter. Stäng fliken och öppna igen, eller öppna i inkognitofönster, för omedelbar effekt.
- **Formuläret kommer inte fram.** Kolla att `registrationOpen` är `TRUE` i Settings-fliken i Google Sheets, och att Apps Script-URL:en i `config.js` stämmer.
- **Apps Script är nere och sidan ser tom ut.** Det är därför `config.js` har `fallbackData` — uppdatera default-värdena där om de hamnar långt från verkligheten.

## Lokal utveckling

Öppna `index.html` direkt i webbläsaren funkar för stilkontroll, men formulär-submit kräver att Apps Script är deployat. För full lokal test, kör en enkel HTTP-server:

    python3 -m http.server 8080
    # Öppna http://localhost:8080

## Vad som inte ska ändras utan att läsa SPEC.md

- `data-bind="..."`-attributen i `index.html` mappar till nycklar i `Settings`-fliken. Ändras de måste även Apps Script och Sheets uppdateras.
- Honeypot-fältet `kontakttid` i formuläret — döljs av CSS, fyller spam-skydd. Ta inte bort.
- JSONP-callback-mönstret i `script.js` — Apps Script svarar inte korrekt med vanlig fetch på alla browsers/CORS-konfigurationer.
