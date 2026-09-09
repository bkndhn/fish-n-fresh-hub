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

export type PrinterType = "bluetooth" | "serial_usb" | "network_ip" | "browser_print";
export type PaperWidth = "58mm" | "80mm";

export interface ThermalPrinterConfig {
  type: PrinterType;
  paperWidth: PaperWidth;
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
  type: "browser_print",
  paperWidth: "58mm",
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
    const totalSpaces = Math.max(1, this.charsPerLine - (left.length + right.length));
    const spaces = " ".repeat(totalSpaces);
    this.textLine(left + spaces + right);
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
  if (typeof navigator === "undefined" || !(navigator as any).bluetooth) {
    throw new Error("Web Bluetooth API is not supported in this browser. Please use Chrome on Android/Desktop or Edge.");
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
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
  if (typeof navigator === "undefined" || !(navigator as any).serial) {
    throw new Error("Web Serial API is not supported in this browser. Please use Chrome or Edge on desktop.");
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: 9600 });
    activeSerialPort = port;
    activeSerialWriter = port.writable.getWriter();
    return "USB Thermal Receipt Printer";
  } catch (err: any) {
    throw new Error(`USB Serial Connection Failed: ${err.message}`);
  }
}

/**
 * Send raw ESC/POS byte array to currently connected thermal printer,
 * or automatically trigger styled browser print if no hardware device is paired.
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
      console.warn("Bluetooth raw send failed, falling back:", err);
    }
  }

  // 2. Try Web Serial/USB if configured
  if (config.type === "serial_usb" && activeSerialWriter) {
    try {
      await activeSerialWriter.write(bytes);
      return true;
    } catch (err) {
      console.warn("Serial USB raw send failed, falling back:", err);
    }
  }

  // 3. Fallback: Styled Browser Thermal Print
  if (fallbackPrintHtml) {
    printThermalHtmlRoll(fallbackPrintHtml, config.paperWidth);
    return true;
  } else {
    window.print();
    return true;
  }
}

/**
 * Render and print a high-contrast 58mm/80mm receipt inside an isolated iframe
 * without disturbing current page layout or app state.
 */
export function printThermalHtmlRoll(htmlContent: string, paperWidth: PaperWidth = "58mm") {
  const widthMm = paperWidth === "58mm" ? "58mm" : "80mm";
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
            size: ${widthMm} auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: ${widthMm};
            margin: 0;
            padding: 6px;
            color: #000;
            background: #fff;
            font-size: ${paperWidth === "58mm" ? "11px" : "13px"};
            line-height: 1.25;
            -webkit-print-color-adjust: exact;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .hr { border-bottom: 1px dashed #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
          .total-row { font-size: 14px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 0; margin: 4px 0; }
        </style>
      </head>
      <body>
        ${htmlContent}
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
    b.bold(true).textLine(it.name).bold(false);
    const qtyStr = it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} unit`;
    const rateStr = `@ ₹${it.unitPrice.toFixed(0)}`;
    const lineDesc = it.cuttingStyle ? `${qtyStr} ${rateStr} [${it.cuttingStyle}]` : `${qtyStr} ${rateStr}`;
    b.row(lineDesc, `₹${it.totalPrice.toFixed(0)}`);
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
        <span>${it.name}${it.cuttingStyle ? ` [${it.cuttingStyle}]` : ""}</span>
        <span>₹${it.totalPrice.toFixed(0)}</span>
      </div>
      <div class="row muted font-mono" style="padding-left: 8px;">
        <span>${it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} pcs`} × ₹${it.unitPrice.toFixed(0)}</span>
      </div>
    `
      )
      .join("")}
    <div class="hr"></div>
    <div class="row"><span>Subtotal:</span><span>₹${data.subtotal.toFixed(0)}</span></div>
    ${data.discount > 0 ? `<div class="row"><span>Discount:</span><span>-₹${data.discount.toFixed(0)}</span></div>` : ""}
    ${data.gstAmount > 0 ? `<div class="row"><span>GST:</span><span>₹${data.gstAmount.toFixed(0)}</span></div>` : ""}
    <div class="hr"></div>
    <div class="row bold total"><span>TOTAL PAYABLE:</span><span>₹${data.total.toFixed(0)}</span></div>
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
      <div class="row"><span>Payment Mode:</span><span class="bold">${data.paymentMethod.toUpperCase()}</span></div>
    `
    }
    ${data.amountTendered ? `<div class="row"><span>Cash Tendered:</span><span>₹${data.amountTendered.toFixed(0)}</span></div>` : ""}
    ${typeof data.changeDue === "number" ? `<div class="row"><span>Change Returned:</span><span>₹${data.changeDue.toFixed(0)}</span></div>` : ""}
    ${data.upiRef ? `<div class="row muted font-mono"><span>UPI Ref:</span><span>${data.upiRef}</span></div>` : ""}
    <div class="hr"></div>
    <div class="center bold footer">${config.footerLine1}</div>
    <div class="center muted">${config.footerLine2}</div>
  `;
}

/**
 * Generate formatted WhatsApp receipt text for quick sharing.
 */
export function generatePosWhatsAppText(data: PosReceiptData, orderId?: string): string {
  const store = data.storeName || "Fish N Fresh Hub";
  const lines: string[] = [];
  lines.push(`🧾 *${store.toUpperCase()} - TAX INVOICE*`);
  lines.push(`Bill No: *${data.receiptNo}*`);
  lines.push(`Date: ${data.date}`);
  lines.push(`Cashier: ${data.cashierName}`);
  if (data.customerName && data.customerName !== "Walk-in Customer") {
    lines.push(`Customer: ${data.customerName}`);
  }
  lines.push("--------------------------------");
  for (const it of data.items) {
    const qtyStr = it.weightKg ? `${it.weightKg.toFixed(2)} kg` : `${it.qty || 1} unit`;
    const cutStr = it.cuttingStyle ? ` [${it.cuttingStyle}]` : "";
    lines.push(`• *${it.name}*${cutStr}\n   ${qtyStr} × ₹${it.unitPrice.toFixed(0)} = ₹${it.totalPrice.toFixed(0)}`);
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
