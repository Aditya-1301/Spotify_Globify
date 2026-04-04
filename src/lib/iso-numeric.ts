/**
 * ISO 3166-1 numeric code → alpha-2 code mapping.
 * Used to convert world-atlas TopoJSON feature IDs (numeric) to ISO alpha-2 codes.
 */
export const ISO_NUM_A2: Record<number, string> = {
  4: "AF",   8: "AL",  12: "DZ",  20: "AD",  24: "AO",  28: "AG",  31: "AZ",
  32: "AR",  36: "AU",  40: "AT",  44: "BS",  48: "BH",  50: "BD",  51: "AM",
  52: "BB",  56: "BE",  64: "BT",  68: "BO",  70: "BA",  72: "BW",  76: "BR",
  84: "BZ",  90: "SB",  96: "BN", 100: "BG", 104: "MM", 108: "BI", 112: "BY",
 116: "KH", 120: "CM", 124: "CA", 132: "CV", 140: "CF", 144: "LK", 152: "CL",
 156: "CN", 162: "CX", 170: "CO", 174: "KM", 178: "CG", 180: "CD", 188: "CR",
 191: "HR", 192: "CU", 196: "CY", 203: "CZ", 204: "BJ", 208: "DK", 212: "DM",
 214: "DO", 218: "EC", 222: "SV", 226: "GQ", 231: "ET", 232: "ER", 233: "EE",
 242: "FJ", 246: "FI", 250: "FR", 266: "GA", 268: "GE", 270: "GM", 276: "DE",
 288: "GH", 296: "KI", 300: "GR", 308: "GD", 320: "GT", 324: "GN", 328: "GY",
 332: "HT", 340: "HN", 344: "HK", 348: "HU", 352: "IS", 356: "IN", 360: "ID",
 364: "IR", 368: "IQ", 372: "IE", 376: "IL", 380: "IT", 384: "CI", 388: "JM",
 392: "JP", 398: "KZ", 400: "JO", 404: "KE", 408: "KP", 410: "KR", 414: "KW",
 417: "KG", 418: "LA", 422: "LB", 426: "LS", 428: "LV", 430: "LR", 434: "LY",
 438: "LI", 440: "LT", 442: "LU", 446: "MO", 450: "MG", 454: "MW", 458: "MY",
 462: "MV", 466: "ML", 470: "MT", 478: "MR", 480: "MU", 484: "MX", 496: "MN",
 498: "MD", 499: "ME", 504: "MA", 508: "MZ", 516: "NA", 524: "NP", 528: "NL",
 554: "NZ", 558: "NI", 562: "NE", 566: "NG", 578: "NO", 586: "PK", 591: "PA",
 598: "PG", 600: "PY", 604: "PE", 608: "PH", 616: "PL", 620: "PT", 624: "GW",
 630: "PR", 634: "QA", 642: "RO", 643: "RU", 646: "RW", 659: "KN", 662: "LC",
 670: "VC", 682: "SA", 686: "SN", 688: "RS", 694: "SL", 703: "SK", 704: "VN",
 705: "SI", 706: "SO", 710: "ZA", 716: "ZW", 724: "ES", 728: "SS", 736: "SD",
 740: "SR", 748: "SZ", 752: "SE", 756: "CH", 760: "SY", 762: "TJ", 764: "TH",
 768: "TG", 776: "TO", 780: "TT", 788: "TN", 792: "TR", 795: "TM", 800: "UG",
 804: "UA", 807: "MK", 818: "EG", 826: "GB", 834: "TZ", 840: "US", 858: "UY",
 860: "UZ", 862: "VE", 882: "WS", 887: "YE", 894: "ZM",
};

/** Primary spoken languages by ISO alpha-2 country code */
export const COUNTRY_LANGUAGE: Record<string, string[]> = {
  US: ["English"],    GB: ["English"],    AU: ["English"],    CA: ["English", "French"],
  IE: ["English"],    NZ: ["English"],    ZA: ["English", "Afrikaans", "Zulu"],    JM: ["English"],
  TT: ["English"],    BB: ["English"],    GH: ["English", "Akan"],    NG: ["English", "Hausa", "Yoruba"],
  KE: ["Swahili", "English"],    TZ: ["Swahili"],    SG: ["English", "Mandarin", "Malay", "Tamil"],
  FR: ["French"],     BE: ["French", "Dutch", "German"],     CI: ["French"],
  DE: ["German"],     AT: ["German"],     CH: ["German", "French", "Italian", "Romansh"],     LI: ["German"],
  ES: ["Spanish", "Catalan", "Galician"],    MX: ["Spanish"],    AR: ["Spanish"],    CO: ["Spanish"],
  CL: ["Spanish"],    PE: ["Spanish", "Quechua"],    VE: ["Spanish"],    CU: ["Spanish"],
  DO: ["Spanish"],    PR: ["Spanish", "English"],    GT: ["Spanish"],    EC: ["Spanish"],
  BR: ["Portuguese"], PT: ["Portuguese"],
  IT: ["Italian"],
  SE: ["Swedish"],    NO: ["Norwegian"],  DK: ["Danish"],     FI: ["Finnish", "Swedish"],
  IS: ["Icelandic"],  NL: ["Dutch"],      PL: ["Polish"],     CZ: ["Czech"],
  SK: ["Slovak"],     HU: ["Hungarian"],  RO: ["Romanian"],   HR: ["Croatian"],
  RS: ["Serbian"],    RU: ["Russian"],    UA: ["Ukrainian"],  BG: ["Bulgarian"],
  BY: ["Belarusian", "Russian"], GE: ["Georgian"],   AM: ["Armenian"],   AZ: ["Azerbaijani"],
  KZ: ["Kazakh", "Russian"],     UZ: ["Uzbek"],      TJ: ["Tajik"],      KG: ["Kyrgyz", "Russian"],
  TM: ["Turkmen"],    LT: ["Lithuanian"], LV: ["Latvian"],    EE: ["Estonian"],
  MK: ["Macedonian"], BA: ["Bosnian", "Croatian", "Serbian"],   SI: ["Slovenian"],  AL: ["Albanian"],
  MD: ["Romanian"],   ME: ["Montenegrin"], LU: ["Luxembourgish", "French", "German"],
  JP: ["Japanese"],   KR: ["Korean"],     CN: ["Chinese"],    TW: ["Chinese", "Taiwanese"],
  HK: ["Cantonese", "English"],  VN: ["Vietnamese"], TH: ["Thai"],       ID: ["Indonesian"],
  MY: ["Malay"],      PH: ["Filipino", "English"],   MM: ["Burmese"],    KH: ["Khmer"],
  IN: ["Hindi", "English", "Bengali", "Telugu", "Marathi", "Tamil", "Urdu", "Gujarati", "Kannada", "Odia", "Malayalam", "Punjabi"],
  PK: ["Urdu", "Punjabi", "Sindhi", "Pashto"],       BD: ["Bengali"],    LK: ["Sinhala", "Tamil"],
  TR: ["Turkish"],    IL: ["Hebrew", "Arabic"],     LB: ["Arabic", "French"],     SA: ["Arabic"],
  EG: ["Arabic"],     MA: ["Arabic", "Berber", "French"],     DZ: ["Arabic", "Berber", "French"],     TN: ["Arabic", "French"],
  GR: ["Greek"],
};

/** Generate a flag emoji from a 2-letter ISO alpha-2 code (e.g. "US" → "🇺🇸") */
export function getCountryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌎";
  return [...code.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join("");
}
