const fs = require('fs');
const path = 'src/routes/_authenticated/admin/products.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. DEFAULT_NEW_PRODUCT
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

// 2. Fix setNewProduct reset
content = content.replace(
  /const \[newProduct, setNewProduct\] = useState\(\{[\s\S]*?hsn_code: "",\n  \}\);/g,
  'const [newProduct, setNewProduct] = useState({ ...DEFAULT_NEW_PRODUCT });'
);
content = content.replace(
  /setNewProduct\(\{[\s\S]*?is_featured: false,[\s\S]*?\}\);/g,
  'setNewProduct({ ...DEFAULT_NEW_PRODUCT });'
);

// 3. Add MultiImageUpload import
if (!content.includes('MultiImageUpload')) {
  content = content.replace(
    'import { ImageUpload } from "@/components/ImageUpload";',
    'import { ImageUpload } from "@/components/ImageUpload";\nimport { MultiImageUpload } from "@/components/MultiImageUpload";'
  );
}

// 4. Add Modal UI
const addModalImage = `<div className="space-y-1.5">
                <Label>Product Image</Label>
                <ImageUpload
                  currentImage={newProduct.image_url}
                  onUpload={(url) => setNewProduct({ ...newProduct, image_url: url })}
                />
              </div>`;

const addModalImageNew = `<div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Main Image</Label>
                  <ImageUpload
                    currentImage={newProduct.image_url}
                    onUpload={(url) => setNewProduct({ ...newProduct, image_url: url })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gallery (up to 5 additional images)</Label>
                  <MultiImageUpload
                    urls={newProduct.gallery_urls || []}
                    onChange={(urls) => setNewProduct({ ...newProduct, gallery_urls: urls })}
                  />
                </div>
              </div>`;
content = content.replace(addModalImage, addModalImageNew);

const addModalDesc = `<div className="space-y-1.5">
                <Label htmlFor="prod-desc">Description</Label>
                <Textarea
                  id="prod-desc"
                  placeholder={formFields.descriptionPlaceholder}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>`;

const addModalDescNew = `<div className="space-y-1.5">
                <Label htmlFor="prod-desc">Short Description</Label>
                <Textarea
                  id="prod-desc"
                  placeholder={formFields.descriptionPlaceholder}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 mt-4">
                <Label htmlFor="prod-rich-desc">Rich Description (Full details)</Label>
                <Textarea
                  id="prod-rich-desc"
                  value={newProduct.rich_description || ""}
                  onChange={(e) => setNewProduct({ ...newProduct, rich_description: e.target.value })}
                  className="rounded-xl min-h-[120px] text-sm"
                  placeholder="Extensive details, features, specifications..."
                />
              </div>`;
content = content.replace(addModalDesc, addModalDescNew);

// 5. Edit Modal UI
const editModalImage = `<div className="space-y-1.5">
                <Label>Product Image</Label>
                <ImageUpload
                  currentImage={editingProduct.image_url}
                  onUpload={(url) => setEditingProduct({ ...editingProduct, image_url: url })}
                />
              </div>`;

const editModalImageNew = `<div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Main Image</Label>
                  <ImageUpload
                    currentImage={editingProduct.image_url}
                    onUpload={(url) => setEditingProduct({ ...editingProduct, image_url: url })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gallery (up to 5 additional images)</Label>
                  <MultiImageUpload
                    urls={editingProduct.gallery_urls || []}
                    onChange={(urls) => setEditingProduct({ ...editingProduct, gallery_urls: urls })}
                  />
                </div>
              </div>`;
content = content.replace(editModalImage, editModalImageNew);

const editModalDesc = `<div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea
                  id="edit-desc"
                  placeholder={formFields.descriptionPlaceholder}
                  value={editingProduct.description ?? ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                />
              </div>`;

const editModalDescNew = `<div className="space-y-1.5">
                <Label htmlFor="edit-desc">Short Description</Label>
                <Textarea
                  id="edit-desc"
                  placeholder={formFields.descriptionPlaceholder}
                  value={editingProduct.description ?? ""}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
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
              </div>`;
content = content.replace(editModalDesc, editModalDescNew);

// 6. Mutation payloads
content = content.replace(
  'image_url: newProduct.image_url || null,',
  'image_url: newProduct.image_url || null,\n        gallery_urls: newProduct.gallery_urls || [],\n        rich_description: newProduct.rich_description || null,'
);

fs.writeFileSync(path, content);
console.log('Safe patch applied.');
