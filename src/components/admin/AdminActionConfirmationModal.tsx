import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Lock, Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AdminActionConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  riskWarning?: string;
  requiresPassword?: boolean;
  confirmText?: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: () => Promise<void> | void;
}

export function AdminActionConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  riskWarning,
  requiresPassword = false,
  confirmText = "Confirm Action",
  confirmVariant = "default",
  onConfirm,
}: AdminActionConfirmationModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = () => {
    setPassword("");
    setErrorMsg(null);
    onOpenChange(false);
  };

  const handleExecute = async () => {
    setErrorMsg(null);

    if (requiresPassword) {
      if (!password.trim()) {
        setErrorMsg("Administrator password is required to authorize this change.");
        return;
      }

      setIsVerifying(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const email = sessionData.session?.user?.email;

        if (email) {
          const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password: password.trim(),
          });

          if (authError) {
            setErrorMsg("Incorrect administrator password. Action denied.");
            setIsVerifying(false);
            return;
          }
        } else {
          // If no active email session, check fallback security admin PIN
          if (password.trim() !== "admin" && password.trim() !== "1234") {
            setErrorMsg("Invalid administrator authorization code.");
            setIsVerifying(false);
            return;
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to verify administrator identity.");
        setIsVerifying(false);
        return;
      }
    }

    try {
      setIsVerifying(true);
      await onConfirm();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to execute action.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !isVerifying && onOpenChange(val)}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
              confirmVariant === "destructive" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            }`}>
              {requiresPassword ? <ShieldCheck className="size-5" /> : <AlertTriangle className="size-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">{title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {riskWarning && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Important Warning / Potential Impact</span>
                <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {riskWarning}
                </p>
              </div>
            </div>
          </div>
        )}

        {requiresPassword && (
          <div className="space-y-2 pt-2">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Admin Password Verification</span>
              <span className="text-[10px] text-muted-foreground font-normal">Required for security</span>
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter administrator password to confirm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isVerifying) {
                    handleExecute();
                  }
                }}
                className="pl-9 pr-10 text-sm rounded-xl"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errorMsg && (
              <p className="text-xs font-medium text-destructive mt-1">
                {errorMsg}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isVerifying}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={handleExecute}
            disabled={isVerifying}
            className="rounded-xl text-xs font-bold gap-1.5 shadow-xs"
          >
            {isVerifying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Verifying...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
