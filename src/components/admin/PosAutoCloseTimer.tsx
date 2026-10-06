import { useEffect, useState } from "react";
import { Lock, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AUTO_CLOSE_KEY,
  LOCKED_DAY_KEY,
  shouldAutoLock,
  todayKey,
} from "@/lib/posAutoClose";

/**
 * Locks the POS counter at the configured closing time and opens the
 * day-end closing report. Billing stays frozen until a new shift starts.
 */
export function PosAutoCloseTimer({ onOpenReport }: { onOpenReport: () => void }) {
  const [closeAt, setCloseAt] = useState("");
  const [locked, setLocked] = useState(false);
  const [float, setFloat] = useState("1000");

  useEffect(() => {
    setCloseAt(localStorage.getItem(AUTO_CLOSE_KEY) || "");
    const check = () => {
      const time = localStorage.getItem(AUTO_CLOSE_KEY) || "";
      const lockedDay = localStorage.getItem(LOCKED_DAY_KEY);
      const now = new Date();
      if (lockedDay === todayKey(now) && localStorage.getItem("fnf_pos_shift_reopened") !== todayKey(now)) {
        setLocked(true);
        return;
      }
      if (shouldAutoLock(time, now, lockedDay)) {
        localStorage.setItem(LOCKED_DAY_KEY, todayKey(now));
        setLocked(true);
        onOpenReport();
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [onOpenReport]);

  const saveTime = (v: string) => {
    setCloseAt(v);
    if (v) localStorage.setItem(AUTO_CLOSE_KEY, v);
    else localStorage.removeItem(AUTO_CLOSE_KEY);
  };

  const startNewShift = () => {
    const amt = Number(float);
    if (!Number.isFinite(amt) || amt < 0) return;
    localStorage.setItem("fnf_pos_opening_float", String(amt));
    localStorage.setItem("fnf_pos_shift_reopened", todayKey(new Date()));
    localStorage.setItem(
      "fnf_pos_shift_start",
      new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    );
    setLocked(false);
  };

  return (
    <>
      <label className="flex items-center gap-1.5 text-xs font-semibold shrink-0" title="Counter locks and the closing report opens at this time">
        <Clock className="size-3.5 text-primary" />
        Auto-close
        <Input
          type="time"
          value={closeAt}
          onChange={(e) => saveTime(e.target.value)}
          className="h-8 w-[104px] text-xs rounded-lg"
          aria-label="Automatic closing time"
        />
      </label>

      {locked && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur flex items-center justify-center p-4">
          <div className="max-w-sm w-full rounded-3xl border bg-card p-6 text-center space-y-4 shadow-xl">
            <Lock className="size-10 mx-auto text-primary" />
            <h2 className="text-lg font-bold">Counter closed for today</h2>
            <p className="text-sm text-muted-foreground">
              Closing time ({closeAt}) reached. Billing is locked. Check the closing report, send it to WhatsApp, then start the next shift.
            </p>
            <Button className="w-full" variant="outline" onClick={onOpenReport}>
              Open closing report
            </Button>
            <div className="space-y-2 text-left">
              <label className="text-xs font-semibold" htmlFor="new-float">Opening cash for next shift (₹)</label>
              <Input id="new-float" type="number" min={0} value={float} onChange={(e) => setFloat(e.target.value)} />
            </div>
            <Button className="w-full" onClick={startNewShift}>Start next shift</Button>
          </div>
        </div>
      )}
    </>
  );
}
