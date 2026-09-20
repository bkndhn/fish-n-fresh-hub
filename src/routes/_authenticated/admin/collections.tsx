import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAdminBranch } from "@/lib/branchContext";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, Edit2, Check, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/admin/collections")({
  component: CollectionsAdmin,
});

type Collection = Database["public"]["Tables"]["collections"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];

function CollectionsAdmin() {
  const qc = useQueryClient();
  const { selectedBranchId, isConsolidated } = useAdminBranch();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: collections, isLoading } = useQuery({
    queryKey: ["admin", "collections", selectedBranchId],
    queryFn: async () => {
      let q = supabase.from("collections").select("*").order("sort_order");
      if (selectedBranchId) {
        q = q.or(`branch_id.eq.${selectedBranchId},branch_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Collection[];
    }
  });

  const { data: products } = useQuery({
    queryKey: ["admin", "products_for_collections", selectedBranchId],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, image_url").eq("is_available", true);
      if (selectedBranchId) {
        q = q.or(`branch_id.eq.${selectedBranchId},branch_id.is.null`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Pick<Product, "id" | "name" | "image_url">[];
    }
  });

  const createCol = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("collections").insert({
        name,
        branch_id: selectedBranchId || null,
        sort_order: (collections?.length || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collection created");
      qc.invalidateQueries({ queryKey: ["admin", "collections"] });
    }
  });

  const updateCol = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Collection> }) => {
      const { error } = await supabase.from("collections").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "collections"] });
      setEditingId(null);
    }
  });

  const deleteCol = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Collection deleted");
      qc.invalidateQueries({ queryKey: ["admin", "collections"] });
    }
  });

  const updateSort = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      // Supabase lacks bulk update in JS client without RPC, so we do Promise.all
      await Promise.all(
        updates.map((u) => supabase.from("collections").update({ sort_order: u.sort_order }).eq("id", u.id))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "collections"] });
    }
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination || !collections) return;
    const items = Array.from(collections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    if (!reorderedItem) return;
    items.splice(result.destination.index, 0, reorderedItem);

    const updates = items.map((item, index) => ({ id: item.id, sort_order: index + 1 }));
    // Optimistic update
    qc.setQueryData(["admin", "collections", selectedBranchId], items.map((item, index) => ({...item, sort_order: index + 1})));
    updateSort.mutate(updates);
  };

  return (
    <AdminShell title="Home Collections">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Home Collections</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organize your homepage headers and the products underneath them.
            </p>
          </div>
          <Button onClick={() => {
            const name = prompt("Enter collection name (e.g. Diwali Specials)");
            if (name) createCol.mutate(name);
          }} className="rounded-xl shadow-xs">
            <Plus className="size-4 mr-2" /> Add Collection
          </Button>
        </div>

        {isConsolidated && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl text-sm font-medium">
            Viewing global collections. Switch to a specific branch to manage branch-specific collections.
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden p-1">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : collections?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              No collections found. Create one to display products on the homepage.
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="collections">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                    {collections?.map((col, index) => (
                      <Draggable key={col.id} draggableId={col.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border bg-background ${
                              snapshot.isDragging ? "shadow-md ring-1 ring-primary/20 border-primary/20" : "border-border/50 hover:bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div {...provided.dragHandleProps} className="p-1.5 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing rounded-md hover:bg-muted">
                                <GripVertical className="size-4" />
                              </div>
                              
                              {editingId === col.id ? (
                                <div className="flex items-center gap-2 flex-1 max-w-sm">
                                  <Input 
                                    value={editName} 
                                    onChange={e => setEditName(e.target.value)} 
                                    className="h-8 rounded-lg"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') updateCol.mutate({ id: col.id, patch: { name: editName } });
                                      if (e.key === 'Escape') setEditingId(null);
                                    }}
                                  />
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={() => updateCol.mutate({ id: col.id, patch: { name: editName } })}>
                                    <Check className="size-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setEditingId(null)}>
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <span className="font-semibold text-sm sm:text-base truncate">{col.name}</span>
                                  {!col.active && <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-medium">Hidden</span>}
                                  <button onClick={() => { setEditingId(col.id); setEditName(col.name); }} className="text-muted-foreground/60 hover:text-primary transition-colors p-1">
                                    <Edit2 className="size-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg text-xs"
                                onClick={() => {
                                  updateCol.mutate({ id: col.id, patch: { active: !col.active } });
                                }}
                              >
                                {col.active ? "Hide" : "Show"}
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-rose-500/70 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                                onClick={() => {
                                  if (confirm(`Delete collection "${col.name}"?`)) deleteCol.mutate(col.id);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
