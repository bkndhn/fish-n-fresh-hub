export type BusinessVertical = "seafood" | "chicken_meat" | "all_meat";

export interface VerticalConfig {
  id: BusinessVertical;
  name: string;
  shortName: string;
  emoji: string;
  tagline: string;
  badgeText: string;
  recommendedThemeColor: string;
  defaultCategories: string[];
  motto: {
    en: string;
    ta: string;
    hi: string;
  };
  subMotto: {
    en: string;
    ta: string;
    hi: string;
  };
  features: {
    title: string;
    desc: string;
  }[];
}

export const VERTICAL_CONFIGS: Record<BusinessVertical, VerticalConfig> = {
  seafood: {
    id: "seafood",
    name: "Seafood & Daily Catch Hub",
    shortName: "Seafood",
    emoji: "🐟",
    tagline: "Daily Harbour Day-Catch · 100% Chemical-Free",
    badgeText: "100% Day Catch · Formalin Free",
    recommendedThemeColor: "#0ea5e9",
    defaultCategories: [
      "Sea Fish",
      "Freshwater Fish",
      "Prawns & Shrimps",
      "Crabs & Lobsters",
      "Squid & Cuttlefish",
    ],
    motto: {
      en: "No Compromise in Quality · Best Affordable Price",
      ta: "தரத்திலும் சுவையிலும் சமரசம் இல்லை · நியாயமான குறைந்த விலை",
      hi: "क्वालिटी में कोई समझौता नहीं · सबसे किफायती और सही दाम",
    },
    subMotto: {
      en: "Fresh harbour landings daily. Zero chemical preservatives.",
      ta: "தினசரி புதிய கடல் பிடிப்பு. இரசாயனம் அல்லது பார்மலின் இல்லாத இயற்கை தரம்.",
      hi: "रोज़ाना बंदरगाह से ताज़ा माल। किसी भी हानिकारक केमिकल के बिना।",
    },
    features: [
      { title: "100% Day Catch", desc: "Sourced direct from coastal harbor boats at dawn." },
      { title: "45-Min Cold Chain", desc: "Chilled with food-grade gel ice chill pads at 0–4°C." },
      { title: "Custom Cuts", desc: "Curry cut, steaks, whole cleaned, or Bengali cut." },
      { title: "Freshness Guaranteed", desc: "100% satisfaction or instant replacement promise." },
    ],
  },
  chicken_meat: {
    id: "chicken_meat",
    name: "Fresh Farm Chicken & Tender Meat Hub",
    shortName: "Chicken & Meat",
    emoji: "🍗",
    tagline: "100% Farm-Fresh Antibiotic-Free Chicken & Tender Cuts",
    badgeText: "Farm Fresh · 100% Antibiotic-Free & Halal",
    recommendedThemeColor: "#e11d48",
    defaultCategories: [
      "Farm Fresh Chicken",
      "Country Chicken (Nattu Kozhi)",
      "Tender Mutton & Goat",
      "Fresh Farm Eggs",
      "Boneless & Curry Cuts",
    ],
    motto: {
      en: "No Compromise in Quality · Best Affordable Price",
      ta: "தரத்திலும் சுவையிலும் சமரசம் இல்லை · நியாயமான குறைந்த விலை",
      hi: "क्वालिटी में कोई समझौता नहीं · सबसे किफायती और सही दाम",
    },
    subMotto: {
      en: "Hygienic daily cuts, 100% antibiotic-free and 100% Halal certified.",
      ta: "சுத்தமான தினசரி வெட்டு, 100% ஆன்டிபயாடிக் இல்லாத மற்றும் ஹலால் சான்றளிக்கப்பட்ட தரம்.",
      hi: "स्वच्छ दैनिक कटिंग, 100% एंटीबायोटिक-मुक्त और शत-प्रतिशत हलाल प्रमाणित।",
    },
    features: [
      { title: "100% Farm Fresh", desc: "Raised naturally in bio-secure farms with zero antibiotics." },
      { title: "100% Halal Certified", desc: "Traditional hygienic cuts prepared fresh per order." },
      { title: "Tender & Juicy Cuts", desc: "Biryani cut, curry cut, drumsticks, and tender keema." },
      { title: "Express 35m Delivery", desc: "Arrives fresh and vacuum-sealed at your doorstep." },
    ],
  },
  all_meat: {
    id: "all_meat",
    name: "Multi-Meat Superstore (Fish, Chicken, Mutton & Seafood)",
    shortName: "All Meat & Fish",
    emoji: "🥩",
    tagline: "One-Stop Daily Fresh Meat, Seafood & Poultry Superstore",
    badgeText: "Daily Fresh Harvest · 100% Clean Cuts",
    recommendedThemeColor: "#b91c1c",
    defaultCategories: [
      "Daily Catch Fish",
      "Farm Fresh Chicken",
      "Tender Mutton & Lamb",
      "Prawns & Shellfish",
      "Farm Eggs & Cuts",
    ],
    motto: {
      en: "No Compromise in Quality · Best Affordable Price",
      ta: "தரத்திலும் சுவையிலும் சமரசம் இல்லை · நியாயமான குறைந்த விலை",
      hi: "क्वालिटी में कोई समझौता नहीं · सबसे किफायती और सही दाम",
    },
    subMotto: {
      en: "The ultimate fresh protein superstore for your entire family.",
      ta: "உங்கள் முழு குடும்பத்திற்கும் ஒரே இடத்தில் தரமான மீன், கோழி மற்றும் ஆட்டு இறைச்சி.",
      hi: "आपके पूरे परिवार के लिए एक ही जगह ताज़ी मछली, चिकन और मटन सुपरस्टोर।",
    },
    features: [
      { title: "All-in-One Selection", desc: "Seafood, chicken, mutton, and eggs in a single order." },
      { title: "Lab Tested Freshness", desc: "Strict hygiene and cold-chain temperature monitoring." },
      { title: "Custom Master Butchery", desc: "Precision custom cuts tailored for every recipe." },
      { title: "Zero-Wait Express", desc: "Delivered to your kitchen chilled within 35–45 mins." },
    ],
  },
};

export function getVerticalConfig(vertical?: string | null): VerticalConfig {
  if (vertical === "chicken_meat") return VERTICAL_CONFIGS.chicken_meat;
  if (vertical === "all_meat") return VERTICAL_CONFIGS.all_meat;
  return VERTICAL_CONFIGS.seafood;
}
