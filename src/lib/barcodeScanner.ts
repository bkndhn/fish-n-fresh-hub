/**
 * Hardware & Camera Barcode Scanner Integration Engine
 *
 * Supports:
 * 1. USB & Bluetooth HID barcode scanners (rapid keystroke detection <50ms per character).
 * 2. In-store retail scale barcode decoding (EAN-13 / GS1 in-store prefix 20/21 with embedded weight/price).
 * 3. Standard UPC, EAN-13, Code 128, and custom FNF barcodes.
 * 4. Synthesized audio feedback for positive scan and error.
 */

import { soundEngine } from "./realtime";

export interface ParsedBarcode {
  raw: string;
  type: "scale_weight" | "standard_sku" | "plu_code" | "qr";
  productIdOrCode: string;
  embeddedWeightKg?: number;
  embeddedPriceInr?: number;
}

/**
 * Parses an in-store retail scale barcode (Prefix '20' or '21')
 * Standard format: 20 [4-digit Product PLU] [5-digit Weight in grams] [Check Digit]
 * Example: '200001015004' -> PLU 01, Weight 1.500 kg (1500g)
 */
export function parseBarcode(rawCode: string): ParsedBarcode {
  const code = rawCode.trim();

  // In-store weighing scale barcode (12 or 13 digits starting with 20 or 21)
  if ((code.startsWith("20") || code.startsWith("21")) && (code.length === 12 || code.length === 13)) {
    const pluStr = code.slice(2, 6);
    const pluNumber = parseInt(pluStr, 10);
    const weightGramStr = code.slice(6, 11);
    const weightGrams = parseInt(weightGramStr, 10);
    const weightKg = weightGrams / 1000;

    return {
      raw: code,
      type: "scale_weight",
      productIdOrCode: String(pluNumber),
      embeddedWeightKg: weightKg,
    };
  }

  // FNF custom prefix (e.g. FNF-01 or FNF-PLU-02)
  if (code.toUpperCase().startsWith("FNF-")) {
    const parts = code.toUpperCase().split("-");
    const lastPart = parts[parts.length - 1];
    return {
      raw: code,
      type: "plu_code",
      productIdOrCode: lastPart || code,
    };
  }

  // Pure 1-3 digit PLU entered via scanner
  if (/^\d{1,3}$/.test(code)) {
    return {
      raw: code,
      type: "plu_code",
      productIdOrCode: String(parseInt(code, 10)),
    };
  }

  // Standard EAN-13 / UPC / SKU barcode
  return {
    raw: code,
    type: "standard_sku",
    productIdOrCode: code,
  };
}

/**
 * Hook or class to listen for hardware USB/Bluetooth barcode scanner inputs.
 * Hardware scanners send keys rapidly (<50ms per character) followed by 'Enter'.
 */
export class HardwareBarcodeScannerListener {
  private buffer: string = "";
  private lastKeyTime: number = 0;
  private maxIntervalMs: number = 55; // Hardware scanner keystroke threshold
  private onScanCallback: ((parsed: ParsedBarcode) => void) | null = null;
  private isListening: boolean = false;

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore keystrokes when user is intentionally typing inside an <input> or <textarea>
    // unless the input is specifically marked for barcode scanning
    const target = e.target as HTMLElement | null;
    const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
    const isBarcodeFocused = target?.hasAttribute("data-barcode-input");

    const now = Date.now();
    const interval = now - this.lastKeyTime;
    this.lastKeyTime = now;

    if (e.key === "Enter") {
      if (this.buffer.length >= 2) {
        // Buffer was populated rapidly
        const rawCode = this.buffer;
        this.buffer = "";

        const parsed = parseBarcode(rawCode);
        soundEngine.playScannerBeep();
        this.onScanCallback?.(parsed);

        // Prevent default form submission if it was scanner-induced
        if (!isInput || isBarcodeFocused) {
          e.preventDefault();
        }
      } else {
        this.buffer = "";
      }
      return;
    }

    // Only printable single characters
    if (e.key.length === 1) {
      // If time between keystrokes is too long and user was in normal text input, reset buffer
      if (interval > this.maxIntervalMs && isInput && !isBarcodeFocused) {
        this.buffer = "";
        return;
      }

      if (interval > this.maxIntervalMs * 3) {
        this.buffer = e.key;
      } else {
        this.buffer += e.key;
      }
    }
  };

  public startListening(callback: (parsed: ParsedBarcode) => void) {
    if (typeof window === "undefined") return;
    this.onScanCallback = callback;
    if (!this.isListening) {
      window.addEventListener("keydown", this.handleKeyDown, true);
      this.isListening = true;
    }
  }

  public stopListening() {
    if (typeof window === "undefined") return;
    if (this.isListening) {
      window.removeEventListener("keydown", this.handleKeyDown, true);
      this.isListening = false;
      this.buffer = "";
    }
  }
}

export const hardwareScanner = new HardwareBarcodeScannerListener();
