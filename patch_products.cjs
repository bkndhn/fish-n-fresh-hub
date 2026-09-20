const fs = require('fs');
const path = 'src/routes/_authenticated/admin/products.tsx';
let content = fs.readFileSync(path, 'utf8');

const DEFAULT_NEW_PRODUCT = `const DEFAULT_NEW_PRODUCT = {
  name: "",
  name_tamil: "",
  pos_code: "",
  category: "",
  customCategory: "",
  price: "",
  old_price: "",
  unit: "kg",
  customUnit: "",
  stock: "25",
  low_stock_threshold: "5",
  gst_percent: "0",
  gst_included: false,
  is_available: true,
  is_featured: false,
  is_bestseller: false,
  allow_custom_qty: true,
  rating: "4.8",
  reviews_count: "124",
  image_url: "",
  gallery_urls: [] as string[],
  description: "",
  rich_description: "",
  delivery_info: "Standard local delivery window.",
  storage_info: "Keep refrigerated.",
  brand: "",
  model_number: "",
  warranty_period_months: "0",
  requires_serial: false,
  aisle_location: "",
  specifications_text: "",
  cost_price: "",
  is_returnable: false,
  return_window_days: "0",
  gst_percentage: "0",
  hsn_code: "",
};`;

if (!content.includes('const DEFAULT_NEW_PRODUCT = {')) {
  content = content.replace('function ProductsAdmin() {', DEFAULT_NEW_PRODUCT + '\n\nfunction ProductsAdmin() {');
}

// Replace the old setNewProduct with DEFAULT_NEW_PRODUCT
content = content.replace(
  /const \[newProduct, setNewProduct\] = useState\(\{[\s\S]*?hsn_code: "",\n  \}\);/g,
  'const [newProduct, setNewProduct] = useState({ ...DEFAULT_NEW_PRODUCT });'
);

// Replace the reset in onSuccess
content = content.replace(
  /setNewProduct\(\{[\s\S]*?is_featured: false,[\s\S]*?\}\);/g,
  'setNewProduct({ ...DEFAULT_NEW_PRODUCT });'
);

// We need to inject the tabbed interface into the modal...
// Wait, instead of rewriting the entire modal which is massive, I'll just add the gallery_urls array to the UI as MultiImageUpload, and rich_description as Textarea.
// I'll place it right after the main ImageUpload.

content = content.replace(
  /<div className="w-24 shrink-0">\s*<Label className="text-xs font-semibold mb-1.5 block">Photo<\/Label>\s*<ImageUpload\s*onUpload=\{\(url\) => setNewProduct\(\{ \.\.\.newProduct, image_url: url \}\)\}\s*currentImage=\{newProduct\.image_url\}\s*compact\s*\/>\s*<\/div>/g,
  `<div className="w-24 shrink-0">
                  <Label className="text-xs font-semibold mb-1.5 block">Main Photo</Label>
                  <ImageUpload 
                    onUpload={(url) => setNewProduct({ ...newProduct, image_url: url })} 
                    currentImage={newProduct.image_url} 
                    compact 
                  />
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold">Additional Photos (up to 5)</Label>
                  <MultiImageUpload 
                    urls={newProduct.gallery_urls || []} 
                    onChange={(urls) => setNewProduct({ ...newProduct, gallery_urls: urls })} 
                  />
                </div>`
);

content = content.replace(
  /<div className="space-y-1.5 mt-2">\s*<Label htmlFor="prod-desc" className="text-xs font-semibold">Short Description<\/Label>\s*<Textarea\s*id="prod-desc"\s*value=\{newProduct\.description\}/g,
  `<div className="space-y-1.5 mt-2">
                <Label htmlFor="prod-desc" className="text-xs font-semibold">Short Description</Label>
                <Textarea
                  id="prod-desc"
                  value={newProduct.description}`
);

// Let's add Rich Description after short description
content = content.replace(
  /placeholder="Brief details about the product..."\s*\/>\s*<\/div>/g,
  `placeholder="Brief details about the product..."
                />
              </div>
              <div className="space-y-1.5 mt-2">
                <Label htmlFor="prod-rich-desc" className="text-xs font-semibold">Rich Description (Full details)</Label>
                <Textarea
                  id="prod-rich-desc"
                  value={newProduct.rich_description || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, rich_description: e.target.value })}
                  className="rounded-xl min-h-\[120px\] text-sm"
                  placeholder="Extensive details, features, specifications..."
                />
              </div>`
);

// Do the same for editingProduct
content = content.replace(
  /<div className="w-24 shrink-0">\s*<Label className="text-xs font-semibold mb-1.5 block">Photo<\/Label>\s*<ImageUpload\s*onUpload=\{\(url\) => setEditingProduct\(\{ \.\.\.editingProduct, image_url: url \}\)\}\s*currentImage=\{editingProduct\.image_url\}\s*compact\s*\/>\s*<\/div>/g,
  `<div className="w-24 shrink-0">
                  <Label className="text-xs font-semibold mb-1.5 block">Main Photo</Label>
                  <ImageUpload 
                    onUpload={(url) => setEditingProduct({ ...editingProduct, image_url: url })} 
                    currentImage={editingProduct.image_url} 
                    compact 
                  />
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold">Additional Photos (up to 5)</Label>
                  <MultiImageUpload 
                    urls={editingProduct.gallery_urls || []} 
                    onChange={(urls) => setEditingProduct({ ...editingProduct, gallery_urls: urls })} 
                  />
                </div>`
);

content = content.replace(
  /<div className="space-y-1.5">\s*<Label htmlFor="edit-desc">Short Description<\/Label>\s*<Textarea\s*id="edit-desc"\s*value=\{editingProduct\.description\}/g,
  `<div className="space-y-1.5">
                  <Label htmlFor="edit-desc">Short Description</Label>
                  <Textarea
                    id="edit-desc"
                    value={editingProduct.description}`
);

content = content.replace(
  /onChange=\{\(e\) => setEditingProduct\(\{ \.\.\.editingProduct, description: e\.target\.value \}\)\}\s*\/>\s*<\/div>/g,
  `onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 mt-4">
                  <Label htmlFor="edit-rich-desc">Rich Description (Full details)</Label>
                  <Textarea
                    id="edit-rich-desc"
                    value={editingProduct.rich_description || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, rich_description: e.target.value })}
                    className="rounded-xl min-h-[120px] text-sm"
                  />
                </div>`
);


// In createProduct mutation, add gallery_urls and rich_description
content = content.replace(
  /image_url: newProduct.image_url,/g,
  'image_url: newProduct.image_url, gallery_urls: newProduct.gallery_urls, rich_description: newProduct.rich_description,'
);


fs.writeFileSync(path, content);
console.log('products.tsx patched.');
