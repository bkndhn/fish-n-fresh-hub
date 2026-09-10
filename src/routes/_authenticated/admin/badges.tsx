import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { BADGE_ICONS, BadgeIcon } from "@/components/TrustBadges";
import { adminTrustBadgesQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/badges")({
  head: () => ({
    meta: [
      { title: "Home Cards | Fish N Fresh Admin" },
      {
        name: "description",
        content: "Customize the highlight cards shown under the home page banner of your Fish N Fresh store.",
      },
      { property: "og:title", content: "Home Cards | Fish N Fresh Admin" },
      {
        property: "og:description",
        content: "Add, rename, reorder or hide the trust highlight cards on the storefront home page.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BadgesAdmin,
});


function BadgesAdmin() {
  const qc = useQueryClient();
  const badges = useQuery(adminTrustBadgesQuery);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("sparkles");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "trust_badges"] });
    qc.invalidateQueries({ queryKey: ["trust_badges"] });
  };

  const create = useMutation({
    mutationFn: async () => {
      const next = (badges.data ?? []).reduce((m, b) => Math.max(m, Number(b.sort_order)), 0) + 1;
      const { error } = await supabase
        .from("trust_badges")
        .insert({ label: label.trim(), icon, sort_order: next } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setLabel("");
      toast.success("Card added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("trust_badges").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trust_badges").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Card removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminShell title="Home highlight cards" allow={["admin", "manager"]}>
      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="label">New card label</Label>
            <Input
              id="label"
              value={label}
              placeholder="e.g. Free delivery over ₹499"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="icon">Icon</Label>
            <select
              id="icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.keys(BADGE_ICONS).map((k) => (
                <option key={k} value={k}>
                  {k.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <Button disabled={!label.trim() || create.isPending} onClick={() => create.mutate()}>
            <Plus className="mr-1.5 size-4" /> Add card
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(badges.data ?? []).map((b) => (
          <Card key={b.id}>
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <BadgeIcon name={b.icon} className="size-5 text-primary" />
              <Input
                className="w-56"
                defaultValue={b.label}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== b.label) update.mutate({ id: b.id, patch: { label: value } });
                }}
              />
              <select
                value={b.icon}
                onChange={(e) => update.mutate({ id: b.id, patch: { icon: e.target.value } })}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Object.keys(BADGE_ICONS).map((k) => (
                  <option key={k} value={k}>
                    {k.replace(/-/g, " ")}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                className="w-20"
                defaultValue={Number(b.sort_order)}
                onBlur={(e) =>
                  update.mutate({ id: b.id, patch: { sort_order: Number(e.target.value) || 0 } })
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={b.active}
                  onCheckedChange={(v) => update.mutate({ id: b.id, patch: { active: v } })}
                />
                Visible
              </label>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(b.id)}>
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {badges.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No cards yet — add one above.</p>
        )}
      </div>
    </AdminShell>
  );
}
