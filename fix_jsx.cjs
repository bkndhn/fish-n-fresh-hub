const fs = require('fs');
const path = 'src/routes/_authenticated/admin/products.tsx';
let content = fs.readFileSync(path, 'utf8');

const brokenBlock = `                  <span>
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

const fixedBlock = `                  <span>
                    Customer saves <strong>{formatINR(Number(editingProduct.old_price) - Number(editingProduct.price))}</strong>
                  </span>
                </div>
              )}

              <div className="space-y-4">
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
              </div>

              <div className="space-y-1.5 mt-2">
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

content = content.replace(brokenBlock, fixedBlock);
fs.writeFileSync(path, content);
console.log('Fixed broken block');
