import { createServerFn } from "@tanstack/react-start";

export interface SeedCatalogResult {
  success: boolean;
  inserted: number;
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
  {
    id: "a0000000-0000-0000-0000-000000000009",
    pos_code: 9,
    name: "Free-Range Country Chicken (Nattu Kozhi)",
    name_ta: "நாட்டுக்கோழி",
    category_slug: "poultry-meat",
    category_name: "Poultry & Meat",
    price: 420,
    original_mrp: 490,
    unit: "kg",
    stock: 35,
    image_url: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800",
    description: "Pure pasture-raised country chicken without antibiotics or hormones. Rich, dark bone broth and authentic village curry.",
    ai_benefits_summary: "Rich in organic minerals, carnosine, and collagen for joint health.",
    is_active: true,
    is_featured: false,
    is_bestseller: true,
    hsn_code: "0207",
  },
  {
    id: "a0000000-0000-0000-0000-000000000010",
    pos_code: 10,
    name: "Tender Goat / Mutton Curry Cut",
    name_ta: "ஆட்டிறைச்சி கறி வெட்டு",
    category_slug: "poultry-meat",
    category_name: "Poultry & Meat",
    price: 850,
    original_mrp: 980,
    unit: "kg",
    stock: 25,
    image_url: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800",
    description: "Tender, fresh grass-fed mountain goat. Balanced mix of meat, bone, and marrow for rich, succulent mutton chukka or biryani.",
    ai_benefits_summary: "Dense in heme iron, zinc, and Vitamin B12, ideal for energy and red blood cells.",
    is_active: true,
    is_featured: true,
    is_bestseller: true,
    hsn_code: "0204",
  },
];

export const applyRealProductsCatalog = createServerFn({ method: "POST" })
  .inputValidator((data: { archiveExisting?: boolean } | undefined) => data || {})
  .handler(async ({ data }): Promise<SeedCatalogResult> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Ensure Categories Exist
      const categoriesToUpsert = [
        { id: "c1111111-1111-1111-1111-111111111111", name: "Sea Fish", name_ta: "கடல் மீன்", slug: "sea-fish", sort_order: 1, is_active: true },
        { id: "c2222222-2222-2222-2222-222222222222", name: "Prawns & Shellfish", name_ta: "இறால் மற்றும் நண்டு", slug: "prawns-shellfish", sort_order: 2, is_active: true },
        { id: "c3333333-3333-3333-3333-333333333333", name: "Freshwater Fish", name_ta: "நன்னீர் மீன்", slug: "freshwater-fish", sort_order: 3, is_active: true },
        { id: "c4444444-4444-4444-4444-444444444444", name: "Poultry & Meat", name_ta: "நாட்டுக்கோழி & ஆட்டிறைச்சி", slug: "poultry-meat", sort_order: 4, is_active: true },
      ];

      for (const cat of categoriesToUpsert) {
        await supabaseAdmin.from("categories").upsert(cat, { onConflict: "slug" });
      }

      // 2. Map Categories to IDs
      const { data: catRows } = await supabaseAdmin.from("categories").select("id, slug");
      const catMap = new Map(((catRows as Array<{ id: string; slug: string }>) || []).map((c) => [c.slug, c.id]));

      // 3. Optionally archive old mock products
      if (data.archiveExisting) {
        const realIds = REAL_SEAFOOD_PRODUCTS.map((p) => p.id);
        await supabaseAdmin
          .from("products")
          .update({ is_active: false })
          .not("id", "in", `(${realIds.join(",")})`);
      }

      // 4. Upsert Real Products
      let count = 0;
      for (const p of REAL_SEAFOOD_PRODUCTS) {
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

        const { error } = await supabaseAdmin.from("products").upsert(payload, { onConflict: "id" });
        if (!error) count++;
      }

      return { success: true, inserted: count };
    } catch (err: any) {
      console.error("[Products Seed Error]:", err);
      return { success: false, inserted: 0, error: err?.message || String(err) };
    }
  });
