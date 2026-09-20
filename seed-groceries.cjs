const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract supabase URL and KEY from env file
const envPath = path.resolve(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting DB update...");

  // 1. Fix Mutton / Chicken images
  const { data: products, error: pErr } = await supabase.from('products').select('*');
  if (pErr) {
    console.error("Error fetching products:", pErr);
    return;
  }

  for (const p of products) {
    if (p.name.toLowerCase().includes("mutton") || p.name.toLowerCase().includes("goat")) {
      await supabase.from('products').update({ image_url: "https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=800&q=80" }).eq('id', p.id);
    } else if (p.name.toLowerCase().includes("chicken")) {
      await supabase.from('products').update({ image_url: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=800&q=80" }).eq('id', p.id);
    }
  }
  console.log("Fixed meat images.");

  // 2. Add Categories
  const categories = [
    { name: "Vegetables", slug: "vegetables", sort_order: 10, image_url: "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=800&q=80" },
    { name: "Fruits", slug: "fruits", sort_order: 11, image_url: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800&q=80" },
    { name: "Groceries", slug: "groceries", sort_order: 12, image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80" }
  ];

  for (const cat of categories) {
    await supabase.from('categories').upsert(cat, { onConflict: 'slug' });
  }
  console.log("Added categories.");

  // 3. Add Placeholder Products
  const sampleProducts = [
    {
      name: "Farm Fresh Tomatoes",
      category: "Vegetables",
      price: 40,
      old_price: 50,
      unit: "kg",
      stock: 100,
      image_url: "https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80",
      description: "Freshly handpicked red tomatoes.",
      is_available: true
    },
    {
      name: "Organic Red Onion",
      category: "Vegetables",
      price: 60,
      old_price: 75,
      unit: "kg",
      stock: 200,
      image_url: "https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&q=80",
      description: "Crisp and flavorful red onions.",
      is_available: true
    },
    {
      name: "Kashmir Apples",
      category: "Fruits",
      price: 180,
      old_price: 220,
      unit: "kg",
      stock: 50,
      image_url: "https://images.unsplash.com/photo-1560806887-1e4cd0b6fd6c?w=800&q=80",
      description: "Sweet and crunchy premium apples.",
      is_available: true
    },
    {
      name: "Premium Toor Dal",
      category: "Groceries",
      price: 160,
      old_price: 180,
      unit: "kg",
      stock: 50,
      image_url: "https://images.unsplash.com/photo-1585996884617-15e851e39a3e?w=800&q=80",
      description: "High quality polished Toor Dal.",
      is_available: true
    }
  ];

  for (const prod of sampleProducts) {
    const { data: existing } = await supabase.from('products').select('id').eq('name', prod.name).single();
    if (!existing) {
      await supabase.from('products').insert([prod]);
    }
  }
  console.log("Added sample products.");

  // 4. Add Banners
  const banners = [
    {
      title: "Fresh Harvest Festival",
      subtitle: "Up to 20% off on all organic vegetables and fruits this weekend.",
      image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80",
      active: true,
      sort_order: 1
    }
  ];

  for (const b of banners) {
    const { data: existing } = await supabase.from('banners').select('id').eq('title', b.title).single();
    if (!existing) {
      await supabase.from('banners').insert([b]);
    }
  }
  console.log("Added banners.");

  console.log("Done!");
}

run();
