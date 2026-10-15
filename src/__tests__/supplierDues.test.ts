import { describe, it, expect } from "vitest";
import { supplierBalances } from "@/lib/supplierDues";

const row = (t: string, amount: number, due: string | null = null) => ({ supplier_name: "Kasimedu", supplier_phone: "9843061919", entry_type: t, amount, due_date: due, created_at: "" });

describe("supplier dues", () => {
  it("balance is bills minus payments", () => {
    const [b] = supplierBalances([row("bill", 15000, "2026-10-20"), row("payment", 10800)], "2026-10-15");
    expect(b!.balance).toBe(4200);
    expect(b!.status).toBe("open");
  });
  it("flags overdue after due date", () => {
    expect(supplierBalances([row("bill", 5000, "2026-10-10")], "2026-10-15")[0]!.status).toBe("overdue");
  });
  it("due within 3 days is due soon", () => {
    expect(supplierBalances([row("bill", 5000, "2026-10-17")], "2026-10-15")[0]!.status).toBe("due_soon");
  });
  it("fully paid is settled", () => {
    expect(supplierBalances([row("bill", 5000, "2026-10-10"), row("payment", 5000)], "2026-10-15")[0]!.status).toBe("settled");
  });
});
