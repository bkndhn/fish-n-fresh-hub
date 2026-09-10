import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  weighingScaleDriver,
  DEFAULT_SCALE_CONFIG,
  type ScaleReading,
} from "@/lib/weighingScale";

describe("Hardware Weighing Scale Driver & Protocol Parser", () => {
  beforeEach(() => {
    // Reset driver tare and disconnect simulator
    weighingScaleDriver.disconnect();
    weighingScaleDriver.saveConfig({ ...DEFAULT_SCALE_CONFIG });
  });

  describe("Multi-Protocol Parsing", () => {
    it("parses CAS / Toledo standard continuous gross stream (ST,GS,+01.450kg)", () => {
      const parsed = weighingScaleDriver.parseWeightString("ST,GS,+01.450kg\r\n");
      expect(parsed).not.toBeNull();
      expect(parsed?.weight).toBe(1.45);
      expect(parsed?.isStable).toBe(true);
      expect(parsed?.protocol).toBe("cas");
    });

    it("parses unstable motion stream (US,GS,+00.825kg)", () => {
      const parsed = weighingScaleDriver.parseWeightString("US,GS,+00.825kg\r\n");
      expect(parsed).not.toBeNull();
      expect(parsed?.weight).toBe(0.825);
      expect(parsed?.isStable).toBe(false);
      expect(parsed?.protocol).toBe("cas");
    });

    it("parses Essae-Teraoka Indian retail scale format (WN02.350kg)", () => {
      const parsed = weighingScaleDriver.parseWeightString("WN02.350kg\r\n");
      expect(parsed).not.toBeNull();
      expect(parsed?.weight).toBe(2.35);
      expect(parsed?.isStable).toBe(true);
      expect(parsed?.protocol).toBe("essae");
    });

    it("parses NCI / Fairbanks ECR standard format (H  0.650kg)", () => {
      const parsed = weighingScaleDriver.parseWeightString("H  0.650kg\r");
      expect(parsed).not.toBeNull();
      expect(parsed?.weight).toBe(0.65);
      expect(parsed?.isStable).toBe(true);
      expect(parsed?.protocol).toBe("nci");
    });

    it("parses raw gram readings into decimal kilograms (450g -> 0.450 kg)", () => {
      const parsed = weighingScaleDriver.parseWeightString("450g");
      expect(parsed).not.toBeNull();
      expect(parsed?.weight).toBe(0.45);
      expect(parsed?.isStable).toBe(true);
    });

    it("detects scale overload condition (OL / ++++++)", () => {
      const parsed = weighingScaleDriver.parseWeightString("OL\r\n");
      expect(parsed).not.toBeNull();
      expect(parsed?.isOverload).toBe(true);
      expect(parsed?.isStable).toBe(false);
    });
  });

  describe("Tare & Zero Operations", () => {
    it("zeros net weight when tare is invoked with a platter weight", async () => {
      weighingScaleDriver.simulateReading(0.25, true);
      expect(weighingScaleDriver.getLastReading().weightKg).toBe(0.25);

      await weighingScaleDriver.tare();
      expect(weighingScaleDriver.getLastReading().weightKg).toBe(0);
      expect(weighingScaleDriver.getLastReading().tareKg).toBe(0.25);

      // Now place 1.0kg seafood into the 0.25kg container -> net should be 0.75kg!
      weighingScaleDriver.simulateReading(1.0, true);
      expect(weighingScaleDriver.getLastReading().weightKg).toBe(0.75);
    });

    it("resets tare and scale state on zero", async () => {
      weighingScaleDriver.simulateReading(0.5, true);
      await weighingScaleDriver.tare();
      expect(weighingScaleDriver.getLastReading().tareKg).toBe(0.5);

      await weighingScaleDriver.zero();
      expect(weighingScaleDriver.getLastReading().tareKg).toBe(0);
      expect(weighingScaleDriver.getLastReading().weightKg).toBe(0);
      expect(weighingScaleDriver.getLastReading().isZero).toBe(true);
    });
  });

  describe("Hands-Free Stabilization & Auto-Capture", () => {
    it("dispatches stable weight event when weight stabilizes >= 20g", async () => {
      const stableSpy = vi.fn();
      const unsub = weighingScaleDriver.onStableWeight(stableSpy);

      // Simulate placing fish in motion
      weighingScaleDriver.simulateReading(1.25, false);
      expect(stableSpy).not.toHaveBeenCalled();

      // Simulate stabilization
      weighingScaleDriver.simulateReading(1.25, true);

      // Wait 350ms for the 300ms stability window
      await new Promise((resolve) => setTimeout(resolve, 350));
      weighingScaleDriver.simulateReading(1.25, true);

      expect(stableSpy).toHaveBeenCalledWith(1.25, expect.objectContaining({ isStable: true }));
      unsub();
    });

    it("re-arms auto-capture when scale platter is cleared (< 10g)", async () => {
      const stableSpy = vi.fn();
      const unsub = weighingScaleDriver.onStableWeight(stableSpy);

      // 1. First catch placed & stabilized
      weighingScaleDriver.simulateReading(0.85, true);
      await new Promise((resolve) => setTimeout(resolve, 350));
      weighingScaleDriver.simulateReading(0.85, true);
      expect(stableSpy).toHaveBeenCalledTimes(1);

      // Same catch sitting on plate -> should not fire repeatedly
      weighingScaleDriver.simulateReading(0.85, true);
      expect(stableSpy).toHaveBeenCalledTimes(1);

      // Platter cleared
      weighingScaleDriver.simulateReading(0.0, true);

      // 2. Next catch placed & stabilized -> should fire again!
      weighingScaleDriver.simulateReading(1.5, true);
      await new Promise((resolve) => setTimeout(resolve, 350));
      weighingScaleDriver.simulateReading(1.5, true);
      expect(stableSpy).toHaveBeenCalledTimes(2);

      unsub();
    });
  });

  describe("Scale Configuration & Storage", () => {
    it("loads and persists serial parameters and protocol profile", () => {
      const updated = weighingScaleDriver.saveConfig({
        baudRate: 19200,
        protocol: "essae",
        handsFreeMode: true,
        autoPoll: false,
      });

      expect(updated.baudRate).toBe(19200);
      expect(updated.protocol).toBe("essae");
      expect(updated.autoPoll).toBe(false);

      const retrieved = weighingScaleDriver.getConfig();
      expect(retrieved.baudRate).toBe(19200);
      expect(retrieved.protocol).toBe("essae");
    });
  });
});
