import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Fish,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Lock,
  UserCheck,
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
      { name: "description", content: "Sign in to the Fish N Fresh store." },
    ],
  }),
  component: AuthPage,
});

// ─── Password requirements (matches Supabase config: lowercase, uppercase, number) ─
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
    { key: "length",    label: "At least 6 characters",       met: password.length >= 6 },
    { key: "lowercase", label: "One lowercase letter (a–z)",  met: /[a-z]/.test(password) },
    { key: "uppercase", label: "One uppercase letter (A–Z)",  met: /[A-Z]/.test(password) },
    { key: "number",    label: "One number (0–9)",            met: /[0-9]/.test(password) },
  ];

  const metCount = rules.filter((r) => r.met).length;
  const allMet = metCount === rules.length;

  return (
    <div className="space-y-2">
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

// ─── Email regex helper ────────────────────────────────────────────────────────
function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ─── Main component ────────────────────────────────────────────────────────────
function AuthPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const next = searchParams.next;

  // ── Sign-in state ─────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signinLockout, setSigninLockout] = useState(0);

  // ── Signup state (2 steps: form → check email) ────────────────────────────
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [signupEmail, setSignupEmail] = useState("");
  const [signupFullName, setSignupFullName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupLockout, setSignupLockout] = useState(0);

  // ── OTP state ─────────────────────────────────────────────────────────────


  // ── Forgot / reset state ──────────────────────────────────────────────────
  // forgotStep: 1=email entry, 2=check email waiting, 3=set new password (after clicking link)
  const [viewMode, setViewMode] = useState<"auth" | "forgot">("auth");
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLockout, setResetLockout] = useState(0);

  // ── Global countdown ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setSigninLockout((p) => (p > 0 ? p - 1 : 0));
      setSignupLockout((p) => (p > 0 ? p - 1 : 0));
      setResetLockout((p)  => (p > 0 ? p - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Auth state: handle password recovery link + auto-redirect ─────────────
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || searchParams.mode === "reset") {
      setViewMode("forgot");
      setForgotStep(3);
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setViewMode("forgot");
        setForgotStep(3);
      }
      if (event === "SIGNED_IN") {
        // Only auto-route if not in password recovery flow
        if (!window.location.hash.includes("type=recovery") && searchParams.mode !== "reset") {
          await routeAfterLogin();
        }
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !hash.includes("type=recovery") && searchParams.mode !== "reset") {
        void routeAfterLogin();
      }
    });

    return () => { sub.subscription.unsubscribe(); };
  }, [navigate, searchParams.mode]);

  function getSafeRedirect(target: string | undefined): string | null {
    if (!target) return null;
    if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return null;
    try {
      const p = new URL(target, window.location.origin);
      if (p.origin !== window.location.origin) return null;
      return p.pathname + p.search + p.hash;
    } catch { return null; }
  }

  async function routeAfterLogin() {
    const safeNextUrl = getSafeRedirect(next);
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
    setSigninLockout(0);
    toast.success("Welcome back!");
    await routeAfterLogin();
  }

  // ─── GOOGLE LOGIN ──────────────────────────────────────────────────────────
  async function signInWithGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/orders`
        }
      });
      if (error) toast.error(error.message);
    } catch (error) {
      toast.error("Failed to initialize Google login.");
    }
  }

  // ─── OTP LOGIN ─────────────────────────────────────────────────────────────


  // ─── SIGN UP ───────────────────────────────────────────────────────────────
  async function submitSignup(e: React.FormEvent) {
    e.preventDefault();
    const rlCheck = checkRateLimit("auth_signup", signupEmail || "guest");
    if (!rlCheck.allowed) {
      setSignupLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many registration attempts. Please wait.");
      return;
    }
    // Validation
    if (signupFullName.trim().length < 2) { toast.error("Please enter your full name."); return; }
    if (signupPhone.length !== 10 || !/^[6-9]/.test(signupPhone)) {
      toast.error("Enter a valid 10-digit Indian mobile number starting with 6–9."); return;
    }
    if (!isValidEmail(signupEmail)) { toast.error("Please enter a valid email address."); return; }
    const pwErrors = getPasswordErrors(signupPassword);
    if (pwErrors.length > 0) {
      const msgs: Record<string, string> = {
        length: "Password must be at least 6 characters.",
        lowercase: "Password must include a lowercase letter.",
        uppercase: "Password must include an uppercase letter.",
        number: "Password must include a number.",
      };
      const firstError = pwErrors[0] ?? "";
      toast.error(msgs[firstError] || "Password does not meet requirements."); return;
    }
    if (signupPassword !== signupConfirmPassword) { toast.error("Passwords do not match."); return; }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: { full_name: signupFullName, phone: signupPhone },
      },
    });
    setLoading(false);

    if (error) {
      recordRateLimitAttempt("auth_signup", signupEmail || "guest");
      toast.error(error.message);
      return;
    }

    recordRateLimitAttempt("auth_signup", signupEmail || "guest");
    setSignupStep(2); // Show "check your email" screen
  }

  // ─── FORGOT PASSWORD — Send Reset Link ────────────────────────────────────
  async function sendPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(forgotEmail.trim())) {
      toast.error("Please enter a valid email address."); return;
    }
    const rlCheck = checkRateLimit("auth_reset", forgotEmail.trim());
    if (!rlCheck.allowed) {
      setResetLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many reset attempts. Please wait."); return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    setLoading(false);
    const res = recordRateLimitAttempt("auth_reset", forgotEmail.trim());
    if (!res.allowed && res.retryAfterSeconds > 0) setResetLockout(res.retryAfterSeconds);
    if (error) { toast.error(error.message); return; }
    setForgotStep(2);
    toast.success("Password reset link sent! Check your inbox.");
  }

  // ─── RESET PASSWORD — Set New Password ────────────────────────────────────
  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    const pwErrors = getPasswordErrors(newPassword);
    if (pwErrors.length > 0) {
      const msgs: Record<string, string> = {
        length: "Password must be at least 6 characters.",
        lowercase: "Password must include a lowercase letter.",
        uppercase: "Password must include an uppercase letter.",
        number: "Password must include a number.",
      };
      const firstError = pwErrors[0] ?? "";
      toast.error(msgs[firstError] || "Password does not meet requirements."); return;
    }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated! You are now signed in.");
    setViewMode("auth");
    setForgotStep(1);
    setForgotEmail(""); setNewPassword(""); setConfirmPassword("");
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
              {forgotStep === 1 && "Enter your email and we'll send a reset link."}
              {forgotStep === 2 && "Check your inbox for the reset link."}
              {forgotStep === 3 && "Create your new secure password."}
            </CardDescription>
          </CardHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 pb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  "size-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                  forgotStep > s
                    ? "bg-primary border-primary text-primary-foreground"
                    : forgotStep === s
                    ? "border-primary text-primary bg-primary/10"
                    : "border-muted-foreground/30 text-muted-foreground/50"
                )}>
                  {forgotStep > s ? <CheckCircle2 className="size-3.5" /> : s}
                </div>
                {s < 3 && <div className={cn("h-0.5 w-8 rounded-full transition-all", forgotStep > s ? "bg-primary" : "bg-muted")} />}
              </div>
            ))}
          </div>

          <CardContent className="space-y-4">
            {/* Step 1: Email entry */}
            {forgotStep === 1 && (
              <form onSubmit={sendPasswordReset} className="space-y-4 pt-2" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Account Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="forgot-email" type="email" inputMode="email"
                      placeholder="you@example.com"
                      value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                      className={cn("rounded-xl pl-10",
                        forgotEmail && !isValidEmail(forgotEmail) && "border-rose-500"
                      )}
                    />
                  </div>
                  {forgotEmail && !isValidEmail(forgotEmail) && (
                    <p className="text-xs text-rose-500">Enter a valid email address.</p>
                  )}
                </div>
                {resetLockout > 0 && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                    <span>Too many attempts. Wait <strong className="font-mono">{resetLockout}s</strong>.</span>
                  </div>
                )}
                <Button type="submit" className="w-full rounded-xl font-bold"
                  disabled={loading || resetLockout > 0 || !isValidEmail(forgotEmail)}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}

            {/* Step 2: Check email waiting screen */}
            {forgotStep === 2 && (
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center space-y-2">
                  <Mail className="mx-auto size-8 text-primary" />
                  <p className="font-bold text-foreground">Check your inbox</p>
                  <p className="text-sm text-muted-foreground">
                    We sent a password reset link to<br />
                    <span className="font-semibold text-foreground">{forgotEmail}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click the link in the email to set your new password. The link expires in 10 minutes.
                  </p>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Didn't receive it?{" "}
                  <button type="button" className="text-primary hover:underline font-semibold"
                    onClick={() => setForgotStep(1)}>
                    Try again
                  </button>
                </p>
              </div>
            )}

            {/* Step 3: Set new password (after clicking reset link) */}
            {forgotStep === 3 && (
              <form onSubmit={updatePassword} className="space-y-4 pt-2" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pass">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="new-pass" type={showNewPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl pl-10 pr-10"
                    />
                    <Button type="button" variant="ghost" size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}>
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
                      id="confirm-pass" type={showNewPassword ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className={cn("rounded-xl pl-10",
                        confirmPassword && confirmPassword !== newPassword && "border-rose-500"
                      )}
                    />
                  </div>
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="text-xs text-rose-500 font-medium">Passwords do not match</p>
                  )}
                </div>
                <Button type="submit" className="w-full rounded-xl font-bold"
                  disabled={loading || getPasswordErrors(newPassword).length > 0 || newPassword !== confirmPassword}>
                  {loading ? "Updating..." : "Save New Password & Sign In"}
                </Button>
              </form>
            )}

            {forgotStep !== 3 && (
              <Button type="button" variant="ghost"
                className="w-full rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => { setViewMode("auth"); setForgotStep(1); setForgotEmail(""); }}>
                <ArrowLeft className="size-3.5" /> Back to Sign In
              </Button>
            )}
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
            <TabsContent value="signin" className="space-y-4 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full rounded-xl flex items-center justify-center gap-2 h-11 hover:bg-muted/50"
                onClick={signInWithGoogle}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="size-5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or continue with</span></div>
              </div>

              <form onSubmit={signIn} className="space-y-4 mt-6" noValidate>
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
                    <Input id="email" type="email" placeholder="you@example.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl pl-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button type="button"
                      onClick={() => { setForgotEmail(email); setViewMode("forgot"); }}
                      className="text-xs font-semibold text-primary hover:underline">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input id="password" type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl pl-10 pr-10" />
                    <Button type="button" variant="ghost" size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-xl font-bold"
                  disabled={loading || signinLockout > 0}>
                  {loading ? "Signing in..." : signinLockout > 0 ? `Locked (${signinLockout}s)` : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            {/* ── Sign Up Tab ── */}
            <TabsContent value="signup">
              <Button 
                type="button" 
                variant="outline" 
                className="w-full rounded-xl flex items-center justify-center gap-2 h-11 mt-4 hover:bg-muted/50"
                onClick={signInWithGoogle}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="size-5">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign up with Google
              </Button>
              
              <div className="relative mt-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">Or sign up with email</span></div>
              </div>

              {/* Step 1 — Registration form */}
              {signupStep === 1 && (
                <>
                  {/* Step indicator */}
                  <div className="flex items-center justify-center gap-2 pt-2 pb-3">
                    {[1, 2].map((s) => (
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
                        {s < 2 && <div className={cn("h-0.5 w-8 rounded-full transition-all", signupStep > s ? "bg-primary" : "bg-muted")} />}
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-xs text-muted-foreground mb-4">Your details</p>

                  <form onSubmit={submitSignup} className="space-y-3" noValidate>
                    {signupLockout > 0 && (
                      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                        <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                        <span>Too many attempts. Wait <strong className="font-mono">{signupLockout}s</strong>.</span>
                      </div>
                    )}

                    {/* Full Name */}
                    <div className="space-y-1">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" placeholder="e.g. Ramesh Kumar"
                        value={signupFullName}
                        onChange={(e) => setSignupFullName(e.target.value)}
                        className={cn("rounded-xl",
                          signupFullName && signupFullName.trim().length < 2 && "border-rose-500"
                        )} />
                      {signupFullName && signupFullName.trim().length < 2 && (
                        <p className="text-xs text-rose-500">Enter your full name (at least 2 characters).</p>
                      )}
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input id="phone" type="tel" inputMode="numeric"
                        placeholder="e.g. 9876543210" maxLength={10}
                        value={signupPhone}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setSignupPhone(digits);
                        }}
                        className={cn("rounded-xl font-mono tracking-wider",
                          signupPhone.length > 0 && signupPhone.length < 10 && "border-amber-500",
                          signupPhone.length === 10 && !/^[6-9]/.test(signupPhone) && "border-rose-500",
                          signupPhone.length === 10 && /^[6-9]/.test(signupPhone) && "border-emerald-500",
                        )} />
                      {signupPhone.length > 0 && signupPhone.length < 10 && (
                        <p className="text-xs text-amber-600">Enter all 10 digits ({10 - signupPhone.length} more needed).</p>
                      )}
                      {signupPhone.length === 10 && !/^[6-9]/.test(signupPhone) && (
                        <p className="text-xs text-rose-500">Number must start with 6, 7, 8 or 9.</p>
                      )}
                      {signupPhone.length === 10 && /^[6-9]/.test(signupPhone) && (
                        <p className="text-xs text-emerald-600">✓ Valid mobile number</p>
                      )}
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                      <Label htmlFor="signup-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input id="signup-email" type="email" inputMode="email"
                          placeholder="you@example.com"
                          value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)}
                          className={cn("rounded-xl pl-10",
                            signupEmail && !isValidEmail(signupEmail) && "border-rose-500"
                          )} />
                      </div>
                      {signupEmail && !isValidEmail(signupEmail) && (
                        <p className="text-xs text-rose-500">Enter a valid email (e.g. name@gmail.com).</p>
                      )}
                    </div>

                    {/* Password */}
                    <div className="space-y-1">
                      <Label htmlFor="signup-pass">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input id="signup-pass" type={showSignupPassword ? "text" : "password"}
                          placeholder="At least 6 characters"
                          value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)}
                          className="rounded-xl pl-10 pr-10" />
                        <Button type="button" variant="ghost" size="icon"
                          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                          onClick={() => setShowSignupPassword(!showSignupPassword)}>
                          {showSignupPassword ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-muted-foreground" />}
                        </Button>
                      </div>
                      <PasswordStrength password={signupPassword} />
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                      <Label htmlFor="signup-confirm">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input id="signup-confirm" type={showSignupPassword ? "text" : "password"}
                          placeholder="Re-enter password"
                          value={signupConfirmPassword} onChange={(e) => setSignupConfirmPassword(e.target.value)}
                          className={cn("rounded-xl pl-10",
                            signupConfirmPassword && signupConfirmPassword !== signupPassword && "border-rose-500"
                          )} />
                      </div>
                      {signupConfirmPassword && signupConfirmPassword !== signupPassword && (
                        <p className="text-xs text-rose-500 font-medium">Passwords do not match</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full rounded-xl font-bold mt-1"
                      disabled={
                        loading || signupLockout > 0 ||
                        signupFullName.trim().length < 2 ||
                        signupPhone.length !== 10 || !/^[6-9]/.test(signupPhone) ||
                        !isValidEmail(signupEmail) ||
                        getPasswordErrors(signupPassword).length > 0 ||
                        signupPassword !== signupConfirmPassword
                      }>
                      {loading ? "Creating Account..." : "Create Account"}
                    </Button>
                  </form>
                </>
              )}

              {/* Step 2 — Check email */}
              {signupStep === 2 && (
                <div className="space-y-4 pt-4">
                  {/* Step indicator */}
                  <div className="flex items-center justify-center gap-2 pb-2">
                    {[1, 2].map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <div className={cn(
                          "size-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                          signupStep >= s
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground/30 text-muted-foreground/50"
                        )}>
                          {signupStep > s ? <CheckCircle2 className="size-3.5" /> : s}
                        </div>
                        {s < 2 && <div className="h-0.5 w-8 rounded-full bg-primary" />}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-center space-y-2">
                    <UserCheck className="mx-auto size-8 text-primary" />
                    <p className="font-bold text-foreground">Almost there!</p>
                    <p className="text-sm text-muted-foreground">
                      We sent a confirmation email to<br />
                      <span className="font-semibold text-foreground">{signupEmail}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click the link in the email to activate your account. The link expires in 24 hours.
                    </p>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Wrong email?{" "}
                    <button type="button" className="text-primary hover:underline font-semibold"
                      onClick={() => {
                        setSignupStep(1);
                        setSignupEmail(""); setSignupPassword(""); setSignupConfirmPassword("");
                      }}>
                      Go back and change it
                    </button>
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
