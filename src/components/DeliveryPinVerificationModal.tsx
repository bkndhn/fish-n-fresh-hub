import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/format";
import { verifyAndDeliverOrder } from "@/lib/deliveryPin";

interface DeliveryPinVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string | null;
  orderNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  fulfillmentType?: string | null;
  isCod?: boolean;
  totalAmount?: number | null;
  isAdmin?: boolean;
  onSuccess: () => void;
}

export function DeliveryPinVerificationModal({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  customerName,
  customerPhone,
  fulfillmentType = "delivery",
  isCod = false,
  totalAmount = 0,
  isAdmin = false,
  onSuccess,
}: DeliveryPinVerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showAdminOverride, setShowAdminOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const inputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];

  // Auto-focus first input box when modal opens
  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setErrorMessage(null);
      setShowAdminOverride(false);
      setOverrideReason("");
      setTimeout(() => {
        inputRefs[0]?.current?.focus();
      }, 150);
    }
  }, [open]);

  const handleDigitChange = (index: number, value: string) => {
    // Clean to numeric only
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    // Handle multi-character paste (e.g. pasted "4829")
    if (clean.length > 1) {
      const pasted = clean.slice(0, 4).split("");
      const next = [...digits];
      pasted.forEach((d, i) => {
        if (i < 4) next[i] = d;
      });
      setDigits(next);
      const nextFocus = Math.min(pasted.length, 3);
      inputRefs[nextFocus]?.current?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean.slice(-1);
    setDigits(next);
    setErrorMessage(null);

    // Auto-advance to next input box
    if (index < 3 && clean) {
      inputRefs[index + 1]?.current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs[index - 1]?.current?.focus();
    }
  };

  const enteredPin = digits.join("");
  const isPinComplete = enteredPin.length === 4;

  const handleVerify = async () => {
    if (!orderId) return;
    if (!isPinComplete) {
      setErrorMessage("Please enter all 4 digits of the Delivery PIN.");
      return;
    }

    setVerifying(true);
    setErrorMessage(null);

    try {
      const result = await verifyAndDeliverOrder(orderId, enteredPin);
      if (result.success) {
        toast.success(result.message || "Delivery PIN verified! Order completed.");
        onSuccess();
        onOpenChange(false);
      } else {
        setErrorMessage(result.message);
        toast.error(result.message);
        // Clear digits on failure
        setDigits(["", "", "", ""]);
        inputRefs[0]?.current?.focus();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to verify PIN");
    } finally {
      setVerifying(false);
    }
  };

  const handleAdminOverride = async () => {
    if (!orderId) return;
    if (!overrideReason.trim() || overrideReason.trim().length < 4) {
      toast.error("Please enter a valid reason for emergency bypass (min 4 characters).");
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyAndDeliverOrder(orderId, "", true, overrideReason);
      if (result.success) {
        toast.success(result.message || "Emergency override recorded. Order marked delivered.");
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err.message || "Emergency override failed");
    } finally {
      setVerifying(false);
    }
  };

  const isPickup = fulfillmentType === "pickup";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl">
        {/* Header Ribbon */}
        <div className="bg-linear-to-r from-primary/15 via-primary/10 to-transparent p-5 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-foreground">
                {isPickup ? "Counter Pickup Verification" : "Doorstep Delivery PIN"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Order #{orderNumber || orderId?.slice(0, 8)} · {customerName || "Customer"}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* COD Cash Collection Warning */}
          {isCod && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                <AlertTriangle className="size-4 shrink-0 text-rose-600 animate-pulse" />
                <span>MANDATORY CASH COLLECTION: {formatINR(totalAmount || 0)}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-700/90 dark:text-rose-300/90 pl-6">
                Collect <strong>{formatINR(totalAmount || 0)}</strong> in exact cash before asking the customer for their secret PIN.
              </p>
            </div>
          )}

          {/* Prompt Instruction Banner */}
          <div className="rounded-2xl bg-muted/40 border border-border/60 p-3.5 text-xs text-muted-foreground flex items-start gap-2.5">
            <HelpCircle className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Ask the customer: <em>&ldquo;Please share your 4-digit Delivery PIN from your live tracking screen.&rdquo;</em> Fresh seafood packages must only be released upon successful verification.
            </p>
          </div>

          {/* 4-Digit Numerical OTP Input */}
          <div className="py-2">
            <label className="block text-center text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Enter 4-Digit Customer PIN
            </label>
            <div className="flex items-center justify-center gap-3">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  autoComplete="one-time-code"
                  disabled={verifying}
                  className={`size-14 text-center font-display text-2xl font-extrabold rounded-2xl border-2 transition-all duration-200 outline-none ${
                    digit
                      ? "border-primary bg-primary/5 text-foreground ring-2 ring-primary/20 scale-105"
                      : "border-border bg-background text-foreground hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/20"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Error Message Display */}
          {errorMessage && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <ShieldAlert className="size-4 shrink-0 text-destructive" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
          )}

          {/* Verify & Complete Delivery Button */}
          <Button
            type="button"
            className="w-full rounded-2xl h-11 text-sm font-bold shadow-md gap-2"
            disabled={!isPinComplete || verifying}
            onClick={handleVerify}
          >
            {verifying ? (
              <span className="flex items-center gap-2">
                <span className="size-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                Verifying PIN...
              </span>
            ) : (
              <>
                <CheckCircle2 className="size-4.5" />
                <span>Verify PIN &amp; Complete {isPickup ? "Pickup" : "Delivery"}</span>
              </>
            )}
          </Button>

          {/* Customer Call Shortcut if needed */}
          {customerPhone && (
            <div className="flex items-center justify-center pt-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground gap-1.5" asChild>
                <a href={`tel:${customerPhone}`}>
                  <Phone className="size-3 text-primary" /> Call customer for assistance
                </a>
              </Button>
            </div>
          )}

          {/* Emergency Admin Override Toggle */}
          {isAdmin && (
            <div className="pt-2 border-t border-border/50">
              <button
                type="button"
                className="w-full flex items-center justify-between text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => setShowAdminOverride(!showAdminOverride)}
              >
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <Lock className="size-3" /> Emergency Admin Override (Phone Dead / In-Person ID)
                </span>
                {showAdminOverride ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>

              {showAdminOverride && (
                <div className="mt-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-snug">
                    Use this ONLY if customer cannot access their phone or tracking page. Overrides are permanently logged with your admin identity.
                  </p>
                  <Input
                    placeholder="Reason (e.g. Customer verified in person with Aadhaar)"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="h-8 text-xs rounded-xl bg-background"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full rounded-xl h-8 text-xs font-bold border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    disabled={verifying || !overrideReason.trim()}
                    onClick={handleAdminOverride}
                  >
                    Confirm Emergency Admin Bypass
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
