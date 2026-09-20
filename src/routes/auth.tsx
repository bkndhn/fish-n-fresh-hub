import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Fish,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Send,
  RefreshCw,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkRateLimit, recordRateLimitAttempt, resetRateLimit } from "@/lib/rateLimiter";
import { cn } from "@/lib/utils";

function safeNext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string; mode?: string } => {
    const next = safeNext(s['next']);
    const mode = typeof s['mode'] === "string" ? s['mode'] : undefined;
    return {
      ...(next ? { next } : {}),
      ...(mode ? { mode } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Sign In | Fish N Fresh" },
      {
        name: "description",
        content: "Sign in to the Fish N Fresh admin console to manage products, orders and deliveries.",
      },
      { property: "og:title", content: "Sign In | Fish N Fresh" },
      {
        property: "og:description",
        content: "Sign in to the Fish N Fresh admin console to manage products, orders and deliveries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

// ─── OTP input: 6 individual digit boxes ──────────────────────────────────────
function OtpInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split("").concat(Array(6).fill("")).slice(0, 6);

  function handleChange(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[idx] = char;
    const joined = next.join("");
    onChange(joined);
    if (char && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) refs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) refs.current[idx + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      onChange(pasted);
      refs.current[Math.min(pasted.length, 5)]?.focus();
    }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "w-11 h-13 text-center text-xl font-black font-mono rounded-xl border-2 bg-background outline-none transition-all",
            "focus:border-primary focus:ring-2 focus:ring-primary/30",
            d ? "border-primary/70 text-foreground" : "border-border text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        />
      ))}
    </div>
  );
}

// ─── Password requirements checklist (matches Supabase config exactly) ────────
export function getPasswordErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 6) errors.push("length");
  if (!/[a-z]/.test(password)) errors.push("lowercase");
  if (!/[A-Z]/.test(password)) errors.push("uppercase");
  if (!/[0-9]/.test(password)) errors.push("number");
  return errors;
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const rules = [
    { key: "length",    label: "At least 6 characters", met: password.length >= 6 },
    { key: "lowercase", label: "One lowercase letter (a–z)", met: /[a-z]/.test(password) },
    { key: "uppercase", label: "One uppercase letter (A–Z)", met: /[A-Z]/.test(password) },
    { key: "number",    label: "One number (0–9)", met: /[0-9]/.test(password) },
  ];

  const metCount = rules.filter((r) => r.met).length;
  const allMet = metCount === rules.length;

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < metCount
                ? metCount === 4 ? "bg-emerald-500"
                  : metCount === 3 ? "bg-blue-500"
                  : metCount === 2 ? "bg-amber-500"
                  : "bg-rose-500"
                : "bg-muted"
            )}
          />
        ))}
      </div>
      {/* Per-rule checklist */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {rules.map((r) => (
          <p key={r.key} className={cn(
            "text-[11px] flex items-center gap-1 transition-colors",
            r.met ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )}>
            <span className={cn(
              "size-3 rounded-full flex items-center justify-center text-[8px] font-black shrink-0",
              r.met ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
            )}>
              {r.met ? "✓" : "·"}
            </span>
            {r.label}
          </p>
        ))}
      </div>
      {allMet && (
        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          ✓ Password meets all requirements
        </p>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
function AuthPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const next = searchParams.next;

  // Sign-in state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sign-up state (multi-step: 1=details, 2=otp, 3=password)
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Forgot / reset password state (multi-step: 1=email, 2=otp, 3=new password)
  const [viewMode, setViewMode] = useState<"auth" | "forgot">("auth");
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);

  // Rate limit lockouts
  const [signinLockout, setSigninLockout] = useState(0);
  const [signupLockout, setSignupLockout] = useState(0);
  const [resetLockout, setResetLockout] = useState(0);
  const [otpVerifyLockout, setOtpVerifyLockout] = useState(0);       // signup OTP guess lockout
  const [resetVerifyLockout, setResetVerifyLockout] = useState(0);   // reset OTP guess lockout
  const [otpSendLockout, setOtpSendLockout] = useState(0);           // send OTP lockout (resend abuse)

  // Global countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setOtpCooldown((p) => (p > 0 ? p - 1 : 0));
      setResetCooldown((p) => (p > 0 ? p - 1 : 0));
      setSigninLockout((p) => (p > 0 ? p - 1 : 0));
      setSignupLockout((p) => (p > 0 ? p - 1 : 0));
      setResetLockout((p) => (p > 0 ? p - 1 : 0));
      setOtpVerifyLockout((p) => (p > 0 ? p - 1 : 0));
      setResetVerifyLockout((p) => (p > 0 ? p - 1 : 0));
      setOtpSendLockout((p) => (p > 0 ? p - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Restore reset mode from URL/hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || searchParams.mode === "reset") {
      setViewMode("forgot");
      setResetStep(3); // Jump straight to new password if arriving via link
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setViewMode("forgot");
        setResetStep(3);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !hash.includes("type=recovery") && searchParams.mode !== "reset") {
        void routeAfterLogin();
      }
    });

    return () => { authListener.subscription.unsubscribe(); };
  }, [navigate, searchParams.mode]);

  function getSafeRedirectUrl(target: string | undefined): string | null {
    if (!target) return null;
    if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return null;
    try {
      const parsed = new URL(target, window.location.origin);
      if (parsed.origin !== window.location.origin) return null;
      return parsed.pathname + parsed.search + parsed.hash;
    } catch { return null; }
  }

  async function routeAfterLogin() {
    const safeNextUrl = getSafeRedirectUrl(next);
    if (safeNextUrl) { window.location.href = safeNextUrl; return; }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) { navigate({ to: "/orders" }); return; }
      const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (rolesData ?? []).map((r) => r.role as string);
      if (roles.includes("super_admin") || roles.includes("admin") || roles.includes("manager")) {
        navigate({ to: "/admin" });
      } else if (roles.includes("cashier")) {
        navigate({ to: "/admin/pos" });
      } else if (roles.includes("driver")) {
        navigate({ to: "/admin/driver" });
      } else if (roles.includes("inventory_manager")) {
        navigate({ to: "/admin/products" });
      } else if (roles.includes("support_staff")) {
        navigate({ to: "/admin/support" });
      } else {
        navigate({ to: "/orders" });
      }
    } catch { navigate({ to: "/orders" }); }
  }

  // ─── SIGN IN ───────────────────────────────────────────────────────────────
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    const rlCheck = checkRateLimit("auth_signin", email || "guest");
    if (!rlCheck.allowed) {
      setSigninLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many sign in attempts. Please wait.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const res = recordRateLimitAttempt("auth_signin", email || "guest");
      if (!res.allowed && res.retryAfterSeconds > 0) setSigninLockout(res.retryAfterSeconds);
      toast.error(error.message);
      return;
    }
    resetRateLimit("auth_signin", email || "guest");
    setSigninLockout(0);
    toast.success("Welcome back!");
    await routeAfterLogin();
  }

  // ─── SIGN UP — Step 1→2: Send OTP ─────────────────────────────────────────
  async function sendSignupOtp(e: React.FormEvent) {
    e.preventDefault();
    // Check both registration limit and OTP send spam limit
    const rlCheck = checkRateLimit("auth_signup", signupEmail || "guest");
    if (!rlCheck.allowed) {
      setSignupLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many registration attempts. Please wait.");
      return;
    }
    const sendCheck = checkRateLimit("auth_otp_send", signupEmail || "guest");
    if (!sendCheck.allowed) {
      setOtpSendLockout(sendCheck.retryAfterSeconds);
      toast.error(sendCheck.errorMessage || "Too many code requests. Please wait.");
      return;
    }
    if (otpSendLockout > 0) {
      toast.info(`Please wait ${otpSendLockout}s before requesting another code.`);
      return;
    }
    if (!/^[6-9]\d{9}$/.test(signupPhone)) {
      toast.error("Please enter a valid 10-digit Indian phone number.");
      return;
    }
    if (!signupFullName.trim() || signupFullName.trim().length < 2) {
      toast.error("Please enter your full name.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: signupEmail,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    // Always record the send attempt (even on success) to cap resends
    const sendRes = recordRateLimitAttempt("auth_otp_send", signupEmail || "guest");
    if (!sendRes.allowed && sendRes.retryAfterSeconds > 0) setOtpSendLockout(sendRes.retryAfterSeconds);
    if (error) {
      recordRateLimitAttempt("auth_signup", signupEmail || "guest");
      toast.error(error.message);
      return;
    }
    setSignupStep(2);
    setOtpCooldown(60);
    toast.success("6-digit code sent! Check your inbox.");
  }

  // ─── SIGN UP — Step 2→3: Verify OTP ───────────────────────────────────────
  async function verifySignupOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otpVerifyLockout > 0) {
      toast.error(`Too many wrong attempts. Wait ${otpVerifyLockout}s before trying again.`);
      return;
    }
    const rlCheck = checkRateLimit("auth_otp_verify", signupEmail || "guest");
    if (!rlCheck.allowed) {
      setOtpVerifyLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many verification attempts. Please wait.");
      return;
    }
    if (signupOtp.length < 6) {
      toast.error("Please enter the complete 6-digit code.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: signupEmail,
      token: signupOtp,
      type: "email",
    });
    setLoading(false);
    if (error) {
      // Record failed attempt — locks out after 5 wrong guesses
      const res = recordRateLimitAttempt("auth_otp_verify", signupEmail || "guest");
      if (!res.allowed && res.retryAfterSeconds > 0) setOtpVerifyLockout(res.retryAfterSeconds);
      toast.error("Invalid or expired code. Please try again.");
      setSignupOtp("");
      return;
    }
    // Success — clear OTP verify counter for this email
    resetRateLimit("auth_otp_verify", signupEmail || "guest");
    setSignupStep(3);
  }

  // ─── SIGN UP — Step 3: Set Password & Finalize ────────────────────────────
  async function finalizeSignup(e: React.FormEvent) {
    e.preventDefault();
    const pwErrors = getPasswordErrors(signupPassword);
    if (pwErrors.length > 0) {
      const msgs: Record<string, string> = {
        length: "Password must be at least 6 characters.",
        lowercase: "Password must include at least one lowercase letter.",
        uppercase: "Password must include at least one uppercase letter.",
        number: "Password must include at least one number.",
      };
      toast.error(msgs[pwErrors[0]] || "Password does not meet requirements.");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    // Update the now-verified user with password + metadata
    const { error } = await supabase.auth.updateUser({
      password: signupPassword,
      data: { full_name: signupFullName, phone: signupPhone },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    resetRateLimit("auth_signup", signupEmail || "guest");
    toast.success("Account created! Welcome to Fish N Fresh 🎉");
    await routeAfterLogin();
  }

  // ─── RESET — Step 1→2: Send OTP ───────────────────────────────────────────
  async function sendResetOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    const rlCheck = checkRateLimit("auth_reset", forgotEmail.trim());
    if (!rlCheck.allowed) {
      setResetLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many reset attempts. Please wait.");
      return;
    }
    const sendCheck = checkRateLimit("auth_otp_send", forgotEmail.trim());
    if (!sendCheck.allowed) {
      setOtpSendLockout(sendCheck.retryAfterSeconds);
      toast.error(sendCheck.errorMessage || "Too many code requests. Please wait.");
      return;
    }
    if (resetCooldown > 0) {
      toast.info(`Please wait ${resetCooldown}s before requesting another code.`);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: forgotEmail.trim(),
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    // Always record the send attempt (even on success) to cap resends
    const sendRes = recordRateLimitAttempt("auth_otp_send", forgotEmail.trim());
    if (!sendRes.allowed && sendRes.retryAfterSeconds > 0) setOtpSendLockout(sendRes.retryAfterSeconds);
    const res = recordRateLimitAttempt("auth_reset", forgotEmail.trim());
    if (!res.allowed && res.retryAfterSeconds > 0) setResetLockout(res.retryAfterSeconds);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResetStep(2);
    setResetCooldown(60);
    toast.success("6-digit reset code sent! Check your inbox.");
  }

  // ─── RESET — Step 2→3: Verify OTP ─────────────────────────────────────────
  async function verifyResetOtp(e: React.FormEvent) {
    e.preventDefault();
    if (resetVerifyLockout > 0) {
      toast.error(`Too many wrong attempts. Wait ${resetVerifyLockout}s before trying again.`);
      return;
    }
    const rlCheck = checkRateLimit("auth_otp_verify", forgotEmail.trim());
    if (!rlCheck.allowed) {
      setResetVerifyLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many verification attempts. Please wait.");
      return;
    }
    if (resetOtp.length < 6) {
      toast.error("Please enter the complete 6-digit code.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: forgotEmail,
      token: resetOtp,
      type: "email",
    });
    setLoading(false);
    if (error) {
      const res = recordRateLimitAttempt("auth_otp_verify", forgotEmail.trim());
      if (!res.allowed && res.retryAfterSeconds > 0) setResetVerifyLockout(res.retryAfterSeconds);
      toast.error("Invalid or expired code. Please try again.");
      setResetOtp("");
      return;
    }
    resetRateLimit("auth_otp_verify", forgotEmail.trim());
    setResetStep(3);
  }

  // ─── RESET — Step 3: Update Password ─────────────────────────────────────
  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    const pwErrors = getPasswordErrors(newPassword);
    if (pwErrors.length > 0) {
      const msgs: Record<string, string> = {
        length: "Password must be at least 6 characters.",
        lowercase: "Password must include at least one lowercase letter.",
        uppercase: "Password must include at least one uppercase letter.",
        number: "Password must include at least one number.",
      };
      toast.error(msgs[pwErrors[0]] || "Password does not meet requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated successfully!");
    setViewMode("auth");
    setResetStep(1);
    setForgotEmail("");
    setResetOtp("");
    setNewPassword("");
    setConfirmPassword("");
    await routeAfterLogin();
  }

  // ─── FORGOT PASSWORD SCREENS ───────────────────────────────────────────────
  if (viewMode === "forgot") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md rounded-3xl border-border/80 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="ocean-gradient mx-auto flex size-12 items-center justify-center rounded-2xl text-primary-foreground shadow-sm">
              <KeyRound className="size-6" />
            </div>
            <CardTitle className="mt-3 font-display text-2xl">Reset Password</CardTitle>
            <CardDescription>
              {resetStep === 1 && "We'll email you a 6-digit code to verify it's you."}
              {resetStep === 2 && `Enter the 6-digit code sent to ${forgotEmail}`}
              {resetStep === 3 && "Create your new secure password."}
            </CardDescription>
          </CardHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 pb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  "size-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  resetStep > s
                    ? "bg-primary border-primary text-primary-foreground"
                    : resetStep === s
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted-foreground/30 text-muted-foreground/50"
                )}>
                  {resetStep > s ? <CheckCircle2 className="size-3.5" /> : s}
                </div>
                {s < 3 && <div className={cn("h-0.5 w-8 rounded-full transition-all", resetStep > s ? "bg-primary" : "bg-muted")} />}
              </div>
            ))}
          </div>

          <CardContent className="space-y-4">
            {/* Step 1: Email entry */}
            {resetStep === 1 && (
              <form onSubmit={sendResetOtp} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Account Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="rounded-xl pl-10"
                    />
                  </div>
                </div>
                {resetLockout > 0 && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                    <span>Too many attempts. Wait <strong className="font-mono">{resetLockout}s</strong>.</span>
                  </div>
                )}
                <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading || resetLockout > 0}>
                  {loading ? "Sending Code..." : <><Send className="mr-2 size-4" /> Send 6-Digit Code</>}
                </Button>
              </form>
            )}

            {/* Step 2: OTP verification */}
            {resetStep === 2 && (
              <form onSubmit={verifyResetOtp} className="space-y-5 pt-2">
                {resetVerifyLockout > 0 && (
                  <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-rose-500" />
                    <span>Too many wrong attempts. Try again in <strong className="font-mono text-foreground">{resetVerifyLockout}s</strong>.</span>
                  </div>
                )}
                <div className="space-y-3">
                  <Label className="text-center block">Enter Verification Code</Label>
                  <OtpInput value={resetOtp} onChange={setResetOtp} disabled={loading || resetVerifyLockout > 0} />
                  <p className="text-center text-xs text-muted-foreground">
                    Sent to <span className="font-semibold text-foreground">{forgotEmail}</span>
                  </p>
                </div>
                <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading || resetOtp.length < 6 || resetVerifyLockout > 0}>
                  {loading ? "Verifying..." : resetVerifyLockout > 0 ? `Locked (${resetVerifyLockout}s)` : "Verify Code →"}
                </Button>
                <div className="text-center">
                  {resetCooldown > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      <RefreshCw className="inline size-3 mr-1 animate-spin" />
                      Resend in <strong className="font-mono text-foreground">{resetCooldown}s</strong>
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={sendResetOtp as unknown as React.MouseEventHandler}
                    >
                      Didn't receive it? Resend code
                    </button>
                  )}
                </div>
              </form>
            )}

            {/* Step 3: New password */}
            {resetStep === 3 && (
              <form onSubmit={updatePassword} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-pass">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="new-pass"
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl pl-10 pr-10"
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                    </Button>
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pass">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="confirm-pass"
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn(
                        "rounded-xl pl-10",
                        confirmPassword && confirmPassword !== newPassword && "border-rose-500 focus-visible:ring-rose-500/30"
                      )}
                    />
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-rose-500 font-medium">Passwords do not match</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-xl font-bold"
                  disabled={loading || getPasswordErrors(newPassword).length > 0 || newPassword !== confirmPassword}
                >
                  {loading ? "Updating Password..." : "Save New Password & Sign In"}
                </Button>
              </form>
            )}

            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => {
                setViewMode("auth");
                setResetStep(1);
                setForgotEmail("");
                setResetOtp("");
              }}
            >
              <ArrowLeft className="size-3.5" /> Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── DEFAULT: Sign In + Sign Up (tabbed) ──────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md rounded-3xl border-border/80 shadow-lg">
        <CardHeader className="text-center pb-2">
          <span className="ocean-gradient mx-auto flex size-12 items-center justify-center rounded-2xl text-primary-foreground shadow-sm">
            <Fish className="size-6" />
          </span>
          <CardTitle className="mt-3 font-display text-2xl">Fish N Fresh</CardTitle>
          <CardDescription>Customers, staff &amp; admin</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl">
              <TabsTrigger value="signin" className="rounded-xl font-semibold">Sign In</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl font-semibold">Create Account</TabsTrigger>
            </TabsList>

            {/* ── Sign In Tab ── */}
            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                {signinLockout > 0 && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                    <span>Locked out. Try again in <strong className="font-mono">{signinLockout}s</strong>.</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="email" type="email" required
                      placeholder="you@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => { setForgotEmail(email); setViewMode("forgot"); }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Enter your password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl pl-10 pr-10"
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading || signinLockout > 0}>
                  {loading ? "Signing in..." : signinLockout > 0 ? `Locked (${signinLockout}s)` : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            {/* ── Sign Up Tab ── */}
            <TabsContent value="signup">
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={cn(
                      "size-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                      signupStep > s
                        ? "bg-primary border-primary text-primary-foreground"
                        : signupStep === s
                        ? "border-primary text-primary bg-primary/10"
                        : "border-muted-foreground/30 text-muted-foreground/50"
                    )}>
                      {signupStep > s ? <CheckCircle2 className="size-3.5" /> : s}
                    </div>
                    {s < 3 && <div className={cn("h-0.5 w-8 rounded-full transition-all", signupStep > s ? "bg-primary" : "bg-muted")} />}
                  </div>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground mb-3">
                {signupStep === 1 && "Your details"}
                {signupStep === 2 && "Verify email"}
                {signupStep === 3 && "Set password"}
              </p>

              {/* Step 1 — Details + Send OTP */}
              {signupStep === 1 && (
                <form onSubmit={sendSignupOtp} className="space-y-4" noValidate>
                  {signupLockout > 0 && (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                      <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                      <span>Too many attempts. Wait <strong className="font-mono">{signupLockout}s</strong>.</span>
                    </div>
                  )}

                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g. Ramesh Kumar"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      className={cn("rounded-xl", signupFullName && signupFullName.trim().length < 2 && "border-rose-500 focus-visible:ring-rose-500/30")}
                    />
                    {signupFullName && signupFullName.trim().length < 2 && (
                      <p className="text-xs text-rose-500">Please enter your full name (at least 2 characters).</p>
                    )}
                  </div>

                  {/* Phone Number — controlled, digits only, max 10 */}
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      placeholder="e.g. 9876543210"
                      maxLength={10}
                      value={signupPhone}
                      onChange={(e) => {
                        // Strip non-digits, cap at 10
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setSignupPhone(digits);
                      }}
                      className={cn(
                        "rounded-xl font-mono tracking-wider",
                        signupPhone.length > 0 && signupPhone.length < 10 && "border-amber-500 focus-visible:ring-amber-500/30",
                        signupPhone.length === 10 && !/^[6-9]/.test(signupPhone) && "border-rose-500 focus-visible:ring-rose-500/30",
                        signupPhone.length === 10 && /^[6-9]/.test(signupPhone) && "border-emerald-500 focus-visible:ring-emerald-500/30",
                      )}
                    />
                    {/* Inline error messages */}
                    {signupPhone.length > 0 && signupPhone.length < 10 && (
                      <p className="text-xs text-amber-600">Enter all 10 digits ({10 - signupPhone.length} more needed).</p>
                    )}
                    {signupPhone.length === 10 && !/^[6-9]/.test(signupPhone) && (
                      <p className="text-xs text-rose-500">Mobile number must start with 6, 7, 8 or 9.</p>
                    )}
                    {signupPhone.length === 10 && /^[6-9]/.test(signupPhone) && (
                      <p className="text-xs text-emerald-600">✓ Valid mobile number</p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        inputMode="email"
                        placeholder="you@example.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className={cn(
                          "rounded-xl pl-10",
                          signupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail) && "border-rose-500 focus-visible:ring-rose-500/30"
                        )}
                      />
                    </div>
                    {signupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail) && (
                      <p className="text-xs text-rose-500">Please enter a valid email address (e.g. name@gmail.com).</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full rounded-xl font-bold"
                    disabled={
                      loading ||
                      signupLockout > 0 ||
                      signupFullName.trim().length < 2 ||
                      signupPhone.length !== 10 ||
                      !/^[6-9]/.test(signupPhone) ||
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmail)
                    }
                  >
                    {loading ? "Sending Code..." : <><Send className="mr-2 size-4" /> Send Verification Code</>}
                  </Button>
                </form>
              )}

              {/* Step 2 — OTP Verification */}
              {signupStep === 2 && (
                <form onSubmit={verifySignupOtp} className="space-y-5">
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center space-y-1">
                    <Mail className="mx-auto size-6 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Check your email</p>
                    <p className="text-xs text-muted-foreground">
                      We sent a 6-digit code to <span className="font-semibold text-foreground">{signupEmail}</span>
                    </p>
                  </div>
                  {otpVerifyLockout > 0 && (
                    <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2.5">
                      <ShieldCheck className="size-4 shrink-0 text-rose-500" />
                      <span>Too many wrong attempts. Try again in <strong className="font-mono text-foreground">{otpVerifyLockout}s</strong>.</span>
                    </div>
                  )}
                  <div className="space-y-3">
                    <Label className="text-center block">Verification Code</Label>
                    <OtpInput value={signupOtp} onChange={setSignupOtp} disabled={loading || otpVerifyLockout > 0} />
                  </div>
                  <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading || signupOtp.length < 6 || otpVerifyLockout > 0}>
                    {loading ? "Verifying..." : otpVerifyLockout > 0 ? `Locked (${otpVerifyLockout}s)` : "Verify & Continue →"}
                  </Button>
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" className="text-muted-foreground hover:text-foreground gap-1 flex items-center" onClick={() => setSignupStep(1)}>
                      <ArrowLeft className="size-3" /> Change email
                    </button>
                    {otpCooldown > 0 ? (
                      <span className="text-muted-foreground">Resend in <strong className="font-mono text-foreground">{otpCooldown}s</strong></span>
                    ) : (
                      <button type="button" className="text-primary hover:underline" onClick={sendSignupOtp as unknown as React.MouseEventHandler}>
                        Resend code
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* Step 3 — Set Password */}
              {signupStep === 3 && (
                <form onSubmit={finalizeSignup} className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2.5">
                    <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Email verified!</p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{signupEmail}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-pass">Create Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signup-pass"
                        type={showSignupPassword ? "text" : "password"}
                        required minLength={6}
                        placeholder="At least 6 characters"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="rounded-xl pl-10 pr-10"
                      />
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                      >
                        {showSignupPassword ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                      </Button>
                    </div>
                    <PasswordStrength password={signupPassword} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-confirm-pass">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-pass"
                        type={showSignupPassword ? "text" : "password"}
                        required minLength={6}
                        placeholder="Re-enter your password"
                        value={signupConfirmPassword}
                        onChange={(e) => setSignupConfirmPassword(e.target.value)}
                        className={cn(
                          "rounded-xl pl-10",
                          signupConfirmPassword && signupConfirmPassword !== signupPassword && "border-rose-500 focus-visible:ring-rose-500/30"
                        )}
                      />
                    </div>
                    {signupConfirmPassword && signupConfirmPassword !== signupPassword && (
                      <p className="text-xs text-rose-500 font-medium">Passwords do not match</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full rounded-xl font-bold"
                    disabled={loading || getPasswordErrors(signupPassword).length > 0 || signupPassword !== signupConfirmPassword}
                  >
                    {loading ? "Creating Account..." : "Create Account 🎉"}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
