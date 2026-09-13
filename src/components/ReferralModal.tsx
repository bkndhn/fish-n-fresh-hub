import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gift, Copy, Check, Share2, Sparkles, Wallet, History, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSessionUser } from "@/lib/session";
import { inr, formatIST } from "@/lib/format";
import { getOrCreateUserWallet, getWalletTransactions } from "@/lib/wallet";

export function ReferralModal({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useSessionUser();
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["customer-wallet", user?.id],
    queryFn: () => (user ? getOrCreateUserWallet(user.id) : null),
    enabled: Boolean(user),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["wallet-transactions", user?.id],
    queryFn: () => (user ? getWalletTransactions(user.id) : []),
    enabled: Boolean(user && showHistory),
  });

  if (!user) return null;

  const referralCode = wallet?.referral_code || `FNF-${user.id.slice(0, 5).toUpperCase()}`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}?ref=${referralCode}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success("Referral code copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🐟 Get ₹50 OFF fresh ocean seafood on Fish N Fresh Hub!\n\nUse my invite code: ${referralCode}\nOr click here to order: ${shareUrl}\n\n100% Chemical-free, Kasimedu boat-catch delivered fresh!`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-semibold text-xs"
          >
            <Gift className="size-3.5" />
            <span className="hidden sm:inline">Refer & Earn ₹50</span>
            <span className="sm:hidden font-mono text-[11px]">₹50</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-md p-5 sm:p-6 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <div className="size-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <Gift className="size-4" />
            </div>
            FreshCash Wallet & Referral
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Wallet Balance Hero Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-4 text-primary-foreground shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-primary-foreground/80 flex items-center gap-1">
                  <Wallet className="size-3.5" /> FreshCash Balance
                </p>
                <p className="font-display text-3xl font-extrabold mt-1">
                  {inr(Number(wallet?.balance || 0))}
                </p>
              </div>
              <Badge className="bg-white/20 hover:bg-white/25 text-white border-0 text-xs gap-1">
                <Sparkles className="size-3" /> 100% Usable
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/20 pt-2 text-xs">
              <div>
                <span className="text-primary-foreground/70">Total Earned: </span>
                <span className="font-bold">{inr(Number(wallet?.total_earned || 0))}</span>
              </div>
              <div>
                <span className="text-primary-foreground/70">Redeemed: </span>
                <span className="font-bold">{inr(Number(wallet?.total_redeemed || 0))}</span>
              </div>
            </div>
          </div>

          {/* Referral Code Box */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-xs text-muted-foreground font-medium">
              Share your invite code with seafood lovers. They get <span className="font-bold text-foreground">₹50 welcome off</span>, and you earn <span className="font-bold text-primary">₹50 FreshCash</span> on their 1st delivered order!
            </p>

            <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background p-2 px-3">
              <div className="font-mono text-base sm:text-lg font-bold tracking-wider text-foreground">
                {referralCode}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg text-xs gap-1 px-3"
                onClick={handleCopy}
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <Button
              className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-xs"
              onClick={handleShareWhatsApp}
            >
              <Share2 className="size-4" />
              Share on WhatsApp
            </Button>
          </div>

          {/* Ledger History Toggle */}
          <div className="pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => setShowHistory(!showHistory)}
            >
              <History className="size-3.5" />
              {showHistory ? "Hide Transaction Ledger" : "View Wallet Transaction History"}
            </Button>

            {showHistory && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {transactions.length === 0 ? (
                  <p className="text-center py-4 text-xs text-muted-foreground">
                    No wallet transactions yet. Share your code to start earning!
                  </p>
                ) : (
                  transactions.map((tx) => {
                    const isCredit = Number(tx.amount) > 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`size-6 rounded-full flex items-center justify-center ${
                              isCredit ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            }`}
                          >
                            {isCredit ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground line-clamp-1">{tx.description || tx.type}</p>
                            <p className="text-[10px] text-muted-foreground">{formatIST(tx.created_at)}</p>
                          </div>
                        </div>
                        <span
                          className={`font-bold font-mono ${
                            isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {isCredit ? "+" : ""}{inr(Number(tx.amount))}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
