import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Printer,
  Sparkles,
  Eye,
  CheckCircle2,
  Smartphone,
  Phone,
  Instagram,
  ShieldCheck,
  FileText,
  RotateCcw,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSavedPrinterConfig,
  savePrinterConfig,
  type ThermalPrinterConfig,
  buildPosReceiptHtml,
  type PosReceiptData,
  sendEscPosToPrinter,
  buildPosReceiptEscPos,
} from "@/lib/thermalPrinter";
import type { SiteSettings } from "@/lib/types";

interface ThermalPrinterCustomizerProps {
  tenantId?: string;
  settings?: SiteSettings | null;
  onSaveToDatabase?: (patch: Record<string, unknown>) => Promise<void>;
}

export function ThermalPrinterCustomizer({
  tenantId,
  settings,
  onSaveToDatabase,
}: ThermalPrinterCustomizerProps) {
  const [config, setConfig] = useState<ThermalPrinterConfig>(() =>
    getSavedPrinterConfig(tenantId)
  );
  const [previewWidth, setPreviewWidth] = useState<"58mm" | "80mm">("58mm");
  const [isSaving, setIsSaving] = useState(false);
  const [isPrintingTest, setIsPrintingTest] = useState(false);

  // Sync initial settings from database if available
  useEffect(() => {
    if (settings) {
      setConfig((prev) => ({
        ...prev,
        showHeaderStoreName: true,
        showHeaderAddress: settings.printer_show_address !== false,
        showHeaderPhone: settings.printer_show_phone !== false,
        showHeaderGstin: settings.printer_show_gstin !== false,
        showHeaderFssai: settings.printer_show_fssai !== false,
        showFooterWhatsapp: settings.printer_show_whatsapp !== false,
        showFooterSupport: settings.printer_show_support !== false,
        showFooterSocial: settings.printer_show_social !== false,
        showFooterReturnPolicy: settings.printer_show_return_policy !== false,
        whatsappNumber: settings.printer_whatsapp_number || settings.contact_phone || prev.whatsappNumber || "+91 98430 61919",
        socialHandle: settings.printer_social_handle || prev.socialHandle || "@fishnfreshhub",
        supportPhone: settings.contact_phone || prev.supportPhone || "+91 98430 61919",
        fssaiNumber: settings.fssai_license_no || settings.fssai_number || undefined,
        customFooterNote: settings.printer_custom_footer_message || prev.customFooterNote || "",
        footerText: settings.terms_and_conditions || prev.footerText || "Fresh Catch Daily · No Returns After Cutting",
      }));
    }
  }, [settings]);

  const sampleReceiptData: PosReceiptData = useMemo(() => {
    return {
      receiptNo: "POS-2026-0842",
      date: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      cashierName: "Aravind (Counter 1)",
      customerName: "Rahul Sharma",
      customerPhone: "9876543210",
      items: [
        {
          id: "1",
          name: "Fresh Seer Fish / Vanjaram",
          weightKg: 1.25,
          unitPrice: 950,
          totalPrice: 1188,
          cuttingStyle: "Steaks / Slices",
          unit: "kg",
        },
        {
          id: "2",
          name: "Tiger Prawns (Large)",
          qty: 1,
          weightKg: 0.5,
          unitPrice: 650,
          totalPrice: 325,
          cuttingStyle: "Cleaned & Deveined",
          unit: "kg",
        },
      ],
      subtotal: 1513,
      discount: 50,
      gstAmount: settings?.gst_enabled !== false ? 73 : 0,
      total: settings?.gst_enabled !== false ? 1536 : 1463,
      paymentMethod: "UPI QR (Google Pay)",
      upiRef: "UPI-4291083921",
      storeName: settings?.store_name || config.headerLine1 || "Fish N Fresh Hub",
      storeAddress: settings?.store_address || "42 Harbour Road, Royapuram, Chennai - 600013",
      storePhone: settings?.contact_phone || "+91 98430 61919",
      storeGstin: settings?.gst_enabled !== false ? (settings?.gstin || "33AAAAA0000A1Z5") : undefined,
      storeFssai: settings?.fssai_license_no || settings?.fssai_number || "12423008000123",
      copyType: "ORIGINAL",
      isReprint: false,
    };
  }, [settings, config.headerLine1]);

  const previewHtml = useMemo(() => {
    return buildPosReceiptHtml(sampleReceiptData, {
      ...config,
      paperWidth: previewWidth,
    });
  }, [sampleReceiptData, config, previewWidth]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save locally per tenant
      savePrinterConfig(config, tenantId);

      // 2. Persist to Supabase store_settings if callback provided
      if (onSaveToDatabase) {
        await onSaveToDatabase({
          printer_show_gstin: config.showHeaderGstin,
          printer_show_fssai: config.showHeaderFssai,
          printer_show_address: config.showHeaderAddress,
          printer_show_phone: config.showHeaderPhone,
          printer_show_whatsapp: config.showFooterWhatsapp,
          printer_show_social: config.showFooterSocial,
          printer_show_support: config.showFooterSupport,
          printer_show_return_policy: config.showFooterReturnPolicy,
          printer_custom_footer_message: config.customFooterNote || null,
          printer_whatsapp_number: config.whatsappNumber || null,
          printer_social_handle: config.socialHandle || null,
        });
      }

      toast.success("Thermal Printer Header & Footer Customizations saved!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = async () => {
    setIsPrintingTest(true);
    try {
      const bytes = buildPosReceiptEscPos(sampleReceiptData, {
        ...config,
        paperWidth: previewWidth,
      });
      await sendEscPosToPrinter(bytes, config, previewHtml);
      toast.success("Test print job dispatched to thermal printer!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Test print failed";
      toast.error(msg);
    } finally {
      setIsPrintingTest(false);
    }
  };

  const handleResetDefaults = () => {
    setConfig((prev) => ({
      ...prev,
      showHeaderStoreName: true,
      showHeaderAddress: true,
      showHeaderPhone: true,
      showHeaderGstin: true,
      showHeaderFssai: true,
      showFooterGstin: false,
      showFooterSupport: true,
      showFooterWhatsapp: true,
      showFooterSocial: true,
      showFooterReturnPolicy: true,
      whatsappNumber: settings?.contact_phone || "+91 98430 61919",
      socialHandle: "@fishnfreshhub",
      supportPhone: settings?.contact_phone || "+91 98430 61919",
      customFooterNote: "Thank you for shopping with us! Fresh catch guaranteed.",
      returnPolicyText: "Fresh Catch Daily · No returns once cut or cleaned",
    }));
    toast.info("Restored default thermal template options. Click 'Save' to apply.");
  };

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Printer className="size-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Thermal Printer Header &amp; Footer Customizer</CardTitle>
              <CardDescription className="text-xs">
                Configure what appears on your 58mm / 80mm billing receipts. Fully isolated per client.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="rounded-xl text-xs h-8 gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              Reset Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl text-xs h-8 gap-1.5"
            >
              <Save className="size-3.5" />
              {isSaving ? "Saving..." : "Save Customizer"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Controls & Toggles (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Header Section Controls */}
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/10 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5 text-primary" /> Receipt Header Options
                </span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Top of Slip
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs">
                  <div>
                    <Label className="font-medium text-xs cursor-pointer">Store Brand Name</Label>
                    <p className="text-[10px] text-muted-foreground">Large bold store title</p>
                  </div>
                  <Switch
                    checked={config.showHeaderStoreName !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showHeaderStoreName: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs">
                  <div>
                    <Label className="font-medium text-xs cursor-pointer">Store Address</Label>
                    <p className="text-[10px] text-muted-foreground">Physical shop location</p>
                  </div>
                  <Switch
                    checked={config.showHeaderAddress !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showHeaderAddress: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs">
                  <div>
                    <Label className="font-medium text-xs cursor-pointer">Store Phone Number</Label>
                    <p className="text-[10px] text-muted-foreground">Contact number on top</p>
                  </div>
                  <Switch
                    checked={config.showHeaderPhone !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showHeaderPhone: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs">
                  <div>
                    <Label className="font-medium text-xs cursor-pointer">Header GSTIN</Label>
                    <p className="text-[10px] text-muted-foreground">Statutory tax identifier</p>
                  </div>
                  <Switch
                    checked={config.showHeaderGstin !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showHeaderGstin: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border bg-card text-xs sm:col-span-2">
                  <div>
                    <Label className="font-medium text-xs cursor-pointer flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-emerald-600" />
                      FSSAI Food License Number
                    </Label>
                    <p className="text-[10px] text-muted-foreground">
                      Mandatory food safety license printed at the top
                    </p>
                  </div>
                  <Switch
                    checked={config.showHeaderFssai !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showHeaderFssai: checked }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Footer Section Controls */}
            <div className="rounded-2xl border border-border/70 p-4 bg-muted/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="size-3.5 text-emerald-600" /> Receipt Footer &amp; Social Links
                </span>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Bottom of Slip
                </Badge>
              </div>

              {/* WhatsApp Support */}
              <div className="space-y-2 p-3 rounded-xl border bg-card text-xs">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-xs flex items-center gap-1.5 cursor-pointer">
                    <Smartphone className="size-3.5 text-emerald-600" />
                    Show WhatsApp Support Line
                  </Label>
                  <Switch
                    checked={config.showFooterWhatsapp !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showFooterWhatsapp: checked }))
                    }
                  />
                </div>
                {config.showFooterWhatsapp !== false && (
                  <div className="pt-1">
                    <Input
                      value={config.whatsappNumber ?? ""}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, whatsappNumber: e.target.value }))
                      }
                      placeholder="+91 98430 61919"
                      className="text-xs font-mono h-8"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Customers can message this number for quick re-orders or complaints.
                    </p>
                  </div>
                )}
              </div>

              {/* Customer Care Phone */}
              <div className="space-y-2 p-3 rounded-xl border bg-card text-xs">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-xs flex items-center gap-1.5 cursor-pointer">
                    <Phone className="size-3.5 text-blue-600" />
                    Show Customer Support Phone
                  </Label>
                  <Switch
                    checked={config.showFooterSupport !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showFooterSupport: checked }))
                    }
                  />
                </div>
                {config.showFooterSupport !== false && (
                  <div className="pt-1">
                    <Input
                      value={config.supportPhone ?? ""}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, supportPhone: e.target.value }))
                      }
                      placeholder="+91 98430 61919"
                      className="text-xs font-mono h-8"
                    />
                  </div>
                )}
              </div>

              {/* Social Media Link */}
              <div className="space-y-2 p-3 rounded-xl border bg-card text-xs">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-xs flex items-center gap-1.5 cursor-pointer">
                    <Instagram className="size-3.5 text-pink-600" />
                    Show Social Media Handle
                  </Label>
                  <Switch
                    checked={config.showFooterSocial !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showFooterSocial: checked }))
                    }
                  />
                </div>
                {config.showFooterSocial !== false && (
                  <div className="pt-1">
                    <Input
                      value={config.socialHandle ?? ""}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, socialHandle: e.target.value }))
                      }
                      placeholder="@fishnfreshhub"
                      className="text-xs font-mono h-8"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Helps drive repeat orders and Instagram followers from offline walk-ins.
                    </p>
                  </div>
                )}
              </div>

              {/* Return Policy Notice */}
              <div className="space-y-2 p-3 rounded-xl border bg-card text-xs">
                <div className="flex items-center justify-between">
                  <Label className="font-medium text-xs cursor-pointer">
                    Show Return Policy / Freshness Guarantee
                  </Label>
                  <Switch
                    checked={config.showFooterReturnPolicy !== false}
                    onCheckedChange={(checked) =>
                      setConfig((prev) => ({ ...prev, showFooterReturnPolicy: checked }))
                    }
                  />
                </div>
                {config.showFooterReturnPolicy !== false && (
                  <div className="pt-1">
                    <Input
                      value={config.returnPolicyText ?? config.footerText ?? ""}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          returnPolicyText: e.target.value,
                          footerText: e.target.value,
                        }))
                      }
                      placeholder="Fresh Catch Daily · No Returns After Cutting"
                      className="text-xs h-8"
                    />
                  </div>
                )}
              </div>

              {/* Custom Thank-You Note */}
              <div className="p-3 rounded-xl border bg-card text-xs space-y-1.5">
                <Label className="font-medium text-xs">Custom Thank-You / Greeting Line</Label>
                <Input
                  value={config.customFooterNote ?? ""}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, customFooterNote: e.target.value }))
                  }
                  placeholder="e.g. Have a delicious meal with your family!"
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Thermal Slip Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Eye className="size-3.5 text-primary" /> Live Thermal Slip Preview
              </div>
              <div className="flex items-center gap-2">
                <Tabs
                  value={previewWidth}
                  onValueChange={(v) => setPreviewWidth(v as "58mm" | "80mm")}
                  className="w-auto"
                >
                  <TabsList className="h-7 p-0.5 rounded-lg bg-muted/60">
                    <TabsTrigger value="58mm" className="text-[11px] h-6 px-2.5 rounded-md">
                      58mm (2")
                    </TabsTrigger>
                    <TabsTrigger value="80mm" className="text-[11px] h-6 px-2.5 rounded-md">
                      80mm (3")
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestPrint}
                  disabled={isPrintingTest}
                  className="rounded-lg text-[11px] h-7 px-2.5 gap-1"
                >
                  <Printer className="size-3" />
                  {isPrintingTest ? "Printing..." : "Test Slip"}
                </Button>
              </div>
            </div>

            {/* Thermal Paper Container */}
            <div
              className={`mx-auto bg-amber-50/40 dark:bg-zinc-900 border-2 border-dashed border-border/80 rounded-2xl p-4 shadow-inner overflow-hidden font-mono text-[11px] leading-tight text-foreground transition-all duration-200 ${
                previewWidth === "58mm" ? "max-w-[320px]" : "max-w-[420px]"
              }`}
            >
              <div
                className="bg-white dark:bg-black text-black dark:text-zinc-100 p-4 rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-800"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>

            <p className="text-[11px] text-center text-muted-foreground">
              Preview refreshes instantly as you toggle options or customize text.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
