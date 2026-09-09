/**
 * Web Serial & Bluetooth Electronic Weighing Scale Hardware Driver.
 * Supports standard retail scales (CAS, Essae, Toledo, Avery, Phoenix, Rongta, Sansui).
 * Continuously parses RS-232 / USB / Bluetooth NMEA & ASCII weight data streams.
 */

export interface ScaleReading {
  weightKg: number;
  isStable: boolean;
  unit: string;
  raw: string;
  timestamp: number;
}

export type ScaleConnectionState = "disconnected" | "connecting" | "connected" | "streaming" | "error";

type WeightListener = (reading: ScaleReading) => void;
type StatusListener = (state: ScaleConnectionState, error?: string) => void;

class WeighingScaleDriver {
  private serialPort: any = null;
  private reader: any = null;
  private keepReading = false;
  private connectionState: ScaleConnectionState = "disconnected";
  private weightListeners: Set<WeightListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private lastReading: ScaleReading = {
    weightKg: 0,
    isStable: false,
    unit: "kg",
    raw: "",
    timestamp: Date.now(),
  };

  /**
   * Check if Web Serial API is supported in current browser environment.
   */
  isSerialSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  /**
   * Check if Web Bluetooth API is supported.
   */
  isBluetoothSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  getConnectionState(): ScaleConnectionState {
    return this.connectionState;
  }

  getLastReading(): ScaleReading {
    return this.lastReading;
  }

  private setStatus(state: ScaleConnectionState, err?: string) {
    this.connectionState = state;
    this.statusListeners.forEach((fn) => fn(state, err));
  }

  /**
   * Parse continuous raw ASCII data buffer from weighing scale.
   * Standard scale stream formats:
   * - "ST,GS,+00.350kg\r\n" (CAS, Toledo standard stable gross)
   * - "US,GS,+00.345kg\r\n" (Unstable gross)
   * - "WN00.350kg" (Essae Teraoka)
   * - "+00.350\r\n" or "0.350 kg"
   */
  parseWeightString(buffer: string): { weight: number; isStable: boolean } | null {
    if (!buffer || buffer.trim().length === 0) return null;

    const isStable =
      !buffer.includes("US") && // UnStable indicator
      !buffer.includes("?") &&
      !buffer.includes("M"); // Motion indicator

    // Extract decimal number from stream (matches e.g. +0.35, 0.350, +00.850, 1.25)
    const match = buffer.match(/[+-]?\s*(\d+\.\d{2,3})/);
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed >= 0) {
        return { weight: parsed, isStable };
      }
    }

    // Match integer gram format (e.g. 350g -> 0.35kg)
    const gramMatch = buffer.match(/(\d+)\s*g/i);
    if (gramMatch && gramMatch[1]) {
      const g = parseInt(gramMatch[1], 10);
      if (!isNaN(g)) {
        return { weight: Math.round((g / 1000) * 1000) / 1000, isStable };
      }
    }

    return null;
  }

  /**
   * Connect to physical electronic weighing scale via Web Serial API.
   */
  async connectSerial(baudRate = 9600): Promise<boolean> {
    if (!this.isSerialSupported()) {
      this.setStatus("error", "Web Serial API is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
      return false;
    }

    try {
      this.setStatus("connecting");
      // Prompt user to pick physical serial COM port
      this.serialPort = await (navigator as any).serial.requestPort();
      await this.serialPort.open({
        baudRate: Number(baudRate) || 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });

      this.setStatus("connected");
      this.startReadingStream();
      return true;
    } catch (err: any) {
      console.warn("Could not connect to scale port:", err);
      this.setStatus("error", err.message || "Failed to connect to weighing scale port");
      return false;
    }
  }

  /**
   * Background reader continuously consuming scale serial buffer.
   */
  private async startReadingStream() {
    if (!this.serialPort || !this.serialPort.readable) return;

    this.keepReading = true;
    this.setStatus("streaming");
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.serialPort.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    let accumulated = "";

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          accumulated += value;
          // Most scales terminate weight packets with \r or \n
          if (accumulated.includes("\r") || accumulated.includes("\n")) {
            const lines = accumulated.split(/[\r\n]+/);
            // Process the latest complete line
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i]?.trim();
              if (line) {
                const parsed = this.parseWeightString(line);
                if (parsed) {
                  const reading: ScaleReading = {
                    weightKg: parsed.weight,
                    isStable: parsed.isStable,
                    unit: "kg",
                    raw: line,
                    timestamp: Date.now(),
                  };
                  this.lastReading = reading;
                  this.weightListeners.forEach((fn) => fn(reading));
                }
              }
            }
            accumulated = lines[lines.length - 1] || "";
          }
        }
      }
    } catch (streamErr) {
      console.warn("Serial scale stream error:", streamErr);
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {}
      this.setStatus("disconnected");
    }
  }

  /**
   * Send Zero command to scale.
   */
  async zeroScale(): Promise<void> {
    await this.sendCommand("Z\r\n");
  }

  async zero(): Promise<void> {
    await this.zeroScale();
  }

  /**
   * Send Tare command to scale.
   */
  async tareScale(): Promise<void> {
    await this.sendCommand("T\r\n");
  }

  async tare(): Promise<void> {
    await this.tareScale();
  }

  private async sendCommand(cmd: string) {
    if (!this.serialPort || !this.serialPort.writable) return;
    try {
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(this.serialPort.writable);
      const writer = textEncoder.writable.getWriter();
      await writer.write(cmd);
      await writer.close();
    } catch (e) {
      console.warn("Could not write command to scale:", e);
    }
  }

  /**
   * Disconnect and close serial port.
   */
  async disconnect(): Promise<void> {
    this.keepReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      this.reader = null;
    }
    if (this.serialPort) {
      try {
        await this.serialPort.close();
      } catch {}
      this.serialPort = null;
    }
    this.setStatus("disconnected");
  }

  /**
   * Manual simulator for testing scale integration without physical hardware.
   */
  simulateReading(weightKg: number, isStable = true): void {
    const reading: ScaleReading = {
      weightKg: Math.max(0, Math.round(weightKg * 1000) / 1000),
      isStable,
      unit: "kg",
      raw: `SIM,+${weightKg.toFixed(3)}kg`,
      timestamp: Date.now(),
    };
    this.lastReading = reading;
    this.setStatus("streaming");
    this.weightListeners.forEach((fn) => fn(reading));
  }

  onWeight(fn: WeightListener): () => void {
    this.weightListeners.add(fn);
    return () => this.weightListeners.delete(fn);
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }
}

export const weighingScaleDriver = new WeighingScaleDriver();
