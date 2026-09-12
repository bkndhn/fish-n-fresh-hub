import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import type { Category, Product } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ImageUpload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Package,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

export function CategoryManagement() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery(categoriesQuery);
  const { data: products = [] } = useQuery(productsQuery);

  const [search, setSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // Form states for Add Category
  const [newName, setNewName] = useState("");
  const [newTamilName, setNewTamilName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newSortOrder, setNewSortOrder] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // Form states for Edit Category
  const [editName, setEditName] = useState("");
  const [editTamilName, setEditTamilName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<number>(0);
  const [updateProductTags, setUpdateProductTags] = useState(true);

  // Count products by category name
  const productCounts = (products as Product[]).reduce<Record<string, number>>((acc, p) => {
    if (p.category) {
      acc[p.category] = (acc[p.category] || 0) + 1;
    }
    return acc;
  }, {});

  // Sorted list of categories
  const sortedCategories = [...categories].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const filteredCategories = sortedCategories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setNewName("");
    setNewTamilName("");
    setNewImageUrl("");
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.sort_order ?? 0), 0);
    setNewSortOrder(maxOrder + 1);
    setAddModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditTamilName(cat.icon || ""); // using icon/slug for secondary name if available
    setEditImageUrl(cat.image_url || "");
    setEditSortOrder(cat.sort_order ?? 0);
    setUpdateProductTags(true);
  };

  // Add Category Mutation
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const slug = newName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const { error } = await supabase.from("categories").insert({
        name: newName.trim(),
        slug: slug,
        image_url: newImageUrl.trim() || null,
        icon: newTamilName.trim() || null,
        sort_order: Number(newSortOrder) || 0,
      });

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(`Category "${newName}" added successfully`);
      setAddModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add category");
    } finally {
      setSaving(false);
    }
  };

  // Edit Category Mutation
  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const slug = editName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const { error } = await supabase
        .from("categories")
        .update({
          name: editName.trim(),
          slug: slug,
          image_url: editImageUrl.trim() || null,
          icon: editTamilName.trim() || null,
          sort_order: Number(editSortOrder) || 0,
        })
        .eq("id", editingCategory.id);

      if (error) throw error;

      // If category name changed and user wants to sync existing products
      if (updateProductTags && editingCategory.name !== editName.trim()) {
        await supabase
          .from("products")
          .update({ category: editName.trim() })
          .eq("category", editingCategory.name);
        await qc.invalidateQueries({ queryKey: ["products"] });
      }

      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(`Category "${editName}" updated successfully`);
      setEditingCategory(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update category");
    } finally {
      setSaving(false);
    }
  };

  // Delete Category Mutation
  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", deletingCategory.id);

      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(`Category "${deletingCategory.name}" removed`);
      setDeletingCategory(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete category");
    }
  };

  // Quick Reorder (Move Up / Down)
  const handleMoveOrder = async (cat: Category, direction: "up" | "down") => {
    const currentIndex = sortedCategories.findIndex((c) => c.id === cat.id);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedCategories.length) return;

    const targetCat = sortedCategories[targetIndex];
    if (!targetCat) return;

    const currentOrder = cat.sort_order ?? currentIndex;
    const targetOrder = targetCat.sort_order ?? targetIndex;

    const newCurrentOrder = currentOrder === targetOrder ? (direction === "up" ? targetOrder - 1 : targetOrder + 1) : targetOrder;
    const newTargetOrder = currentOrder;

    try {
      await Promise.all([
        supabase.from("categories").update({ sort_order: newCurrentOrder }).eq("id", cat.id),
        supabase.from("categories").update({ sort_order: newTargetOrder }).eq("id", targetCat.id),
      ]);
      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(`Reordered "${cat.name}"`);
    } catch (err: any) {
      toast.error("Failed to reorder category");
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Management Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border/80 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Layers className="size-4.5 text-primary" />
            <span>Store Categories &amp; Navigation Order</span>
            <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5">
              {categories.length} Categories
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Categories configured here determine the circular image cards on the Home Page and populate product tagging dropdowns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenAdd}
            className="rounded-xl h-9 text-xs font-bold gap-1.5 shadow-xs shrink-0"
          >
            <Plus className="size-4" /> Add Category
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Filter categories by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl h-9.5 text-xs bg-card"
        />
      </div>

      {/* Category List */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground">Loading categories...</div>
      ) : filteredCategories.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-8 text-center">
          <Layers className="size-10 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold">No categories found</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Create your first store category to display on your storefront and group your products.
          </p>
          <Button onClick={handleOpenAdd} size="sm" className="rounded-xl text-xs font-bold">
            <Plus className="size-3.5 mr-1" /> Add Category Now
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCategories.map((cat, index) => {
            const count = productCounts[cat.name] || 0;
            const isFirst = index === 0;
            const isLast = index === filteredCategories.length - 1;

            return (
              <Card
                key={cat.id}
                className="rounded-2xl border border-border/80 bg-card hover:border-primary/40 transition-all shadow-2xs overflow-hidden group"
              >
                <div className="p-3.5 flex items-center gap-3">
                  {/* Sort Order Badge & Reorder Arrows */}
                  <div className="flex flex-col items-center justify-center shrink-0">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveOrder(cat, "up")}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      title="Move Category Earlier"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-muted-foreground px-1 bg-muted rounded">
                      #{index + 1}
                    </span>
                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveOrder(cat, "down")}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                      title="Move Category Later"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                  </div>

                  {/* Circular Image Preview */}
                  <div className="size-14 shrink-0 rounded-full border border-border/80 bg-muted overflow-hidden flex items-center justify-center shadow-2xs">
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="size-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="font-bold text-sm text-muted-foreground">
                        {cat.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Category Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-foreground truncate">{cat.name}</h3>
                      {cat.icon && (
                        <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                          ({cat.icon})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Package className="size-3 text-muted-foreground" />
                      <span>{count} {count === 1 ? "Product" : "Products"}</span>
                      <span className="text-muted-foreground/50">&bull;</span>
                      <span className="font-mono text-[10px]">Order: {cat.sort_order ?? 0}</span>
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(cat)}
                      className="size-8 p-0 rounded-xl hover:bg-muted"
                      title="Edit Category"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingCategory(cat)}
                      className="size-8 p-0 rounded-xl text-destructive hover:bg-destructive/10"
                      title="Delete Category"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Category Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0 rounded-2xl sm:max-w-md overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" /> Add New Category
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCategory} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="add-cat-name" className="text-xs font-semibold">
                  Category Name (English) *
                </Label>
                <Input
                  id="add-cat-name"
                  placeholder="e.g. Sea Fish, Fresh Mutton, River Fish"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-cat-tamil" className="text-xs font-semibold">
                  Category Name (Tamil / Local) <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="add-cat-tamil"
                  placeholder="e.g. கடல் மீன், ஆட்டிறைச்சி"
                  value={newTamilName}
                  onChange={(e) => setNewTamilName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category Card Image</Label>
                <p className="text-[11px] text-muted-foreground">
                  Upload an image to display in the circular category showcase on the Home Page.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <div className="size-16 shrink-0 rounded-full border border-border/80 bg-muted overflow-hidden flex items-center justify-center">
                    {newImageUrl ? (
                      <img src={newImageUrl} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-6 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <ImageUpload
                      currentImage={newImageUrl}
                      onUpload={(url) => setNewImageUrl(url)}
                      onRemove={() => setNewImageUrl("")}
                      compact
                      maxSizeMB={0.2}
                      label="Upload Category Image"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="add-cat-order" className="text-xs font-semibold">
                  Display Sort Order
                </Label>
                <Input
                  id="add-cat-order"
                  type="number"
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(Number(e.target.value))}
                  className="rounded-xl h-9 text-xs w-28"
                />
                <p className="text-[10px] text-muted-foreground">
                  Lower numbers appear first on the Home Page category slider.
                </p>
              </div>
            </div>

            <DialogFooter className="p-4 sm:p-5 pt-3 border-t border-border/60 shrink-0 bg-muted/20 flex flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                className="rounded-xl text-xs h-8.5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !newName.trim()}
                className="rounded-xl text-xs font-bold h-8.5"
              >
                {saving ? "Saving..." : "Save Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={Boolean(editingCategory)} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="max-h-[90vh] flex flex-col p-0 rounded-2xl sm:max-w-md overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit2 className="size-4 text-primary" /> Edit Category: {editingCategory?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateCategory} className="flex flex-col flex-1 overflow-hidden">
            <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="edit-cat-name" className="text-xs font-semibold">
                  Category Name (English) *
                </Label>
                <Input
                  id="edit-cat-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-cat-tamil" className="text-xs font-semibold">
                  Category Name (Tamil / Local) <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Input
                  id="edit-cat-tamil"
                  value={editTamilName}
                  onChange={(e) => setEditTamilName(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category Card Image</Label>
                <div className="flex items-center gap-3 pt-1">
                  <div className="size-16 shrink-0 rounded-full border border-border/80 bg-muted overflow-hidden flex items-center justify-center">
                    {editImageUrl ? (
                      <img src={editImageUrl} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="size-6 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <ImageUpload
                      currentImage={editImageUrl}
                      onUpload={(url) => setEditImageUrl(url)}
                      onRemove={() => setEditImageUrl("")}
                      compact
                      maxSizeMB={0.2}
                      label="Replace Category Image"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label htmlFor="edit-cat-order" className="text-xs font-semibold">
                  Display Sort Order
                </Label>
                <Input
                  id="edit-cat-order"
                  type="number"
                  value={editSortOrder}
                  onChange={(e) => setEditSortOrder(Number(e.target.value))}
                  className="rounded-xl h-9 text-xs w-28"
                />
              </div>

              {editingCategory && editingCategory.name !== editName.trim() && (
                <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={updateProductTags}
                      onChange={(e) => setUpdateProductTags(e.target.checked)}
                      className="rounded size-4 text-primary"
                    />
                    <span>
                      Update all products currently tagged as <strong>"{editingCategory.name}"</strong> to <strong>"{editName}"</strong>
                    </span>
                  </label>
                </div>
              )}
            </div>

            <DialogFooter className="p-4 sm:p-5 pt-3 border-t border-border/60 shrink-0 bg-muted/20 flex flex-row justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCategory(null)}
                className="rounded-xl text-xs h-8.5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !editName.trim()}
                className="rounded-xl text-xs font-bold h-8.5"
              >
                {saving ? "Updating..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Category AlertDialog */}
      <AlertDialog open={Boolean(deletingCategory)} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold">
              Delete Category: {deletingCategory?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {deletingCategory && (productCounts[deletingCategory.name] || 0) > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium block">
                  Warning: {productCounts[deletingCategory.name]} products are currently assigned to this category. Deleting it will remove the category from the home page navigation.
                </span>
              ) : (
                "Are you sure you want to delete this category? This will remove it from the home page category showcase."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl text-xs bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDeleteCategory}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
