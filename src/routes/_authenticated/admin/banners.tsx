import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({ meta: [{ title: "Banners | Admin" }] }),
  component: AdminBanners,
});

function AdminBanners() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(null);

  const { data: banners } = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: async () => {
      const { data } = await supabase.from("banners").select("*").order("sort_order");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (banner: any) => {
      if (banner.id) {
        const { error } = await supabase.from("banners").update(banner).eq("id", banner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("banners").insert(banner);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Banner saved!");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Banner deleted!");
      queryClient.invalidateQueries({ queryKey: ["admin", "banners"] });
    },
  });

  return (
    <AdminShell title="Home Page Banners" allow={["admin", "manager"]}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage the sliding banners on the home page.</p>
        <Button 
          size="sm" 
          className="rounded-xl" 
          onClick={() => {
            setForm({ title: "", subtitle: "", image_url: "", link: "", cta: "Shop Now", sort_order: 0, active: true });
            setEditingId("new");
          }}
        >
          <Plus className="mr-2 size-4" /> Add Banner
        </Button>
      </div>

      {editingId && (
        <Card className="mb-6 border-primary bg-primary/5">
          <CardContent className="space-y-4 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Subtitle</Label>
                <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Button Text (CTA)</Label>
                <Input value={form.cta} onChange={(e) => setForm({ ...form, cta: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Link / URL</Label>
                <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Banner Image (Desktop & Mobile)</Label>
              <div className="mt-1">
                <ImageUpload currentImage={form.image_url} onUpload={(url) => setForm({ ...form, image_url: url })} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>Save</Button>
              <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {banners?.map((b) => (
          <Card key={b.id}>
            <CardContent className="pt-6">
              <div className="aspect-[21/9] overflow-hidden rounded-lg bg-muted">
                {b.image_url && <img src={b.image_url} className="h-full w-full object-cover" alt="Banner" />}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{b.cta} → {b.link || "No link"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setForm(b); setEditingId(b.id); }}>Edit</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="destructive"><Trash2 className="size-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete banner?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this banner. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteMutation.mutate(b.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {banners?.length === 0 && !editingId && <p className="text-sm text-muted-foreground">No banners found. Add one!</p>}
      </div>
    </AdminShell>
  );
}
