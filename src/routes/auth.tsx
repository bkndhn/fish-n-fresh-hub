import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Fish, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkRateLimit, recordRateLimitAttempt, resetRateLimit } from "@/lib/rateLimiter";

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

function AuthPage() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const next = searchParams.next;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password Recovery States
  const [viewMode, setViewMode] = useState<"auth" | "forgot" | "reset">("auth");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  function getSafeRedirectUrl(target: string | undefined): string | null {
    if (!target) return null;
    // Prevent protocol-relative URLs (//evil.com) or backslash tricks (/\evil.com)
    if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
      return null;
    }
    try {
      const parsed = new URL(target, window.location.origin);
      if (parsed.origin !== window.location.origin) return null;
      return parsed.pathname + parsed.search + parsed.hash;
    } catch {
      return null;
    }
  }

  async function routeAfterLogin() {
    const safeNext = getSafeRedirectUrl(next);
    if (safeNext) {
      window.location.href = safeNext;
      return;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        navigate({ to: "/orders" });
        return;
      }

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
      } else if (roles.includes("staff")) {
        navigate({ to: "/admin" });
      } else {
        navigate({ to: "/orders" });
      }
    } catch {
      navigate({ to: "/orders" });
    }
  }

  // Detect recovery mode from hash or URL query param
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || searchParams.mode === "reset") {
      setViewMode("reset");
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setViewMode("reset");
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      // If regular active session and not resetting password, route after login
      if (data.session && !hash.includes("type=recovery") && searchParams.mode !== "reset") {
        void routeAfterLogin();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, searchParams.mode]);

  // Rate Limit Lockout States
  const [signinLockout, setSigninLockout] = useState(0);
  const [signupLockout, setSignupLockout] = useState(0);
  const [resetLockout, setResetLockout] = useState(0);

  // Cooldown & Lockout countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      setSigninLockout((prev) => (prev > 0 ? prev - 1 : 0));
      setSignupLockout((prev) => (prev > 0 ? prev - 1 : 0));
      setResetLockout((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync lockout state on email change
  useEffect(() => {
    const check = checkRateLimit("auth_signin", email || "guest");
    if (!check.allowed && check.retryAfterSeconds > 0) {
      setSigninLockout(check.retryAfterSeconds);
    }
  }, [email]);

  useEffect(() => {
    const check = checkRateLimit("auth_signup", email || "guest");
    if (!check.allowed && check.retryAfterSeconds > 0) {
      setSignupLockout(check.retryAfterSeconds);
    }
  }, [email]);

  useEffect(() => {
    const check = checkRateLimit("auth_reset", forgotEmail || "guest");
    if (!check.allowed && check.retryAfterSeconds > 0) {
      setResetLockout(check.retryAfterSeconds);
    }
  }, [forgotEmail]);

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
      if (!res.allowed && res.retryAfterSeconds > 0) {
        setSigninLockout(res.retryAfterSeconds);
      }
      toast.error(error.message);
      return;
    }
    resetRateLimit("auth_signin", email || "guest");
    setSigninLockout(0);
    toast.success("Welcome back");
    await routeAfterLogin();
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    const rlCheck = checkRateLimit("auth_signup", email || "guest");
    if (!rlCheck.allowed) {
      setSignupLockout(rlCheck.retryAfterSeconds);
      toast.error(rlCheck.errorMessage || "Too many registration attempts. Please wait.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Please enter a valid 10-digit phone number starting with 6-9.");
      return;
    }
    
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${next ?? "/orders"}`,
        data: { full_name: fullName, phone },
      },
    });
    setLoading(false);
    if (error) {
      const res = recordRateLimitAttempt("auth_signup", email || "guest");
      if (!res.allowed && res.retryAfterSeconds > 0) {
        setSignupLockout(res.retryAfterSeconds);
      }
      toast.error(error.message);
      return;
    }
    
    resetRateLimit("auth_signup", email || "guest");
    setSignupLockout(0);
    if (data.session) {
      toast.success("Account created successfully!");
      await routeAfterLogin();
    } else {
      toast.success("Account created! Please check your email to verify before signing in.");
    }
  }

  async function sendPasswordReset(e: React.FormEvent) {
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

    if (cooldown > 0) {
      toast.info(`Please wait ${cooldown}s before requesting another reset email.`);
      return;
    }

    setLoading(true);
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: redirectUrl,
    });
    setLoading(false);

    const res = recordRateLimitAttempt("auth_reset", forgotEmail.trim());
    if (!res.allowed && res.retryAfterSeconds > 0) {
      setResetLockout(res.retryAfterSeconds);
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    setResetSent(true);
    setCooldown(60);
    toast.success("Password reset email sent! Check your inbox or spam folder.");
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated successfully! Redirecting...");
    setViewMode("auth");
    await routeAfterLogin();
  }

  // Screen 1: Set New Password (User arrived via reset link)
  if (viewMode === "reset") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md rounded-3xl border-border/80 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="ocean-gradient mx-auto flex size-12 items-center justify-center rounded-2xl text-primary-foreground shadow-sm">
              <ShieldCheck className="size-6" />
            </div>
            <CardTitle className="mt-3 font-display text-2xl">Create New Password</CardTitle>
            <CardDescription>
              Enter a strong, secure password for your Fish N Fresh account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={updatePassword} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-pass">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-pass"
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="rounded-xl pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="size-4 text-muted-foreground" />
                    ) : (
                      <Eye className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-pass">Confirm New Password</Label>
                <Input
                  id="confirm-pass"
                  type={showNewPassword ? "text" : "password"}
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading}>
                {loading ? "Updating Password..." : "Save & Sign In"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setViewMode("auth")}
              >
                Cancel and return to sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Screen 2: Forgot Password Request Form
  if (viewMode === "forgot") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md rounded-3xl border-border/80 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="ocean-gradient mx-auto flex size-12 items-center justify-center rounded-2xl text-primary-foreground shadow-sm">
              <KeyRound className="size-6" />
            </div>
            <CardTitle className="mt-3 font-display text-2xl">Reset Your Password</CardTitle>
            <CardDescription>
              We'll send a secure password reset link to your verified email address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resetSent ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-3">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">Verification Link Sent!</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    A password recovery link has been emailed to{" "}
                    <span className="font-semibold text-foreground">{forgotEmail}</span>.
                    Click the link in your email to choose a new password.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cooldown > 0 || loading}
                  className="rounded-xl text-xs w-full mt-2"
                  onClick={sendPasswordReset}
                >
                  <Mail className="mr-1.5 size-3.5" />
                  {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend Recovery Email"}
                </Button>
              </div>
            ) : (
              <form onSubmit={sendPasswordReset} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Account Email Address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    placeholder="Enter the email associated with your account"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Works for staff, admin, and customer accounts.
                  </p>
                </div>

                {resetLockout > 0 && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                    <div className="flex-1 leading-tight">
                      <span className="font-bold block">Security Rate Limit Active</span>
                      <span>Too many reset attempts. Please wait <strong className="font-mono text-foreground font-bold">{resetLockout}s</strong> before trying again.</span>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading || resetLockout > 0}>
                  {loading ? "Sending link..." : resetLockout > 0 ? `Locked (${resetLockout}s cooldown)` : "Send Reset Link"}
                </Button>
              </form>
            )}

            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => {
                setViewMode("auth");
                setResetSent(false);
              }}
            >
              <ArrowLeft className="size-3.5" /> Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Screen 3: Default Sign In & Sign Up Form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md rounded-3xl border-border/80 shadow-lg">
        <CardHeader className="text-center pb-2">
          <span className="ocean-gradient mx-auto flex size-12 items-center justify-center rounded-2xl text-primary-foreground shadow-sm">
            <Fish className="size-6" />
          </span>
          <CardTitle className="mt-3 font-display text-2xl">Fish N Fresh Console</CardTitle>
          <CardDescription>Customers, staff &amp; admin</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 rounded-2xl">
              <TabsTrigger value="signin" className="rounded-xl font-semibold">Sign in</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl font-semibold">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-4 pt-4">
                {signinLockout > 0 && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                    <div className="flex-1 leading-tight">
                      <span className="font-bold block">Security Lockout Active</span>
                      <span>Too many failed sign-in attempts. Try again in <strong className="font-mono text-foreground font-bold">{signinLockout}s</strong>.</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    required 
                    placeholder="Enter your email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setViewMode("forgot");
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4 text-muted-foreground" />
                      ) : (
                        <Eye className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading || signinLockout > 0}>
                  {loading ? "Signing in..." : signinLockout > 0 ? `Locked (${signinLockout}s cooldown)` : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-4 pt-4">
                {signupLockout > 0 && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-amber-500" />
                    <div className="flex-1 leading-tight">
                      <span className="font-bold block">Security Lockout Active</span>
                      <span>Too many registration attempts. Try again in <strong className="font-mono text-foreground font-bold">{signupLockout}s</strong>.</span>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input 
                    id="name" 
                    required 
                    placeholder="e.g. John Doe"
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    required 
                    pattern="[6-9][0-9]{9}"
                    placeholder="e.g. 9876543210"
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email2">Email</Label>
                  <Input 
                    id="email2" 
                    type="email" 
                    required 
                    placeholder="Enter your email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Password</Label>
                  <div className="relative">
                    <Input
                      id="password2"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={6}
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4 text-muted-foreground" />
                      ) : (
                        <Eye className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-xl font-bold" disabled={loading || signupLockout > 0}>
                  {loading ? "Creating..." : signupLockout > 0 ? `Locked (${signupLockout}s cooldown)` : "Create account"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  The first account created becomes the store admin.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

