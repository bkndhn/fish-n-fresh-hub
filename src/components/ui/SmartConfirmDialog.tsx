import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Trash2, Info, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SmartConfirmVariant = "sparkle" | "destructive" | "warning" | "info" | "success";

export interface SmartConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  variant?: SmartConfirmVariant;
  badgeText?: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

export function SmartConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "info",
  badgeText,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  children,
}: SmartConfirmDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case "sparkle":
        return <Sparkles className="size-5 text-primary animate-pulse" />;
      case "destructive":
        return <Trash2 className="size-5 text-rose-500" />;
      case "warning":
        return <AlertTriangle className="size-5 text-amber-500" />;
      case "success":
        return <CheckCircle2 className="size-5 text-emerald-500" />;
      case "info":
      default:
        return <Info className="size-5 text-sky-500" />;
    }
  };

  const getIconBg = () => {
    switch (variant) {
      case "sparkle":
        return "bg-primary/10 border-primary/20";
      case "destructive":
        return "bg-rose-500/10 border-rose-500/20";
      case "warning":
        return "bg-amber-500/10 border-amber-500/20";
      case "success":
        return "bg-emerald-500/10 border-emerald-500/20";
      case "info":
      default:
        return "bg-sky-500/10 border-sky-500/20";
    }
  };

  const getConfirmButtonVariant = () => {
    switch (variant) {
      case "destructive":
        return "destructive" as const;
      default:
        return "default" as const;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 border-border/80 bg-card shadow-2xl backdrop-blur-md">
        <DialogHeader className="flex flex-col items-center text-center space-y-3">
          <div className={cn("size-12 rounded-2xl border flex items-center justify-center shadow-xs", getIconBg())}>
            {getIcon()}
          </div>
          {badgeText && (
            <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {badgeText}
            </span>
          )}
          <DialogTitle className="text-lg font-bold text-foreground leading-snug">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        {children && <div className="my-2">{children}</div>}

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-xs font-semibold h-10 w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={getConfirmButtonVariant()}
            className="rounded-xl text-xs font-bold h-10 w-full sm:w-auto shadow-sm"
            onClick={async () => {
              await onConfirm();
            }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" /> Processing…
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
