import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { TOGGLEABLE_PAGES, disabledPagesQuery, setPageDisabled } from "@/lib/pageVisibility";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  head: () => ({
    meta: [
      { title: "Pages & Modules — Admin" },
      { name: "description", content: "Turn app pages on or off for every role." },
      { property: "og:title", content: "Pages & Modules — Admin" },
      { property: "og:description", content: "Turn app pages on or off for every role." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagesAdmin,
});

function PagesAdmin() {
  const qc = useQueryClient();
  const { data: disabled = [] } = useQuery(disabledPagesQuery);
  const m = useMutation({
    mutationFn: ({ path, off }: { path: string; off: boolean }) => setPageDisabled(path, off),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["disabled_pages"] });
      toast.success(v.off ? "Page hidden for everyone" : "Page visible again");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save"),
  });

  return (
    <AdminShell title="Pages &amp; Modules" allow={["admin"]}>
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Pages & Modules</h1>
          <p className="text-sm text-muted-foreground">Switch off pages your business doesn't use. Hidden pages disappear from menus and are blocked for every role. Turn them back on anytime.</p>
        </div>
        {(["Storefront", "Admin"] as const).map((g) => (
          <Card key={g}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{g} pages</CardTitle></CardHeader>
            <CardContent className="divide-y divide-border">
              {TOGGLEABLE_PAGES.filter((p) => p.group === g).map((p) => {
                const on = !disabled.includes(p.path);
                return (
                  <label key={p.path} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{p.label}</span>
                      <span className="block text-xs text-muted-foreground">{p.path}</span>
                    </span>
                    <Switch checked={on} disabled={m.isPending} onCheckedChange={(v) => m.mutate({ path: p.path, off: !v })} />
                  </label>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
