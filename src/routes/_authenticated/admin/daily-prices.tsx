import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/daily-prices")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/price-board" });
  },
});
