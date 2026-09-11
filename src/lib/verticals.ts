export type BusinessVertical =
  | "seafood"
  | "chicken_meat"
  | "all_meat"
  | "electronics_appliances"
  | "clothing_fashion"
  | "grocery_supermarket"
  | "departmental_store"
  | "universal";

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
  // Vertical-specific capability flags
  hasWeighingScale: boolean;
  hasImeiSerialTracking: boolean;
  hasSizeColorVariants: boolean;
  hasAisleRackLocation: boolean;
  hasWarrantyManagement: boolean;
  hasTechnicalSpecs: boolean;
  hasSizeChart: boolean;
  hasCutPreferences: boolean;
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
    hasWeighingScale: true,
    hasImeiSerialTracking: false,
    hasSizeColorVariants: false,
    hasAisleRackLocation: false,
    hasWarrantyManagement: false,
    hasTechnicalSpecs: false,
    hasSizeChart: false,
    hasCutPreferences: true,
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
    hasWeighingScale: true,
    hasImeiSerialTracking: false,
    hasSizeColorVariants: false,
    hasAisleRackLocation: false,
    hasWarrantyManagement: false,
    hasTechnicalSpecs: false,
    hasSizeChart: false,
    hasCutPreferences: true,
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
    hasWeighingScale: true,
    hasImeiSerialTracking: false,
    hasSizeColorVariants: false,
    hasAisleRackLocation: false,
    hasWarrantyManagement: false,
    hasTechnicalSpecs: false,
    hasSizeChart: false,
    hasCutPreferences: true,
  },

  electronics_appliances: {
    id: "electronics_appliances",
    name: "Electronics, Mobiles & Home Appliances",
    shortName: "Electronics & Tech",
    emoji: "📱",
    tagline: "100% Genuine Gadgets, Appliances & Tech with Brand Warranty",
    badgeText: "100% Genuine · Official Brand Warranty · Fast Delivery",
    recommendedThemeColor: "#2563eb",
    defaultCategories: [
      "Smartphones & Tablets",
      "Laptops & Computers",
      "Smart TVs & Home Theatre",
      "Home & Kitchen Appliances",
      "Audio, Headphones & Speakers",
      "Smartwatches & Wearables",
      "Cables, Chargers & Accessories",
    ],
    motto: {
      en: "Authorized Genuine Tech · Best Prices with Brand Warranty",
      ta: "உண்மையான பிராண்ட் எலக்ட்ரானிக்ஸ் · சிறந்த விலை மற்றும் உத்தரவாதம்",
      hi: "शत-प्रतिशत असली गैजेट्स · ब्रांड वारंटी और बेहतरीन दाम",
    },
    subMotto: {
      en: "Verified serial & IMEI numbers with authorized manufacturer warranty support.",
      ta: "உத்தியோகபூர்வ தயாரிப்பாளர் உத்தரவாதத்துடன் சரிபார்க்கப்பட்ட தயாரிப்புகள்.",
      hi: "अधिकृत निर्माता वारंटी और वेरिफाइड सीरियल/IMEI नंबर के साथ।",
    },
    features: [
      { title: "100% Brand Genuine", desc: "Direct brand sealed box with verified serial and IMEI." },
      { title: "Official Brand Warranty", desc: "Valid at all authorized brand service centers pan-India." },
      { title: "Safe Insured Transit", desc: "Shockproof tamper-evident transit packing for high-value items." },
      { title: "GST Input Credit Invoice", desc: "B2B & B2C tax invoices with serial and HSN details." },
    ],
    hasWeighingScale: false,
    hasImeiSerialTracking: true,
    hasSizeColorVariants: true,
    hasAisleRackLocation: true,
    hasWarrantyManagement: true,
    hasTechnicalSpecs: true,
    hasSizeChart: false,
    hasCutPreferences: false,
  },

  clothing_fashion: {
    id: "clothing_fashion",
    name: "Fashion, Clothing & Lifestyle Apparel",
    shortName: "Clothing & Fashion",
    emoji: "👗",
    tagline: "Trendy Styles, Premium Fabrics & Perfect Fits for All",
    badgeText: "Premium Fabrics · Easy Exchanges · Perfect Fits",
    recommendedThemeColor: "#e11d48",
    defaultCategories: [
      "Men's Casual & Formal",
      "Women's Ethnic & Western",
      "Kids & Baby Apparel",
      "Footwear & Sneakers",
      "Activewear & Loungewear",
      "Bags, Belts & Accessories",
    ],
    motto: {
      en: "Style Meets Comfort · Premium Fabrics at Everyday Prices",
      ta: "நவீன பாணி மற்றும் ஆறுதல் · சிறந்த துணி மற்றும் நியாயமான விலை",
      hi: "स्टाइल और कम्फर्ट का संगम · प्रीमियम फैब्रिक और सही दाम",
    },
    subMotto: {
      en: "Curated collections with accurate size charts and hassle-free fit exchange.",
      ta: "துல்லியமான அளவு வழிகாட்டி மற்றும் எளிதான மாற்றுக் கொள்கை.",
      hi: "सटीक साइज चार्ट और आसान एक्सचेंज सुविधा के साथ बेहतरीन कलेक्शन।",
    },
    features: [
      { title: "Color & Size Matrix", desc: "Instant stock availability per color and size combination." },
      { title: "Accurate Fit Guide", desc: "Interactive size measurements in inches and centimetres." },
      { title: "Breathable Fabrics", desc: "100% pure cotton, linen blends, and skin-friendly textiles." },
      { title: "Hassle-Free Exchange", desc: "Simple 7-day size exchange guarantee on all apparel." },
    ],
    hasWeighingScale: false,
    hasImeiSerialTracking: false,
    hasSizeColorVariants: true,
    hasAisleRackLocation: true,
    hasWarrantyManagement: false,
    hasTechnicalSpecs: false,
    hasSizeChart: true,
    hasCutPreferences: false,
  },

  grocery_supermarket: {
    id: "grocery_supermarket",
    name: "Fresh Grocery & Daily Supermarket",
    shortName: "Grocery & Mart",
    emoji: "🛒",
    tagline: "Farm Fresh Produce, Daily Essentials & Household Staples",
    badgeText: "Daily Fresh Harvest · Best Market Rates · 30m Express",
    recommendedThemeColor: "#059669",
    defaultCategories: [
      "Fresh Fruits & Vegetables",
      "Atta, Rice & Whole Grains",
      "Dals, Pulses & Dry Fruits",
      "Dairy, Bread & Eggs",
      "Edible Oils, Ghee & Masalas",
      "Snacks, Biscuits & Beverages",
      "Cleaning, Detergents & Home",
      "Personal Care & Hygiene",
    ],
    motto: {
      en: "Purity & Daily Savings · Fresh From Farm to Kitchen",
      ta: "சுத்தமும் தினசரி சேமிப்பும் · பண்ணையிலிருந்து நேராக உங்கள் சமையலறைக்கு",
      hi: "शुद्धता और रोज़ाना बचत · खेत से सीधे आपकी रसोई तक",
    },
    subMotto: {
      en: "Handpicked premium staples with quick aisle picking and express doorstep delivery.",
      ta: "கைரேகை தரமான பொருட்கள் மற்றும் அதிவேக வீட்டு விநியோகம்.",
      hi: "सर्वोत्तम गुणवत्ता वाले दैनिक आवश्यक सामान और तेज़ होम डिलीवरी।",
    },
    features: [
      { title: "Digital Scale & Barcodes", desc: "Accurate weighment and barcode checkout for every item." },
      { title: "Aisle & Rack Picking", desc: "Optimized store shelf locations for sub-5-minute store fulfillment." },
      { title: "Daily Fresh Harvest", desc: "Fresh produce sourced directly from farmers at morning wholesale." },
      { title: "Wholesale Pack Savings", desc: "Bulk 5kg/10kg bags with maximum family budget discounts." },
    ],
    hasWeighingScale: true,
    hasImeiSerialTracking: false,
    hasSizeColorVariants: false,
    hasAisleRackLocation: true,
    hasWarrantyManagement: false,
    hasTechnicalSpecs: false,
    hasSizeChart: false,
    hasCutPreferences: false,
  },

  departmental_store: {
    id: "departmental_store",
    name: "Mega Departmental & General Retail Store",
    shortName: "Departmental Store",
    emoji: "🏬",
    tagline: "Everything Under One Roof · Groceries, Lifestyle, Home & Tech",
    badgeText: "All-in-One Mega Store · Best Prices Every Day",
    recommendedThemeColor: "#7c3aed",
    defaultCategories: [
      "Groceries & Food Hall",
      "Home & Kitchen Essentials",
      "Apparel & Footwear",
      "Small Appliances & Electronics",
      "Stationery & Toys",
      "Bath, Beauty & Personal Care",
      "Luggage & Travel Gear",
    ],
    motto: {
      en: "One Stop for Everything · Maximum Variety, Minimum Price",
      ta: "அனைத்திற்கும் ஒரே இடம் · அதிக வகை, குறைந்த விலை",
      hi: "सब कुछ एक ही छत के नीचे · सबसे बड़ी वैरायटी, सबसे कम दाम",
    },
    subMotto: {
      en: "Multi-department shopping with consolidated billing and express checkout.",
      ta: "பல பிரிவுகள் கொண்ட ஷாப்பிங் மற்றும் விரைவான பில்லிங்.",
      hi: "மल्टी-डिपार्टमेंटल शॉपिंग और तेज़ काउंटर बिलिंग।",
    },
    features: [
      { title: "Multi-Department Aisles", desc: "Organized aisle navigation across grocery, fashion, and home goods." },
      { title: "Universal Barcode POS", desc: "Blazing fast billing supporting weighable, sized, and packaged goods." },
      { title: "Consolidated Basket", desc: "Buy food, clothes, and appliances in a single order and invoice." },
      { title: "Instant Store Pickup & Delivery", desc: "Click & Collect in store or door delivery in 45 mins." },
    ],
    hasWeighingScale: true,
    hasImeiSerialTracking: true,
    hasSizeColorVariants: true,
    hasAisleRackLocation: true,
    hasWarrantyManagement: true,
    hasTechnicalSpecs: true,
    hasSizeChart: true,
    hasCutPreferences: false,
  },

  universal: {
    id: "universal",
    name: "Universal Multi-Category Commerce Hub",
    shortName: "Universal Store",
    emoji: "🏪",
    tagline: "Modern Omni-Channel Retail for Any Physical Product",
    badgeText: "All Categories Supported · Fast Delivery",
    recommendedThemeColor: "#0f766e",
    defaultCategories: [
      "General Catalog",
      "Featured Products",
      "Top Sellers",
      "New Arrivals",
      "Offers & Deals",
    ],
    motto: {
      en: "Premium Products · Guaranteed Quality & Fast Delivery",
      ta: "தரமான தயாரிப்புகள் · விரைவான விநியோகம்",
      hi: "प्रीमियम उत्पाद · पक्की गुणवत्ता और तेज़ डिलीवरी",
    },
    subMotto: {
      en: "Engineered for high-volume retail across all product categories.",
      ta: "அனைத்து தயாரிப்புகளுக்கான நவீன வர்த்தக தளம்.",
      hi: "सभी उत्पाद श्रेणियों के लिए आधुनिक कॉमर्स प्लेटफॉर्म।",
    },
    features: [
      { title: "Omni-Channel POS", desc: "High-speed billing counter with barcode and thermal receipt printing." },
      { title: "Serial & Variant Ready", desc: "Supports technical specs, serial numbers, sizes, and colors." },
      { title: "Multi-Branch Isolation", desc: "Independent inventories, staff, and pricing per outlet." },
      { title: "Direct WhatsApp Ordering", desc: "Instant order updates and receipt sharing on WhatsApp." },
    ],
    hasWeighingScale: true,
    hasImeiSerialTracking: true,
    hasSizeColorVariants: true,
    hasAisleRackLocation: true,
    hasWarrantyManagement: true,
    hasTechnicalSpecs: true,
    hasSizeChart: true,
    hasCutPreferences: false,
  },
};

export function getVerticalConfig(vertical?: string | null): VerticalConfig {
  if (!vertical) return VERTICAL_CONFIGS.seafood;
  const key = vertical.toLowerCase().trim() as BusinessVertical;
  if (key in VERTICAL_CONFIGS) {
    return VERTICAL_CONFIGS[key];
  }
  return VERTICAL_CONFIGS.seafood;
}

export const BUSINESS_VERTICALS: VerticalConfig[] = Object.values(VERTICAL_CONFIGS);

export function getVerticalCapabilities(vertical?: string | null) {
  const config = getVerticalConfig(vertical);
  return {
    hasWeighingScale: config.hasWeighingScale,
    hasImeiSerialTracking: config.hasImeiSerialTracking,
    hasSizeColorVariants: config.hasSizeColorVariants,
    hasAisleRackLocation: config.hasAisleRackLocation,
    hasWarrantyManagement: config.hasWarrantyManagement,
    hasTechnicalSpecs: config.hasTechnicalSpecs,
    hasSizeChart: config.hasSizeChart,
    hasCutPreferences: config.hasCutPreferences,
  };
}

export function getVerticalPreset(vertical?: string | null): VerticalConfig {
  return getVerticalConfig(vertical);
}


