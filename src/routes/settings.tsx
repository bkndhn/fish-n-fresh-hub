import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/session";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — Fish N Fresh" },
      { name: "description", content: "Update your Fish N Fresh delivery details, contact number and password." },
      { property: "og:title", content: "Account Settings — Fish N Fresh" },
      { property: "og:description", content: "Manage your profile and saved delivery address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, loading } = useSessionUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, phone, address")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
        setAddress(data?.address ?? "");
      });
  }, [user]);

  if (loading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="py-20 text-center">
          <p className="text-sm text-muted-foreground">Sign in to manage your account.</p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: user.id, full_name: fullName, phone, address, email: user.email });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (phone) localStorage.setItem("fnf_phone", phone);
    toast.success("Profile saved");
  }

  async function changePassword() {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const { error } = await supabase.auth.updateUser({
      password,
      // @ts-expect-error current_password is required by Lovable Cloud for signed-in changes
      current_password: currentPassword,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setCurrentPassword("");
    toast.success("Password updated");
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Account settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

      <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Profile</h2>
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address">Delivery address</Label>
          <Textarea id="address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <Button className="rounded-xl" disabled={saving} onClick={saveProfile}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-semibold">Change password</h2>
        <div className="space-y-1.5">
          <Label htmlFor="current">Current password</Label>
          <Input
            id="current"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new">New password</Label>
          <Input id="new" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button variant="outline" className="rounded-xl" onClick={changePassword}>
          Update password
        </Button>
      </section>

      <Button variant="outline" className="mt-4 w-full rounded-xl" onClick={signOut}>
        Sign out
      </Button>
    </AppShell>
  );
}
