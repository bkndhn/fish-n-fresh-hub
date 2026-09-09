import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Printer,
  ShieldCheck,
  CreditCard,
  MapPin,
  Fish,
  Layers,
  Check,
  AlertCircle,
  Database,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { settingsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/onboarding")({
  head: () => ({
    meta: [
      { title: "Store Onboarding Wizard | Fish N Fresh White-Label Setup" },
      { name: "description", content: "5-step guided setup wizard for multi-client white-label deployments." },
    ],
  }),
  component: OnboardingWizard,
});

const VERTICALS = [
  { id: "seafood", name: "Fresh Marine Seafood & Harbour Catch", icon: Fish, desc: "Sea fish, river fish, prawns, crabs & cut customization" },
  { id: "meat", name: "Poultry, Mutton & Cold Cuts", icon: Layers, desc: "Fresh broiler chicken, country chicken, mutton & marinades" },
  { id: "grocery", name: "Organic Vegetables & Supermarket Groceries", icon: Store, desc: "Daily farm fresh veggies, fruits & packaged coastal staples" },
];

export function OnboardingWizard() {
  const { data: settings } = useQuery(settingsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  // Form State
  const [storeName, setStoreName] = useState(settings?.store_name || "Fish N Fresh Seafood Hub");
  const [legalName, setLegalName] = useState((settings as any)?.gst_legal_name || "Fish N Fresh Hyperlocal Enterprise LLP");
  const [phone, setPhone] = useState(settings?.contact_phone || settings?.support_phone || "9843061919");
  const [email, setEmail] = useState(settings?.contact_email || "billing@fishnfresh.in");
  const [address, setAddress] = useState(settings?.store_address || "Harbour Bypass Road, Thoothukudi - 628001");

  const [vertical, setVertical] = useState("seafood");

  const [gstin, setGstin] = useState((settings as any)?.gst_number || "33AAAAF0000A1Z5");
  const [fssai, setFssai] = useState((settings as any)?.fssai_license_no || "12423008000451");
  const [upiId, setUpiId] = useState(settings?.upi_id || "9843061919@upi");
  const [upiName, setUpiName] = useState(settings?.upi_name || "Fish N Fresh");

  const [radiusKm, setRadiusKm] = useState(Number(settings?.delivery_radius_km) || 15);
  const [deliveryFee, setDeliveryFee] = useState(Number(settings?.delivery_fee) || 40);
  const [freeThreshold, setFreeThreshold] = useState(Number((settings as any)?.free_delivery_over || (settings as any)?.free_delivery_threshold) || 499);
  const [expressSla, setExpressSla] = useState(Number((settings as any)?.express_sla_mins) || 35);

  const [featurePos, setFeaturePos] = useState(true);
  const [featureLiveChat, setFeatureLiveChat] = useState(true);
  const [featureWallet, setFeatureWallet] = useState(true);
  const [featureAiBenefits, setFeatureAiBenefits] = useState(true);

  // Save mutation
  const saveOnboarding = useMutation({
    mutationFn: async () => {
      const payload: any = {
        store_name: storeName,
        gst_legal_name: legalName,
        contact_phone: phone,
        support_phone: phone,
        whatsapp_number: phone,
        contact_email: email,
        store_address: address,
        gst_number: gstin,
        fssai_license_no: fssai,
        upi_id: upiId,
        upi_name: upiName,
        delivery_radius_km: radiusKm,
        delivery_fee: deliveryFee,
        free_delivery_threshold: freeThreshold,
        express_sla_mins: expressSla,
        feature_pos_enabled: featurePos,
        feature_live_chat_enabled: featureLiveChat,
        feature_wallet_enabled: featureWallet,
        feature_ai_benefits_enabled: featureAiBenefits,
      };

      if (settings?.id) {
        const { error } = await supabase.from("store_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Store setup successfully completed!");
      qc.invalidateQueries({ queryKey: ["store_settings"] });
      navigate({ to: "/admin" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save settings"),
  });

  return (
    <AdminShell title="Store Setup & Onboarding Wizard" allow={["admin"]}>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Wizard Progress Bar */}
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="size-4" /> Step {step} of 5
            </span>
            <span className="text-muted-foreground font-medium">
              {step === 1 && "Brand & Identity"}
              {step === 2 && "Business Vertical"}
              {step === 3 && "Tax & UPI Settlement"}
              {step === 4 && "Delivery & Logistics"}
              {step === 5 && "Hardware & Launch"}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all ${
                  step >= s ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Brand & Contact */}
        {step === 1 && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Store className="size-5 text-primary" /> Step 1: Store & Brand Identity
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Set up your brand name, legal entity, and customer communication channels.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Store Public Display Name</Label>
                  <Input
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Fish N Fresh Hub"
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Legal Entity Name (Invoices)</Label>
                  <Input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="e.g. Acme Hyperlocal Food LLP"
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Support & WhatsApp Phone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Billing Support Email</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. billing@yourstore.in"
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Registered Store / Hub Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full physical address"
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Vertical Selection */}
        {step === 2 && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Layers className="size-5 text-primary" /> Step 2: Select Business Vertical
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Tailor catalog units, cuts, freshness disclaimers, and HSN codes for your business model.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {VERTICALS.map((v) => {
                const Icon = v.icon;
                const isSelected = vertical === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setVertical(v.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border/80 bg-card hover:border-primary/40"
                    }`}
                  >
                    <div
                      className={`p-3 rounded-xl shrink-0 ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground">{v.name}</span>
                        {isSelected && <Check className="size-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Tax & UPI Setup */}
        {step === 3 && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CreditCard className="size-5 text-primary" /> Step 3: Tax Compliance & Direct UPI Settlement
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Zero commission settlement directly to your store bank account via standard UPI QR.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Business GSTIN</Label>
                  <Input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 33AAAAF0000A1Z5"
                    className="mt-1 rounded-xl text-xs font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Printed on official customer Tax Invoices.</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">FSSAI License Number</Label>
                  <Input
                    value={fssai}
                    onChange={(e) => setFssai(e.target.value)}
                    placeholder="14-digit FSSAI License"
                    className="mt-1 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-xs font-semibold">Store Bank UPI VPA ID</Label>
                  <Input
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. storename@okaxis"
                    className="mt-1 rounded-xl text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Customers pay to this UPI ID directly with 0% gateway deductions.
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">UPI Payee Display Name</Label>
                  <Input
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    placeholder="e.g. Fish N Fresh"
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Delivery & Logistics */}
        {step === 4 && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MapPin className="size-5 text-primary" /> Step 4: Geofencing & Delivery Logistics
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Control hyper-local delivery boundary, freight pricing, and express turnaround speed.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Delivery Radius (km)</Label>
                  <Input
                    type="number"
                    value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))}
                    className="mt-1 rounded-xl text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Orders outside this radius are blocked.</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Express Priority Dispatch SLA (Mins)</Label>
                  <Input
                    type="number"
                    value={expressSla}
                    onChange={(e) => setExpressSla(Number(e.target.value))}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Base Delivery Fee (₹)</Label>
                  <Input
                    type="number"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(Number(e.target.value))}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Free Delivery Order Threshold (₹)</Label>
                  <Input
                    type="number"
                    value={freeThreshold}
                    onChange={(e) => setFreeThreshold(Number(e.target.value))}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Hardware & Feature Modules */}
        {step === 5 && (
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" /> Step 5: System Verification & Launch Readiness
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Audit system health, database schema marker, and enable operational feature modules.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              {/* Health Marker */}
              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-foreground">Database Schema Version</span>
                </div>
                <Badge className="bg-emerald-600 text-white font-mono text-[10px]">
                  v2.2.0 &bull; Up to Date
                </Badge>
              </div>

              {/* Module Toggles */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-foreground">Operational Modules (Per-Client Killswitches)</p>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                  <div>
                    <span className="font-semibold text-xs text-foreground block">In-Store Retail POS Counter</span>
                    <span className="text-[11px] text-muted-foreground">Barcode scanner & ESC/POS receipt billing</span>
                  </div>
                  <Switch checked={featurePos} onCheckedChange={setFeaturePos} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                  <div>
                    <span className="font-semibold text-xs text-foreground block">Live Customer Support Desk</span>
                    <span className="text-[11px] text-muted-foreground">In-app floating chat and customer messaging</span>
                  </div>
                  <Switch checked={featureLiveChat} onCheckedChange={setFeatureLiveChat} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                  <div>
                    <span className="font-semibold text-xs text-foreground block">FreshCash Loyalty Wallet</span>
                    <span className="text-[11px] text-muted-foreground">Cashback rewards and customer referral program</span>
                  </div>
                  <Switch checked={featureWallet} onCheckedChange={setFeatureWallet} />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                  <div>
                    <span className="font-semibold text-xs text-foreground block">AI Health & Culinary Benefits</span>
                    <span className="text-[11px] text-muted-foreground">Nutritional profiling & pairing tips per species</span>
                  </div>
                  <Switch checked={featureAiBenefits} onCheckedChange={setFeatureAiBenefits} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wizard Nav Controls */}
        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl font-semibold text-xs gap-1"
            >
              <ArrowLeft className="size-3.5" /> Previous
            </Button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl font-semibold text-xs gap-1"
            >
              Next Step <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => saveOnboarding.mutate()}
              disabled={saveOnboarding.isPending}
              className="rounded-xl font-bold text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
            >
              <CheckCircle2 className="size-4" /> Save & Launch Store
            </Button>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
export default OnboardingWizard;
