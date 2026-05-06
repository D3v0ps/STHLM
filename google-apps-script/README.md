# google-apps-script/ – Backend för Stockholms Moské Festival 2026

Detta är ALL backend-logik för projektet. Apps Script tar emot formulär från publika sidan, serverar adminpanelen via HtmlService, och pratar med Google Sheets.

## Filer

- `Code.gs` – all backend-logik (router, auth, sheet-helpers, admin-funktioner, setup)
- `Admin.html` – adminpanelens HTML-stomme (HtmlService-template)
- `AdminCSS.html` – inline-CSS för adminpanelen
- `AdminJS.html` – klient-side JS för adminpanelen (kommunikation via google.script.run)
- `README.md` – denna fil

## Förutsättningar

- Ett Google-konto med åtkomst till Google Sheets och Apps Script.
- Ett tomt Google Sheet (eller låt setup-funktionen skapa ett bundet kalkylark).

## Setup steg-för-steg

### 1. Skapa Apps Script-projektet

**Alternativ A — bundet till ett Sheet (rekommenderas):**

1. Skapa ett nytt Google Sheet på `https://sheets.google.com`. Döp det t.ex. `Stockholms Moské Festival 2026 – CMS`.
2. I arket: `Tillägg` → `Apps Script`. Detta öppnar ett bundet projekt.
3. Sätt projektnamn (uppe till vänster) till t.ex. "Stockholms Moské Festival – Backend".

**Alternativ B — fristående script:**

1. Gå till `https://script.google.com` → `Nytt projekt`.
2. Skapa ett separat Sheet och kopiera dess ID (URL-segmentet mellan `/d/` och `/edit`).
3. I Apps Script: `Projektinställningar` → `Skript-egenskaper` → lägg till `SPREADSHEET_ID` med arkets ID.

### 2. Lägg in koden

I Apps Script-editorn:

1. Öppna `Code.gs` (default heter den så). Klistra in innehållet från denna mapps `Code.gs`.
2. Skapa ny fil: `+ → HTML`. Döp till `Admin`. Klistra in innehållet från `Admin.html` (utan filändelse i editorn — det blir `Admin.html` automatiskt).
3. Skapa ny HTML-fil: `AdminCSS`. Klistra in från `AdminCSS.html`.
4. Skapa ny HTML-fil: `AdminJS`. Klistra in från `AdminJS.html`.
5. Spara allt med Cmd/Ctrl-S.

### 3. Initiera kalkylarket

I Apps Script-editorn:

1. Öppna `Code.gs`.
2. Längst upp i drop-down-funktionsväljaren (bredvid "Kör"-knappen): välj `setupSpreadsheet`.
3. Klicka `Kör`.
4. Första gången: tillåt scriptets behörigheter (Google ber om åtkomst till Sheets, properties, etc.).
5. När det är klart: gå tillbaka till Sheetet och kontrollera att alla flikar är skapade:
   - `Settings`
   - `FormQuestions`
   - `Submissions`
   - `Exhibitors`
   - `SocialLinks`
   - `SportsPages`
   - `AdminLogs`
6. Bekräfta att Settings-fliken har default-rader och FormQuestions har 8 default-frågor.

### 4. Sätt adminlösenord

> ⚠️ Detta lösenord ger full åtkomst till adminpanelen. Använd ett LÅNGT, slumpmässigt lösenord. Spara det i en lösenordshanterare. Aldrig i kod.

Generera ett starkt lösenord (i terminal):

```
openssl rand -base64 32
```

I Apps Script-editorn:

1. Öppna `Code.gs`.
2. Tillfälligt ändra raden där `setupAdminPassword` deklareras — eller skapa en engångs-funktion högst upp i filen:

   ```js
   function _initPassword() {
     setupAdminPassword('DITT_LÖSENORD_HÄR');
   }
   ```

3. Välj `_initPassword` i drop-down, klicka `Kör`.
4. Efter att det körts: **TA BORT** `_initPassword` från koden, eller åtminstone ta bort lösenordet från strängen. Lämna ingen "lösenord-historia" i scriptet.
5. Kontrollera under `Projektinställningar` → `Skript-egenskaper` att `ADMIN_PASSWORD_HASH` och `ADMIN_PASSWORD_SALT` finns satta. Värdena är inte lösenordet i klartext utan hashen + saltet.

### 5. Publicera som Web App

1. I Apps Script-editorn: `Distribuera` → `Ny distribution`.
2. Typ: `Webbapp`.
3. Beskrivning: t.ex. `v1 – initial`.
4. Kör som: `Mig själv` (ditt Google-konto).
5. Vem har åtkomst: `Alla` (krävs för att publika sidan ska kunna POST:a formulär). Detta innebär att vem som helst kan anropa endpointen — säkerheten finns i:
   - Adminfunktioner kräver giltig token.
   - Publika endpoints (publicData, submit) är medvetet öppna.
6. Klicka `Distribuera`.
7. Kopiera Web App-URL:en. Det är värdet du ska klistra in i:
   - `bajram-basar/config.js` → `appsScriptUrl`
   - `bajram-admin/config.js` → `adminWebAppUrl` (samma URL, ev. med `?view=admin` som suffix om du vill att admin-launchern ska redirecta direkt)

### 6. Testa

**Publik data (utan inloggning):**

Öppna i webbläsaren:
```
https://script.google.com/macros/s/.../exec?action=publicData&callback=test
```

Du ska få en JSONP-respons: `test({"ok":true,"data":{...}})`.

**Adminpanel:**

Öppna:
```
https://script.google.com/macros/s/.../exec?view=admin
```

Du ska se loginrutan. Logga in med lösenordet. Bekräfta att fliken `Översikt` visar status, och att `Eventinformation` listar settings-fälten.

**Formulärinlämning:**

På publika sidan (när den är uppladdad) — fyll i och skicka formuläret. Kontrollera att en ny rad dyker upp i `Submissions`-fliken.

## Vid uppdatering av koden

När du ändrar något i `Code.gs`/`Admin.html`/`AdminCSS.html`/`AdminJS.html`:

1. Klistra in den uppdaterade koden i respektive fil i Apps Script-editorn.
2. **Distribuera** → **Hantera distributioner** → klicka pennan bredvid din distribution → välj `Ny version` → ange beskrivning → `Distribuera`.
3. Web App-URL:en ändras INTE när du uppdaterar en befintlig distribution — bara om du skapar en ny.

> Viktigt: Ändringar i koden tar inte effekt på Web App-URL:en förrän du publicerat ny version. Detta gäller även om du klickar `Spara`. "Spara" sparar i editorn, men trafiken går mot den senast publicerade versionen.

## Script Properties

Sätts under `Projektinställningar` → `Skript-egenskaper`. Hemliga, syns aldrig i koden.

| Nyckel | Värde | När |
|---|---|---|
| `ADMIN_PASSWORD_HASH` | (auto-genererat av setupAdminPassword) | Steg 4 ovan |
| `ADMIN_PASSWORD_SALT` | (auto-genererat av setupAdminPassword) | Steg 4 ovan |
| `SPREADSHEET_ID` | Sheet-ID:t | Bara om scriptet är fristående (Alternativ B) |

## Audit log

`AdminLogs`-fliken loggar alla skriv-operationer:

| Timestamp | Action | Details | Session ID |
|---|---|---|---|
| 2026-05-06 20:30:00 | login | – | a3f4b1e2… |
| 2026-05-06 20:31:15 | save_settings | { eventDate: "Lör 13 juni" } | a3f4b1e2… |
| 2026-05-06 20:35:42 | approve_submission | { id: 123 } | a3f4b1e2… |

Granska denna flik regelbundet, särskilt om något misstänkt händer.

## Felsökning

**"Du har inte behörighet att utföra denna åtgärd"**
→ Du har inte godkänt scriptets behörigheter. Kör en funktion (t.ex. `setupSpreadsheet`) manuellt och godkänn dialoger.

**Adminpanelen visar "Adminlösenord är inte satt"**
→ Du har inte kört `setupAdminPassword('...')`. Se Steg 4.

**Publika sidan får tomt svar från Apps Script**
→ Kontrollera att Web App är publicerad med `Vem har åtkomst: Alla`. Standardinställningen `Endast jag` blockerar publika anrop.

**CORS-error i konsolen på publika sidan**
→ Det är därför vi använder JSONP för läsningar och `Content-Type: text/plain` för POST. Om du ändrat något här: läs SPEC §6 igen.

**"Token expired" vid varje admin-action**
→ CacheService kan tömmas vid Apps Script-deploy. Logga ut och in igen. Om problemet kvarstår: kolla att `validateSession` returnerar rätt och att TTL inte är för kort.

## Säkerhet — vad som ALDRIG ska göras

- ❌ Aldrig hårdkoda adminlösenordet i koden. Använd Script Properties.
- ❌ Aldrig logga lösenord (ens hashade) i AdminLogs.
- ❌ Aldrig skicka token i URL-query-parameter (kan hamna i loggar). Token bara i request-body eller via google.script.run.
- ❌ Aldrig sätt `Vem har åtkomst: Alla` på en separat admin-deployment. Adminpanelen körs på samma Web App via `?view=admin` — då gäller `Mig själv` automatiskt för admin-funktioner via google.script.run.

## Backup

Sheetet är arkivet. Säkerhetskopiera regelbundet:
- `Arkiv` → `Ladda ner` → `Microsoft Excel (.xlsx)` eller `OpenDocument-format`.
- Eller använd Google Drives versionshistorik.

Apps Script-koden är versionshanterad i denna mapp i git — committa kodändringar parallellt med ändringar i Apps Script-editorn så koden inte divergerar.
