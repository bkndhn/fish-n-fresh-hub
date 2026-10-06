// Sample starter menus for shop types that previously had no catalog template.
type Cat = { id: string; name: string; name_ta: string; slug: string; sort_order: number; is_active: boolean };

const img = (id: string) => `https://images.unsplash.com/${id}?w=800`;

function mk(prefix: string, n: number, posBase: number, p: {
  name: string; name_ta: string; cat: Cat; price: number; mrp?: number; unit: string; stock?: number; image: string; desc: string; hsn: string; featured?: boolean;
}) {
  return {
    id: `${prefix}-0000-0000-0000-${String(n).padStart(12, "0")}`,
    pos_code: posBase + n,
    name: p.name,
    name_ta: p.name_ta,
    category_slug: p.cat.slug,
    category_name: p.cat.name,
    price: p.price,
    original_mrp: p.mrp ?? p.price,
    unit: p.unit,
    stock: p.stock ?? 100,
    image_url: img(p.image),
    description: p.desc,
    ai_benefits_summary: p.desc,
    is_active: true,
    is_featured: !!p.featured,
    is_bestseller: !!p.featured,
    hsn_code: p.hsn,
  };
}

const cat = (id: string, name: string, name_ta: string, slug: string, sort_order: number): Cat => ({ id, name, name_ta, slug, sort_order, is_active: true });

// ---------- Juice Bar ----------
const J1 = cat("ca111111-1111-1111-1111-111111111111", "Fresh Juices", "பழச்சாறுகள்", "fresh-juices", 1);
const J2 = cat("ca222222-2222-2222-2222-222222222222", "Milkshakes", "மில்க் ஷேக்", "milkshakes", 2);
const juice = (n: number, p: Parameters<typeof mk>[3]) => mk("aa000000", n, 700, p);
export const JUICE_CATALOG = {
  categories: [J1, J2],
  products: [
    juice(1, { name: "Alphonso Mango Shake", name_ta: "மாம்பழ ஷேக்", cat: J2, price: 90, unit: "glass", image: "photo-1546173159-315724a31696", desc: "Thick shake made with ripe Alphonso mango pulp and chilled milk.", hsn: "2202", featured: true }),
    juice(2, { name: "Tender Coconut Shake", name_ta: "இளநீர் ஷேக்", cat: J2, price: 80, unit: "glass", image: "photo-1553530666-ba11a7da3888", desc: "Fresh tender coconut blended with milk and a hint of honey.", hsn: "2202" }),
    juice(3, { name: "Cold-Pressed ABC Juice", name_ta: "ABC ஜூஸ்", cat: J1, price: 70, unit: "glass", image: "photo-1622597467836-f3285f2131b8", desc: "Apple, beetroot and carrot, pressed fresh. No added sugar.", hsn: "2009", featured: true }),
    juice(4, { name: "Mosambi Sweet Lime Juice", name_ta: "சாத்துக்குடி ஜூஸ்", cat: J1, price: 50, unit: "glass", image: "photo-1600271886742-f049cd451bba", desc: "Freshly squeezed sweet lime, served with or without ice.", hsn: "2009" }),
    juice(5, { name: "Watermelon Mint Cooler", name_ta: "தர்பூசணி ஜூஸ்", cat: J1, price: 40, unit: "glass", image: "photo-1589733955941-5eeaf752f6dd", desc: "Watermelon juice with fresh mint and a pinch of black salt.", hsn: "2009" }),
  ],
};

// ---------- Fruits & Vegetables ----------
const F1 = cat("cb111111-1111-1111-1111-111111111111", "Fresh Fruits", "பழங்கள்", "fresh-fruits", 1);
const F2 = cat("cb222222-2222-2222-2222-222222222222", "Daily Vegetables", "காய்கறிகள்", "daily-vegetables", 2);
const F3 = cat("cb333333-3333-3333-3333-333333333333", "Leafy Greens & Herbs", "கீரை வகைகள்", "leafy-greens", 3);
const fv = (n: number, p: Parameters<typeof mk>[3]) => mk("bb000000", n, 720, p);
export const PRODUCE_CATALOG = {
  categories: [F1, F2, F3],
  products: [
    fv(1, { name: "Shimla Royal Apples", name_ta: "ஆப்பிள்", cat: F1, price: 180, mrp: 220, unit: "kg", image: "photo-1560806887-1e4cd0b6cbd6", desc: "Crisp, sweet Shimla apples, hand-picked.", hsn: "0808", featured: true }),
    fv(2, { name: "Robusta Bananas", name_ta: "வாழைப்பழம்", cat: F1, price: 50, unit: "dozen", image: "photo-1571771894821-ce9b6c11b08e", desc: "Naturally ripened bananas, no carbide.", hsn: "0803" }),
    fv(3, { name: "Ooty Carrots", name_ta: "கேரட்", cat: F2, price: 60, unit: "kg", image: "photo-1598170845058-32b9d6a5da37", desc: "Sweet hill-grown carrots from Ooty.", hsn: "0706", featured: true }),
    fv(4, { name: "Country Tomatoes", name_ta: "நாட்டு தக்காளி", cat: F2, price: 30, unit: "kg", image: "photo-1546470427-e26264be0b0d", desc: "Tangy local tomatoes, picked this morning.", hsn: "0702" }),
    fv(5, { name: "Small Onions (Shallots)", name_ta: "சின்ன வெங்காயம்", cat: F2, price: 70, unit: "kg", image: "photo-1618512496248-a07fe83aa8cb", desc: "Sambar onions, cleaned and sorted.", hsn: "0703" }),
    fv(6, { name: "Fresh Mint & Coriander", name_ta: "புதினா & கொத்தமல்லி", cat: F3, price: 15, unit: "bunch", image: "photo-1628556270448-4d4e4148e1b1", desc: "One bunch each of mint and coriander.", hsn: "0709" }),
  ],
};

// ---------- Bakery ----------
const B1 = cat("cc111111-1111-1111-1111-111111111111", "Cakes", "கேக்குகள்", "cakes", 1);
const B2 = cat("cc222222-2222-2222-2222-222222222222", "Breads", "ரொட்டி", "breads", 2);
const B3 = cat("cc333333-3333-3333-3333-333333333333", "Puffs & Pastries", "பப்ஸ் & பேஸ்ட்ரி", "puffs-pastries", 3);
const bk = (n: number, p: Parameters<typeof mk>[3]) => mk("cc000000", n, 740, p);
export const BAKERY_CATALOG = {
  categories: [B1, B2, B3],
  products: [
    bk(1, { name: "Eggless Black Forest Cake (500g)", name_ta: "பிளாக் பாரஸ்ட் கேக்", cat: B1, price: 450, unit: "box", stock: 20, image: "photo-1578985545062-69928b1d9587", desc: "Eggless chocolate sponge with cherries and fresh cream.", hsn: "1905", featured: true }),
    bk(2, { name: "Belgian Chocolate Brownie", name_ta: "பிரவுனி", cat: B1, price: 70, unit: "pc", image: "photo-1606313564200-e75d5e30476c", desc: "Fudgy brownie made with Belgian dark chocolate.", hsn: "1905" }),
    bk(3, { name: "Fresh Milk Bread", name_ta: "பால் ரொட்டி", cat: B2, price: 45, unit: "loaf", image: "photo-1509440159596-0249088772ff", desc: "Soft milk bread baked every morning.", hsn: "1905", featured: true }),
    bk(4, { name: "Artisan Sourdough Loaf", name_ta: "சோர்டோ ரொட்டி", cat: B2, price: 180, unit: "loaf", stock: 15, image: "photo-1585478259715-876acc5be8eb", desc: "Slow-fermented sourdough with a crisp crust.", hsn: "1905" }),
    bk(5, { name: "Veg Puff", name_ta: "வெஜ் பப்ஸ்", cat: B3, price: 25, unit: "pc", image: "photo-1601050690117-94f5f6fa8bd7", desc: "Flaky puff with spicy potato masala.", hsn: "1905" }),
    bk(6, { name: "Butter Croissant", name_ta: "குரோசான்ட்", cat: B3, price: 80, unit: "pc", image: "photo-1555507036-ab1f4038808a", desc: "Layered all-butter croissant.", hsn: "1905" }),
  ],
};

// ---------- Pharmacy ----------
const P1 = cat("cd111111-1111-1111-1111-111111111111", "Everyday Medicines", "மருந்துகள்", "everyday-medicines", 1);
const P2 = cat("cd222222-2222-2222-2222-222222222222", "Vitamins & Wellness", "வைட்டமின்கள்", "vitamins-wellness", 2);
const P3 = cat("cd333333-3333-3333-3333-333333333333", "Health Devices & First Aid", "முதலுதவி", "first-aid", 3);
const ph = (n: number, p: Parameters<typeof mk>[3]) => mk("dd000000", n, 760, p);
export const PHARMACY_CATALOG = {
  categories: [P1, P2, P3],
  products: [
    ph(1, { name: "Paracetamol 650mg (15 tablets)", name_ta: "பாராசிட்டமால் 650", cat: P1, price: 32, unit: "strip", stock: 200, image: "photo-1584308666744-24d5c474f2ae", desc: "Fever and pain relief. Use as directed by a doctor.", hsn: "3004", featured: true }),
    ph(2, { name: "ORS Electrolyte Sachet", name_ta: "ORS பொடி", cat: P1, price: 22, unit: "sachet", stock: 200, image: "photo-1471864190281-a93a3070b6de", desc: "Oral rehydration salts, orange flavour.", hsn: "3004" }),
    ph(3, { name: "Vitamin C + Zinc (15 tablets)", name_ta: "வைட்டமின் C", cat: P2, price: 99, unit: "strip", image: "photo-1550572017-edd951b55104", desc: "Daily immunity support chewable tablets.", hsn: "2106" }),
    ph(4, { name: "Pain Relief Gel 30g", name_ta: "வலி நிவாரண ஜெல்", cat: P2, price: 120, unit: "tube", image: "photo-1587854692152-cbe660dbde88", desc: "Fast relief for muscle and joint pain.", hsn: "3004" }),
    ph(5, { name: "Digital Thermometer", name_ta: "டிஜிட்டல் தெர்மாமீட்டர்", cat: P3, price: 250, mrp: 350, unit: "pc", stock: 30, image: "photo-1584515933487-779824d29309", desc: "Quick 60-second reading with beep alert.", hsn: "9025", featured: true }),
    ph(6, { name: "Antiseptic Liquid 100ml", name_ta: "ஆன்டிசெப்டிக்", cat: P3, price: 65, unit: "bottle", image: "photo-1583947215259-38e31be8751f", desc: "For cuts, wounds and personal hygiene.", hsn: "3808" }),
  ],
};

export const EXTRA_TEMPLATE_CATEGORY_SLUGS = [JUICE_CATALOG, PRODUCE_CATALOG, BAKERY_CATALOG, PHARMACY_CATALOG]
  .flatMap((c) => c.categories.map((x) => x.slug));

export function getExtraCatalog(vertical: string) {
  switch (vertical) {
    case "juice_shake_bar": return JUICE_CATALOG;
    case "fruits_vegetables": return PRODUCE_CATALOG;
    case "bakery_cake": return BAKERY_CATALOG;
    case "pharmacy_medical": return PHARMACY_CATALOG;
    default: return null;
  }
}
