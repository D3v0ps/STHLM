# Stockholms Moské Festival 2026 — handoff till webbansvarig

Detta paket innehåller en publik festivalsida + adminpanel för Stockholms Moské Festival, byggda som **rena statiska filer** (HTML/CSS/JS) utan server-krav.

## Vad du ska göra

Ladda upp **två mappar** till webroot för `stockholmsmoske.se`:

```
<webroot>/festival/         (innehåller index.html, styles.css, script.js, assets/, config.js)
<webroot>/festival-admin/   (innehåller index.html, admin.css, admin.js, assets/, config.js)
```

Resultatet blir två URL:er:

- `https://stockholmsmoske.se/festival/` — publik festivalsida
- `https://stockholmsmoske.se/festival-admin/` — adminpanel (lösenordsskyddad)

Inga build-steg, inget Node, inga moduler. Drag-och-släpp via FileZilla / cPanel-filhanterare.

## WordPress-överväganden

Eftersom huvudsajten kör WordPress på Oderland:

1. **Mapparna måste ligga utanför wp-content/, wp-admin/ och wp-includes/.** Lägg dem direkt i webroot (samma nivå som `wp-config.php`).

2. **WordPress .htaccess ska INTE blockera de nya katalogerna.** Standard-WP-rewrites lämnar befintliga mappar i fred via:
   ```apache
   RewriteCond %{REQUEST_FILENAME} !-d
   ```
   Så `/festival/` borde fungera så fort katalogen finns på disk.

3. **Om det ändå 404:ar:** lägg in en `.htaccess` i `festival/`-mappen som stänger av WP-rewriten lokalt:
   ```apache
   # festival/.htaccess
   RewriteEngine Off
   DirectoryIndex index.html
   ```
   Samma fil i `festival-admin/`.

4. **HTTPS:** sköts av Oderland för hela domänen, gäller automatiskt även subkataloger.

## Vad som är vad

- **Publika sidan** läser data från Google Sheets via en Apps Script Web App (Google hostar). Inget databas-call mot er server.
- **Adminpanelen** är en SPA som loggar in mot samma Apps Script. Lösenordet är hashat (SHA-256 + salt) och lagras i Google Apps Script Script Properties — aldrig på er server.
- **Sociala länkar, datum, eventbeskrivningar** — allt redigeras av styrelsen direkt i adminpanelen, ingen kodändring behövs.

## Uppdateringar

När festivalsidan behöver uppdateras får ni en ny ZIP från Karim med samma två mappar. Skriv över de gamla. Ingen migrering, ingen schemaändring.

## Kontakt

Karim Khalil (Karim.khalil002@gmail.com) — bygger och underhåller koden.
