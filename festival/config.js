// Klistra in Apps Script Web App-URL nedan när Apps Script är deployat.
// Exempel: https://script.google.com/macros/s/AKfyc.../exec
window.APP_CONFIG = {
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbwYXgZ6PirSdCa8aKTpyT0RLnw8TkCpk4zwdSZWSvTD2ENy1Vqh26nxS6u0m7xVF_nP7g/exec",
  adminUrl: "../festival-admin/",
  // Fallback-data används om Apps Script inte svarar inom 8 sekunder.
  // Innehållet ska matcha det som senare lagras i Google Sheets-fliken Settings,
  // så sidan ser bra ut även när backend är nere.
  fallbackData: {
    settings: {
      eventTitle: "Stockholms Moské Festival",
      eventSubtitle: "— en dag för gemenskap",
      eventDate: "Lördag 13 juni",
      eventTime: "12:00–19:00",
      bazaarTime: "13:00–17:00",
      eventLocation: "Stockholms Moské",
      expectedChildren: 130,
      expectedAdults: 200,
      registrationOpen: true,
      showExhibitors: true,
      heroButtonText: "Anmäl dig till bazaaren",
      introText: "Bazaar, öppet hus och familjeaktiviteter på Stockholms Moské och Björns Trädgård vid Medborgarplatsen. Fri entré.",
      whoCanApplyText: "Bazaren är öppen för företagare, kreatörer, föreningar och andra som vill sälja eller presentera produkter och tjänster som passar festivalens besökare och familjer.\n\nDet finns ingen avgift för att boka ett stånd. Istället tillfaller 10 % av försäljningen under festivaldagen Stockholms Moské som bidrag till festivalens verksamhet och arrangemang.\n\nI formuläret ber vi dig beskriva vad du planerar att erbjuda samt vilken typ av stånd eller plats du behöver.",
      selectionText: "Urvalet kommer att göras baserat på hur relevant ditt erbjudande är för besökarna samt hur genomförbart det är. Ju mer information du lämnar om vad du planerar att sälja eller presentera, desto enklare blir bedömningen. Vi hör av oss efter att urvalsprocessen är klar.",
      importantInfoText: "• Att boka ett stånd är kostnadsfritt.\n• Anmälan är bindande efter bekräftad plats.\n• Sen avanmälan eller utebliven närvaro kan medföra en avgift.\n• Sista anmälningsdag: söndag 17 maj.",
      successMessage: "Tack! Din intresseanmälan har skickats. Vi återkommer när urvalet är klart.",
      closedMessage: "Anmälan är stängd. Utställare publiceras här när programmet är klart.",
      purposeText: "Stockholms Moské Festival är en årlig familje- och gemenskapsfestival som arrangeras av Stockholms Moské för att samla människor i alla åldrar kring gemenskap, glädje, kultur och aktiviteter.\n\nFestivalen skapar en trygg och välkomnande mötesplats där familjer, ungdomar och besökare kan umgås, lära känna varandra och delta i aktiviteter för både barn och vuxna.\n\nGenom bazaar, sportturneringar, barnaktiviteter, mat, fika och kunskapsutställningar vill festivalen stärka gemenskapen i samhället och skapa positiva minnen för hela familjen – i en öppen, familjevänlig och inkluderande miljö där människor möts.",
      linktreeUrl: "https://linktr.ee/stockholmsmoske",
      activityBazaarText: "Sälj eller presentera produkter och tjänster vid ett stånd. Begränsade platser — urval baseras på relevans.",
      activitySportText: "Fotbollsturnering för ålder 15+ (födda 2011 eller tidigare). 5v5, max 6 spelare per lag. 500 kr per lag — 1:a-pris 6 000 kr i presentkort. Sista anmälningsdag 6 juni.",
      activityBasketText: "3x3-basket för ålder 15+ (födda 2011 eller tidigare). Max 4 spelare per lag. 400 kr per lag — 1:a-pris 4 000 kr i presentkort. Sista anmälningsdag 10 juni.",
      activityMatText: "Mat, fika och tilltugg från lokala kockar och bagerier. Meny och priser uppdateras inom kort.",
      activityKidsText: "Lek, pyssel och familjeaktiviteter för de yngsta. Ansvariga ledare på plats hela dagen.",
      activityKnowledgeText: "Utställningar och kortföredrag som introducerar besökare till moskéns verksamhet, historia och tro."
    },
    questions: [
      {
        order: 1,
        fieldId: "name",
        label: "Namn och efternamn",
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
        label: "Företagsnamn, om tillämpligt",
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
        label: "E-post",
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
        label: "Vad planerar du att sälja eller presentera?",
        helperText: "Beskriv så detaljerat som möjligt.",
        placeholder: "",
        type: "textarea",
        required: true,
        active: true,
        options: ""
      },
      {
        order: 7,
        fieldId: "standNeeds",
        label: "Behov för stånd",
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
        label: "Jag godkänner villkoren och ansvarar för mitt eget stånd.",
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
      { slug: "festival-fotboll", title: "Anmälan till fotboll", description: "Mer information kommer snart.", active: false, registrationOpen: false },
      { slug: "festival-basket-3vs3", title: "Anmälan till basket 3 mot 3", description: "Mer information kommer snart.", active: false, registrationOpen: false }
    ],
    volunteerQuestions: [
      { order: 1, fieldId: "name", label: "Namn och efternamn", helperText: "", placeholder: "För- och efternamn", type: "text", required: true, active: true, options: [] },
      { order: 2, fieldId: "phone", label: "Telefonnummer", helperText: "", placeholder: "+46 70 123 45 67", type: "tel", required: true, active: true, options: [] },
      { order: 3, fieldId: "birthDate", label: "Födelsedatum (ÅÅMMDD)", helperText: "Sex siffror — t.ex. 980415 för 15 april 1998.", placeholder: "ÅÅMMDD", type: "text", required: true, active: true, options: [] },
      { order: 4, fieldId: "hasExperience", label: "Tidigare volontärerfarenhet i moskén", helperText: "", placeholder: "", type: "radio", required: true, active: true, options: ["ja|Ja", "nej|Nej"] },
      { order: 5, fieldId: "about", label: "Berätta kort om dig själv", helperText: "Vad gör du till vardags? Något särskilt vi bör veta?", placeholder: "", type: "textarea", required: true, active: true, options: [] },
      { order: 6, fieldId: "areas", label: "Områden du vill hjälpa till med", helperText: "Välj ett eller flera.", placeholder: "", type: "multicheck", required: true, active: true, options: ["reception|Reception & välkomna", "mat|Mat & fika", "barn|Barn & familj", "sakerhet|Säkerhet & ordning", "bazaar|Bazaar-stöd", "stadning|Städning & rivning"] },
      { order: 7, fieldId: "shifts", label: "Pass du kan hjälpa till med", helperText: "Välj ett eller flera.", placeholder: "", type: "multicheck", required: true, active: true, options: ["forenoon|Förmiddag (10:00–15:00)", "afternoon|Eftermiddag (15:00–20:00)"] }
    ],
    bazaarFaq: []
  }
};
