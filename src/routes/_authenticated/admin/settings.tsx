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
import { ImageUpload } from "@/components/ImageUpload";
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
      <div className="mb-6 flex items-center justify-between rounded-2xl border p-4 bg-card">
        <div>
          <h3 className="font-semibold text-base">Store Status</h3>
          <p className="text-xs text-muted-foreground">
            {form.is_open ?? true ? "Store is currently OPEN and accepting orders." : "Store is CLOSED. Customers will see pre-order notification."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${form.is_open ?? true ? "text-green-600" : "text-destructive"}`}>
            {form.is_open ?? true ? "OPEN" : "CLOSED"}
          </span>
          <input
            type="checkbox"
            id="store_is_open"
            checked={form.is_open ?? true}
            onChange={(e) => setForm({ ...form, is_open: e.target.checked })}
            className="h-5 w-5 cursor-pointer"
          />
        </div>
      </div>

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
            <div className="space-y-1.5">
              <Label>Store Address (Footer)</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.store_address ?? ""}
                onChange={(e) => setForm({ ...form, store_address: e.target.value })}
                placeholder="123 Fish Market, Chennai..."
              />
            </div>
            <div>
              <Label>Google Maps Link (for Address)</Label>
              <Input
                value={form.store_map_link ?? ""}
                onChange={(e) => setForm({ ...form, store_map_link: e.target.value })}
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>
            <div>
              <Label>Firm Name (for Copyright Footer)</Label>
              <Input
                value={form.firm_name ?? ""}
                onChange={(e) => setForm({ ...form, firm_name: e.target.value })}
                placeholder="Fish N Fresh LLC"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>App Theme Color (Hex)</Label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="color"
                    className="w-16 h-10 p-1 cursor-pointer"
                    value={form.theme_color ?? "#0ea5e9"}
                    onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                  />
                  <span className="text-xs text-muted-foreground">{form.theme_color ?? "Default Blue"}</span>
                </div>
              </div>
              <div>
                <Label>Logo</Label>
                <div className="mt-1">
                  <ImageUpload 
                    currentImage={form.logo_url} 
                    onUpload={(url) => setForm({ ...form, logo_url: url })} 
                  />
                </div>
              </div>
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
            <div>
              <Label>Google Review Link</Label>
              <Input
                value={form.google_review_link ?? ""}
                onChange={(e) => setForm({ ...form, google_review_link: e.target.value })}
                placeholder="https://g.page/r/..."
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
      
      <Card className="mt-6 border-primary">
        <CardHeader>
          <CardTitle className="text-lg">Payments & Checkout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="require_online"
              checked={form.require_online_payment ?? false}
              onChange={(e) => setForm({ ...form, require_online_payment: e.target.checked })}
              className="h-4 w-4"
            />
            <Label htmlFor="require_online" className="cursor-pointer">
              Require Online Payment (Disable Cash on Delivery)
            </Label>
          </div>

          <div className="rounded-xl border p-4 bg-muted/40 space-y-3">
            <h4 className="font-semibold text-sm">Direct UPI & QR Code Settings (Zero Gateway Fees)</h4>
            <p className="text-xs text-muted-foreground">
              Payments go directly to your bank account via UPI with 0% commission. Customers can scan a QR code or tap to pay using GPay, PhonePe, or Paytm.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="upi_id">Store UPI ID (VPA) *</Label>
                <Input
                  id="upi_id"
                  value={form.upi_id ?? ""}
                  onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                  placeholder="e.g. 9843061919@upi or store@okhdfcbank"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="upi_name">UPI Business Display Name *</Label>
                <Input
                  id="upi_name"
                  value={form.upi_name ?? ""}
                  onChange={(e) => setForm({ ...form, upi_name: e.target.value })}
                  placeholder="e.g. Fish N Fresh Hub"
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Gateway Provider</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={form.payment_gateway ?? "none"}
                onChange={(e) => setForm({ ...form, payment_gateway: e.target.value })}
              >
                <option value="none">Manual UPI Only</option>
                <option value="razorpay">Razorpay</option>
                <option value="phonepe">PhonePe</option>
                <option value="cashfree">Cashfree</option>
              </select>
            </div>
            {form.payment_gateway !== "none" && (
              <>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={form.gateway_api_key ?? ""}
                    onChange={(e) => setForm({ ...form, gateway_api_key: e.target.value })}
                    placeholder="rzp_live_..."
                  />
                </div>
                <div>
                  <Label>Secret Key</Label>
                  <Input
                    type="password"
                    value={form.gateway_secret_key ?? ""}
                    onChange={(e) => setForm({ ...form, gateway_secret_key: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
      
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
