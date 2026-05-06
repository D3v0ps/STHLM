// Klistra in Apps Script Web App-URL nedan när Apps Script är deployat.
// Exempel: https://script.google.com/macros/s/AKfyc.../exec
window.APP_CONFIG = {
  appsScriptUrl: "PASTE_APPS_SCRIPT_URL_HERE",
  adminUrl: "../bajram-admin/",
  // Fallback-data används om Apps Script inte svarar inom 8 sekunder.
  // Innehållet ska matcha det som senare lagras i Google Sheets-fliken Settings,
  // så sidan ser bra ut även när backend är nere.
  fallbackData: {
    settings: {
      eventTitle: "Stockholms Moské Festival",
      eventSubtitle: "Bazaar, öppet hus & familjeaktiviteter",
      eventDate: "Lördag 13 juni",
      eventTime: "12:00–19:00",
      bazaarTime: "13:00–17:00",
      eventLocation: "Stockholms Moské & Björns trädgård, Medborgarplatsen",
      expectedChildren: 130,
      expectedAdults: 200,
      registrationOpen: true,
      showExhibitors: true,
      heroButtonText: "Anmäl intresse till bazaren",
      introText: "Föreningen arrangerar en festival med bazaar, öppet hus och familjeaktiviteter på Stockholms Moské och Björns trädgård vid Medborgarplatsen. Vi bjuder in företagare, kreativa personer och föreningar som vill sälja eller presentera produkter och tjänster vid ett stånd att anmäla sig.",
      whoCanApplyText: "Bazaren är öppen för företagare, kreatörer, föreningar och personer som vill sälja eller presentera produkter och tjänster som passar familjer och besökare. Anmälan är gratis – vi vill bara veta vad du planerar att erbjuda och vilket stånd du behöver.",
      selectionText: "Urvalet kommer att göras baserat på hur relevant ditt erbjudande är för besökarna samt hur genomförbart det är. Ju mer information du lämnar om vad du planerar att sälja eller presentera, desto enklare blir bedömningen. Vi hör av oss efter att urvalsprocessen är klar.",
      importantInfoText: "• Att delta är gratis.\n• Anmälan är bindande – vid sen avanmälan kan en avgift debiteras.\n• Varje deltagare ansvarar för sin egen plats.\n• Varje deltagare ansvarar för städning efter avslutat evenemang.\n• Bazaren är öppen mellan kl. 13:00–17:00; festivalen pågår 12:00–19:00.",
      successMessage: "Tack! Din intresseanmälan har skickats. Vi återkommer efter att urvalet har gåtts igenom.",
      closedMessage: "Anmälan är stängd. Utställare publiceras här när programmet är klart."
    },
    questions: [
      {
        order: 1,
        fieldId: "name",
        label: "Namn och efternamn / Ime i prezime",
        helperText: "",
        placeholder: "",
        type: "text",
        required: true,
        active: true,
        options: ""
      },
      {
        order: 2,
        fieldId: "company",
        label: "Företagsnamn, om tillämpligt / Naziv firme, ako postoji",
        helperText: "",
        placeholder: "",
        type: "text",
        required: false,
        active: true,
        options: ""
      },
      {
        order: 3,
        fieldId: "email",
        label: "Email",
        helperText: "",
        placeholder: "",
        type: "email",
        required: true,
        active: true,
        options: ""
      },
      {
        order: 4,
        fieldId: "phone",
        label: "Telefon",
        helperText: "",
        placeholder: "",
        type: "tel",
        required: true,
        active: true,
        options: ""
      },
      {
        order: 5,
        fieldId: "websiteSocials",
        label: "Webbsida och sociala medier",
        helperText: "",
        placeholder: "Instagram, TikTok, hemsida eller annan länk",
        type: "text",
        required: false,
        active: true,
        options: ""
      },
      {
        order: 6,
        fieldId: "offering",
        label: "Vad planerar du att sälja eller presentera? / Šta planirate prodavati ili predstavljati?",
        helperText: "Beskriv så detaljerat som möjligt. / Molimo opišite što detaljnije.",
        placeholder: "",
        type: "textarea",
        required: true,
        active: true,
        options: ""
      },
      {
        order: 7,
        fieldId: "standNeeds",
        label: "Behov för stånd / Potrebe za štandom",
        helperText: "Behöver du bord? Behöver du el? Hur mycket plats behöver du? Övriga behov?",
        placeholder: "",
        type: "textarea",
        required: true,
        active: true,
        options: ""
      },
      {
        order: 8,
        fieldId: "consentAccepted",
        label: "Jag godkänner villkoren och ansvarar för mitt eget stånd. / Saglasan/na sam sa pravilima događaja i preuzimam odgovornost za svoj štand",
        helperText: "",
        placeholder: "",
        type: "checkbox",
        required: true,
        active: true,
        options: ""
      }
    ],
    exhibitors: [],
    socialLinks: [
      { order: 1, platform: "Instagram", label: "Instagram", url: "https://instagram.com/stockholmsmoske", active: true },
      { order: 2, platform: "TikTok", label: "TikTok", url: "", active: true },
      { order: 3, platform: "Facebook", label: "Facebook", url: "https://facebook.com/sthlmsmoske", active: true },
      { order: 4, platform: "YouTube", label: "YouTube", url: "https://youtube.com/c/StockholmsMoskéIF", active: true },
      { order: 5, platform: "Hemsida", label: "Hemsida", url: "https://stockholmsmoske.se", active: true }
    ],
    sportsPages: [
      { slug: "bajram-fotboll", title: "Anmälan till fotboll", description: "Mer information kommer snart.", active: false, registrationOpen: false },
      { slug: "bajram-basket-3vs3", title: "Anmälan till basket 3 mot 3", description: "Mer information kommer snart.", active: false, registrationOpen: false }
    ]
  }
};
