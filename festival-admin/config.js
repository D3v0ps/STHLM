// Apps Script Web App-URL för adminpanelen.
// Den static SPA:n i denna mapp POST:ar { adminAction, args } hit och
// dispatchas i Code.gs::adminDispatch_. Samma URL som festival/config.js,
// utan ?view=admin (det suffixet behövs bara om man vill öppna den gamla
// HtmlService-panelen i Apps Script — det är inte längre standardflödet).
window.ADMIN_CONFIG = {
  adminWebAppUrl: "https://script.google.com/macros/s/AKfycbwYXgZ6PirSdCa8aKTpyT0RLnw8TkCpk4zwdSZWSvTD2ENy1Vqh26nxS6u0m7xVF_nP7g/exec"
};
