const fs = require('fs');
const path = 'src/routes/_authenticated/admin/products.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'image_url: newProduct.image_url || null,',
  'image_url: newProduct.image_url || null,\n        gallery_urls: newProduct.gallery_urls,\n        rich_description: newProduct.rich_description || null,'
);

// We should also replace the `updateProduct` mutation to include them, but `patch` receives all fields anyway.

// The regex for the Add Modal ImageUpload didn't match. Let's find exactly what it says.
// It might say `<div className="w-24 shrink-0">\n                  <Label className="text-xs font-semibold mb-1.5 block">Photo</Label>\n                  <ImageUpload\n                    onUpload={(url) => setNewProduct({ ...newProduct, image_url: url })}\n                    currentImage={newProduct.image_url}\n                    compact\n                  />\n                </div>`

const oldImageAdd = `<div className="w-24 shrink-0">
                  <Label className="text-xs font-semibold mb-1.5 block">Photo</Label>
                  <ImageUpload
                    onUpload={(url) => setNewProduct({ ...newProduct, image_url: url })}
                    currentImage={newProduct.image_url}
                    compact
                  />
                </div>`;

const newImageAdd = `<div className="w-24 shrink-0">
                  <Label className="text-xs font-semibold mb-1.5 block">Main Photo</Label>
                  <ImageUpload
                    onUpload={(url) => setNewProduct({ ...newProduct, image_url: url })}
                    currentImage={newProduct.image_url}
                    compact
                  />
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold block mb-1.5">Gallery (up to 5)</Label>
                  <MultiImageUpload
                    urls={newProduct.gallery_urls || []}
                    onChange={(urls) => setNewProduct({ ...newProduct, gallery_urls: urls })}
                  />
                </div>`;

content = content.replace(oldImageAdd, newImageAdd);

const oldImageEdit = `<div className="w-24 shrink-0">
                  <Label className="text-xs font-semibold mb-1.5 block">Photo</Label>
                  <ImageUpload
                    onUpload={(url) => setEditingProduct({ ...editingProduct, image_url: url })}
                    currentImage={editingProduct.image_url}
                    compact
                  />
                </div>`;

const newImageEdit = `<div className="w-24 shrink-0">
                  <Label className="text-xs font-semibold mb-1.5 block">Main Photo</Label>
                  <ImageUpload
                    onUpload={(url) => setEditingProduct({ ...editingProduct, image_url: url })}
                    currentImage={editingProduct.image_url}
                    compact
                  />
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Label className="text-xs font-semibold block mb-1.5">Gallery (up to 5)</Label>
                  <MultiImageUpload
                    urls={editingProduct.gallery_urls || []}
                    onChange={(urls) => setEditingProduct({ ...editingProduct, gallery_urls: urls })}
                  />
                </div>`;

content = content.replace(oldImageEdit, newImageEdit);

fs.writeFileSync(path, content);
console.log('products.tsx patched again.');
