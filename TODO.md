# TODO – Stockholms Moské Festival 2026

Öppna punkter att lösa innan launch eller löpande efter launch.

## Innehåll – behöver beslut/leverans

- [ ] **Eventnamn:** Festival vs Bajramfirande – Yasser bekräftar slutgiltigt namn (default i koden: "Stockholms Moské Festival")
- [ ] **Datum:** Lör 13 juni vs Sön 31 maj – Yasser bekräftar (default: "Lördag 13 juni")
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

- [ ] **Skapa Google Sheet + Apps Script-projekt** (se `google-apps-script/README.md`)
- [ ] **Kör `setupSpreadsheet()`** för att initiera flikar
- [ ] **Kör `setupAdminPassword('...')`** med långt slumpat lösenord
- [ ] **Publicera Apps Script som Web App** (åtkomst: Alla)
- [ ] **Klistra in Web App-URL** i `bajram-basar/config.js` och `bajram-admin/config.js`
- [ ] **Beställ subdomän eller subkatalog** på One.com (rekommendation: subkatalog `/bajram-basar/` och `/bajram-admin/`)
- [ ] **Ladda upp via SFTP** till One.com webroot
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

- [ ] **GitHub Actions för auto-deploy via SFTP** (när det finns en stabil main-branch)
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
