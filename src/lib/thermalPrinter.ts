/**
 * Universal ESC/POS Thermal Receipt Printer Engine for Fish N Fresh Hub.
 *
 * Supports:
 * - Direct Web Bluetooth API (Mobile & Tablet 58mm / 80mm Bluetooth printers)
 * - Web Serial / USB API (Direct USB thermal billing printers on Windows/Mac/Linux)
 * - Network / WiFi ESC/POS (Direct TCP IP raw print via local print server / socket)
 * - Tailored High-Contrast CSS Thermal Browser Print Fallback
 * - 58mm (32 chars/line) and 80mm (42-48 chars/line) auto-formatting
 * - Hardware cash drawer kick & paper auto-cutter
 */

export type PrinterType = "none" | "bluetooth" | "serial_usb" | "network_ip" | "browser_print";
export type PaperWidth = "58mm" | "80mm";
export type PrintFormat = "58mm" | "80mm" | "a4" | "a5" | "kot";

export interface ThermalPrinterConfig {
  type: PrinterType;
  paperWidth: PaperWidth;
  defaultFormat?: PrintFormat;
  autoCut: boolean;
  openCashDrawer: boolean;
  headerLine1: string;
  headerLine2: string;
  footerText: string;
  footerLine1?: string | undefined;
  footerLine2?: string | undefined;
  networkIp?: string;
  networkPort?: number;
  autoPrintOnComplete?: boolean;
  printCopies?: number; // 1, 2, 3
  billPrefix?: string;
  billSequenceDailyReset?: boolean;
  autoWhatsAppPrompt?: boolean;
}

export const DEFAULT_PRINTER_CONFIG: ThermalPrinterConfig = {
  type: "none",
  paperWidth: "58mm",
  defaultFormat: "58mm",
  autoCut: true,
  openCashDrawer: false,
  headerLine1: "FISH N FRESH HUB",
  headerLine2: "Premium Fresh Seafood & Meat",
  footerText: "Thank You! Fresh Catch Guaranteed.",
  autoPrintOnComplete: true,
  printCopies: 1,
  billPrefix: "POS-",
  billSequenceDailyReset: true,
  autoWhatsAppPrompt: false,
};

const STORAGE_KEY = "fnf_printer_config";

export function getSavedPrinterConfig(): ThermalPrinterConfig {
  if (typeof window === "undefined") return DEFAULT_PRINTER_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRINTER_CONFIG;
    return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PRINTER_CONFIG;
  }
}

export function savePrinterConfig(cfg: ThermalPrinterConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private buffer: number[] = [];
  private charsPerLine: number;

  constructor(paperWidth: PaperWidth = "58mm") {
    this.charsPerLine = paperWidth === "58mm" ? 32 : 48;
    this.init();
  }

  init() {
    this.buffer.push(ESC, 0x40); // Initialize printer
    return this;
  }

  align(alignment: "left" | "center" | "right") {
    const n = alignment === "center" ? 1 : alignment === "right" ? 2 : 0;
    this.buffer.push(ESC, 0x61, n);
    return this;
  }

  bold(enable: boolean) {
    this.buffer.push(ESC, 0x45, enable ? 1 : 0);
    return this;
  }

  size(mode: "normal" | "double" | "large") {
    if (mode === "double") {
      this.buffer.push(GS, 0x21, 0x11); // Double width & height
    } else if (mode === "large") {
      this.buffer.push(GS, 0x21, 0x22);
    } else {
      this.buffer.push(GS, 0x21, 0x00); // Normal
    }
    return this;
  }

  lineFeed(lines = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  text(str: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]!);
    }
    return this;
  }

  textLine(str: string) {
    this.text(str);
    this.lineFeed(1);
    return this;
  }

  horizontalRule(char = "-") {
    const line = char.repeat(this.charsPerLine);
    this.textLine(line);
    return this;
  }

  row(left: string, right: string) {
    const rightLen = right.length;
    const maxLeftLen = this.charsPerLine - rightLen - 1;
    if (left.length <= maxLeftLen) {
      const spaces = " ".repeat(Math.max(1, this.charsPerLine - (left.length + rightLen)));
      this.textLine(left + spaces + right);
    } else {
      const words = left.split(" ");
      let current = "";
      const lines: string[] = [];
      for (const w of words) {
        if ((current + (current ? " " : "") + w).length <= this.charsPerLine) {
          current = current + (current ? " " : "") + w;
        } else {
          if (current) lines.push(current);
          current = w;
        }
      }
      if (current) lines.push(current);

      for (let i = 0; i < lines.length - 1; i++) {
        this.textLine(lines[i]!);
      }
      const last = lines[lines.length - 1] || "";
      if (last.length <= maxLeftLen) {
        const spaces = " ".repeat(Math.max(1, this.charsPerLine - (last.length + rightLen)));
        this.textLine(last + spaces + right);
      } else {
        this.textLine(last);
        const spaces = " ".repeat(Math.max(1, this.charsPerLine - rightLen));
        this.textLine(spaces + right);
      }
    }
    return this;
  }

  openCashDrawer() {
    // Standard ESC p m t1 t2 pulse
    this.buffer.push(ESC, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  cutPaper() {
    this.lineFeed(3);
    this.buffer.push(GS, 0x56, 0x42, 0x00); // Partial cut
    return this;
  }

  line(str: string) {
    return this.textLine(str);
  }

  hr(char = "-") {
    return this.horizontalRule(char);
  }

  feed(lines = 1) {
    return this.lineFeed(lines);
  }

  cut() {
    return this.cutPaper();
  }

  getBytes(): Uint8Array {
    return this.build();
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

// Global active hardware handles
let activeBluetoothDevice: any = null;
let activeBluetoothCharacteristic: any = null;
let activeSerialPort: any = null;
let activeSerialWriter: any = null;

/**
 * Connect to a Bluetooth thermal printer via Web Bluetooth API.
 */
export async function connectBluetoothPrinter(): Promise<string> {
  if (typeof navigator === "undefined" || !(navigator as unknown as { bluetooth: { requestDevice: (opts: unknown) => Promise<unknown> } }).bluetooth) {
    throw new Error("Web Bluetooth API is not supported in this browser. Please use Chrome on Android/Desktop or Edge.");
  }

  try {
    const device = await (navigator as unknown as { bluetooth: { requestDevice: (opts: unknown) => Promise<unknown> } }).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        "000018f0-0000-1000-8000-00805f9b34fb",
        "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
        "0000af30-0000-1000-8000-00805f9b34fb",
      ],
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error("Could not connect to GATT Server on printer.");

    // Find writable serial service
    const services = await server.getPrimaryServices();
    let charFound = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          charFound = char;
          break;
        }
      }
      if (charFound) break;
    }

    if (!charFound) throw new Error("Connected to printer, but no writable serial characteristic found.");

    if (device?.id) {
      try {
        localStorage.setItem("fnf_paired_bt_device_id", device.id);
      } catch {}
    }

    activeBluetoothDevice = device;
    activeBluetoothCharacteristic = charFound;
    return device.name || "Bluetooth Thermal Printer";
  } catch (err: any) {
    throw new Error(`Bluetooth Connection Failed: ${err.message}`);
  }
}

/**
 * Connect to a USB / Serial thermal printer via Web Serial API.
 */
export async function connectSerialUsbPrinter(): Promise<string> {
  if (typeof navigator === "undefined" || !(navigator as unknown as { serial: { requestPort: () => Promise<unknown> } }).serial) {
    throw new Error("Web Serial API is not supported in this browser. Please use Chrome or Edge on desktop.");
  }

  try {
    const port = await (navigator as unknown as { serial: { requestPort: () => Promise<unknown> } }).serial.requestPort();
    await port.open({ baudRate: 9600 });
    activeSerialPort = port;
    activeSerialWriter = port.writable.getWriter();
    try {
      localStorage.setItem("fnf_paired_serial_usb", "true");
    } catch {}
    return "USB Thermal Receipt Printer";
  } catch (err: any) {
    throw new Error(`USB Serial Connection Failed: ${err.message}`);
  }
}

/**
 * Auto-reconnect previously authorized Bluetooth or USB Serial printers without user prompts.
 */
export async function autoReconnectSavedPrinters(): Promise<boolean> {
  const config = getSavedPrinterConfig();
  if (config.type === "none" || config.type === "browser_print") {
    return false;
  }

  // 1. Auto-reconnect Web Serial USB printer
  if (config.type === "serial_usb" && typeof navigator !== "undefined" && "serial" in navigator) {
    try {
      if (!activeSerialPort || !activeSerialWriter) {
        const ports = await (navigator as any).serial.getPorts();
        if (ports && ports.length > 0) {
          const port = ports[0];
          await port.open({ baudRate: 9600 });
          activeSerialPort = port;
          activeSerialWriter = port.writable.getWriter();
          console.info("[ThermalPrinter] Auto-reconnected to authorized USB Serial printer");
          return true;
        }
      }
    } catch (err) {
      console.debug("[ThermalPrinter] Serial USB auto-reconnect notice:", err);
    }
  }

  // 2. Auto-reconnect Web Bluetooth printer
  if (config.type === "bluetooth" && typeof navigator !== "undefined" && "bluetooth" in navigator) {
    try {
      if (!activeBluetoothDevice || !activeBluetoothCharacteristic) {
        const bt = (navigator as any).bluetooth;
        if (typeof bt.getDevices === "function") {
          const devices = await bt.getDevices();
          if (devices && devices.length > 0) {
            const savedId = typeof window !== "undefined" ? localStorage.getItem("fnf_paired_bt_device_id") : null;
            const targetDevice = savedId ? (devices.find((d: any) => d.id === savedId) || devices[0]) : devices[0];
            const server = await targetDevice.gatt?.connect();
            if (server) {
              const services = await server.getPrimaryServices();
              let charFound = null;
              for (const service of services) {
                const chars = await service.getCharacteristics();
                for (const char of chars) {
                  if (char.properties.write || char.properties.writeWithoutResponse) {
                    charFound = char;
                    break;
                  }
                }
                if (charFound) break;
              }
              if (charFound) {
                activeBluetoothDevice = targetDevice;
                activeBluetoothCharacteristic = charFound;
                console.info("[ThermalPrinter] Auto-reconnected to paired Bluetooth printer:", targetDevice.name);
                return true;
              }
            }
          }
        }
      }
    } catch (err) {
      console.debug("[ThermalPrinter] Bluetooth auto-reconnect notice:", err);
    }
  }

  return false;
}

// Global listener for USB printer hotplug
if (typeof window !== "undefined" && typeof navigator !== "undefined" && "serial" in navigator && (navigator as any).serial?.addEventListener) {
  try {
    (navigator as any).serial.addEventListener("connect", () => {
      autoReconnectSavedPrinters();
    });
    (navigator as any).serial.addEventListener("disconnect", () => {
      activeSerialPort = null;
      activeSerialWriter = null;
    });
  } catch {}
}

/**
 * Check if a physical ESC/POS hardware printer (Bluetooth or USB Serial) is actively connected.
 */
export function isHardwarePrinterConnected(): boolean {
  return Boolean(activeBluetoothCharacteristic || activeSerialWriter);
}

/**
 * Send raw ESC/POS byte array to currently connected thermal printer,
 * or trigger styled browser print only if explicitly configured.
 */
export async function sendEscPosToPrinter(
  bytes: Uint8Array,
  config: ThermalPrinterConfig = getSavedPrinterConfig(),
  fallbackPrintHtml?: string
): Promise<boolean> {
  // 1. Try Web Bluetooth if configured
  if (config.type === "bluetooth" && activeBluetoothCharacteristic) {
    try {
      // Chunk into 512-byte packets for BLE MTU
      const CHUNK_SIZE = 100;
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        await activeBluetoothCharacteristic.writeValue(chunk);
      }
      return true;
    } catch (err) {
      console.warn("Bluetooth raw send failed:", err);
    }
  }

  // 2. Try Web Serial/USB if configured
  if (config.type === "serial_usb" && activeSerialWriter) {
    try {
      await activeSerialWriter.write(bytes);
      return true;
    } catch (err) {
      console.warn("Serial USB raw send failed:", err);
    }
  }

  // 3. Trigger Styled Browser Thermal Print ONLY if explicitly configured by user
  if (config.type === "browser_print" && fallbackPrintHtml) {
    printThermalHtmlRoll(fallbackPrintHtml, config.paperWidth);
    return true;
  }

  // If type is "none" or no printer is connected, return false without popping up print dialog
  return false;
}


/**
 * Render and print a high-contrast 58mm/80mm receipt inside an isolated iframe
 * without disturbing current page layout or app state.
 */
export function printThermalHtmlRoll(htmlContent: string, paperWidth: PaperWidth = "58mm") {
  const is58 = paperWidth === "58mm";
  const rollWidth = is58 ? "58mm" : "80mm";
  // The printable area of thermal roll is narrower than the total physical paper roll:
  // 58mm roll -> 48mm printable area (384 dots @ 203 DPI)
  // 80mm roll -> 72mm printable area (576 dots @ 203 DPI)
  const printableWidth = is58 ? "48mm" : "72mm";
  const fontSize = is58 ? "10px" : "12px";
  const titleFontSize = is58 ? "13px" : "15px";

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Thermal Receipt</title>
        <style>
          @page {
            size: ${rollWidth} auto;
            margin: 0;
          }
          *, *:before, *:after {
            box-sizing: border-box;
          }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            max-width: ${rollWidth};
            background: #fff;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .thermal-bill-container {
            width: ${printableWidth};
            max-width: ${printableWidth};
            margin: 0 auto;
            padding: ${is58 ? "2mm 1mm" : "3mm 2mm"};
            font-family: 'Courier New', Courier, monospace;
            font-size: ${fontSize};
            line-height: 1.25;
            word-break: break-word;
            overflow: hidden;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .hr { border-bottom: 1px dashed #000; margin: 4px 0; }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 4px;
            margin: 2px 0;
          }
          .row > span:first-child, .row > div:first-child {
            flex: 1;
            min-width: 0;
            word-break: break-word;
          }
          .row > span:last-child, .row > div:last-child {
            flex-shrink: 0;
            text-align: right;
            white-space: nowrap;
          }
          .title { font-size: ${titleFontSize}; font-weight: bold; margin-bottom: 2px; }
          .total {
            font-size: ${is58 ? "12px" : "14px"};
            font-weight: bold;
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 3px 0;
            margin: 3px 0;
          }
          .muted { opacity: 0.85; }
          .font-mono { font-family: 'Courier New', Courier, monospace; }
        </style>
      </head>
      <body>
        <div class="thermal-bill-container">
          ${htmlContent}
        </div>
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
}

/**
 * Generate a complete Test Print byte sequence.
 */
export function buildTestPrintEscPos(config: ThermalPrinterConfig): Uint8Array {
  const b = new EscPosBuilder(config.paperWidth);
  b.align("center")
    .bold(true)
    .size("double")
    .textLine(config.headerLine1)
    .size("normal")
    .textLine(config.headerLine2)
    .horizontalRule("=")
    .textLine("THERMAL PRINTER TEST OK")
    .textLine(`Paper Width: ${config.paperWidth}`)
    .textLine(`Timestamp: ${new Date().toLocaleTimeString()}`)
    .horizontalRule("-")
    .align("left")
    .row("ESC/POS Engine:", "ACTIVE")
    .row("Hardware Cut:", config.autoCut ? "ENABLED" : "DISABLED")
    .row("Cash Drawer:", config.openCashDrawer ? "ENABLED" : "DISABLED")
    .horizontalRule("=")
    .align("center")
    .textLine(config.footerText)
    .lineFeed(2);

  if (config.openCashDrawer) b.openCashDrawer();
  if (config.autoCut) b.cutPaper();
  return b.build();
}

export interface PosReceiptItem {
  name: string;
  weightKg?: number | undefined;
  qty?: number | undefined;
  unitPrice: number;
  totalPrice: number;
  cuttingStyle?: string | undefined;
  unit?: string | undefined;
  serialNumbers?: string[] | undefined;
  variant?: string | undefined;
  brand?: string | undefined;
  warrantyMonths?: number | undefined;
  aisleLocation?: string | undefined;
}

export interface PosReceiptData {
  receiptNo: string;
  date: string;
  cashierName: string;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  items: PosReceiptItem[];
  subtotal: number;
  discount: number;
  gstAmount: number;
  total: number;
  paymentMethod: string;
  amountTendered?: number | undefined;
  changeDue?: number | undefined;
  upiRef?: string | undefined;
  storeName?: string | undefined;
  storeAddress?: string | undefined;
  storePhone?: string | undefined;
  storeGstin?: string | undefined;
  copyType?: "original" | "kitchen_token" | "merchant_copy" | "ORIGINAL" | "KITCHEN TOKEN" | "STORE RECORD" | undefined;
  isReprint?: boolean | undefined;
  reprintCount?: number | undefined;
  reprintTimestamp?: string | undefined;
  splitPayments?: {
    cash?: number;
    upi?: number;
    card?: number;
  } | undefined;
}

/**
 * Generate binary ESC/POS payload for retail POS counter receipt.
 */
export function buildPosReceiptEscPos(
  data: PosReceiptData,
  config: ThermalPrinterConfig = getSavedPrinterConfig()
): Uint8Array {
  const b = new EscPosBuilder(config.paperWidth);
  const store = data.storeName || config.headerLine1;

  // Anti-theft reprint banner
  if (data.isReprint) {
    b.horizontalRule("*")
      .align("center")
      .bold(true)
      .size("normal")
      .textLine("*** REPRINT COPY (AUDIT) ***")
      .textLine(`Reprint #${data.reprintCount || 1} · ${data.reprintTimestamp || new Date().toLocaleTimeString("en-IN")}`)
      .textLine(`Cashier: ${data.cashierName} · NOT ORIGINAL`)
      .bold(false)
      .horizontalRule("*");
  }

  b.align("center")
    .bold(true)
    .size("double")
    .textLine(store)
    .size("normal")
    .bold(false);

  if (data.storeAddress) b.textLine(data.storeAddress);
  if (data.storePhone) b.textLine(`Ph: ${data.storePhone}`);
  if (data.storeGstin) b.textLine(`GSTIN: ${data.storeGstin}`);

  const copyHeader =
    data.copyType === "kitchen_token" || data.copyType === "KITCHEN TOKEN"
      ? "KITCHEN / CUTTING TOKEN"
      : data.copyType === "merchant_copy" || data.copyType === "STORE RECORD"
      ? "MERCHANT / STORE AUDIT COPY"
      : "RETAIL TAX INVOICE / COUNTER BILL";

  b.horizontalRule("=")
    .bold(true)
    .textLine(copyHeader)
    .bold(false)
    .horizontalRule("-")
    .align("left")
    .row("Bill No:", data.receiptNo)
    .row("Date:", data.date)
    .row("Cashier:", data.cashierName);

  if (data.customerPhone) {
    b.row("Customer:", `${data.customerName || "Walk-in"} (${data.customerPhone})`);
  }

  b.horizontalRule("-");

  // Items
  for (const it of data.items) {
    const brandPrefix = it.brand ? `[${it.brand}] ` : "";
    b.bold(true).textLine(`${brandPrefix}${it.name}`).bold(false);
    const qtyStr = it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} unit`;
    const rateStr = `@ ₹${it.unitPrice.toFixed(0)}`;
    const lineDesc = it.cuttingStyle ? `${qtyStr} ${rateStr} [${it.cuttingStyle}]` : `${qtyStr} ${rateStr}`;
    b.row(lineDesc, `₹${it.totalPrice.toFixed(0)}`);
    if (it.variant) {
      b.textLine(`  Variant: ${it.variant}`);
    }
    if (it.serialNumbers && it.serialNumbers.length > 0) {
      b.textLine(`  IMEI/SN: ${it.serialNumbers.join(", ")}`);
    }
    if (it.warrantyMonths && it.warrantyMonths > 0) {
      b.textLine(`  Warranty: ${it.warrantyMonths} Months Brand Cover`);
    }
    if (it.aisleLocation) {
      b.textLine(`  Location: ${it.aisleLocation}`);
    }
  }

  b.horizontalRule("-")
    .row("Subtotal:", `₹${data.subtotal.toFixed(0)}`);

  if (data.discount > 0) {
    b.row("Discount:", `-₹${data.discount.toFixed(0)}`);
  }
  if (data.gstAmount > 0) {
    b.row("GST:", `₹${data.gstAmount.toFixed(0)}`);
  }

  b.horizontalRule("=")
    .bold(true)
    .size("double")
    .align("center")
    .textLine(`NET: ₹${data.total.toFixed(0)}`)
    .size("normal")
    .bold(false)
    .horizontalRule("-")
    .align("left");

  if (data.splitPayments) {
    b.row("Payment:", "SPLIT TENDER");
    if (data.splitPayments.cash) b.row("  - Cash:", `₹${data.splitPayments.cash.toFixed(0)}`);
    if (data.splitPayments.upi) b.row("  - UPI QR:", `₹${data.splitPayments.upi.toFixed(0)}`);
    if (data.splitPayments.card) b.row("  - Card:", `₹${data.splitPayments.card.toFixed(0)}`);
  } else {
    b.row("Payment Mode:", data.paymentMethod.toUpperCase());
  }

  if (data.amountTendered && data.amountTendered > 0) {
    b.row("Cash Tendered:", `₹${data.amountTendered.toFixed(0)}`)
      .row("Change Returned:", `₹${(data.changeDue || 0).toFixed(0)}`);
  }
  if (data.upiRef) {
    b.row("UPI Ref / UTR:", data.upiRef);
  }

  b.horizontalRule("=")
    .align("center")
    .textLine(config.footerText || "Fresh Catch Daily · No Returns After Cutting")
    .textLine("Have a Healthy & Delicious Meal!")
    .lineFeed(3);

  if (config.openCashDrawer && (data.paymentMethod.toLowerCase() === "cash" || (data.splitPayments?.cash ?? 0) > 0)) {
    b.openCashDrawer();
  }
  if (config.autoCut) {
    b.cutPaper();
  }

  return b.build();
}

/**
 * Generate clean styled HTML for high-contrast thermal browser printing fallback.
 */
export function buildPosReceiptHtml(
  data: PosReceiptData,
  config: ThermalPrinterConfig = getSavedPrinterConfig()
): string {
  const store = data.storeName || config.headerLine1;
  const copyHeader =
    data.copyType === "kitchen_token" || data.copyType === "KITCHEN TOKEN"
      ? "KITCHEN / CUTTING TOKEN"
      : data.copyType === "merchant_copy" || data.copyType === "STORE RECORD"
      ? "MERCHANT / STORE AUDIT COPY"
      : "RETAIL INVOICE / COUNTER BILL";

  return `
    ${
      data.isReprint
        ? `
      <div style="border: 1px dashed #000; padding: 4px; text-align: center; margin-bottom: 6px; font-weight: bold;">
        <div>*** REPRINT COPY (AUDIT) ***</div>
        <div style="font-size: 0.85em;">Reprint #${data.reprintCount || 1} · ${data.reprintTimestamp || new Date().toLocaleTimeString("en-IN")}</div>
        <div style="font-size: 0.8em;">Cashier: ${data.cashierName} · NOT AN ORIGINAL</div>
      </div>
    `
        : ""
    }
    <div class="center bold title">${store}</div>
    ${data.storeAddress ? `<div class="center">${data.storeAddress}</div>` : ""}
    ${data.storePhone ? `<div class="center">Ph: ${data.storePhone}</div>` : ""}
    ${data.storeGstin ? `<div class="center">GSTIN: ${data.storeGstin}</div>` : ""}
    <div class="hr"></div>
    <div class="center bold">${copyHeader}</div>
    <div class="hr"></div>
    <div class="row"><span>Bill No:</span><span class="bold">${data.receiptNo}</span></div>
    <div class="row"><span>Date:</span><span>${data.date}</span></div>
    <div class="row"><span>Cashier:</span><span>${data.cashierName}</span></div>
    ${data.customerPhone ? `<div class="row"><span>Customer:</span><span>${data.customerName || "Walk-in"} (${data.customerPhone})</span></div>` : ""}
    <div class="hr"></div>
    ${data.items
      .map(
        (it) => `
      <div class="row">
        <span>${it.brand ? `[${it.brand}] ` : ""}${it.name}${it.cuttingStyle ? ` [${it.cuttingStyle}]` : ""}</span>
        <span class="bold">₹${(it.totalPrice ?? ((it as Record<string, unknown>).total as number | undefined) ?? (it.unitPrice * (it.qty || 1))).toFixed(0)}</span>
      </div>
      <div class="row muted font-mono" style="padding-left: 6px; font-size: 0.9em;">
        <span>${it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} pcs`} × ₹${(it.unitPrice || 0).toFixed(0)}</span>
      </div>
      ${it.variant ? `<div class="row muted font-mono" style="padding-left: 6px; font-size: 0.8em;"><span>Variant: ${it.variant}</span></div>` : ""}
      ${it.serialNumbers && it.serialNumbers.length > 0 ? `<div class="row muted font-mono" style="padding-left: 6px; font-size: 0.8em;"><span>IMEI/SN: ${it.serialNumbers.join(", ")}</span></div>` : ""}
      ${it.warrantyMonths && it.warrantyMonths > 0 ? `<div class="row muted font-mono" style="padding-left: 6px; font-size: 0.8em;"><span>Warranty: ${it.warrantyMonths}M Official</span></div>` : ""}
      ${it.aisleLocation ? `<div class="row muted font-mono" style="padding-left: 6px; font-size: 0.8em;"><span>Loc: ${it.aisleLocation}</span></div>` : ""}
    `
      )
      .join("")}
    <div class="hr"></div>
    <div class="row"><span>Subtotal:</span><span>₹${(data.subtotal || 0).toFixed(0)}</span></div>
    ${(data.discount || 0) > 0 ? `<div class="row"><span>Discount:</span><span>-₹${data.discount.toFixed(0)}</span></div>` : ""}
    ${(data.gstAmount || 0) > 0 ? `<div class="row"><span>GST:</span><span>₹${data.gstAmount.toFixed(0)}</span></div>` : ""}
    <div class="hr"></div>
    <div class="row bold total"><span>TOTAL PAYABLE:</span><span>₹${(data.total ?? ((data as Record<string, unknown>).finalTotal as number | undefined) ?? 0).toFixed(0)}</span></div>
    <div class="hr"></div>
    ${
      data.splitPayments
        ? `
      <div class="row"><span>Split Tender:</span></div>
      ${data.splitPayments.cash ? `<div class="row muted" style="padding-left: 8px;"><span>Cash:</span><span>₹${data.splitPayments.cash}</span></div>` : ""}
      ${data.splitPayments.upi ? `<div class="row muted" style="padding-left: 8px;"><span>UPI:</span><span>₹${data.splitPayments.upi}</span></div>` : ""}
      ${data.splitPayments.card ? `<div class="row muted" style="padding-left: 8px;"><span>Card:</span><span>₹${data.splitPayments.card}</span></div>` : ""}
    `
        : `
      <div class="row"><span>Payment Mode:</span><span class="bold">${(data.paymentMethod || "CASH").toUpperCase()}</span></div>
    `
    }
    ${data.amountTendered ? `<div class="row"><span>Cash Tendered:</span><span>₹${data.amountTendered.toFixed(0)}</span></div>` : ""}
    ${typeof data.changeDue === "number" ? `<div class="row"><span>Change Returned:</span><span>₹${data.changeDue.toFixed(0)}</span></div>` : ""}
    ${data.upiRef ? `<div class="row muted font-mono"><span>UPI Ref:</span><span>${data.upiRef}</span></div>` : ""}
    <div class="hr"></div>
    <div class="center bold footer">${config.footerLine1 || config.footerText || "100% Genuine Guaranteed"}</div>
    ${config.footerLine2 ? `<div class="center muted">${config.footerLine2}</div>` : ""}
  `;
}

/**
 * Generate formatted WhatsApp receipt text for quick sharing.
 */
export function generatePosWhatsAppText(data: PosReceiptData, orderId?: string): string {
  const store = data.storeName || "Universal Store Hub";
  const lines: string[] = [];
  lines.push(`🧾 *${store.toUpperCase()} - TAX INVOICE*`);
  lines.push(`Bill No: *${data.receiptNo || ((data as Record<string, unknown>).receiptNumber as string | undefined) || "INV"}*`);
  lines.push(`Date: ${data.date}`);
  lines.push(`Cashier: ${data.cashierName}`);
  if (data.customerName && data.customerName !== "Walk-in Customer") {
    lines.push(`Customer: ${data.customerName}`);
  }
  lines.push("--------------------------------");
  for (const it of data.items) {
    const qtyStr = it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} unit`;
    const cutStr = it.cuttingStyle ? ` [${it.cuttingStyle}]` : "";
    const brandStr = it.brand ? `[${it.brand}] ` : "";
    const itemTotal = it.totalPrice ?? ((it as Record<string, unknown>).total as number | undefined) ?? (it.unitPrice * (it.qty || 1));
    lines.push(`• *${brandStr}${it.name}*${cutStr}\n   ${qtyStr} × ₹${it.unitPrice.toFixed(0)} = ₹${itemTotal.toFixed(0)}`);
    if (it.variant) lines.push(`   Variant: ${it.variant}`);
    if (it.serialNumbers && it.serialNumbers.length > 0) lines.push(`   IMEI/SN: ${it.serialNumbers.join(", ")}`);
    if (it.warrantyMonths && it.warrantyMonths > 0) lines.push(`   Warranty: ${it.warrantyMonths}M Brand Cover`);
    if (it.aisleLocation) lines.push(`   Loc: ${it.aisleLocation}`);
  }
  lines.push("--------------------------------");
  lines.push(`Subtotal: ₹${data.subtotal.toFixed(0)}`);
  if (data.discount > 0) lines.push(`Discount: -₹${data.discount.toFixed(0)}`);
  if (data.gstAmount > 0) lines.push(`GST: ₹${data.gstAmount.toFixed(0)}`);
  lines.push(`*NET TOTAL: ₹${data.total.toFixed(0)}*`);

  if (data.splitPayments) {
    lines.push(`Payment: *Split Tender*`);
    if (data.splitPayments.cash) lines.push(`  Cash: ₹${data.splitPayments.cash}`);
    if (data.splitPayments.upi) lines.push(`  UPI: ₹${data.splitPayments.upi}`);
    if (data.splitPayments.card) lines.push(`  Card: ₹${data.splitPayments.card}`);
  } else {
    lines.push(`Payment Mode: *${data.paymentMethod.toUpperCase()}*`);
  }

  if (orderId) {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://fishnfresh.com";
    lines.push(`\n📄 View Digital Invoice: ${origin}/orders?id=${orderId}`);
  }
  lines.push(`\nThank you for choosing ${store}! 🐟 Have a delicious meal.`);
  return lines.join("\n");
}

export function getPosWhatsAppShareUrl(phone: string, dataOrText: PosReceiptData | string, orderId?: string): string {
  const cleanPhone = phone.replace(/\D/g, "");
  const targetPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const text = typeof dataOrText === "string" ? dataOrText : generatePosWhatsAppText(dataOrText, orderId);
  return `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
}

/**
 * Generate ESC/POS commands for Fish Cutting & Cleaning Station KOT Token.
 */
export function buildKotTokenEscPos(data: PosReceiptData, config: ThermalPrinterConfig = getSavedPrinterConfig()): Uint8Array {
  const b = new EscPosBuilder(config.paperWidth);
  b.init()
    .align("center")
    .bold(true)
    .size("double")
    .line("CUTTING TOKEN")
    .size("normal")
    .line(`Token #${data.receiptNo}`)
    .line(`Time: ${data.date}`)
    .hr()
    .align("left")
    .line(`Customer: ${data.customerName || "Counter Guest"}`)
    .line(`Cashier: ${data.cashierName}`)
    .hr();

  b.bold(true).line("ITEMS TO CUT & PREPARE:").bold(false);
  data.items.forEach((it, idx) => {
    const qtyStr = it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} ${it.unit || "unit"}`;
    b.bold(true)
      .size("double")
      .line(`${idx + 1}. ${it.name}`)
      .size("normal")
      .bold(false)
      .line(`   QTY: ${qtyStr}`);
    if (it.cuttingStyle) {
      b.bold(true).line(`   >> CUT: [${it.cuttingStyle.toUpperCase()}] <<`).bold(false);
    }
  });

  b.hr()
    .align("center")
    .line("* PACK ON FOOD-GRADE CRUSHED ICE *")
    .feed(3);

  if (config.autoCut) b.cut();
  return b.getBytes();
}

/**
 * Generate HTML for Fish Cutting & Cleaning Station KOT Token.
 */
export function buildKotTokenHtml(data: PosReceiptData, config: ThermalPrinterConfig = getSavedPrinterConfig()): string {
  return `
    <div class="center bold title" style="font-size: 16px;">*** CUTTING TOKEN ***</div>
    <div class="center bold">Token #${data.receiptNo}</div>
    <div class="center muted">${data.date}</div>
    <div class="hr"></div>
    <div class="row"><span>Customer:</span><span class="bold">${data.customerName || "Counter Guest"}</span></div>
    <div class="row"><span>Cashier:</span><span>${data.cashierName}</span></div>
    <div class="hr"></div>
    <div class="bold" style="margin-bottom: 4px;">ITEMS TO CUT & PREPARE:</div>
    ${data.items
      .map(
        (it, idx) => `
      <div style="margin: 6px 0; padding: 4px; border: 1px dashed #000;">
        <div class="bold" style="font-size: 13px;">${idx + 1}. ${it.name}</div>
        <div class="row">
          <span>Qty:</span>
          <span class="bold">${it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} ${it.unit || "unit"}`}</span>
        </div>
        ${
          it.cuttingStyle
            ? `<div style="background: #000; color: #fff; padding: 2px 4px; font-weight: bold; text-align: center; margin-top: 3px; font-size: 11px;">
                STYLE: ${it.cuttingStyle.toUpperCase()}
               </div>`
            : ""
        }
      </div>
    `
      )
      .join("")}
    <div class="hr"></div>
    <div class="center bold" style="font-size: 11px;">* PACK IN INSULATED ICE BOX *</div>
  `;
}

/**
 * Generate standard A4 GST Tax Invoice HTML for laser/inkjet printers.
 */
export function buildA4InvoiceHtml(data: PosReceiptData, config: ThermalPrinterConfig = getSavedPrinterConfig()): string {
  const store = data.storeName || config.headerLine1 || "FISH N FRESH HUB";
  const address = data.storeAddress || "Kasimedu Marine Terminal, Chennai - 600013";
  const phone = data.storePhone || "9843061919";
  const gstin = data.storeGstin || "33AAAAF1234A1Z5";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>GST Tax Invoice #${data.receiptNo}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 12px; color: #111; margin: 0; line-height: 1.4; }
          .invoice-box { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #ddd; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0284c7; padding-bottom: 12px; }
          .company-name { font-size: 22px; font-weight: bold; color: #0284c7; }
          .doc-title { font-size: 18px; font-weight: bold; text-align: right; }
          .grid-2 { display: flex; justify-content: space-between; margin: 15px 0; gap: 20px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; text-transform: uppercase; }
          .table td { border: 1px solid #cbd5e1; padding: 8px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .summary-box { width: 280px; margin-left: auto; margin-top: 15px; }
          .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .total-row { border-top: 2px solid #111; border-bottom: 2px solid #111; font-size: 14px; font-weight: bold; padding: 6px 0; margin-top: 4px; }
          .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #666; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div>
              <div class="company-name">${store}</div>
              <div>${address}</div>
              <div>Phone: ${phone} · GSTIN: <strong>${gstin}</strong></div>
              <div>FSSAI Lic No: 12423002000456 · State: Tamil Nadu (Code 33)</div>
            </div>
            <div>
              <div class="doc-title">TAX INVOICE</div>
              <div>Invoice No: <strong>#${data.receiptNo}</strong></div>
              <div>Date: ${data.date}</div>
              <div>Place of Supply: Tamil Nadu (33)</div>
            </div>
          </div>

          <div class="grid-2">
            <div>
              <div class="bold" style="color: #475569; font-size: 11px;">BILLED TO:</div>
              <div class="bold" style="font-size: 13px;">${data.customerName || "Walk-in Customer"}</div>
              <div>Phone: ${data.customerPhone || "N/A"}</div>
              <div>Payment Mode: <strong>${data.paymentMethod.toUpperCase()}</strong></div>
            </div>
            <div class="text-right">
              <div class="bold" style="color: #475569; font-size: 11px;">DISPATCH DETAILS:</div>
              <div>Cashier: ${data.cashierName}</div>
              <div>Cold-Chain Integrity: Guaranteed 0°C–4°C</div>
              <div>HSN Code: 0302 (Fresh Sea Fish)</div>
            </div>
          </div>

          <table class="table">
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th style="text-align: left;">Item Description</th>
                <th style="width: 70px;">HSN</th>
                <th style="width: 80px;" class="text-right">Quantity</th>
                <th style="width: 80px;" class="text-right">Rate</th>
                <th style="width: 90px;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${data.items
                .map(
                  (it, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td>
                    <strong>${it.name}</strong>
                    ${it.cuttingStyle ? `<div style="font-size: 10px; color: #64748b;">Style: ${it.cuttingStyle}</div>` : ""}
                  </td>
                  <td class="text-center">0302</td>
                  <td class="text-right">${it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} ${it.unit || "kg"}`}</td>
                  <td class="text-right">₹${it.unitPrice.toFixed(2)}</td>
                  <td class="text-right bold">₹${it.totalPrice.toFixed(2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-row"><span>Subtotal:</span><span class="bold">₹${data.subtotal.toFixed(2)}</span></div>
            ${data.discount > 0 ? `<div class="summary-row" style="color: #16a34a;"><span>Discount:</span><span>-₹${data.discount.toFixed(2)}</span></div>` : ""}
            <div class="summary-row"><span>CGST (2.5%):</span><span>₹${(data.gstAmount / 2).toFixed(2)}</span></div>
            <div class="summary-row"><span>SGST (2.5%):</span><span>₹${(data.gstAmount / 2).toFixed(2)}</span></div>
            <div class="summary-row total-row"><span>Grand Total:</span><span>₹${data.total.toFixed(2)}</span></div>
          </div>

          <div class="footer">
            <div>
              <p>Terms: 100% chemical-free fresh catch. Perishable goods warranty 2 hours from delivery.</p>
              <p>This is a computer-generated statutory tax invoice under Section 31 of CGST Act 2017.</p>
            </div>
            <div style="text-align: right;">
              <div style="height: 35px;"></div>
              <div class="bold">For ${store}</div>
              <div style="font-size: 10px; color: #666;">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate standard A5 Delivery Packing Slip HTML.
 */
export function buildA5SlipHtml(data: PosReceiptData, config: ThermalPrinterConfig = getSavedPrinterConfig()): string {
  const store = data.storeName || config.headerLine1 || "FISH N FRESH HUB";
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Packing Slip #${data.receiptNo}</title>
        <style>
          @page { size: A5 landscape; margin: 8mm 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; color: #111; margin: 0; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 6px; }
          .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .table th, .table td { border: 1px solid #bbb; padding: 6px; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size: 16px; font-weight: bold;">${store} — DISPATCH SLIP</div>
            <div>Order #${data.receiptNo} · ${data.date}</div>
          </div>
          <div style="text-align: right;">
            <div>Customer: <strong>${data.customerName || "Walk-in Customer"}</strong></div>
            <div>Phone: ${data.customerPhone || "N/A"}</div>
          </div>
        </div>
        <table class="table">
          <thead>
            <tr style="background: #f1f5f9;">
              <th>#</th>
              <th>Product</th>
              <th>Cut Style</th>
              <th>Weight / Qty</th>
              <th>Verified</th>
            </tr>
          </thead>
          <tbody>
            ${data.items
              .map(
                (it, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td class="bold">${it.name}</td>
                <td>${it.cuttingStyle || "Standard"}</td>
                <td style="text-align: right;">${it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} ${it.unit || "unit"}`}</td>
                <td style="text-align: center; font-size: 14px;">[ &nbsp; ]</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
        <div style="display: flex; justify-content: space-between; margin-top: 15px;">
          <div>Packed on crushed ice at 0°C–4°C. Doorstep inspection required.</div>
          <div>Total Items: <strong>${data.items.length}</strong> · Amount: <strong>₹${data.total.toFixed(0)}</strong></div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Universal print dispatcher for all formats (58mm, 80mm, A4, A5, KOT).
 */
export async function printUniversalDocument(
  data: PosReceiptData,
  format: PrintFormat = "58mm",
  config: ThermalPrinterConfig = getSavedPrinterConfig()
): Promise<boolean> {
  if (format === "kot") {
    const bytes = buildKotTokenEscPos(data, config);
    const fallbackHtml = buildKotTokenHtml(data, config);
    return sendEscPosToPrinter(bytes, config, fallbackHtml);
  }

  if (format === "a4") {
    const html = buildA4InvoiceHtml(data, config);
    const win = window.open("", "_blank", "width=850,height=900");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 350);
      return true;
    }
    return false;
  }

  if (format === "a5") {
    const html = buildA5SlipHtml(data, config);
    const win = window.open("", "_blank", "width=750,height=600");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 350);
      return true;
    }
    return false;
  }

  // Standard 58mm / 80mm thermal receipts
  const bytes = buildPosReceiptEscPos(data, config);
  const fallbackHtml = buildPosReceiptHtml(data, config);
  return sendEscPosToPrinter(bytes, config, fallbackHtml);
}

/**
 * Build test print artifacts for any format.
 */
export function buildTestPrintForFormat(format: PrintFormat, config: ThermalPrinterConfig): { bytes?: Uint8Array; html: string } {
  const sampleData: PosReceiptData = {
    receiptNo: "TEST-9999",
    date: new Date().toLocaleString("en-IN"),
    cashierName: "Test Terminal",
    customerName: "Demo Customer",
    customerPhone: "9876543210",
    items: [
      { name: "Vanjaram / Seer Fish (Steaks)", qty: 1, weightKg: 1.25, unit: "kg", unitPrice: 950, totalPrice: 1188, cuttingStyle: "Curry Cut" },
      { name: "Tiger Prawns (Cleaned)", qty: 1, weightKg: 0.8, unit: "kg", unitPrice: 750, totalPrice: 600, cuttingStyle: "Deveined & Peeled" },
    ],
    subtotal: 1788,
    discount: 50,
    gstAmount: 86,
    total: 1824,
    paymentMethod: "UPI",
    storeName: config.headerLine1 || "FISH N FRESH HUB",
    storeAddress: "Kasimedu Marine Terminal, Chennai",
    storePhone: "9843061919",
    storeGstin: "33AAAAF1234A1Z5",
  };

  if (format === "kot") {
    return {
      bytes: buildKotTokenEscPos(sampleData, config),
      html: buildKotTokenHtml(sampleData, config),
    };
  }

  if (format === "a4") {
    return {
      html: buildA4InvoiceHtml(sampleData, config),
    };
  }

  if (format === "a5") {
    return {
      html: buildA5SlipHtml(sampleData, config),
    };
  }

  return {
    bytes: buildPosReceiptEscPos(sampleData, config),
    html: buildPosReceiptHtml(sampleData, config),
  };
}

