import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "@/lib/authz.server";
import { detectVerticalFromStoreName, type BusinessVertical } from "@/lib/verticals";

export interface SeedCatalogResult {
  success: boolean;
  inserted: number;
  vertical?: string;
  error?: string;
}

export const REAL_SEAFOOD_PRODUCTS = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    pos_code: 1,
    name: "Vanjaram / Seer Fish (King Mackerel)",
    name_ta: "வஞ்சிரம் மீன்",
    category_slug: "sea-fish",
    category_name: "Sea Fish",
    price: 950,
    original_mrp: 1100,
    unit: "kg",
    stock: 45,
    image_url: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800",
    description: "The undisputed king of South Indian seafood. Dock-fresh from Kasimedu, expertly cut into thick steak slices or round curry pieces. 100% chemical-free.",
    ai_benefits_summary: "High in Omega-3 fatty acids, supports heart health, rich in high-quality lean protein.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0302",
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    pos_code: 2,
    name: "White Pomfret (Vellai Vavval)",
    name_ta: "வெள்ளை வவ்வால்",
    category_slug: "sea-fish",
    category_name: "Sea Fish",
    price: 880,
    original_mrp: 1050,
    unit: "kg",
    stock: 30,
    image_url: "https://images.unsplash.com/photo-1534943441045-125078d6b8ec?w=800",
    description: "Prized for delicate, sweet meat and minimal bones. Perfect for deep tawa fry or steaming with coastal spice rub.",
    ai_benefits_summary: "Extremely low in saturated fats, rich in Vitamin D and B12 for cognitive vitality.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0302",
  },
  {
    id: "a0000000-0000-0000-0000-000000000003",
    pos_code: 3,
    name: "Black Pomfret (Karuppu Vavval)",
    name_ta: "கருப்பு வவ்வால்",
    category_slug: "sea-fish",
    category_name: "Sea Fish",
    price: 680,
    original_mrp: 800,
    unit: "kg",
    stock: 35,
    image_url: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800",
    description: "Rich, flavorful dark meat with an appetizing ocean aroma. Highly recommended for rich fish curries and masala grill.",
    ai_benefits_summary: "Rich source of phosphorus, selenium, and essential amino acids.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0302",
  },
  {
    id: "a0000000-0000-0000-0000-000000000004",
    pos_code: 4,
    name: "Kasimedu Tiger Prawns (Jumbo)",
    name_ta: "புலி இறால் (பெரியது)",
    category_slug: "prawns-shellfish",
    category_name: "Prawns & Shellfish",
    price: 720,
    original_mrp: 850,
    unit: "kg",
    stock: 50,
    image_url: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=800",
    description: "Succulent, crisp coastal tiger prawns. Cleaned and deveined on order. Ideal for butter garlic prawns or spicy biryani.",
    ai_benefits_summary: "Packed with astaxanthin antioxidant, high zinc and iron content.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0306",
  },
  {
    id: "a0000000-0000-0000-0000-000000000005",
    pos_code: 5,
    name: "Live Sea Mud Crab (Nandu)",
    name_ta: "உயிருள்ள நண்டு",
    category_slug: "prawns-shellfish",
    category_name: "Prawns & Shellfish",
    price: 640,
    original_mrp: 750,
    unit: "kg",
    stock: 25,
    image_url: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=800",
    description: "Fresh live coastal crabs with sweet, tender claw meat. Unbeatable in Chettinad crab masala and immunity-boosting pepper soup.",
    ai_benefits_summary: "Exceptional remedy for cold/congestion, loaded with bio-available copper and calcium.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0306",
  },
  {
    id: "a0000000-0000-0000-0000-000000000006",
    pos_code: 6,
    name: "Red Snapper (Sankara)",
    name_ta: "சங்கரா மீன்",
    category_slug: "sea-fish",
    category_name: "Sea Fish",
    price: 480,
    original_mrp: 580,
    unit: "kg",
    stock: 40,
    image_url: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800",
    description: "Firm, flaky pink-scaled ocean fish. Absorbs tangy tamarind and spicy coconut gravies effortlessly.",
    ai_benefits_summary: "Low calorie density with high potassium, supports blood pressure regulation.",
    is_active: true,
    is_featured: false,
    is_bestseller: false,
    hsn_code: "0302",
  },
  {
    id: "a0000000-0000-0000-0000-000000000007",
    pos_code: 7,
    name: "White Anchovy (Nethili)",
    name_ta: "நெத்திலி மீன்",
    category_slug: "sea-fish",
    category_name: "Sea Fish",
    price: 280,
    original_mrp: 340,
    unit: "kg",
    stock: 60,
    image_url: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800",
    description: "Fresh small ocean anchovies. Cleaned head-off. Crisp golden fry favorite for all age groups.",
    ai_benefits_summary: "Consumed whole with soft bones for supreme natural calcium and bone health.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0302",
  },
  {
    id: "a0000000-0000-0000-0000-000000000008",
    pos_code: 8,
    name: "Fresh Squid / Calamari (Kanava)",
    name_ta: "கணவாய் மீன்",
    category_slug: "prawns-shellfish",
    category_name: "Prawns & Shellfish",
    price: 520,
    original_mrp: 620,
    unit: "kg",
    stock: 28,
    image_url: "https://images.unsplash.com/photo-1608797178974-15b35a61dd75?w=800",
    description: "Cleaned squid rings and tubes with no grit or ink. Mild flavor, tender texture, perfect for stir-fries and pepper roast.",
    ai_benefits_summary: "Rich in Vitamin B2 (Riboflavin) and choline for nervous system health.",
    is_active: true,
    is_featured: false,
    is_bestseller: false,
    hsn_code: "0307",
  },
];

export const REAL_CHICKEN_MEAT_PRODUCTS = [
  {
    id: "m0000000-0000-0000-0000-000000000001",
    pos_code: 101,
    name: "Farm Fresh Chicken (Curry Cut)",
    name_ta: "பண்ணை கோழி கறி வெட்டு",
    category_slug: "farm-chicken",
    category_name: "Farm Fresh Chicken",
    price: 240,
    original_mrp: 280,
    unit: "kg",
    stock: 50,
    image_url: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800",
    description: "Tender, succulent broiler chicken expertly cut into bite-sized curry portions. 100% antibiotic-free and Halal certified.",
    ai_benefits_summary: "High quality lean protein, supports muscle building and cellular recovery.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0207",
  },
  {
    id: "m0000000-0000-0000-0000-000000000002",
    pos_code: 102,
    name: "Country Chicken / Nattu Kozhi",
    name_ta: "நாட்டுக்கோழி முழுதும்",
    category_slug: "farm-chicken",
    category_name: "Farm Fresh Chicken",
    price: 440,
    original_mrp: 520,
    unit: "kg",
    stock: 35,
    image_url: "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800",
    description: "Free-range pasture-raised country chicken. Robust bone marrow flavor, ideal for traditional village medicinal soup and gravies.",
    ai_benefits_summary: "Rich in natural collagen, carnosine, and bioavailable iron.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0207",
  },
  {
    id: "m0000000-0000-0000-0000-000000000003",
    pos_code: 103,
    name: "Tender Mountain Goat / Mutton (Curry Cut)",
    name_ta: "ஆட்டிறைச்சி கறி வெட்டு",
    category_slug: "tender-mutton",
    category_name: "Tender Mutton",
    price: 860,
    original_mrp: 980,
    unit: "kg",
    stock: 30,
    image_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800",
    description: "Prime grass-fed tender young goat. Sourced from organic pastures, perfectly balanced with meat and soft marrow bones.",
    ai_benefits_summary: "Dense source of heme iron, zinc, and B-complex vitamins for stamina.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0204",
  },
  {
    id: "m0000000-0000-0000-0000-000000000004",
    pos_code: 104,
    name: "Chicken Breast Boneless Fillet",
    name_ta: "எலும்பில்லா கோழி நெஞ்சுக்கறி",
    category_slug: "farm-chicken",
    category_name: "Farm Fresh Chicken",
    price: 340,
    original_mrp: 400,
    unit: "kg",
    stock: 40,
    image_url: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800",
    description: "Ultra-lean, skinless chicken breast fillets. Perfect for pan-searing, meal prep, fitness diets, and healthy salads.",
    ai_benefits_summary: "High protein, ultra low fat, zero carbohydrates. Ideal for fitness goals.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0207",
  },
  {
    id: "m0000000-0000-0000-0000-000000000005",
    pos_code: 105,
    name: "Farm Fresh Country Eggs (Pack of 12)",
    name_ta: "பண்ணை நாட்டுக்கோழி முட்டைகள்",
    category_slug: "farm-eggs",
    category_name: "Fresh Farm Eggs",
    price: 120,
    original_mrp: 140,
    unit: "pack",
    stock: 100,
    image_url: "https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=800",
    description: "Golden yolk, farm-collected brown eggs from pasture-fed hens. Cleaned, graded, and carefully packed in protective cartons.",
    ai_benefits_summary: "Complete amino acid profile, choline for brain development, and lutein for vision.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0407",
  },
  {
    id: "m0000000-0000-0000-0000-000000000006",
    pos_code: 106,
    name: "Tender Mutton Keema / Minced Meat",
    name_ta: "ஆட்டிறைச்சி கீமா",
    category_slug: "tender-mutton",
    category_name: "Tender Mutton",
    price: 920,
    original_mrp: 1050,
    unit: "kg",
    stock: 20,
    image_url: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=800",
    description: "Double-ground boneless mutton mince from prime cuts. Ideal for succulent kebabs, mutton samosas, and keema mattar.",
    ai_benefits_summary: "Easy to digest protein rich in iron and muscle-rebuilding nutrients.",
    is_active: true,
    is_featured: false,
    is_bestseller: false,
    hsn_code: "0204",
  },
];

export const REAL_GROCERY_PRODUCTS = [
  {
    id: "g0000000-0000-0000-0000-000000000001",
    pos_code: 201,
    name: "Organic Farm Country Tomatoes (Naatu Thakkali)",
    name_ta: "நாட்டு தக்காளி",
    category_slug: "fresh-produce",
    category_name: "Fresh Fruits & Vegetables",
    price: 36,
    original_mrp: 45,
    unit: "kg",
    stock: 120,
    image_url: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800",
    description: "Farm-fresh ripe red tomatoes picked daily at dawn. Juicy, tangy, and rich in natural lycopene.",
    ai_benefits_summary: "Loaded with lycopene, Vitamin C, and potassium for cardiovascular wellness.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0702",
  },
  {
    id: "g0000000-0000-0000-0000-000000000002",
    pos_code: 202,
    name: "Premium Red Onions (Bellary)",
    name_ta: "பெல்லாரி பெரிய வெங்காயம்",
    category_slug: "fresh-produce",
    category_name: "Fresh Fruits & Vegetables",
    price: 42,
    original_mrp: 55,
    unit: "kg",
    stock: 150,
    image_url: "https://images.unsplash.com/photo-1518977956812-cd3dbadaaf31?w=800",
    description: "Crisp, pungent red onions. Essential staple for every Indian gravy, curry, sambar, and salad.",
    ai_benefits_summary: "High in quercetin anti-inflammatory flavanoids and dietary prebiotic fiber.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0703",
  },
  {
    id: "g0000000-0000-0000-0000-000000000003",
    pos_code: 203,
    name: "100% MP Sharbati Whole Wheat Atta (5kg)",
    name_ta: "முழு கோதுமை மாவு 5kg",
    category_slug: "grains-atta",
    category_name: "Atta, Rice & Grains",
    price: 270,
    original_mrp: 320,
    unit: "pack",
    stock: 80,
    image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800",
    description: "Chakki-ground 100% pure Madhya Pradesh Sharbati wheat. Retains natural bran and fiber for super soft rotis.",
    ai_benefits_summary: "High fiber, low glycemic index, supports healthy digestion and sustained energy.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "1101",
  },
  {
    id: "g0000000-0000-0000-0000-000000000004",
    pos_code: 204,
    name: "Royal Aged Basmati Biryani Rice (5kg)",
    name_ta: "பாசுமதி பிரியாணி அரிசி 5kg",
    category_slug: "grains-atta",
    category_name: "Atta, Rice & Grains",
    price: 520,
    original_mrp: 620,
    unit: "pack",
    stock: 65,
    image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800",
    description: "Extra long grain aged Himalayan basmati rice. Non-sticky, fragrant grains that elongate to over twice their length when cooked.",
    ai_benefits_summary: "Naturally aromatic, gluten-free, low sodium grain ideal for celebratory feasts.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "1006",
  },
  {
    id: "g0000000-0000-0000-0000-000000000005",
    pos_code: 205,
    name: "Cold-Pressed Wood Chekku Virgin Coconut Oil (1L)",
    name_ta: "மரச்செக்கு தேங்காய் எண்ணெய் 1L",
    category_slug: "oils-ghee",
    category_name: "Edible Oils & Ghee",
    price: 280,
    original_mrp: 340,
    unit: "liter",
    stock: 45,
    image_url: "https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=800",
    description: "Traditional wood-pressed from sun-dried copra coconuts. Zero heat processing, 100% unrefined natural aroma.",
    ai_benefits_summary: "Rich in Medium Chain Triglycerides (MCTs) and Lauric acid for robust metabolism.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "1513",
  },
  {
    id: "g0000000-0000-0000-0000-000000000006",
    pos_code: 206,
    name: "Farm Pure Vedic Cow Ghee (500ml Glass Jar)",
    name_ta: "சுத்தமான பசு நெய் 500ml",
    category_slug: "oils-ghee",
    category_name: "Edible Oils & Ghee",
    price: 460,
    original_mrp: 540,
    unit: "pack",
    stock: 40,
    image_url: "https://images.unsplash.com/photo-1631451095765-2c91616fc9e6?w=800",
    description: "Golden, granular pure cow ghee made using traditional curd-churning bilona method. Aromatic and nourishing.",
    ai_benefits_summary: "Abundant in fat-soluble vitamins A, E, and Butyric acid for intestinal lining health.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0405",
  },
];

export const REAL_ELECTRONICS_PRODUCTS = [
  {
    id: "e0000000-0000-0000-0000-000000000001",
    pos_code: 301,
    name: "55-inch 4K Smart Ultra HD LED Android TV",
    name_ta: "55 அங்குல 4K ஸ்மார்ட் டிவி",
    category_slug: "tv-audio",
    category_name: "Smart TV & Audio",
    price: 34999,
    original_mrp: 44999,
    unit: "unit",
    stock: 12,
    image_url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800",
    description: "Cinematic 4K UHD display with Dolby Vision Atmos, bezel-less frame, dual-band Wi-Fi, and official 2-year manufacturer warranty.",
    ai_benefits_summary: "High dynamic range visual engine, certified low blue light emission.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "8528",
  },
  {
    id: "e0000000-0000-0000-0000-000000000002",
    pos_code: 302,
    name: "Wireless Active Noise Cancelling Headphones",
    name_ta: "ப்ளூடூத் ஹெட்போன்",
    category_slug: "tv-audio",
    category_name: "Smart TV & Audio",
    price: 2999,
    original_mrp: 4999,
    unit: "unit",
    stock: 25,
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800",
    description: "Industry-leading 35dB hybrid ANC, 40-hour ultra long battery life, memory foam ear cups, and crystal clear calling mics.",
    ai_benefits_summary: "Acoustically balanced 40mm titanium drivers for deep bass and speech clarity.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "8518",
  },
  {
    id: "e0000000-0000-0000-0000-000000000003",
    pos_code: 303,
    name: "High-Speed Dual-Band Gigabit Wi-Fi 6 Router",
    name_ta: "வைஃபை ரூட்டர்",
    category_slug: "computers-tech",
    category_name: "Computers & Tech",
    price: 2499,
    original_mrp: 3499,
    unit: "unit",
    stock: 30,
    image_url: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800",
    description: "Next-gen Wi-Fi 6 speeds up to 1800 Mbps. Connects up to 64 devices simultaneously with beamforming antennas and WPA3 security.",
    ai_benefits_summary: "Ultra low latency gaming and 4K streaming with OFDMA and MU-MIMO technology.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "8517",
  },
];

export const REAL_FASHION_PRODUCTS = [
  {
    id: "f0000000-0000-0000-0000-000000000001",
    pos_code: 401,
    name: "Pure Linen Breathable Casual Button-Down Shirt",
    name_ta: "லினன் சட்டை",
    category_slug: "mens-wear",
    category_name: "Men's Apparel",
    price: 1299,
    original_mrp: 1899,
    unit: "piece",
    stock: 40,
    image_url: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800",
    description: "100% natural European flax linen. Ultra-lightweight and naturally cooling for tropical comfort and smart casual sophistication.",
    ai_benefits_summary: "Hypoallergenic, breathable, natural temperature-regulating weave.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "6205",
  },
  {
    id: "f0000000-0000-0000-0000-000000000002",
    pos_code: 402,
    name: "Handwoven Traditional Festive Kanchipuram Silk Saree",
    name_ta: "காஞ்சிபுரம் பட்டுப்புடவை",
    category_slug: "womens-wear",
    category_name: "Women's Ethnic",
    price: 3899,
    original_mrp: 5499,
    unit: "piece",
    stock: 20,
    image_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800",
    description: "Authentic mulberry silk woven with lustrous golden zari borders. Includes matching unstitched blouse piece.",
    ai_benefits_summary: "Pure natural silk threads, handloom artisan certified with silk mark guarantee.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "5007",
  },
];

export const applyRealProductsCatalog = createServerFn({ method: "POST" })
  .inputValidator((data: { archiveExisting?: boolean; vertical?: string } | undefined) => data || {})
  .handler(async ({ data }): Promise<SeedCatalogResult> => {
    await requireAdmin();
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Determine Effective Vertical
      let activeVertical = data.vertical as BusinessVertical | undefined;
      if (!activeVertical) {
        const { data: storeRow } = await supabaseAdmin
          .from("store_settings")
          .select("business_vertical, store_name")
          .limit(1)
          .maybeSingle();
        if (storeRow) {
          activeVertical =
            ((storeRow as any).business_vertical as BusinessVertical) ||
            detectVerticalFromStoreName((storeRow as any).store_name);
        }
      }
      activeVertical = activeVertical || "seafood";

      // 2. Select Category & Product Payload by Vertical
      let categoriesToUpsert: Array<{ id: string; name: string; name_ta: string; slug: string; sort_order: number; is_active: boolean }> = [];
      let productsToUpsert: any[] = [];

      switch (activeVertical) {
        case "chicken_meat":
        case "all_meat":
          categoriesToUpsert = [
            { id: "c4111111-1111-1111-1111-111111111111", name: "Farm Fresh Chicken", name_ta: "பண்ணை கோழி", slug: "farm-chicken", sort_order: 1, is_active: true },
            { id: "c4222222-2222-2222-2222-222222222222", name: "Tender Mutton", name_ta: "ஆட்டிறைச்சி", slug: "tender-mutton", sort_order: 2, is_active: true },
            { id: "c4333333-3333-3333-3333-333333333333", name: "Fresh Farm Eggs", name_ta: "முட்டை வகைகள்", slug: "farm-eggs", sort_order: 3, is_active: true },
          ];
          productsToUpsert = REAL_CHICKEN_MEAT_PRODUCTS;
          break;

        case "grocery_supermarket":
          categoriesToUpsert = [
            { id: "c5111111-1111-1111-1111-111111111111", name: "Fresh Fruits & Vegetables", name_ta: "காய்கறிகள் & பழங்கள்", slug: "fresh-produce", sort_order: 1, is_active: true },
            { id: "c5222222-2222-2222-2222-222222222222", name: "Atta, Rice & Grains", name_ta: "அரிசி & தானியங்கள்", slug: "grains-atta", sort_order: 2, is_active: true },
            { id: "c5333333-3333-3333-3333-333333333333", name: "Edible Oils & Ghee", name_ta: "சமையல் எண்ணெய் & நெய்", slug: "oils-ghee", sort_order: 3, is_active: true },
          ];
          productsToUpsert = REAL_GROCERY_PRODUCTS;
          break;

        case "electronics_appliances":
          categoriesToUpsert = [
            { id: "c6111111-1111-1111-1111-111111111111", name: "Smart TV & Audio", name_ta: "ஸ்மார்ட் டிவி & ஆடியோ", slug: "tv-audio", sort_order: 1, is_active: true },
            { id: "c6222222-2222-2222-2222-222222222222", name: "Computers & Tech", name_ta: "கணினி & தொழில்நுட்பம்", slug: "computers-tech", sort_order: 2, is_active: true },
          ];
          productsToUpsert = REAL_ELECTRONICS_PRODUCTS;
          break;

        case "clothing_fashion":
          categoriesToUpsert = [
            { id: "c7111111-1111-1111-1111-111111111111", name: "Men's Apparel", name_ta: "ஆண்கள் ஆடைகள்", slug: "mens-wear", sort_order: 1, is_active: true },
            { id: "c7222222-2222-2222-2222-222222222222", name: "Women's Ethnic", name_ta: "பெண்கள் ஆடைகள்", slug: "womens-wear", sort_order: 2, is_active: true },
          ];
          productsToUpsert = REAL_FASHION_PRODUCTS;
          break;

        case "seafood":
        default:
          categoriesToUpsert = [
            { id: "c1111111-1111-1111-1111-111111111111", name: "Sea Fish", name_ta: "கடல் மீன்", slug: "sea-fish", sort_order: 1, is_active: true },
            { id: "c2222222-2222-2222-2222-222222222222", name: "Prawns & Shellfish", name_ta: "இறால் மற்றும் நண்டு", slug: "prawns-shellfish", sort_order: 2, is_active: true },
            { id: "c3333333-3333-3333-3333-333333333333", name: "Freshwater Fish", name_ta: "நன்னீர் மீன்", slug: "freshwater-fish", sort_order: 3, is_active: true },
            { id: "c4444444-4444-4444-4444-444444444444", name: "Poultry & Meat", name_ta: "நாட்டுக்கோழி & ஆட்டிறைச்சி", slug: "poultry-meat", sort_order: 4, is_active: true },
          ];
          productsToUpsert = REAL_SEAFOOD_PRODUCTS;
          break;
      }

      for (const cat of categoriesToUpsert) {
        await supabaseAdmin.from("categories").upsert(cat as never, { onConflict: "slug" });
      }

      // 3. Map Categories to IDs
      const { data: catRows } = await supabaseAdmin.from("categories").select("id, slug");
      const catMap = new Map(((catRows as Array<{ id: string; slug: string }>) || []).map((c) => [c.slug, c.id]));

      // 4. Optionally archive old products
      if (data.archiveExisting) {
        const productIds = productsToUpsert.map((p) => p.id);
        await supabaseAdmin
          .from("products")
          .update({ is_available: false })
          .not("id", "in", `(${productIds.join(",")})`);
      }

      // 5. Upsert Real Products
      let count = 0;
      for (const p of productsToUpsert) {
        const catId = catMap.get(p.category_slug) || null;
        const payload = {
          id: p.id,
          pos_code: p.pos_code,
          name: p.name,
          name_ta: p.name_ta,
          category_id: catId,
          price: p.price,
          original_mrp: p.original_mrp,
          unit: p.unit,
          stock: p.stock,
          image_url: p.image_url,
          description: p.description,
          ai_benefits_summary: p.ai_benefits_summary,
          is_active: p.is_active,
          is_featured: p.is_featured,
          is_bestseller: p.is_bestseller,
          hsn_code: p.hsn_code,
        };

        const { error } = await supabaseAdmin.from("products").upsert(payload as never, { onConflict: "id" });
        if (!error) count++;
      }

      return { success: true, inserted: count, vertical: activeVertical };
    } catch (err: any) {
      console.error("[Products Seed Error]:", err);
      return { success: false, inserted: 0, error: err?.message || String(err) };
    }
  });
