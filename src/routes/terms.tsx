import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [{ title: "Terms and Conditions" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { data: settings } = useQuery(settingsQuery);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl py-12">
        <h1 className="mb-8 font-display text-3xl font-bold">Terms and Conditions</h1>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          {settings?.terms_and_conditions ? (
            <p className="whitespace-pre-wrap">{settings.terms_and_conditions}</p>
          ) : (
            <p>Our terms and conditions will be published here soon.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
