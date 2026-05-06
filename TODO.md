# TODO – Stockholms Moské Festival 2026

Öppna punkter att lösa innan launch eller löpande efter launch.

## Innehåll – behöver beslut/leverans

- [ ] **Eventnamn:** Festival vs Bajramfirande – Yasser bekräftar slutgiltigt namn (default i koden: "Stockholms Moské Festival")
- [x] **Datum:** Lördag 30 maj 2026
- [ ] **Tid:** 12:00–19:00 (event) + 13:00–17:00 (bazaar) — Yasser bekräftar
- [ ] **Plats:** "Stockholms Moské & Björns trädgård" — Yasser bekräftar
- [ ] **Bazaar-pris:** Yasser bestämmer fast pris (eller om gratis). Sätts senare i adminpanelen, ingen kodändring.
- [ ] **Reviderad intro-text** för bazaaren från Yasser
- [ ] **Detaljer från Pamass om fotboll** (åldersklasser, format, datum) — innan sidan publiceras
- [ ] **Detaljer från Pamass om basket 3v3** (åldersklasser, format) — innan sidan publiceras
- [ ] **Foton från tidigare event** — för hero/sektioner; alternativt rena bakgrunder
- [ ] **OG-bild 1200x630** — baserad på flyern, sparas i `bajram-basar/assets/og-festival.jpg`
- [ ] **Logotyp** — kvadratisk + horisontell, sparas i `bajram-basar/assets/`
- [ ] **Favicon** — Yasser/Karim väljer (kan vara förenklat moské-monogram)

## Tekniskt – behöver göras före launch

- [x] **Skapa Google Sheet + Apps Script-projekt** (se `google-apps-script/README.md`)
- [x] **Kör `setupSpreadsheet()`** för att initiera flikar
- [x] **Kör `setupAdminPassword('...')`** med långt slumpat lösenord
- [x] **Publicera Apps Script som Web App** (åtkomst: Alla)
- [x] **Klistra in Web App-URL** i `bajram-basar/config.js` och `bajram-admin/config.js`
- [ ] **Beställ subdomän eller subkatalog** på One.com (rekommendation: subkatalog `/bajram-basar/` och `/bajram-admin/`)
- [ ] **Lägg till GitHub Secrets** för SFTP-deploy: `SFTP_HOST`, `SFTP_USER`, `SFTP_PASSWORD`, `SFTP_WEBROOT` (se README §Steg 3)
- [ ] **Första deployen** — pusha till `main` eller kör workflow manuellt (Actions → `Deploy to One.com` → `Run workflow`)
- [ ] **Smoke-test:** skicka testanmälan, godkänn i admin, byt formulär av/på, verifiera utställarvy
- [ ] **Lägg till sajten i Google Search Console** (verifiera via DNS eller HTML-fil)
- [ ] **Lighthouse-audit:** mobil, mål Performance > 90, Accessibility > 95
- [ ] **Verifiera WCAG AA-kontraster** på blå hero (vit text på #1e3a8a ger ratio 8.6:1 — OK)

## Säkerhet & drift

- [ ] **Säkerhetskopiera Sheetet** regelbundet (auto via Drive funkar, men dokumentera)
- [ ] **Dela Apps Script-projektet** med en backup-person (om primär utvecklaren inte är tillgänglig)
- [ ] **Förvara SFTP-credentials** i 1Password / Bitwarden + GitHub Secrets om CI/CD sätts upp
- [ ] **Granska AdminLogs-fliken** veckovis under festival-perioden

## Framtida förbättringar (post-launch)

- [x] **GitHub Actions för auto-deploy via SFTP** — workflow finns i `.github/workflows/deploy.yml`
- [ ] **Sport-sidor:** fotboll och basket 3v3 — bygg när Pamass har info
- [ ] **Multi-event-stöd:** om föreningen vill köra fler tillfällen per år, refaktorera Settings till per-event
- [ ] **Bättre admin-auth:** byt från lösenord till Google OAuth med email-allowlist
- [ ] **Email-bekräftelse på inlämning:** skicka kvitto till anmälaren via Apps Script `MailApp.sendEmail`
- [ ] **Print/PDF-kvitto** för utställare som godkänts
- [ ] **Drag-and-drop sortering** av frågor/utställare i admin (om bara upp/ner-knappar implementerats först)
- [ ] **Bilduppladdning för utställare:** små logotyper i utställarkortet (kräver Drive-integration i Apps Script)

## Beslutspunkter (öppna frågor i SPEC §12)

| Fält | Status |
|---|---|
| Eventnamn | ✋ Väntar på Yasser |
| Datum | ✋ Väntar på Yasser |
| Tid | ✋ Väntar på Yasser |
| Plats | ✋ Väntar på Yasser |
| Bazaar-pris | ✋ Väntar på Yasser |

Allt ovan styrs från Settings-fliken — inga kodändringar krävs när beslutet är fattat.
