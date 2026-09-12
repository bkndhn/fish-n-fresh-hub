import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Printer,
  Bluetooth,
  Usb,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSavedPrinterConfig,
  savePrinterConfig,
  connectBluetoothPrinter,
  connectSerialUsbPrinter,
  sendEscPosToPrinter,
  buildTestPrintForFormat,
  printUniversalDocument,
  type ThermalPrinterConfig,
  type PrintFormat,
} from "@/lib/thermalPrinter";

interface PrinterSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrinterSettingsModal({ open, onOpenChange }: PrinterSettingsModalProps) {
  const [config, setConfig] = useState<ThermalPrinterConfig>(getSavedPrinterConfig());
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testFormat, setTestFormat] = useState<PrintFormat>(config.defaultFormat || "58mm");

  useEffect(() => {
    if (open) {
      const saved = getSavedPrinterConfig();
      setConfig(saved);
      setTestFormat(saved.defaultFormat || "58mm");
    }
  }, [open]);

  const handleSave = () => {
    const updated = { ...config, defaultFormat: testFormat };
    savePrinterConfig(updated);
    setConfig(updated);
    toast.success("Universal printer configuration saved");
    onOpenChange(false);
  };

  const handleConnectBluetooth = async () => {
    setIsConnecting(true);
    try {
      const name = await connectBluetoothPrinter();
      setConnectedDevice(name);
      setConfig((prev) => ({ ...prev, type: "bluetooth" }));
      toast.success(`Connected to ${name}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsConnecting(true);
    try {
      const name = await connectSerialUsbPrinter();
      setConnectedDevice(name);
      setConfig((prev) => ({ ...prev, type: "serial_usb" }));
      toast.success(`Connected to ${name}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestPrint = async (format: PrintFormat = testFormat) => {
    setIsTesting(true);
    try {
      const testArtifacts = buildTestPrintForFormat(format, config);
      if (format === "a4" || format === "a5") {
        const win = window.open("", "_blank", "width=850,height=900");
        if (win) {
          win.document.write(testArtifacts.html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 350);
          toast.success(`Test ${format.toUpperCase()} invoice rendered!`);
        }
      } else {
        await sendEscPosToPrinter(
          testArtifacts.bytes || new Uint8Array(),
          config,
          testArtifacts.html
        );
        toast.success(`Test ${format.toUpperCase()} sent to printer!`);
      }
    } catch (err: any) {
      toast.error(`Test Print Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl p-5 border-border/70 shadow-2xl">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Printer className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Thermal Receipt Printer Setup
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Configure ESC/POS Bluetooth, USB & Thermal Rolls
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Hardware Connection Card */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 space-y-2.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span>Hardware Connection</span>
              {connectedDevice && (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold normal-case">
                  <CheckCircle2 className="size-3" /> {connectedDevice}
                </span>
              )}
            </Label>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={config.type === "bluetooth" ? "default" : "outline"}
                size="sm"
                className="h-8.5 rounded-xl text-xs font-semibold gap-1.5"
                disabled={isConnecting}
                onClick={handleConnectBluetooth}
              >
                <Bluetooth className="size-3.5" /> Pair Bluetooth
              </Button>

              <Button
                type="button"
                variant={config.type === "serial_usb" ? "default" : "outline"}
                size="sm"
                className="h-8.5 rounded-xl text-xs font-semibold gap-1.5"
                disabled={isConnecting}
                onClick={handleConnectUsb}
              >
                <Usb className="size-3.5" /> Connect USB
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              If no direct hardware printer is connected, the app uses tailored high-contrast thermal browser printing.
            </p>
          </div>

          {/* Universal Print Format & Hardware Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Default Print Format</Label>
              <Select
                value={testFormat}
                onValueChange={(v) => {
                  setTestFormat(v as PrintFormat);
                  if (v === "58mm" || v === "80mm") {
                    setConfig({ ...config, paperWidth: v as "58mm" | "80mm", defaultFormat: v as PrintFormat });
                  } else {
                    setConfig({ ...config, defaultFormat: v as PrintFormat });
                  }
                }}
              >
                <SelectTrigger className="rounded-xl h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="58mm">58mm (2-Inch Thermal Roll)</SelectItem>
                  <SelectItem value="80mm">80mm (3-Inch Wide POS Roll)</SelectItem>
                  <SelectItem value="kot">KOT (Fish Cutting Station Token)</SelectItem>
                  <SelectItem value="a4">A4 (Full GST Tax Invoice · Laser/Deskjet)</SelectItem>
                  <SelectItem value="a5">A5 (Delivery Dispatch Slip · Half Page)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Printer Connection</Label>
              <Select
                value={config.type}
                onValueChange={(v) => setConfig({ ...config, type: v as any })}
              >
                <SelectTrigger className="rounded-xl h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="none">No Physical Printer (Headless Sound Only)</SelectItem>
                  <SelectItem value="browser_print">Universal Browser Print (All Printers)</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth ESC/POS (BLE Mobile/Tablet)</SelectItem>
                  <SelectItem value="serial_usb">USB Serial ESC/POS (Desktop Windows)</SelectItem>
                  <SelectItem value="network_ip">Network LAN / WiFi ESC/POS (IP:Port)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {config.type === "network_ip" && (
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl border border-border/80 bg-muted/20">
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] font-bold">Printer LAN IP</Label>
                <Input
                  value={config.networkIp || "192.168.1.100"}
                  onChange={(e) => setConfig({ ...config, networkIp: e.target.value })}
                  placeholder="192.168.1.100"
                  className="h-7 rounded-lg text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">Port</Label>
                <Input
                  value={String(config.networkPort || 9100)}
                  onChange={(e) => setConfig({ ...config, networkPort: Number(e.target.value) || 9100 })}
                  placeholder="9100"
                  className="h-7 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Cut & Drawer Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold">Auto-Cut Paper</p>
                <p className="text-[10px] text-muted-foreground">After receipt finishes</p>
              </div>
              <div className="flex items-center gap-1.5">
                {config.autoCut ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] font-bold px-1.5 py-0">
                    ● ON
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[9px] font-medium px-1.5 py-0">
                    ○ OFF
                  </Badge>
                )}
                <Switch
                  checked={config.autoCut}
                  onCheckedChange={(autoCut) => setConfig({ ...config, autoCut })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold">Kick Cash Drawer</p>
                <p className="text-[10px] text-muted-foreground">Pop drawer on cash sale</p>
              </div>
              <div className="flex items-center gap-1.5">
                {config.openCashDrawer ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] font-bold px-1.5 py-0">
                    ● ON
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[9px] font-medium px-1.5 py-0">
                    ○ OFF
                  </Badge>
                )}
                <Switch
                  checked={config.openCashDrawer}
                  onCheckedChange={(openCashDrawer) => setConfig({ ...config, openCashDrawer })}
                />
              </div>
            </div>
          </div>

          {/* Automation & Anti-Theft Copy Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold">Auto-Print on Bill</p>
                <p className="text-[10px] text-muted-foreground">Direct silent print</p>
              </div>
              <div className="flex items-center gap-1.5">
                {(config.autoPrintOnComplete ?? true) ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] font-bold px-1.5 py-0">
                    ● ON
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[9px] font-medium px-1.5 py-0">
                    ○ OFF
                  </Badge>
                )}
                <Switch
                  checked={config.autoPrintOnComplete ?? true}
                  onCheckedChange={(autoPrintOnComplete) => setConfig({ ...config, autoPrintOnComplete })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Print Copies (Anti-Theft)</Label>
              <Select
                value={String(config.printCopies || 1)}
                onValueChange={(v) => setConfig({ ...config, printCopies: Number(v) })}
              >
                <SelectTrigger className="rounded-xl h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1">1 Copy (Customer Only)</SelectItem>
                  <SelectItem value="2">2 Copies (+ Kitchen Token)</SelectItem>
                  <SelectItem value="3">3 Copies (+ Store Record)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bill Sequence & WhatsApp Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Bill Prefix</Label>
              <Input
                value={config.billPrefix ?? "POS-"}
                onChange={(e) => setConfig({ ...config, billPrefix: e.target.value })}
                className="h-7.5 rounded-xl text-xs font-mono"
                placeholder="POS-"
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold">Daily Sequence Reset</p>
                <p className="text-[10px] text-muted-foreground">Resets to #001 daily</p>
              </div>
              <div className="flex items-center gap-1.5">
                {(config.billSequenceDailyReset ?? true) ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] font-bold px-1.5 py-0">
                    ● ON
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[9px] font-medium px-1.5 py-0">
                    ○ OFF
                  </Badge>
                )}
                <Switch
                  checked={config.billSequenceDailyReset ?? true}
                  onCheckedChange={(billSequenceDailyReset) => setConfig({ ...config, billSequenceDailyReset })}
                />
              </div>
            </div>
          </div>

          {/* Header & Footer Customization */}
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Receipt Header Line 1</Label>
              <Input
                value={config.headerLine1}
                onChange={(e) => setConfig({ ...config, headerLine1: e.target.value })}
                className="h-7.5 rounded-xl text-xs"
                placeholder="FISH N FRESH HUB"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Receipt Header Line 2</Label>
              <Input
                value={config.headerLine2}
                onChange={(e) => setConfig({ ...config, headerLine2: e.target.value })}
                className="h-7.5 rounded-xl text-xs"
                placeholder="Premium Quality Seafood & Meat"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Receipt Footer Note</Label>
              <Input
                value={config.footerText}
                onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                className="h-7.5 rounded-xl text-xs"
                placeholder="Thank You! Visit Again."
              />
            </div>
          </div>

          {/* Multi-Format Hardware Test Prints */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              1-Click Format Test Print
            </Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTesting}
                onClick={() => handleTestPrint("58mm")}
                className="h-7 text-[11px] font-semibold rounded-lg px-1.5"
              >
                58mm Roll
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTesting}
                onClick={() => handleTestPrint("80mm")}
                className="h-7 text-[11px] font-semibold rounded-lg px-1.5"
              >
                80mm POS
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTesting}
                onClick={() => handleTestPrint("kot")}
                className="h-7 text-[11px] font-semibold rounded-lg px-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300"
              >
                KOT Token
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTesting}
                onClick={() => handleTestPrint("a4")}
                className="h-7 text-[11px] font-semibold rounded-lg px-1.5 border-sky-500/40 text-sky-700 dark:text-sky-300"
              >
                A4 Invoice
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTesting}
                onClick={() => handleTestPrint("a5")}
                className="h-7 text-[11px] font-semibold rounded-lg px-1.5"
              >
                A5 Slip
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTesting}
              onClick={() => handleTestPrint(testFormat)}
              className="flex-1 rounded-xl h-8.5 text-xs font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Printer className="size-3.5" />
              {isTesting ? "Printing..." : `🖨️ Test Default (${testFormat.toUpperCase()})`}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="flex-1 rounded-xl h-8.5 text-xs font-bold"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
