import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw, MapPin, Compass, Zap, Gift, Bell, Wallet, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { settingsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/ImageUpload";
import { useState, useEffect } from "react";
import { MapPinPickerModal } from "@/components/MapPinPickerModal";
import { getGoogleMapsDirUrl, type GeocodedAddress } from "@/lib/maps";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettings,
});

type GatewayCreds = { id?: string; provider: string; api_key: string; secret_key: string };

function AdminSettings() {
  const qc = useQueryClient();
  const { data: settings } = useQuery(settingsQuery);
  const [form, setForm] = useState<any>({});
  const [gatewayForm, setGatewayForm] = useState<GatewayCreds>({ provider: "none", api_key: "", secret_key: "" });
  const [shopPinModalOpen, setShopPinModalOpen] = useState(false);

  const { data: gateway } = useQuery({
    queryKey: ["payment_gateway_credentials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_gateway_credentials")
        .select("id, provider, api_key, secret_key")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (gateway)
      setGatewayForm({
        id: gateway.id,
        provider: gateway.provider ?? "none",
        api_key: gateway.api_key ?? "",
        secret_key: gateway.secret_key ?? "",
      });
  }, [gateway]);

  const update = useMutation({
    mutationFn: async (patch: any) => {
      if (!settings?.id) return;
      const { error } = await supabase.from("store_settings").update(patch).eq("id", settings.id);
      if (error) throw error;

      const creds = {
        provider: gatewayForm.provider,
        api_key: gatewayForm.api_key || null,
        secret_key: gatewayForm.secret_key || null,
      };
      if (gatewayForm.id) {
        const { error: gErr } = await supabase
          .from("payment_gateway_credentials")
          .update(creds)
          .eq("id", gatewayForm.id);
        if (gErr) throw gErr;
      } else if (gatewayForm.provider !== "none") {
        const { error: gErr } = await supabase.from("payment_gateway_credentials").insert(creds);
        if (gErr) throw gErr;
      }
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["store_settings"] });
      qc.invalidateQueries({ queryKey: ["payment_gateway_credentials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleShopPinConfirm = (loc: GeocodedAddress) => {
    setForm((prev: any) => ({
      ...prev,
      shop_lat: Number(loc.lat.toFixed(6)),
      shop_lng: Number(loc.lng.toFixed(6)),
      store_address: prev.store_address || loc.displayName || loc.address,
    }));
    toast.success("Store GPS coordinates updated! Click 'Save Settings' below to persist.");
  };

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
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Shop Location & GPS Pin</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exact store coordinates used for route calculations, distance delivery fees, and driver navigation.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-semibold text-primary border-primary/30 hover:bg-primary/5 shrink-0"
              onClick={() => setShopPinModalOpen(true)}
            >
              <MapPin className="size-3.5 mr-1.5 text-primary" /> Move Pin on Map
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.shop_lat && form.shop_lng ? (
              <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-2.5 text-xs text-foreground">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary font-bold">
                    📍
                  </span>
                  <div>
                    <span className="font-semibold">Pinned Store Coordinates:</span>{" "}
                    <code className="text-primary font-mono">{Number(form.shop_lat).toFixed(6)}, {Number(form.shop_lng).toFixed(6)}</code>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 px-2"
                  asChild
                >
                  <a
                    href={getGoogleMapsDirUrl(form.shop_lat, form.shop_lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Compass className="size-3 mr-1" /> Test Nav
                  </a>
                </Button>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                ⚠️ Store GPS pin not set. Click &quot;Move Pin on Map&quot; to drop a doorstep pin on your physical store.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.shop_lat ?? ""}
                  onChange={(e) => setForm({ ...form, shop_lat: e.target.value ? Number(e.target.value) : null })}
                  className="rounded-xl text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.shop_lng ?? ""}
                  onChange={(e) => setForm({ ...form, shop_lng: e.target.value ? Number(e.target.value) : null })}
                  className="rounded-xl text-sm"
                />
              </div>
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

            {/* App Theme Color with Revert to Default and Preset Swatches */}
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-sm font-semibold">App Brand & Theme Color</Label>
                  <p className="text-[11px] text-muted-foreground">Sets the primary accent color across buttons, badges, and headers.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-lg hover:bg-muted"
                  onClick={() => {
                    setForm({ ...form, theme_color: "#0ea5e9" });
                    toast.success("Reverted to Default Ocean Blue theme (#0ea5e9)");
                  }}
                >
                  <RotateCcw className="mr-1 size-3" /> Revert to Default
                </Button>
              </div>

              {/* Color picker and presets */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="size-9 p-0.5 rounded-lg cursor-pointer border-border"
                    value={form.theme_color || "#0ea5e9"}
                    onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                  />
                  <Input
                    type="text"
                    value={form.theme_color || "#0ea5e9"}
                    onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                    className="h-8 w-24 rounded-lg font-mono text-xs uppercase"
                    placeholder="#0ea5e9"
                  />
                </div>

                {/* Quick Swatch Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { name: "Default Ocean", color: "#0ea5e9" },
                    { name: "Deep Navy", color: "#0369a1" },
                    { name: "Fresh Emerald", color: "#059669" },
                    { name: "Coastal Teal", color: "#0d9488" },
                    { name: "Royal Indigo", color: "#4f46e5" },
                    { name: "Sunset Coral", color: "#f97316" },
                  ].map((preset) => {
                    const isSelected = (form.theme_color || "#0ea5e9").toLowerCase() === preset.color.toLowerCase();
                    return (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, theme_color: preset.color });
                          toast.info(`Selected ${preset.name}`);
                        }}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                          isSelected
                            ? "border-foreground font-semibold bg-background shadow-xs ring-1 ring-foreground"
                            : "border-border bg-background/60 text-muted-foreground hover:border-foreground/40"
                        }`}
                      >
                        <span
                          className="size-3 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span>{preset.name}</span>
                        {preset.color === "#0ea5e9" && (
                          <span className="text-[10px] text-muted-foreground font-normal">(Default)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Theme Live Preview */}
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span>Preview:</span>
                <span
                  className="rounded-md px-2.5 py-0.5 text-xs font-semibold text-white shadow-xs"
                  style={{ backgroundColor: form.theme_color || "#0ea5e9" }}
                >
                  Primary Button
                </span>
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium border"
                  style={{
                    color: form.theme_color || "#0ea5e9",
                    borderColor: `${form.theme_color || "#0ea5e9"}60`,
                    backgroundColor: `${form.theme_color || "#0ea5e9"}15`,
                  }}
                >
                  Active Badge
                </span>
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

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-lg">Inventory, Taxes & Customer Urgency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Default GST Percentage (%)</Label>
              <Input
                type="number"
                value={form.default_gst_percent ?? 0}
                onChange={(e) => setForm({ ...form, default_gst_percent: Number(e.target.value) })}
                placeholder="0"
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Default GST rate pre-filled when creating new seafood items.
              </p>
            </div>

            <div>
              <Label>Stock Urgency Alert Limit</Label>
              <Input
                type="number"
                value={form.stock_urgency_threshold ?? 5}
                onChange={(e) => setForm({ ...form, stock_urgency_threshold: Number(e.target.value) })}
                placeholder="5"
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Displays "🔥 Only X left!" to customers when stock is below or equal to this limit.
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-xl border p-3 bg-muted/20">
              <div className="space-y-0.5">
                <Label htmlFor="show_stock_customer" className="font-semibold cursor-pointer">
                  Show Live Stock Urgency
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Displays remaining quantity badge to customers in catalog & product page to drive conversions.
                </p>
              </div>
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show_stock_customer"
                  checked={form.show_stock_to_customers ?? true}
                  onChange={(e) => setForm({ ...form, show_stock_to_customers: e.target.checked })}
                  className="size-4 cursor-pointer"
                />
                <span className="text-xs font-semibold">
                  {form.show_stock_to_customers ?? true ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="mt-4 border-primary">
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
                value={gatewayForm.provider ?? "none"}
                onChange={(e) => setGatewayForm({ ...gatewayForm, provider: e.target.value })}
              >
                <option value="none">Manual UPI Only</option>
                <option value="razorpay">Razorpay</option>
                <option value="phonepe">PhonePe</option>
                <option value="cashfree">Cashfree</option>
              </select>
            </div>
            {gatewayForm.provider !== "none" && (
              <>
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={gatewayForm.api_key ?? ""}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, api_key: e.target.value })}
                    placeholder="rzp_live_..."
                  />
                </div>
                <div>
                  <Label>Secret Key</Label>
                  <Input
                    type="password"
                    value={gatewayForm.secret_key ?? ""}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, secret_key: e.target.value })}
                  />
                </div>
              </>
            )}
            <p className="col-span-2 text-[10px] text-muted-foreground">
              Gateway keys are stored separately and can only be read by admins.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* 1. Express Delivery Turnaround & SLA Settings */}
      <Card className="mt-6 rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="size-4 text-amber-500 fill-amber-500" />
              ⚡ Express Delivery Turnaround & SLA Settings
            </span>
            <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400">
              High Priority Dispatch
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Enable Express Turnaround (30–45 Mins)</Label>
              <p className="text-xs text-muted-foreground">
                Allows customers to pick fastest doorstep dispatch packed fresh on ice.
              </p>
            </div>
            <Switch
              checked={form.express_delivery_enabled ?? true}
              onCheckedChange={(val) => setForm({ ...form, express_delivery_enabled: val })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="express_delivery_fee">Express Surcharge / Priority Fee (₹)</Label>
              <Input
                id="express_delivery_fee"
                type="number"
                min="0"
                value={form.express_delivery_fee ?? 25}
                onChange={(e) => setForm({ ...form, express_delivery_fee: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Added to delivery fee when express turnaround is selected (Default ₹25).
              </p>
            </div>
            <div>
              <Label htmlFor="express_sla_mins">Turnaround Promised SLA (Minutes)</Label>
              <Input
                id="express_sla_mins"
                type="number"
                min="15"
                max="120"
                value={form.express_sla_mins ?? 35}
                onChange={(e) => setForm({ ...form, express_sla_mins: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Badge displayed on product cards and checkout SLA guarantee (e.g. 35 mins).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. FreshCash Loyalty & Referral Wallet Settings */}
      <Card className="mt-6 rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              🎁 FreshCash Loyalty & Referral Wallet Program
            </span>
            <Badge variant="outline" className="text-xs border-primary/40 text-primary">
              Toggleable & Ledger Audited
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Enable FreshCash Wallet & Referral Program</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, customers get personal invite codes, cashback on delivered orders, and can redeem balance at checkout.
              </p>
            </div>
            <Switch
              checked={form.wallet_enabled ?? true}
              onCheckedChange={(val) => setForm({ ...form, wallet_enabled: val })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="referral_reward_referrer">Referrer Bonus (₹)</Label>
              <Input
                id="referral_reward_referrer"
                type="number"
                min="0"
                value={form.referral_reward_referrer ?? 50}
                onChange={(e) => setForm({ ...form, referral_reward_referrer: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                FreshCash credited to the user who shared the code upon friend's first delivered order.
              </p>
            </div>
            <div>
              <Label htmlFor="referral_reward_referee">Referee Welcome Discount (₹)</Label>
              <Input
                id="referral_reward_referee"
                type="number"
                min="0"
                value={form.referral_reward_referee ?? 50}
                onChange={(e) => setForm({ ...form, referral_reward_referee: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Instant checkout welcome discount for the newly invited friend.
              </p>
            </div>
            <div>
              <Label htmlFor="cashback_percent">Order Cashback (%)</Label>
              <Input
                id="cashback_percent"
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={form.cashback_percent ?? 2.5}
                onChange={(e) => setForm({ ...form, cashback_percent: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Cashback percentage credited to customer wallet upon successful order delivery.
              </p>
            </div>
            <div>
              <Label htmlFor="max_wallet_burn_percent">Max Wallet Burn Per Order (%)</Label>
              <Input
                id="max_wallet_burn_percent"
                type="number"
                min="5"
                max="100"
                value={form.max_wallet_burn_percent ?? 50}
                onChange={(e) => setForm({ ...form, max_wallet_burn_percent: Number(e.target.value) })}
                className="mt-1"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Max percentage of order subtotal that can be paid using FreshCash balance (e.g. 50%).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Firebase Cloud Messaging (FCM) Foundation */}
      <Card className="mt-6 rounded-2xl shadow-xs">
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="size-4 text-sky-500" />
              🔔 Firebase Cloud Messaging (FCM) & Push Setup
            </span>
            <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 text-xs">
              PWA Foundation Ready
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 p-3 text-xs text-sky-800 dark:text-sky-300">
            <p className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-sky-600 dark:text-sky-400" />
              Push Architecture Active: Web Push & Token Registry Configured
            </p>
            <p className="mt-1 opacity-90">
              Customer & staff device tokens are automatically captured in PostgreSQL <code className="font-mono bg-sky-100 dark:bg-sky-900/60 px-1 py-0.5 rounded">fcm_tokens</code> table. The system operates locally with service worker push fallback. When you are ready to configure your Firebase project, enter your credentials below.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fcm_project_id">Firebase Project ID</Label>
              <Input
                id="fcm_project_id"
                value={form.fcm_project_id ?? ""}
                onChange={(e) => setForm({ ...form, fcm_project_id: e.target.value })}
                placeholder="e.g. fish-n-fresh-hub"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="fcm_server_key">FCM Server Key / Web VAPID Key (Add Later)</Label>
              <Input
                id="fcm_server_key"
                type="password"
                value={form.fcm_server_key ?? ""}
                onChange={(e) => setForm({ ...form, fcm_server_key: e.target.value })}
                placeholder="AAAA... or BOrz..."
                className="mt-1 font-mono text-xs"
              />
            </div>
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

      {/* Interactive Shop Map Pin Picker Modal */}
      <MapPinPickerModal
        open={shopPinModalOpen}
        onOpenChange={setShopPinModalOpen}
        initialLat={form.shop_lat ? Number(form.shop_lat) : undefined}
        initialLng={form.shop_lng ? Number(form.shop_lng) : undefined}
        title="Set Physical Shop Location"
        confirmLabel="Confirm Store Location"
        onConfirm={handleShopPinConfirm}
      />
    </AdminShell>
  );
}
