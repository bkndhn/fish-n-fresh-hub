import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { settingsQuery } from "@/lib/queries";
import {
  buildWebSiteSchema,
  buildLocalBusinessSchema,
  buildProductSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  getClientOrigin,
  type StoreSeoInfo,
} from "@/lib/seo";

interface SeoStructuredDataProps {
  product?: {
    id: string;
    name: string;
    price: number;
    stock: number;
    unit?: string | null | undefined;
    category?: string | null | undefined;
    image_url?: string | null | undefined;
    description?: string | null | undefined;
  } | undefined;
  breadcrumbs?: { name: string; path: string }[] | undefined;
  faqs?: { question: string; answer: string }[] | undefined;
}

export function SeoStructuredData({ product, breadcrumbs, faqs }: SeoStructuredDataProps) {
  const { data: settings } = useQuery(settingsQuery);
  const s = settings as import("@/lib/types").SiteSettings | undefined;
  const [origin, setOrigin] = useState("");

  const customDomain = s?.custom_domain;

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(getClientOrigin(null, customDomain));
    }
  }, [customDomain]);

  const storeInfo: StoreSeoInfo = {
    storeName: s?.store_name || "Fish N Fresh Hub",
    description: s?.seo_default_description || "Kasimedu Dock Fresh Seafood & Premium Meat delivered in 35 mins.",
    logoUrl: s?.logo_url,
    phone: s?.support_phone || s?.whatsapp_number,
    address: s?.store_address,
    lat: s?.shop_lat ? Number(s.shop_lat) : undefined,
    lng: s?.shop_lng ? Number(s.shop_lng) : undefined,
    openingTime: s?.open_time,
    closingTime: s?.close_time,
    customDomain: s?.custom_domain,
    vertical: s?.business_vertical,
  };

  const schemas: Record<string, any>[] = [
    buildWebSiteSchema(storeInfo, origin),
    buildLocalBusinessSchema(storeInfo, origin),
  ];

  if (product) {
    schemas.push(buildProductSchema(product, storeInfo, origin));
  }

  if (breadcrumbs && breadcrumbs.length > 0) {
    schemas.push(buildBreadcrumbSchema(breadcrumbs, origin));
  }

  if (faqs && faqs.length > 0) {
    schemas.push(buildFaqSchema(faqs));
  }

  return (
    <>
      {schemas.map((schemaObj, idx) => (
        <script
          key={schemaObj["@id"] || schemaObj["@type"] || idx}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaObj).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--') }}
        />
      ))}
    </>
  );
}
