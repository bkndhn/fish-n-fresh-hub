import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { settingsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const update = useMutation({
    mutationFn: async (patch: any) => {
      if (!settings?.id) return;
      const { error } = await supabase.from("store_settings").update(patch).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["store_settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!settings) return null;

  return (
    <AdminShell title="Store Settings" allow={["admin"]}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Shop Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                value={form.shop_lat ?? ""}
                onChange={(e) => setForm({ ...form, shop_lat: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                value={form.shop_lng ?? ""}
                onChange={(e) => setForm({ ...form, shop_lng: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Delivery Pricing engine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Base Delivery Fee (₹)</Label>
              <Input
                type="number"
                value={form.base_delivery_fee ?? ""}
                onChange={(e) => setForm({ ...form, base_delivery_fee: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Per KM Charge (₹)</Label>
              <Input
                type="number"
                value={form.per_km_charge ?? ""}
                onChange={(e) => setForm({ ...form, per_km_charge: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Free Delivery Over (₹)</Label>
              <Input
                type="number"
                value={form.free_delivery_over ?? ""}
                onChange={(e) => setForm({ ...form, free_delivery_over: Number(e.target.value) })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Complaint Window (Hours after order)</Label>
              <Input
                type="number"
                value={form.complaint_window_hours ?? 24}
                onChange={(e) => setForm({ ...form, complaint_window_hours: Number(e.target.value) })}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                How many hours after placing the order can a customer raise a complaint?
              </p>
            </div>
            <div>
              <Label>Support Phone Number</Label>
              <Input
                value={form.support_phone ?? ""}
                onChange={(e) => setForm({ ...form, support_phone: e.target.value })}
                placeholder="+91..."
              />
            </div>
            <div>
              <Label>Support Email</Label>
              <Input
                type="email"
                value={form.support_email ?? ""}
                onChange={(e) => setForm({ ...form, support_email: e.target.value })}
                placeholder="help@fishnfresh.com"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">App Customization & Socials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Logo URL</Label>
              <Input
                value={form.logo_url ?? ""}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>WhatsApp Link</Label>
              <Input
                value={form.social_whatsapp ?? ""}
                onChange={(e) => setForm({ ...form, social_whatsapp: e.target.value })}
                placeholder="https://wa.me/..."
              />
            </div>
            <div>
              <Label>Instagram Link</Label>
              <Input
                value={form.social_instagram ?? ""}
                onChange={(e) => setForm({ ...form, social_instagram: e.target.value })}
                placeholder="https://instagram.com/..."
              />
            </div>
            <div>
              <Label>Facebook Link</Label>
              <Input
                value={form.social_facebook ?? ""}
                onChange={(e) => setForm({ ...form, social_facebook: e.target.value })}
                placeholder="https://facebook.com/..."
              />
            </div>
            <div>
              <Label>X (Twitter) Link</Label>
              <Input
                value={form.social_x ?? ""}
                onChange={(e) => setForm({ ...form, social_x: e.target.value })}
                placeholder="https://x.com/..."
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Legal & Certifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>FSSAI License Number</Label>
              <Input
                value={form.fssai_number ?? ""}
                onChange={(e) => setForm({ ...form, fssai_number: e.target.value })}
                placeholder="Enter 14-digit FSSAI number"
              />
            </div>
            <div>
              <Label>Terms and Conditions</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.terms_and_conditions ?? ""}
                onChange={(e) => setForm({ ...form, terms_and_conditions: e.target.value })}
                placeholder="Write your terms and conditions here..."
              />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Button 
        className="mt-6 rounded-xl" 
        onClick={() => update.mutate(form)}
        disabled={update.isPending}
      >
        {update.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </AdminShell>
  );
}
