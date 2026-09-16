export type BusinessVertical =
  | "seafood"
  | "chicken_meat"
  | "all_meat"
  | "electronics_appliances"
  | "clothing_fashion"
  | "footwear"
  | "snacks_sweets"
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

  footwear: {
    id: "footwear",
    name: "Footwear, Shoes & Sandal Studio",
    shortName: "Footwear",
    emoji: "👟",
    tagline: "Everyday Comfort, Sports Sneakers, Formal Shoes & Casual Slides",
    badgeText: "All Sizes In-Stock (UK 6–11) · 7-Day Exchange Guarantee",
    recommendedThemeColor: "#2563eb",
    defaultCategories: [
      "Sports Shoes & Sneakers",
      "Formal Oxford & Derby Shoes",
      "Everyday Casual Loafers",
      "Sandals & Floaters",
      "Waterproof Chappals & Slides",
      "Kids Footwear",
      "Shoe Care & Insoles",
    ],
    motto: {
      en: "Step Into Comfort · Engineered Durability & Modern Style",
      ta: "ஆறுதலான நடை · நீண்ட உழைப்பு மற்றும் நவீன வடிவமைப்பு",
      hi: "कम्फर्ट और मजबूती का भरोसा · हर कदम पर बेहतरीन स्टाइल",
    },
    subMotto: {
      en: "Full range of UK/India shoe sizes 6 to 11 with cushion arch support and non-slip soles.",
      ta: "அனைத்து அளவுகளிலும் தரமான காலணிகள் மற்றும் எளிதான அளவு மாற்றம்.",
      hi: "सभी साइज में कम्फर्टेबल जूते और चप्पलें, आसान साइज एक्सचेंज के साथ।",
    },
    features: [
      { title: "Exact Shoe Sizes (6–11)", desc: "Clear UK/India sizing charts with half-sizes and wide-fit options." },
      { title: "Ergonomic Cushion Soles", desc: "Memory foam insoles and EVA shock-absorption for all-day comfort." },
      { title: "Waterproof & Monsoon Ready", desc: "Durable PU and rubber slides designed for tough everyday use." },
      { title: "7-Day Size Exchange", desc: "Doorstep size swap if the fit isn't 100% comfortable." },
    ],
    hasWeighingScale: false,
    hasImeiSerialTracking: false,
    hasSizeColorVariants: true,
    hasAisleRackLocation: true,
    hasWarrantyManagement: true,
    hasTechnicalSpecs: true,
    hasSizeChart: true,
    hasCutPreferences: false,
  },

  snacks_sweets: {
    id: "snacks_sweets",
    name: "Crispy Snacks, Namkeen & Pure Ghee Sweets Hub",
    shortName: "Snacks & Namkeen",
    emoji: "🥨",
    tagline: "Freshly Fried Savouries, ₹10/₹20/₹30 Snack Packs & Mithai",
    badgeText: "Fresh & Crispy Daily · ₹10/₹20/₹30 Pocket Packs",
    recommendedThemeColor: "#d97706",
    defaultCategories: [
      "₹10 & ₹20 Snack Packs",
      "₹30 Party Packs",
      "Chips & Crisps",
      "Traditional Murukku & Mixture",
      "Pure Ghee Sweets & Mithai",
      "Roasted Nuts & Savouries",
      "Tea Time & Biscuits",
    ],
    motto: {
      en: "Crispy, Crunchy & Irresistible · Fresh Everyday Flavours",
      ta: "சுவையான மொறுமொறு நொறுக்குத்தீனி · தினசரி புத்தம் புது சுவை",
      hi: "कुरकुरा और लाजवाब स्वाद · रोज़ाना ताज़ा नमकीन और मिठाइयाँ",
    },
    subMotto: {
      en: "Handcrafted savouries, authentic regional murukkus, and festival sweets at affordable everyday prices.",
      ta: "பாரம்பரிய கார வகைகள், நாட்டு முறுக்கு மற்றும் நெய் இனிப்புகள் நியாயமான விலையில்.",
      hi: "पारंपरिक नमकीन, चटपटे चिप्स और शुद्ध घी की मिठाइयाँ सबसे किफायती दामों में।",
    },
    features: [
      { title: "₹10, ₹20, ₹30 Value Packs", desc: "Pocket-friendly single-serve and family sharing packets for quick snacking." },
      { title: "100% Freshly Prepared", desc: "Fried in clean, pure cold-pressed oils with zero stale preservatives." },
      { title: "Airtight Seal Packaging", desc: "Pouch packaging locks in crisp crunchiness for days." },
      { title: "Bulk & Party Boxes", desc: "Wholesale 500g, 1kg, and 2kg tins for celebrations and corporate events." },
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

export function detectVerticalFromStoreName(storeName?: string | null): BusinessVertical {
  if (!storeName) return "seafood";
  const name = storeName.toLowerCase();

  if (name.includes("fish") || name.includes("seafood") || name.includes("meen") || name.includes("marine") || name.includes("harbour") || name.includes("dock") || name.includes("prawn") || name.includes("crab") || name.includes("salmon") || name.includes("catch")) {
    return "seafood";
  }
  if (name.includes("chicken") || name.includes("mutton") || name.includes("meat") || name.includes("poultry") || name.includes("butcher") || name.includes("halal") || name.includes("kozhi")) {
    if (name.includes("fish") || name.includes("superstore")) return "all_meat";
    return "chicken_meat";
  }
  if (name.includes("grocery") || name.includes("supermarket") || name.includes("mart") || name.includes("organic") || name.includes("harvest") || name.includes("veggie") || name.includes("vegetable") || name.includes("fruit") || name.includes("kirana") || name.includes("provision")) {
    return "grocery_supermarket";
  }
  if (name.includes("electronic") || name.includes("mobile") || name.includes("gadget") || name.includes("appliance") || name.includes("tech") || name.includes("laptop") || name.includes("computer")) {
    return "electronics_appliances";
  }
  if (name.includes("fashion") || name.includes("clothing") || name.includes("apparel") || name.includes("textile") || name.includes("garment") || name.includes("boutique") || name.includes("wear") || name.includes("saree") || name.includes("dress")) {
    return "clothing_fashion";
  }
  if (
    name.includes("snack") ||
    name.includes("namkeen") ||
    name.includes("chips") ||
    name.includes("murukku") ||
    name.includes("mixture") ||
    name.includes("sweet") ||
    name.includes("mithai") ||
    name.includes("bakery") ||
    name.includes("bikkis") ||
    name.includes("biscuit") ||
    name.includes("savouries") ||
    name.includes("haldiram") ||
    name.includes("20rs") ||
    name.includes("30rs") ||
    name.includes("hot chips") ||
    name.includes("chaat") ||
    name.includes("bikanervala") ||
    name.includes("anand sweets")
  ) {
    return "snacks_sweets";
  }
  if (
    name.includes("footwear") ||
    name.includes("shoe") ||
    name.includes("chappal") ||
    name.includes("sandal") ||
    name.includes("sneaker") ||
    name.includes("boot") ||
    name.includes("slipper") ||
    name.includes("crocs") ||
    name.includes("bata") ||
    name.includes("khadim") ||
    name.includes("metro shoes") ||
    name.includes("walkwell") ||
    name.includes("sole") ||
    name.includes("heel")
  ) {
    return "footwear";
  }
  if (name.includes("departmental") || name.includes("hypermarket") || name.includes("mall") || name.includes("bazaar")) {
    return "departmental_store";
  }
  return "seafood";
}

export function getStoreVertical(settings?: { business_vertical?: string | null; store_name?: string | null } | null): VerticalConfig {
  if (settings?.business_vertical && settings.business_vertical in VERTICAL_CONFIGS) {
    return VERTICAL_CONFIGS[settings.business_vertical as BusinessVertical];
  }
  if (settings?.store_name) {
    const detected = detectVerticalFromStoreName(settings.store_name);
    return VERTICAL_CONFIGS[detected];
  }
  return VERTICAL_CONFIGS.seafood;
}

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

export function getVerticalSearchPlaceholder(vertical: BusinessVertical, storeName?: string): string {
  const name = storeName || "our store";
  switch (vertical) {
    case "seafood":
      return "Search fresh fish, tiger prawns, crab, or local catch (e.g. Vanjaram, Nethili)…";
    case "chicken_meat":
      return "Search tender chicken, country chicken, mutton, biryani cut, fresh eggs…";
    case "all_meat":
      return "Search chicken, mutton, fish, prawns, tender keema, eggs…";
    case "grocery_supermarket":
      return "Search organic vegetables, fruits, atta, rice, dal, oils, spices, dairy…";
    case "electronics_appliances":
      return "Search smartphones, smart TVs, laptops, headphones, kitchen appliances…";
    case "clothing_fashion":
      return "Search shirts, sarees, jeans, casual wear, dresses, footwear…";
    case "footwear":
      return "Search sports sneakers, formal leather shoes, daily comfort sandals, chappals (Size 6-11)…";
    case "snacks_sweets":
      return "Search spicy mixture, potato chips, murukku, ₹20/₹30 snack packs, ghee sweets…";
    case "departmental_store":
      return `Search across all departments in ${name} (groceries, home, lifestyle)…`;
    case "universal":
    default:
      return `Search products, brands, or categories in ${name}…`;
  }
}

export function getVerticalProductTerm(vertical: BusinessVertical): { singular: string; plural: string } {
  switch (vertical) {
    case "seafood":
      return { singular: "Catch", plural: "Catches" };
    case "chicken_meat":
    case "all_meat":
      return { singular: "Cut", plural: "Cuts" };
    case "grocery_supermarket":
      return { singular: "Item", plural: "Items" };
    case "footwear":
      return { singular: "Pair", plural: "Pairs" };
    case "snacks_sweets":
      return { singular: "Pack", plural: "Packs" };
    case "electronics_appliances":
    case "clothing_fashion":
    case "departmental_store":
    case "universal":
    default:
      return { singular: "Product", plural: "Products" };
  }
}

export function getVerticalCutOptions(vertical: BusinessVertical): string[] {
  switch (vertical) {
    case "seafood":
      return [
        "Curry Cut",
        "Biryani Cut",
        "Fillet / Boneless",
        "Whole Cleaned (Head On)",
        "Whole Cleaned (Head Off)",
        "Steaks / Slices",
      ];
    case "chicken_meat":
    case "all_meat":
      return [
        "Biryani Cut (Large)",
        "Curry Cut (Medium)",
        "Boneless / Breast Fillet",
        "Keema / Minced Meat",
        "Drumsticks Only",
        "Whole Cleaned & Dressed",
      ];
    case "grocery_supermarket":
      return [
        "Standard Pack",
        "Washed & Cleaned",
        "Diced / Pre-cut",
        "Whole / Uncut",
      ];
    case "footwear":
      return [
        "UK/India Size 6",
        "UK/India Size 7",
        "UK/India Size 8",
        "UK/India Size 9",
        "UK/India Size 10",
        "UK/India Size 11",
      ];
    case "snacks_sweets":
      return [
        "₹10 Pocket Pack",
        "₹20 Value Pack",
        "₹30 Party Pack",
        "250g Fresh Box",
        "500g Family Pack",
        "1kg Bulk Tin",
      ];
    default:
      return ["Standard Packaging", "Gift Wrapped", "Eco-Friendly Bag"];
  }
}

export function getVerticalUnitOptions(vertical: BusinessVertical): string[] {
  switch (vertical) {
    case "seafood":
    case "chicken_meat":
    case "all_meat":
      return ["kg", "500g", "250g", "pack", "unit"];
    case "grocery_supermarket":
      return ["kg", "g", "500g", "liter", "ml", "pack", "bunch", "unit"];
    case "footwear":
      return ["pair", "unit", "box"];
    case "snacks_sweets":
      return ["pkt", "pack", "250g", "500g", "kg", "box", "piece"];
    case "electronics_appliances":
      return ["unit", "piece", "set", "pack"];
    case "clothing_fashion":
      return ["piece", "pair", "set", "unit"];
    default:
      return ["unit", "piece", "kg", "pack", "set"];
  }
}

export interface VerticalFormFields {
  namePlaceholder: string;
  tamilNamePlaceholder: string;
  brandPlaceholder: string;
  skuPlaceholder: string;
  locationPlaceholder: string;
  specsPlaceholder: string;
  descriptionPlaceholder: string;
  units: string[];
  refillPresets: string[];
  wasteReasonPlaceholder: string;
  reviewPlaceholder: string;
  customRequestPlaceholder: string;
  supplierPlaceholder: string;
  supplierNotePlaceholder: string;
}

export function getVerticalFormFields(vertical: BusinessVertical, storeName?: string): VerticalFormFields {
  const name = storeName || "our store";
  switch (vertical) {
    case "footwear":
      return {
        namePlaceholder: "e.g. Apex Pro Running Shoes (UK 6-11), Regal Oxford Derby, SoftStep Sandals",
        tamilNamePlaceholder: "e.g. காலணி, விளையாட்டு காலணி, தோல் காலணி",
        brandPlaceholder: "e.g. Puma, Bata, Nike, Paragon, Sparx, Woodland, Campus",
        skuPlaceholder: "e.g. FTW-RUN-01, OXF-UK-08, SND-BRN-09",
        locationPlaceholder: "e.g. Shoe Rack A-1, Display Shelf 2, Bin 4",
        specsPlaceholder: "Size Range: UK 6-11 | Sole: EVA Cushion | Upper: Breathable Mesh | Closure: Lace-up",
        descriptionPlaceholder: "High-rebound cushioning athletic shoe for daily running, jogging, and gym workouts. Anti-skid sole with 7-day size exchange guarantee.",
        units: ["pair", "unit", "box", "set", "custom"],
        refillPresets: ["5", "10", "20", "50"],
        wasteReasonPlaceholder: "e.g. Damaged sole box, display scuff mark, transit return defect, sizing pair mismatch",
        reviewPlaceholder: "How was the fit, comfort, arch support, and sole durability?",
        customRequestPlaceholder: "e.g. Looking for Size UK 10 in Black Formal Derby or White Sneakers",
        supplierPlaceholder: "e.g. Metro Footwear Distributors, Bata Regional Hub",
        supplierNotePlaceholder: "Box carton condition, batch size assortment (UK 6-11), 7-day return guarantee terms...",
      };
    case "snacks_sweets":
      return {
        namePlaceholder: "e.g. Crispy Masala Potato Chips (₹20), Ribbon Murukku (₹30), Pure Ghee Mysore Pak",
        tamilNamePlaceholder: "e.g. உருளைக்கிழங்கு சிப்ஸ், கை முறுக்கு, நெய் மைசூர் பாக்",
        brandPlaceholder: "e.g. Grand Sweets, Sri Krishna, Lays, Haldiram's, A2B, Balaji",
        skuPlaceholder: "e.g. SNK-20-CHP, MRK-30-PKT, SWT-MP-250",
        locationPlaceholder: "e.g. Snack Stand S-1, Sweet Counter #1, Aisle 1 Rack B",
        specsPlaceholder: "Pack Size: ₹20 (85g) | Shelf Life: 4 Months | Veg: 100% Pure Veg | Oil: Cold-Pressed Groundnut",
        descriptionPlaceholder: "Crispy golden fried savouries prepared in fresh cold-pressed oil with zero trans fats. Airtight moisture-proof pouch locks in crunchiness.",
        units: ["pack", "pkt", "box", "kg", "g", "500g", "250g", "custom"],
        refillPresets: ["10", "25", "50", "100"],
        wasteReasonPlaceholder: "e.g. Crushed packet in transit, expired shelf-life date, torn pouch seal",
        reviewPlaceholder: "How was the crunchiness, spice balance, taste, and freshness?",
        customRequestPlaceholder: "e.g. Looking for ₹20 Ribbon Murukku, Madras Mixture 500g, or Fresh Tirunelveli Halwa",
        supplierPlaceholder: "e.g. Sri Krishna Sweets Wholesalers, Grand Sweets Depot",
        supplierNotePlaceholder: "Fresh batch manufacturing date, airtight carton sealing, pure ghee certification...",
      };
    case "electronics_appliances":
      return {
        namePlaceholder: "e.g. Apple iPhone 15 128GB, Samsung 55-inch 4K TV, boAt Rockerz 450",
        tamilNamePlaceholder: "e.g. ஸ்மார்ட்போன், எல்இடி டிவி, புளூடூத் ஹெட்போன்",
        brandPlaceholder: "e.g. Apple, Samsung, Sony, boAt, Dell, LG, OnePlus",
        skuPlaceholder: "e.g. A3090, UA55-4K, DEL-3520, BOAT-450",
        locationPlaceholder: "e.g. Tech Showcase A-1, Aisle 2 Rack 3, Locker B",
        specsPlaceholder: "RAM: 8GB | Storage: 256GB SSD | Screen: 15.6 FHD | Battery: 54Wh | Warranty: 1 Year",
        descriptionPlaceholder: "High performance smart device engineered with industry-leading components and official 1-year manufacturer warranty support.",
        units: ["unit", "piece", "set", "pack", "box", "custom"],
        refillPresets: ["2", "5", "10", "20"],
        wasteReasonPlaceholder: "e.g. Scratched display unit, transit vibration shock, dead on arrival (DOA)",
        reviewPlaceholder: "How was the build quality, battery life, performance, and screen display?",
        customRequestPlaceholder: "e.g. Looking for specific 65-inch OLED TV model or 65W GaN adapter",
        supplierPlaceholder: "e.g. Ingram Micro India, Redington Electronics Dist.",
        supplierNotePlaceholder: "Serial number manifest, seal intact verification, GST input invoice...",
      };
    case "clothing_fashion":
      return {
        namePlaceholder: "e.g. Men Pure Cotton Slim Fit Oxford Shirt, Women Rayon Anarkali Kurti",
        tamilNamePlaceholder: "e.g. பருத்தி சட்டை, சுடிதார், ஜீன்ஸ் பேன்ட்",
        brandPlaceholder: "e.g. Allen Solly, Levi's, Peter England, Biba, Zara, Raymond",
        skuPlaceholder: "e.g. SHT-OXF-M, JNS-511-32, KRT-BB-09",
        locationPlaceholder: "e.g. Hanger Rack 2, Section B, Shelf 4",
        specsPlaceholder: "Fabric: 100% Pure Cotton | Fit: Slim Fit | Size: M (38) | Pattern: Solid | Care: Machine Wash",
        descriptionPlaceholder: "Breathable pure cotton apparel designed for comfortable daily and formal wear with reinforced stitching and color-fast dyes.",
        units: ["piece", "pair", "set", "pack", "dozen", "custom"],
        refillPresets: ["10", "25", "50", "100"],
        wasteReasonPlaceholder: "e.g. Fabric weave defect, dye stain, loose stitching, customer trial tear",
        reviewPlaceholder: "How was the fabric feel, fit, stitching quality, and color vibrancy?",
        customRequestPlaceholder: "e.g. Looking for Pure Linen Shirt Size 42 or Kanchipuram Silk Saree",
        supplierPlaceholder: "e.g. Tirupur Apparel Mill, Raymond Textile Agency",
        supplierNotePlaceholder: "GSM fabric specification, size ratio carton pack, color assortment...",
      };
    case "grocery_supermarket":
      return {
        namePlaceholder: "e.g. Sona Masoori Raw Rice 5kg, Tata Sampann Toor Dal 1kg, Sunlite Sunflower Oil 1L",
        tamilNamePlaceholder: "e.g. சோனா மசூரி அரிசி, துவரம் பருப்பு, கடலை எண்ணெய்",
        brandPlaceholder: "e.g. Tata Sampann, Aashirvaad, Fortune, Amul, Britannia, Daawat",
        skuPlaceholder: "e.g. ATT-10K, DAL-1K, OIL-1L, BAS-5K",
        locationPlaceholder: "e.g. Aisle 1 Shelf C, Grain Bin 4, Cold Chiller #1",
        specsPlaceholder: "Net Weight: 5kg | Grade: Premium Aged | Shelf Life: 12 Months | Packaging: Airtight",
        descriptionPlaceholder: "Farm-fresh natural produce and staples sourced directly from certified farms with strict quality assurance and unadulterated purity.",
        units: ["kg", "g", "500g", "pack", "pc", "liter", "ml", "box", "dozen", "custom"],
        refillPresets: ["5", "10", "25", "50"],
        wasteReasonPlaceholder: "e.g. Overripe vegetable, broken packaging bag, spilled grain, expired dairy seal",
        reviewPlaceholder: "How was the freshness, taste, cooking quality, and packaging?",
        customRequestPlaceholder: "e.g. Looking for Brown Basmati Rice 5kg or Cold-Pressed Virgin Coconut Oil",
        supplierPlaceholder: "e.g. APMC Grain Market, Organic Farmer Federation",
        supplierNotePlaceholder: "FSSAI batch test report, moisture level < 12%, organic certification...",
      };
    case "chicken_meat":
      return {
        namePlaceholder: "e.g. Farm Fresh Chicken Curry Cut, Country Chicken (Nattu Kozhi), Tender Mutton Curry Cut",
        tamilNamePlaceholder: "e.g. பண்ணைக்கோழி, நாட்டுக்கோழி, ஆட்டிறைச்சி",
        brandPlaceholder: "e.g. Suguna, Godrej Real Good, Farm Fresh Co, Local Certified Halal Hub",
        skuPlaceholder: "e.g. CHK-CUR-1K, NAT-KOZ-1K, MUT-BRL-1K",
        locationPlaceholder: "e.g. Fresh Meat Chiller #1, Deep Chiller -2°C, Counter Display",
        specsPlaceholder: "Feed: 100% Vegetarian Bio-Secure | Halal: Certified | Cut: Curry Cut | Temp: 0-4°C",
        descriptionPlaceholder: "Tender antibiotic-free farm poultry and meat, humanely processed and hygienic halal butchery cuts vacuum-packed and delivered chilled.",
        units: ["kg", "g", "500g", "250g", "pack", "tray", "pc", "custom"],
        refillPresets: ["5", "10", "25", "50"],
        wasteReasonPlaceholder: "e.g. Trimming wastage, fat removal loss, skinning loss, overnight unsold spoilage",
        reviewPlaceholder: "How was the tenderness, juiciness, freshness, and butchery cut?",
        customRequestPlaceholder: "e.g. Looking for Country Chicken (Nattu Kozhi) or Tender Mutton Chops",
        supplierPlaceholder: "e.g. Bio-Secure Poultry Farm, Certified Halal Livestock Mandi",
        supplierNotePlaceholder: "Antibiotic-free lab certificate, morning dispatch temperature 2°C, halal slaughter certificate...",
      };
    case "all_meat":
      return {
        namePlaceholder: "e.g. Vanjaram Fish Steaks, Tender Goat Mutton, Broiler Chicken Curry Cut, Tiger Prawns",
        tamilNamePlaceholder: "e.g. வஞ்சிரம், ஆட்டிறைச்சி, கோழி இறைச்சி, இறால்",
        brandPlaceholder: "e.g. FreshCo Superstore, Kasimedu Dock, Suguna",
        skuPlaceholder: "e.g. VNJ-1K, MUT-1K, CHK-1K, PRW-500G",
        locationPlaceholder: "e.g. Fish Chiller A, Meat Freezer B, Display Showcase",
        specsPlaceholder: "Origin: Daily Fresh Harvest | Halal: 100% Certified | Temperature: 0-2°C on Flake Ice",
        descriptionPlaceholder: "All-in-one fresh meat and seafood superstore selection. Cleaned, prepped, and packed fresh on order within temperature-controlled processing rooms.",
        units: ["kg", "g", "500g", "250g", "pack", "tray", "pc", "custom"],
        refillPresets: ["5", "10", "25", "50"],
        wasteReasonPlaceholder: "e.g. Trimming & gutting wastage, melted ice on top layer, bone write-off",
        reviewPlaceholder: "How was the tenderness, freshness, taste, and cutting quality?",
        customRequestPlaceholder: "e.g. Looking for Vanjaram Steaks (>1kg) and Tender Mutton Biryani Cut",
        supplierPlaceholder: "e.g. Kasimedu Harbour & Livestock Mandi",
        supplierNotePlaceholder: "Harbour landing grade-A inspection, cold chain ice sheet, food-grade transport...",
      };
    case "seafood":
      return {
        namePlaceholder: "e.g. Vanjaram / King Fish (Seer), Fresh Tiger Prawns, Black Pomfret, Nethili",
        tamilNamePlaceholder: "e.g. வஞ்சிரம் மீன், காரைப்பொடி, இறால், வவ்வால்",
        brandPlaceholder: "e.g. Kasimedu Dock, Daily Fresh Catch, Rameshwaram Fish Co",
        skuPlaceholder: "e.g. VNJ-1KG, POM-500G, PRW-1KG, NETH-500G",
        locationPlaceholder: "e.g. Ice Display Chiller A, Deep Freezer 2, Live Shellfish Tank",
        specsPlaceholder: "Catch: Wild Sea Catch | Clean Rate: ~80% Net Yield | Storage: 0-4°C on Food-Grade Flake Ice",
        descriptionPlaceholder: "Wild ocean catch landed at local fishing harbour, cleaned and vacuum-packed on food-grade flake ice within hours of harvest.",
        units: ["kg", "g", "500g", "250g", "pc", "pack", "tray", "custom"],
        refillPresets: ["5", "10", "25", "50"],
        wasteReasonPlaceholder: "e.g. Head & gutting trimming loss, descaling waste, overnight uniced spoilage",
        reviewPlaceholder: "How was the ocean freshness, meat firmness, taste, and master cutting?",
        customRequestPlaceholder: "e.g. Looking for Big Size Vanjaram (>2kg) or Fresh Blue Mud Crab",
        supplierPlaceholder: "e.g. Kasimedu Deep Sea Trawlers Association",
        supplierNotePlaceholder: "Boat registration, dawn auction lot, zero chemical / formalin certified...",
      };
    case "departmental_store":
    case "universal":
    default:
      return {
        namePlaceholder: `e.g. Quality Retail Item / Product Name in ${name}`,
        tamilNamePlaceholder: "e.g. பொருளின் பெயர் / விவரம்",
        brandPlaceholder: "e.g. Premium Brand / In-House",
        skuPlaceholder: "e.g. SKU-1001, PRD-01",
        locationPlaceholder: "e.g. Aisle 1, Shelf B, Rack 3",
        specsPlaceholder: "Key: Value | Model: Standard | Warranty: As Applicable",
        descriptionPlaceholder: `High quality product sourced and curated for customers of ${name}, backed by our customer satisfaction guarantee.`,
        units: ["pc", "pack", "kg", "box", "pair", "set", "unit", "custom"],
        refillPresets: ["5", "10", "25", "50"],
        wasteReasonPlaceholder: "e.g. Damaged inventory packaging, transit handling loss, expired stock",
        reviewPlaceholder: "Share your experience with this item's quality, durability, and value",
        customRequestPlaceholder: "e.g. Looking for a specific brand, model, size, or variety",
        supplierPlaceholder: `e.g. ${name} Central Distribution Warehouse`,
        supplierNotePlaceholder: "Delivery dispatch lot, purchase order terms, barcode verification...",
      };
  }
}

export function getVerticalFaqs(vertical: BusinessVertical, storeName: string): { question: string; answer: string }[] {
  switch (vertical) {
    case "chicken_meat":
    case "all_meat":
      return [
        {
          question: `Is the meat at ${storeName} 100% fresh and antibiotic-free?`,
          answer: `Yes, all poultry and meat at ${storeName} is raised ethically in bio-secure farms with zero antibiotics or artificial growth promoters. Each order is cut fresh on order.`,
        },
        {
          question: "How fast is delivery to my doorstep?",
          answer: "We deliver within 30 to 45 minutes of order confirmation in temperature-controlled insulated cold-boxes to preserve peak juiciness and tenderness.",
        },
        {
          question: "Can I choose customized butcher cuts?",
          answer: "Absolutely. Choose Biryani cut, Curry cut, Boneless fillet, or tender Keema during checkout at zero extra charge.",
        },
        {
          question: "What payment methods are supported?",
          answer: "We accept Cash on Delivery (COD), UPI QR scan at doorstep (Google Pay, PhonePe, Paytm), and instant WhatsApp ordering.",
        },
      ];
    case "grocery_supermarket":
      return [
        {
          question: `Are fresh vegetables and fruits at ${storeName} sourced daily?`,
          answer: `Yes, fresh produce at ${storeName} is harvested daily and sourced directly from verified farmer clusters every morning with strict pesticide-free quality checks.`,
        },
        {
          question: "What is the delivery turnaround time?",
          answer: "We offer express 30-minute delivery for daily essentials as well as convenient scheduled morning and evening delivery slots.",
        },
        {
          question: "Can I order wholesale and family budget packs?",
          answer: "Yes, 5kg and 10kg bulk bags for staple grains, rice, and atta are available with maximum budget savings.",
        },
        {
          question: "Can I place my grocery order directly on WhatsApp?",
          answer: "Yes! Use our 1-click 'Order on WhatsApp' button in your cart to dispatch your itemized grocery list directly to our order desk.",
        },
      ];
    case "electronics_appliances":
      return [
        {
          question: `Are all electronics and gadgets at ${storeName} 100% original?`,
          answer: `Yes, ${storeName} sells only 100% brand-genuine products with verified serial/IMEI numbers and official manufacturer warranty valid pan-India.`,
        },
        {
          question: "Do you provide GST tax invoices for business input credit?",
          answer: "Yes, all orders include a downloadable GST tax invoice with full HSN code, GSTIN, and serial number breakdown.",
        },
        {
          question: "How are high-value products packed for transit?",
          answer: "High-value electronics are packed in shock-proof tamper-evident sealed packaging with delivery PIN verification at doorstep.",
        },
        {
          question: "What is your return and warranty policy?",
          answer: "All items carry full brand warranty support plus an immediate 7-day DOA (dead on arrival) replacement guarantee.",
        },
      ];
    case "clothing_fashion":
      return [
        {
          question: `How do I ensure the right fit when shopping at ${storeName}?`,
          answer: "Every apparel item features an accurate size chart in inches and centimeters. If the fit isn't perfect, we offer a hassle-free 7-day size exchange.",
        },
        {
          question: "What fabrics are used in your apparel collection?",
          answer: "We specialize in premium breathable natural fibers including 100% pure combed cotton, linen blends, and handcrafted textiles.",
        },
        {
          question: "Can I order multiple sizes to try on?",
          answer: "Yes, you can order your preferred sizes and try them with our easy exchange policy.",
        },
        {
          question: "How fast will my fashion order arrive?",
          answer: "Orders are dispatched express and delivered within 24 to 48 hours with live tracking.",
        },
      ];
    case "snacks_sweets":
      return [
        {
          question: `Are the snacks and savouries at ${storeName} freshly prepared daily?`,
          answer: `Yes, all potato chips, murukku, mixture, and savouries at ${storeName} are prepared fresh daily in pure, unadulterated cold-pressed edible oils.`,
        },
        {
          question: "Do you have single-serve ₹10, ₹20, and ₹30 snack packs?",
          answer: "Yes! We offer a full range of budget-friendly ₹10, ₹20, and ₹30 packets alongside 250g, 500g, and 1kg family sharing packs.",
        },
        {
          question: "How long do the snacks maintain their crisp crunch?",
          answer: "Our airtight, nitrogen-sealed packaging keeps savouries crisp, fresh, and crunchy for up to 60 days from packaging.",
        },
        {
          question: "Can I order snack combos directly via WhatsApp?",
          answer: "Yes! Simply add your favorite snack packs to your cart and tap 'Order on WhatsApp' for instant dispatch.",
        },
      ];
    case "footwear":
      return [
        {
          question: `What shoe sizes are available at ${storeName}?`,
          answer: `We stock full Indian / UK shoe sizes from Size 6 up to Size 11 across all sports, formal, and casual models with accurate size charts.`,
        },
        {
          question: "What if the footwear does not fit properly?",
          answer: "We offer a 100% hassle-free 7-day doorstep size exchange policy. If the shoe is too tight or loose, our rider will swap it for the right size.",
        },
        {
          question: "Are your sandals and slides waterproof for rainy season?",
          answer: "Yes, our daily comfort slides and chappals are engineered with high-grade anti-slip EVA and waterproof PU materials ideal for rainy weather.",
        },
        {
          question: "How fast is delivery for footwear orders?",
          answer: "Orders are dispatched express within 24 to 48 hours in premium protective shoe boxes.",
        },
      ];
    case "seafood":
    default:
      return [
        {
          question: `Is seafood from ${storeName} guaranteed 100% chemical-free and fresh?`,
          answer: `Yes, our seafood is sourced daily directly from coastal harbor boats and trawlers. We never use ammonia, formalin, or chemical preservatives — our catch is preserved strictly in food-grade crushed sea ice.`,
        },
        {
          question: "How fast is the delivery to my doorstep?",
          answer: "We deliver within 35 to 45 minutes of order confirmation, packed in temperature-controlled insulated ice boxes with live driver GPS tracking and secret delivery PIN.",
        },
        {
          question: "Can I choose custom cutting styles for my fish?",
          answer: "Yes, you can customize your cuts (curry cut, slice/steaks, whole cleaned with gills removed, or head/tail separated) at zero extra charge.",
        },
        {
          question: "What payment methods are supported?",
          answer: "We accept Cash on Delivery (COD), UPI QR scan at doorstep (Google Pay, PhonePe, Paytm), and instant WhatsApp ordering.",
        },
      ];
  }
}


