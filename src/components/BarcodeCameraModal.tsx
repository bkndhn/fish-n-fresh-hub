import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, RefreshCw, X, Zap, ScanLine } from "lucide-react";
import { parseBarcode, type ParsedBarcode } from "@/lib/barcodeScanner";
import { soundEngine } from "@/lib/realtime";

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): {
        detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
      };
    };
  }
}

interface BarcodeCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (parsed: ParsedBarcode) => void;
}

export function BarcodeCameraModal({ isOpen, onClose, onScan }: BarcodeCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access not supported on this browser.");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err: unknown) {
      console.warn("Camera access failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Could not access camera. You can type or paste the barcode below.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  // Check frames using BarcodeDetector API if available
  useEffect(() => {
    if (!isScanning || !videoRef.current) return;

    const BarcodeDetectorClass = window.BarcodeDetector;
    if (!BarcodeDetectorClass) return;

    let active = true;
    const detector = new BarcodeDetectorClass({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
    });

    const intervalId = setInterval(async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const barcodes = await detector.detect(videoRef.current);
        if (barcodes.length > 0 && barcodes[0] && barcodes[0].rawValue) {
          active = false;
          const raw = barcodes[0].rawValue;
          soundEngine.playScannerBeep();
          const parsed = parseBarcode(raw);
          onScan(parsed);
          onClose();
        }
      } catch {
        // detection frame error, continue
      }
    }, 250);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [isScanning, onScan, onClose]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    soundEngine.playScannerBeep();
    const parsed = parseBarcode(manualCode.trim());
    onScan(parsed);
    setManualCode("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full max-w-md p-0 overflow-hidden bg-card rounded-2xl border border-border">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
              <Camera className="size-4" />
            </div>
            <DialogTitle className="text-sm font-bold text-foreground">
              Scan Barcode / QR Tag
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Camera Viewfinder */}
          <div className="relative w-full aspect-4/3 bg-black rounded-xl overflow-hidden flex items-center justify-center">
            {error ? (
              <div className="p-4 text-center text-xs text-muted-foreground space-y-2">
                <Camera className="size-8 mx-auto text-muted-foreground/50" />
                <p className="font-semibold text-foreground">Camera Access Restricted</p>
                <p>{error}</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Crosshair Viewfinder Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-28 border-2 border-dashed border-emerald-400/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/80 animate-pulse" />
                    <span className="absolute -bottom-6 left-0 right-0 text-center text-[10px] text-emerald-300 font-mono font-medium">
                      Align Barcode Inside Box
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Manual Entry */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  data-barcode-input="true"
                  placeholder="Or enter Barcode / PLU (e.g. 200001015004 or 01)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="pl-9 h-9 text-xs rounded-xl font-mono"
                  autoFocus
                />
              </div>
              <Button type="submit" size="sm" className="rounded-xl h-9 text-xs font-semibold">
                Submit
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Supports USB/Bluetooth barcode guns, camera scan, and weighing scale barcodes.
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
