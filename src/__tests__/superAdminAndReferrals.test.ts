import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  INITIAL_PLATFORM_CLIENTS,
  onboardNewClient,
  toggleClientStatus,
  updateClientQuotas,
  forceLogoutClient,
  type PlatformClient,
} from "@/lib/superAdmin";
import { isReferralProgramActive } from "@/lib/types";
import { formatWhatsAppInvoiceText } from "@/lib/invoicePdf";

// Mock localStorage for vitest node environment
const storageMock: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = String(val);
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const k in storageMock) delete storageMock[k];
  },
});

describe("Super Admin Multi-Client Fleet Governance", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads initial platform clients with both active and inactive organizations", () => {
    expect(INITIAL_PLATFORM_CLIENTS.length).toBeGreaterThanOrEqual(5);

    const active = INITIAL_PLATFORM_CLIENTS.filter((c) => c.is_active);
    const inactive = INITIAL_PLATFORM_CLIENTS.filter((c) => !c.is_active);

    expect(active.length).toBeGreaterThanOrEqual(3);
    expect(inactive.length).toBeGreaterThanOrEqual(2);

    const flagship = INITIAL_PLATFORM_CLIENTS.find((c) => c.tenant_code === "FNF-MAIN");
    expect(flagship).toBeDefined();
    expect(flagship?.tier).toBe("enterprise");
    expect(flagship?.max_branches).toBe(15);
  });

  it("onboards a new client organization with auto-credentials and quotas", async () => {
    const res = await onboardNewClient({
      client_name: "Bay Catch Seafoods",
      tenant_code: "BAY-CATCH",
      owner_name: "Dinesh Varman",
      owner_email: "dinesh@baycatch.in",
      owner_phone: "+91 98455 66778",
      vertical: "seafood",
      tier: "growth",
      max_branches: 8,
      max_staff_per_branch: 15,
      max_monthly_orders: 20000,
    });

    expect(res.success).toBe(true);
    expect(res.client).toBeDefined();
    expect(res.client?.tenant_code).toBe("BAY-CATCH");
    expect(res.client?.is_active).toBe(true);
    expect(res.client?.is_locked).toBe(false);
    expect(res.credentials).toBeDefined();
    expect(res.credentials?.adminEmail).toBe("dinesh@baycatch.in");
    expect(res.credentials?.tempPassword).toMatch(/^FnF@/);
  });

  it("prevents onboarding duplicate tenant codes", async () => {
    const res = await onboardNewClient({
      client_name: "Duplicate Flagship",
      tenant_code: "FNF-MAIN",
      owner_name: "Imposter",
      owner_email: "imposter@fake.com",
      owner_phone: "+91 99999 99999",
      vertical: "seafood",
      tier: "starter",
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain("already in use");
  });

  it("toggles client status between active and suspended", async () => {
    const res = await toggleClientStatus("client-fnf-flagship", false);
    expect(res.success).toBe(true);

    const resumeRes = await toggleClientStatus("client-fnf-flagship", true);
    expect(resumeRes.success).toBe(true);
  });

  it("updates quota limits for a client", async () => {
    const res = await updateClientQuotas("client-tender-farms", {
      tier: "growth",
      max_branches: 10,
      max_staff_per_branch: 20,
      max_monthly_orders: 25000,
    });

    expect(res.success).toBe(true);
  });

  it("executes client-level force logout kill switch", async () => {
    const res = await forceLogoutClient(
      "client-ocean-catch",
      "Ocean Catch Coastal Marine",
      "OCEAN-CATCH",
      "Security compliance review"
    );

    expect(res.success).toBe(true);
    expect(res.message).toContain("broadcast sent");
  });
});

describe("Refer & Earn Customer Visibility Logic", () => {
  it("returns true when referral program is enabled", () => {
    expect(isReferralProgramActive({ wallet_enabled: true } as any)).toBe(true);
    expect(
      isReferralProgramActive({
        wallet_enabled: true,
        referral_program_enabled: true,
      } as any)
    ).toBe(true);
  });

  it("returns false when referral_program_enabled is explicitly set to false", () => {
    expect(
      isReferralProgramActive({
        wallet_enabled: true,
        referral_program_enabled: false,
      } as any)
    ).toBe(false);
  });

  it("returns false when wallet_enabled is set to false", () => {
    expect(
      isReferralProgramActive({
        wallet_enabled: false,
        referral_program_enabled: true,
      } as any)
    ).toBe(false);
  });
});

describe("WhatsApp Tax Invoice Formatting (Delivered Orders Only)", () => {
  const sampleOrder = {
    id: "ord-test-12345",
    order_number: "FNF-20260912-1001",
    customer_name: "Anand Swaminathan",
    customer_phone: "9840012345",
    status: "delivered",
    total: 1450,
    payment_method: "upi",
    payment_status: "paid",
    delivered_at: "2026-09-12T15:30:00Z",
    items: [
      { name: "Vanjaram / Seer Fish (Steaks)", qty: 1, unit: "kg", price: 1100 },
      { name: "Tiger Prawns (Cleaned)", qty: 1, unit: "500g", price: 350 },
    ],
  };

  const sampleSettings = {
    firm_name: "Fish N Fresh Seafood Hub",
    gstin: "33AAAAA0000A1Z5",
    fssai_license_no: "12423008000123",
    support_phone: "+91 98400 12345",
  };

  it("formats official GST invoice text for delivered orders", () => {
    const text = formatWhatsAppInvoiceText(sampleOrder, sampleSettings);

    expect(text).toContain("OFFICIAL GST TAX INVOICE");
    expect(text).toContain("FNF-20260912-1001");
    expect(text).toContain("Anand Swaminathan");
    expect(text).toContain("Vanjaram / Seer Fish");
    expect(text).toContain("33AAAAA0000A1Z5");
    expect(text).toContain("12423008000123");
    expect(text).toContain("Download Digital Tax Invoice (PDF)");
    expect(text).toContain("/orders?invoice=ord-test-12345");
  });
});
