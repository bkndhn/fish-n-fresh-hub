const fs = require('fs');

const path = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(path, 'utf8');

// Inject enable_product_details
content = content.replace(
  'store_settings_public: {\n        Row: {',
  'store_settings_public: {\n        Row: {\n          enable_product_details: boolean | null'
);
content = content.replace(
  'Insert: {\n          accent_color?: string | null',
  'Insert: {\n          enable_product_details?: boolean | null\n          accent_color?: string | null'
);
content = content.replace(
  'Update: {\n          accent_color?: string | null',
  'Update: {\n          enable_product_details?: boolean | null\n          accent_color?: string | null'
);

// Inject gallery_urls and rich_description to products
content = content.replace(
  'products: {\n        Row: {',
  'products: {\n        Row: {\n          gallery_urls: string[] | null\n          rich_description: string | null'
);
content = content.replace(
  'Insert: {\n          brand?: string | null',
  'Insert: {\n          gallery_urls?: string[] | null\n          rich_description?: string | null\n          brand?: string | null'
);
content = content.replace(
  'Update: {\n          brand?: string | null',
  'Update: {\n          gallery_urls?: string[] | null\n          rich_description?: string | null\n          brand?: string | null'
);

fs.writeFileSync(path, content);
console.log('Types updated.');
