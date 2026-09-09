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
  buildTestPrintEscPos,
  sendEscPosToPrinter,
  type ThermalPrinterConfig,
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

  useEffect(() => {
    if (open) {
      setConfig(getSavedPrinterConfig());
    }
  }, [open]);

  const handleSave = () => {
    savePrinterConfig(config);
    toast.success("Printer configuration saved");
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

  const handleTestPrint = async () => {
    setIsTesting(true);
    try {
      const bytes = buildTestPrintEscPos(config);
      await sendEscPosToPrinter(
        bytes,
        config,
        `
        <div class="center">
          <div class="title">${config.headerLine1}</div>
          <div>${config.headerLine2}</div>
          <div class="hr"></div>
          <div class="bold">*** TEST RECEIPT OK ***</div>
          <div>Roll Width: ${config.paperWidth}</div>
          <div>Time: ${new Date().toLocaleTimeString()}</div>
          <div class="hr"></div>
        </div>
        <div class="row"><span>Printer Engine</span><span class="bold">ACTIVE</span></div>
        <div class="row"><span>Hardware Cut</span><span>${config.autoCut ? "ENABLED" : "OFF"}</span></div>
        <div class="row"><span>Cash Drawer</span><span>${config.openCashDrawer ? "ENABLED" : "OFF"}</span></div>
        <div class="hr"></div>
        <div class="center">${config.footerText}</div>
      `
      );
      toast.success("Test receipt sent to printer!");
    } catch (err: any) {
      toast.error(`Test Print Error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-3xl p-5 border-border/70 shadow-2xl">
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

          {/* Roll Width & Hardware Switches */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Paper Roll Width</Label>
              <Select
                value={config.paperWidth}
                onValueChange={(v) => setConfig({ ...config, paperWidth: v as any })}
              >
                <SelectTrigger className="rounded-xl h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="58mm">58mm (2-Inch Standard)</SelectItem>
                  <SelectItem value="80mm">80mm (3-Inch Wide POS)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Print Method</Label>
              <Select
                value={config.type}
                onValueChange={(v) => setConfig({ ...config, type: v as any })}
              >
                <SelectTrigger className="rounded-xl h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="bluetooth">Bluetooth ESC/POS</SelectItem>
                  <SelectItem value="serial_usb">USB Serial ESC/POS</SelectItem>
                  <SelectItem value="browser_print">Browser Thermal Fallback</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold">Auto-Cut Paper</p>
                <p className="text-[10px] text-muted-foreground">After receipt finishes</p>
              </div>
              <Switch
                checked={config.autoCut}
                onCheckedChange={(autoCut) => setConfig({ ...config, autoCut })}
              />
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold">Kick Cash Drawer</p>
                <p className="text-[10px] text-muted-foreground">Pop drawer on cash sale</p>
              </div>
              <Switch
                checked={config.openCashDrawer}
                onCheckedChange={(openCashDrawer) => setConfig({ ...config, openCashDrawer })}
              />
            </div>
          </div>

          {/* Automation & Anti-Theft Copy Controls */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-muted/40 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[11px] font-bold">Auto-Print on Bill</p>
                <p className="text-[10px] text-muted-foreground">Direct silent print</p>
              </div>
              <Switch
                checked={config.autoPrintOnComplete ?? true}
                onCheckedChange={(autoPrintOnComplete) => setConfig({ ...config, autoPrintOnComplete })}
              />
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
              <Switch
                checked={config.billSequenceDailyReset ?? true}
                onCheckedChange={(billSequenceDailyReset) => setConfig({ ...config, billSequenceDailyReset })}
              />
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

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isTesting}
              onClick={handleTestPrint}
              className="flex-1 rounded-xl h-8.5 text-xs font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Printer className="size-3.5" />
              {isTesting ? "Printing..." : "🖨️ Test Print Slip"}
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
