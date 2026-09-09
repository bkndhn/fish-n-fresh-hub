/**
 * Multi-Client White-Label Tenant Engine.
 *
 * Enables running one central codebase across multiple clients, domains,
 * and independent Supabase backend accounts without disturbing existing operations.
 */

export interface TenantInfo {
  tenantId: string;
  clientName: string;
  domain: string;
  supabaseHost: string;
  isCustomBackend: boolean;
  defaultVertical: "seafood" | "chicken_meat" | "all_meat";
  themeColor?: string;
}

/**
 * Extract connected Supabase host for connection diagnostics.
 */
export function getConnectedSupabaseHost(): { host: string; isConfigured: boolean } {
  try {
    const url = import.meta.env['VITE_SUPABASE_URL'] || (typeof process !== "undefined" ? process.env?.['SUPABASE_URL'] : undefined);
    if (!url) {
      return { host: "cloud.supabase.co (default)", isConfigured: true };
    }
    const parsed = new URL(url);
    return { host: parsed.host, isConfigured: true };
  } catch {
    return { host: "cloud.supabase.co", isConfigured: true };
  }
}

/**
 * Returns current tenant profile resolved from environment or window location.
 */
export function getCurrentTenant(): TenantInfo {
  const envName = import.meta.env['VITE_STORE_NAME'];
  const envVertical = import.meta.env['VITE_DEFAULT_VERTICAL'];
  const { host } = getConnectedSupabaseHost();

  let domain = "localhost";
  if (typeof window !== "undefined") {
    domain = window.location.hostname;
  }

  const defaultVertical = (envVertical as any) || "seafood";
  const clientName = envName || "Fish N Fresh Hub";
  const isCustomBackend = Boolean(import.meta.env['VITE_SUPABASE_URL']);

  return {
    tenantId: domain.replace(/\./g, "_"),
    clientName,
    domain,
    supabaseHost: host,
    isCustomBackend,
    defaultVertical,
  };
}

/**
 * Presets for onboarding new business verticals in 1 click.
 */
export const MULTI_CLIENT_PRESETS = [
  {
    id: "seafood_hub",
    title: "Coastal Seafood & Fresh Fish Chain",
    vertical: "seafood",
    recommendedDomain: "e.g. www.oceanfresh.in",
    sampleCategories: "Sea Fish, Freshwater Fish, Prawns & Crabs, Shellfish",
  },
  {
    id: "poultry_meat",
    title: "Farm Chicken & Halal Mutton Outlets",
    vertical: "chicken_meat",
    recommendedDomain: "e.g. www.tenderchicken.com",
    sampleCategories: "Farm Fresh Chicken, Country Chicken (Nattu Kozhi), Mutton & Goat, Eggs",
  },
  {
    id: "all_meat_superstore",
    title: "Multi-Meat & Protein Superstore",
    vertical: "all_meat",
    recommendedDomain: "e.g. www.meatandfishhub.com",
    sampleCategories: "Daily Fish, Farm Chicken, Tender Mutton, Duck, Seafood",
  },
  {
    id: "organic_veggies",
    title: "Farm-to-Table Fresh Vegetables & Greens",
    vertical: "seafood", // can use base with custom categories
    recommendedDomain: "e.g. www.dailygreens.in",
    sampleCategories: "Daily Veggies, Organic Greens, Root Crops, Hydroponic Salads",
  },
];
