/**
 * Web Serial & Hardware Electronic Weighing Scale Protocol Driver.
 * Supports standard retail scales (CAS, Essae-Teraoka, Mettler Toledo, Avery Berkel, NCI/Fairbanks).
 * Features:
 * - Direct RS-232 / USB CDC / FTDI serial communication via W3C Web Serial API
 * - Multi-protocol parsers (Continuous ASCII, Essae, CAS PD-II, Toledo, NCI/Fairbanks)
 * - Active auto-polling heartbeat for command-mode scales (W\r\n, ENQ, Q\r\n)
 * - Persistent auto-connect to remembered ports & USB hot-plug detection
 * - Zero-touch hands-free weight stabilization detector with acoustic Web Audio feedback
 * - Hardware Zero/Tare & software tare offset management
 */

export type ScaleProtocol = "auto" | "essae" | "cas" | "toledo" | "nci" | "avery";

export interface ScaleSerialConfig {
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: "none" | "even" | "odd";
  flowControl: "none" | "hardware";
  protocol: ScaleProtocol;
  autoPoll: boolean;
  pollIntervalMs: number;
  autoReconnect: boolean;
  handsFreeMode: boolean;
  minCaptureWeightKg: number;
}

export const DEFAULT_SCALE_CONFIG: ScaleSerialConfig = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
  protocol: "auto",
  autoPoll: true,
  pollIntervalMs: 250,
  autoReconnect: true,
  handsFreeMode: true,
  minCaptureWeightKg: 0.02,
};

export interface ScaleReading {
  weightKg: number;
  rawWeightKg: number;
  tareKg: number;
  isStable: boolean;
  isZero: boolean;
  isOverload: boolean;
  unit: string;
  raw: string;
  protocol: ScaleProtocol;
  timestamp: number;
}

export type ScaleConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "streaming"
  | "error";

type WeightListener = (reading: ScaleReading) => void;
type StatusListener = (state: ScaleConnectionState, error?: string) => void;
type StableWeightListener = (weightKg: number, reading: ScaleReading) => void;
type RawDataListener = (raw: string) => void;

/**
 * Play a pleasant Web Audio API confirmation chime on stable weight capture
 */
export function playScaleCaptureChime(): void {
  if (typeof window === "undefined" || !("AudioContext" in window || "webkitAudioContext" in window)) {
    return;
  }
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    // Pleasant high melodic ping (E6: 1318Hz -> A6: 1760Hz)
    osc1.frequency.setValueAtTime(1318.51, now);
    osc1.frequency.exponentialRampToValueAtTime(1760.0, now + 0.08);

    osc2.frequency.setValueAtTime(659.25, now);
    osc2.frequency.exponentialRampToValueAtTime(880.0, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.25);
    osc2.stop(now + 0.25);

    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 400);
  } catch (e) {
    console.debug("[Scale Audio Chime not supported/blocked]:", e);
  }
}

class WeighingScaleDriver {
  private serialPort: any = null;
  private reader: any = null;
  private keepReading = false;
  private connectionState: ScaleConnectionState = "disconnected";
  private weightListeners: Set<WeightListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private stableListeners: Set<StableWeightListener> = new Set();
  private rawListeners: Set<RawDataListener> = new Set();

  private config: ScaleSerialConfig = { ...DEFAULT_SCALE_CONFIG };
  private softwareTareKg = 0;
  private autoPollTimer: any = null;

  // Hands-free stabilization tracking
  private stableSince = 0;
  private lastStableWeight = 0;
  private hasCapturedCurrentPlate = false;
  private recentWeights: Array<{ weight: number; time: number }> = [];

  private lastReading: ScaleReading = {
    weightKg: 0,
    rawWeightKg: 0,
    tareKg: 0,
    isStable: false,
    isZero: true,
    isOverload: false,
    unit: "kg",
    raw: "",
    protocol: "auto",
    timestamp: Date.now(),
  };

  constructor() {
    this.loadSavedConfig();
    this.initHotPlugListeners();
  }

  /**
   * Load saved hardware configuration from localStorage
   */
  loadSavedConfig(): ScaleSerialConfig {
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const saved = window.localStorage.getItem("fnf_scale_config");
        if (saved) {
          const parsed = JSON.parse(saved);
          this.config = { ...DEFAULT_SCALE_CONFIG, ...parsed };
        }
      } catch {}
    }
    return this.config;
  }

  saveConfig(newConfig: Partial<ScaleSerialConfig>): ScaleSerialConfig {
    this.config = { ...this.config, ...newConfig };
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("fnf_scale_config", JSON.stringify(this.config));
      } catch {}
    }
    // If polling setting changed while connected, adjust polling timer
    if (this.connectionState === "streaming") {
      this.setupAutoPolling();
    }
    return this.config;
  }

  getConfig(): ScaleSerialConfig {
    return { ...this.config };
  }

  isSerialSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

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
   * Setup USB connect/disconnect event listeners for plug-and-play behavior
   */
  private initHotPlugListeners() {
    if (typeof navigator !== "undefined" && "serial" in navigator) {
      try {
        (navigator as any).serial.addEventListener("connect", (e: any) => {
          console.info("[Scale Driver] USB scale device plugged in:", e);
          if (this.config.autoReconnect && this.connectionState === "disconnected") {
            this.autoConnect();
          }
        });
        (navigator as any).serial.addEventListener("disconnect", (e: any) => {
          console.warn("[Scale Driver] USB scale device unplugged:", e);
          this.disconnect();
        });
      } catch {}
    }
  }

  /**
   * Auto-connect to previously granted serial port without showing browser picker dialog
   */
  async autoConnect(): Promise<boolean> {
    if (!this.isSerialSupported()) return false;
    try {
      const ports = await (navigator as any).serial.getPorts();
      if (ports && ports.length > 0) {
        console.info(`[Scale Driver] Found ${ports.length} remembered serial port(s). Auto-connecting...`);
        return await this.openPort(ports[0]);
      }
    } catch (e) {
      console.warn("[Scale Driver] Auto-connect query failed:", e);
    }
    return false;
  }

  /**
   * Connect to physical electronic weighing scale via Web Serial API.
   * If configOrBaud is a number, treat as baud rate for backwards compatibility.
   */
  async connectSerial(configOrBaud?: number | Partial<ScaleSerialConfig>): Promise<boolean> {
    if (!this.isSerialSupported()) {
      this.setStatus(
        "error",
        "Web Serial API is not supported in this browser. Please open in Google Chrome or Microsoft Edge."
      );
      return false;
    }

    if (typeof configOrBaud === "number") {
      this.saveConfig({ baudRate: configOrBaud });
    } else if (configOrBaud && typeof configOrBaud === "object") {
      this.saveConfig(configOrBaud);
    }

    try {
      this.setStatus("connecting");
      // Request user to pick physical serial COM port
      const port = await (navigator as any).serial.requestPort();
      return await this.openPort(port);
    } catch (err: any) {
      console.warn("[Scale Driver] Connection cancelled or port request error:", err);
      this.setStatus("error", err?.message || "Failed to select scale port");
      return false;
    }
  }

  private async openPort(port: any): Promise<boolean> {
    try {
      this.serialPort = port;
      await this.serialPort.open({
        baudRate: Number(this.config.baudRate) || 9600,
        dataBits: Number(this.config.dataBits) || 8,
        stopBits: Number(this.config.stopBits) || 1,
        parity: this.config.parity || "none",
        flowControl: this.config.flowControl || "none",
      });

      this.setStatus("connected");
      this.startReadingStream();
      this.setupAutoPolling();
      return true;
    } catch (openErr: any) {
      console.error("[Scale Driver] Failed to open serial port:", openErr);
      this.setStatus("error", openErr?.message || "Could not open serial port communication");
      return false;
    }
  }

  /**
   * Parse continuous or polled raw ASCII data buffer from weighing scales.
   * Supported protocols:
   * 1. Generic ASCII:
   *    - "ST,GS,+00.350kg" (Stable Gross)
   *    - "US,GS,+00.345kg" (Unstable Gross)
   *    - "ST,NT,+00.350kg" (Stable Net)
   * 2. Essae-Teraoka (DS-852, DS-215, DS-650):
   *    - "WN00.350kg" or "ST,GS,  0.350kg" or "+00.350"
   * 3. CAS Protocols (PD-II, SW-1, ER Plus):
   *    - "ST,GS,  1.250kg\r\n" or "US,GS,  1.250kg\r\n"
   * 4. Mettler Toledo Continuous Mode:
   *    - Format: <STX> StatusA StatusB StatusC <6-digits weight> <6-digits tare> <CR>
   * 5. NCI / Fairbanks / Avery Berkel:
   *    - "<LF>  0.350<CR>" or "H  0.350<CR>" or "G  0.350<CR>"
   */
  parseWeightString(buffer: string): { weight: number; isStable: boolean; isOverload?: boolean; protocol: ScaleProtocol } | null {
    if (!buffer || buffer.trim().length === 0) return null;

    const trimmed = buffer.trim();

    // Overload check
    const isOverload =
      buffer.includes("OL") ||
      buffer.includes("OVER") ||
      buffer.includes("++++++") ||
      buffer.includes("^");

    if (isOverload) {
      return { weight: 999.999, isStable: false, isOverload: true, protocol: this.config.protocol };
    }

    // 1. Essae Teraoka Format: WN00.350kg or W00.350kg
    const essaeMatch = trimmed.match(/^W[N|G]?\s*([+-]?\d+\.\d{2,3})/i);
    if (essaeMatch && essaeMatch[1]) {
      const w = parseFloat(essaeMatch[1]);
      if (!isNaN(w)) {
        return {
          weight: Math.max(0, w),
          isStable: !trimmed.includes("U") && !trimmed.includes("?"),
          protocol: "essae",
        };
      }
    }

    // 2. CAS / Standard ST,GS / US,GS format:
    // e.g. "ST,GS,+00.350kg" or "US,GS,  0.350kg" or "ST,NT,+01.200kg"
    const casMatch = trimmed.match(/(ST|US|SD|OD)\s*,\s*(GS|NT|TR)\s*,\s*([+-]?\s*\d+\.\d{2,3})/i);
    if (casMatch && casMatch[3] && casMatch[1]) {
      const statusPrefix = casMatch[1].toUpperCase();
      const isStable = statusPrefix === "ST" || statusPrefix === "SD";
      const w = parseFloat(casMatch[3].replace(/\s+/g, ""));
      if (!isNaN(w)) {
        return {
          weight: Math.max(0, w),
          isStable,
          protocol: "cas",
        };
      }
    }

    // 3. NCI / Fairbanks Format: e.g. <LF>  1.250kg<CR> or H  1.250<CR>
    const nciMatch = trimmed.match(/^[H|G|S|U]?\s*([+-]?\s*\d+\.\d{2,3})\s*(kg|lb)?/i);
    if (nciMatch && nciMatch[1]) {
      const w = parseFloat(nciMatch[1].replace(/\s+/g, ""));
      if (!isNaN(w)) {
        const isStable = !trimmed.startsWith("U") && !trimmed.includes("?");
        return {
          weight: Math.max(0, w),
          isStable,
          protocol: "nci",
        };
      }
    }

    // 4. Mettler Toledo Continuous String check
    // Typical Toledo: <STX>...<weight 6 digits>...
    if (buffer.charCodeAt(0) === 0x02 || trimmed.length >= 16) {
      const toledoMatch = buffer.match(/(\d{5,6})/);
      if (toledoMatch && toledoMatch[1]) {
        const rawDigits = parseInt(toledoMatch[1], 10);
        // Assuming 3 decimal places standard for retail scales (e.g. 001250 -> 1.250 kg)
        const w = rawDigits / 1000;
        if (!isNaN(w) && w < 100) {
          return {
            weight: w,
            isStable: !buffer.includes("M") && !buffer.includes("?"),
            protocol: "toledo",
          };
        }
      }
    }

    // 5. General Decimal Fallback (Matches any number like 0.350, +0.350, 1.25kg)
    const isStable =
      !trimmed.includes("US") &&
      !trimmed.includes("?") &&
      !trimmed.includes("M") &&
      !trimmed.includes("UNSTABLE");

    const match = trimmed.match(/[+-]?\s*(\d+\.\d{2,3})/);
    if (match && match[1]) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed >= 0) {
        return { weight: parsed, isStable, protocol: "auto" };
      }
    }

    // 6. Match integer gram format (e.g. 350g -> 0.35kg, 1250g -> 1.25kg)
    const gramMatch = trimmed.match(/(\d+)\s*g/i);
    if (gramMatch && gramMatch[1]) {
      const g = parseInt(gramMatch[1], 10);
      if (!isNaN(g)) {
        return {
          weight: Math.round((g / 1000) * 1000) / 1000,
          isStable,
          protocol: "auto",
        };
      }
    }

    return null;
  }

  /**
   * Start reading serial stream in background loop
   */
  private async startReadingStream() {
    if (!this.serialPort || !this.serialPort.readable) return;

    this.keepReading = true;
    this.setStatus("streaming");
    const textDecoder = new TextDecoderStream();
    this.serialPort.readable.pipeTo(textDecoder.writable).catch(() => {});
    this.reader = textDecoder.readable.getReader();

    let accumulated = "";

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          accumulated += value;
          this.rawListeners.forEach((fn) => fn(value));

          // Scales terminate packets with \r, \n, or \x03 (ETX)
          if (accumulated.includes("\r") || accumulated.includes("\n") || accumulated.includes("\x03")) {
            const lines = accumulated.split(/[\r\n\x03]+/);
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i]?.trim();
              if (line) {
                this.processIncomingPacket(line);
              }
            }
            accumulated = lines[lines.length - 1] || "";
          }
        }
      }
    } catch (streamErr) {
      console.warn("[Scale Driver] Serial stream interrupted:", streamErr);
    } finally {
      try {
        this.reader?.releaseLock();
      } catch {}
      this.setStatus("disconnected");
      this.stopAutoPolling();
    }
  }

  /**
   * Process a single parsed line/packet from the scale
   */
  private processIncomingPacket(rawLine: string) {
    const parsed = this.parseWeightString(rawLine);
    if (!parsed) return;

    const rawWeight = parsed.weight;
    // Calculate net weight taking into account tare offset
    const netWeight = Math.max(0, Math.round((rawWeight - this.softwareTareKg) * 1000) / 1000);
    const isZero = netWeight <= 0.002;

    const reading: ScaleReading = {
      weightKg: netWeight,
      rawWeightKg: rawWeight,
      tareKg: this.softwareTareKg,
      isStable: parsed.isStable,
      isZero,
      isOverload: Boolean(parsed.isOverload),
      unit: "kg",
      raw: rawLine,
      protocol: parsed.protocol,
      timestamp: Date.now(),
    };

    this.lastReading = reading;
    this.weightListeners.forEach((fn) => fn(reading));

    // Hands-Free Auto-Capture Tracking
    this.trackStabilization(reading);
  }

  /**
   * Hands-Free Zero-Keypress Stabilization Engine
   * When weight remains steady (within ±2g for ≥300ms) and > minCaptureWeightKg:
   * 1. Triggers onStableWeight callback
   * 2. Plays acoustic confirmation chime
   * 3. Re-arms automatically when platter is cleared (< 0.010kg)
   */
  private trackStabilization(reading: ScaleReading) {
    const now = Date.now();
    const minWeight = this.config.minCaptureWeightKg || 0.02;

    // If scale plate is cleared (< 10g), re-arm for the next catch!
    if (reading.weightKg < 0.01) {
      this.hasCapturedCurrentPlate = false;
      this.stableSince = 0;
      this.recentWeights = [];
      return;
    }

    // Plate has weight > minCaptureWeight
    if (reading.weightKg >= minWeight) {
      // Record weight point
      this.recentWeights.push({ weight: reading.weightKg, time: now });
      // Keep only last 500ms of readings
      this.recentWeights = this.recentWeights.filter((w) => now - w.time <= 600);

      // Check stability: difference between min and max weight in window <= 3 grams
      const weights = this.recentWeights.map((w) => w.weight);
      const min = Math.min(...weights);
      const max = Math.max(...weights);
      const variance = max - min;

      const isSteady = reading.isStable || (this.recentWeights.length >= 3 && variance <= 0.003);

      if (isSteady) {
        if (this.stableSince === 0) {
          this.stableSince = now;
          this.lastStableWeight = reading.weightKg;
        } else if (now - this.stableSince >= 300) {
          // Weight has been solid and steady for at least 300ms!
          if (!this.hasCapturedCurrentPlate && this.config.handsFreeMode) {
            this.hasCapturedCurrentPlate = true;
            playScaleCaptureChime();
            this.stableListeners.forEach((fn) => fn(reading.weightKg, reading));
          }
        }
      } else {
        // Motion detected
        this.stableSince = 0;
      }
    }
  }

  /**
   * Active Auto-Polling Engine
   * Sends scale poll command periodically for scales that don't continuously transmit
   */
  private setupAutoPolling() {
    this.stopAutoPolling();
    if (!this.config.autoPoll) return;

    const interval = Math.max(100, Number(this.config.pollIntervalMs) || 250);
    this.autoPollTimer = setInterval(() => {
      if (this.connectionState === "streaming" && this.serialPort && this.serialPort.writable) {
        this.sendPollCommand();
      }
    }, interval);
  }

  private stopAutoPolling() {
    if (this.autoPollTimer) {
      clearInterval(this.autoPollTimer);
      this.autoPollTimer = null;
    }
  }

  /**
   * Send specific protocol polling command to scale
   */
  async sendPollCommand(): Promise<void> {
    let cmd = "W\r\n";
    if (this.config.protocol === "toledo") cmd = "P\r\n";
    else if (this.config.protocol === "nci") cmd = "W\r";
    else if (this.config.protocol === "avery") cmd = "G\r";
    await this.sendCommand(cmd);
  }

  /**
   * Send Zero command to scale hardware, and reset software tare
   */
  async zero(): Promise<void> {
    this.softwareTareKg = 0;
    let cmd = "Z\r\n";
    if (this.config.protocol === "nci") cmd = "Z\r";
    else if (this.config.protocol === "toledo") cmd = "Z\r\n";
    await this.sendCommand(cmd);

    // Update state
    this.lastReading = {
      ...this.lastReading,
      weightKg: 0,
      tareKg: 0,
      isZero: true,
      timestamp: Date.now(),
    };
    this.weightListeners.forEach((fn) => fn(this.lastReading));
  }

  /**
   * Send Tare command to scale hardware or apply software tare
   */
  async tare(): Promise<void> {
    let cmd = "T\r\n";
    if (this.config.protocol === "nci") cmd = "T\r";
    await this.sendCommand(cmd);

    // Also apply software tare offset so UI is 100% responsive immediately
    if (this.lastReading.rawWeightKg > 0) {
      this.softwareTareKg = this.lastReading.rawWeightKg;
    } else if (this.lastReading.weightKg > 0) {
      this.softwareTareKg = this.lastReading.weightKg;
    }

    this.lastReading = {
      ...this.lastReading,
      weightKg: 0,
      tareKg: this.softwareTareKg,
      isZero: true,
      timestamp: Date.now(),
    };
    this.weightListeners.forEach((fn) => fn(this.lastReading));
  }

  private async sendCommand(cmd: string) {
    if (!this.serialPort || !this.serialPort.writable) return;
    try {
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(this.serialPort.writable).catch(() => {});
      const writer = textEncoder.writable.getWriter();
      await writer.write(cmd);
      await writer.close();
    } catch (e) {
      console.debug("[Scale Driver] Scale write notice:", e);
    }
  }

  /**
   * Disconnect and close serial port
   */
  async disconnect(): Promise<void> {
    this.keepReading = false;
    this.stopAutoPolling();
    this.resetStabilization();

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
   * Reset stabilization state and platter capture flags
   */
  resetStabilization(): void {
    this.hasCapturedCurrentPlate = false;
    this.stableSince = 0;
    this.recentWeights = [];
  }

  /**
   * Interactive Simulator for testing scale integration without physical hardware
   */
  simulateReading(weightKg: number, isStable = true, protocol: ScaleProtocol = "auto"): void {
    const raw = Math.max(0, Math.round(weightKg * 1000) / 1000);
    const net = Math.max(0, Math.round((raw - this.softwareTareKg) * 1000) / 1000);

    const reading: ScaleReading = {
      weightKg: net,
      rawWeightKg: raw,
      tareKg: this.softwareTareKg,
      isStable,
      isZero: net <= 0.002,
      isOverload: false,
      unit: "kg",
      raw: `SIM,${isStable ? "ST" : "US"},+${raw.toFixed(3)}kg`,
      protocol,
      timestamp: Date.now(),
    };

    this.lastReading = reading;
    this.setStatus("streaming");
    this.weightListeners.forEach((fn) => fn(reading));
    this.trackStabilization(reading);
  }

  onWeight(fn: WeightListener): () => void {
    this.weightListeners.add(fn);
    return () => this.weightListeners.delete(fn);
  }

  onStatus(fn: StatusListener): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  onStableWeight(fn: StableWeightListener): () => void {
    this.stableListeners.add(fn);
    return () => this.stableListeners.delete(fn);
  }

  onRawData(fn: RawDataListener): () => void {
    this.rawListeners.add(fn);
    return () => this.rawListeners.delete(fn);
  }
}

export const weighingScaleDriver = new WeighingScaleDriver();

