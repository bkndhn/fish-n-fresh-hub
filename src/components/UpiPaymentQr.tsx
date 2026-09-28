import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Copy, Check, Smartphone, QrCode } from "lucide-react";
import { toast } from "sonner";

interface UpiPaymentQrProps {
  upiId: string;
  storeName: string;
  amount: number;
  orderReference?: string | undefined;
  storeLogo?: string | null | undefined;
  className?: string | undefined;
}

export function UpiPaymentQr({
  upiId,
  storeName,
  amount,
  orderReference = "Order",
  storeLogo,
  className = "",
}: UpiPaymentQrProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Standard NPCI UPI URI string
  const cleanUpiId = upiId.trim();
  const cleanStoreName = storeName.trim() || "Universal Store";
  const note = `Order_${orderReference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20)}`;
  
  const upiIntentUri = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanStoreName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;

  // Mobile App Deep Links
  const gpayDeepLink = `tez://upi/pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanStoreName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
  const phonepeDeepLink = `phonepe://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanStoreName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
  const paytmDeepLink = `paytmmp://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanStoreName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
  const bhimDeepLink = upiIntentUri;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(upiIntentUri, {
      width: 260,
      margin: 2,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Local QR generation error:", err);
      });
    return () => {
      active = false;
    };
  }, [upiIntentUri]);

  const copyVpa = () => {
    navigator.clipboard.writeText(cleanUpiId);
    setCopied(true);
    toast.success("UPI ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* High-Resolution QR Container with Store Center Badge */}
      <div className="relative flex flex-col items-center justify-center p-4 bg-white rounded-2xl border shadow-sm">
        <div className="relative">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan & Pay UPI QR Code"
              className="size-52 object-contain rounded-xl"
            />
          ) : (
            <div className="size-52 flex flex-col items-center justify-center bg-slate-50 rounded-xl text-slate-400">
              <QrCode className="size-10 animate-pulse" />
              <span className="text-xs mt-2">Generating QR...</span>
            </div>
          )}

          {/* Center Brand Badge */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="size-11 rounded-full bg-white shadow-md border-2 border-emerald-500/80 flex items-center justify-center p-1 overflow-hidden">
              {storeLogo ? (
                <img src={storeLogo} alt="Logo" className="size-full object-contain" />
              ) : (
                <span className="text-[10px] font-black text-emerald-600 tracking-tighter">
                  UPI
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-xs font-semibold text-slate-700 text-center">
          Scan & Pay <span className="text-emerald-600 font-bold">₹{amount.toLocaleString("en-IN")}</span> with any UPI app
        </p>
        <p className="text-[10px] text-slate-400 text-center">
          GPay · PhonePe · Paytm · BHIM · Cred · Amazon Pay
        </p>
      </div>

      {/* Store UPI ID & Copy Button */}
      <div className="flex items-center justify-between rounded-xl bg-card p-3 border text-xs shadow-2xs">
        <div className="min-w-0 pr-2">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Store VPA / UPI ID</p>
          <p className="font-mono font-bold text-foreground truncate">{cleanUpiId}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs rounded-xl shrink-0 gap-1.5 font-semibold"
          onClick={copyVpa}
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy VPA"}
        </Button>
      </div>

      {/* 1-Tap Mobile UPI App Buttons (Instant Deep Linking) */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          One-Tap Mobile UPI Payment:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-9 text-xs font-bold border-border hover:border-emerald-500/40 gap-1.5 shadow-2xs"
            onClick={() => {
              window.location.href = gpayDeepLink;
            }}
          >
            <span className="text-blue-500">G</span>
            <span className="text-red-500">P</span>
            <span className="text-amber-500">a</span>
            <span className="text-emerald-500">y</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-9 text-xs font-bold border-border hover:border-purple-500/40 text-purple-600 dark:text-purple-400 gap-1.5 shadow-2xs"
            onClick={() => {
              window.location.href = phonepeDeepLink;
            }}
          >
            <span>PhonePe</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-9 text-xs font-bold border-border hover:border-sky-500/40 text-sky-600 dark:text-sky-400 gap-1.5 shadow-2xs"
            onClick={() => {
              window.location.href = paytmDeepLink;
            }}
          >
            <span>Paytm</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-9 text-xs font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 shadow-2xs"
            onClick={() => {
              window.location.href = bhimDeepLink;
            }}
          >
            <Smartphone className="size-3.5" />
            <span>Any UPI App</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
