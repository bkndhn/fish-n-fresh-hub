/**
 * Enterprise Multi-Tenant SEO Engine
 * Provides world-class, dynamic domain-aware search engine optimization,
 * structured JSON-LD (Schema.org) schemas, dynamic canonicalization, OpenGraph,
 * and Twitter Card generators that automatically adapt to any client domain.
 */

export interface StoreSeoInfo {
  storeName?: string | null | undefined;
  tagline?: string | null | undefined;
  description?: string | null | undefined;
  logoUrl?: string | null | undefined;
  defaultOgImage?: string | null | undefined;
  phone?: string | null | undefined;
  address?: string | null | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  openingTime?: string | null | undefined;
  closingTime?: string | null | undefined;
  customDomain?: string | null | undefined;
  googleVerification?: string | null | undefined;
  bingVerification?: string | null | undefined;
  vertical?: string | null | undefined;
}

export interface PageSeoOptions {
  title?: string | undefined;
  description?: string | undefined;
  keywords?: string[] | string | undefined;
  image?: string | null | undefined;
  pathname?: string | undefined;
  type?: "website" | "article" | "product" | undefined;
  noindex?: boolean | undefined;
  product?: {
    id: string;
    name: string;
    price: number;
    stock: number;
    unit: string;
    category?: string | null | undefined;
    image_url?: string | null | undefined;
    description?: string | null | undefined;
  } | undefined;
  breadcrumbs?: { name: string; path: string }[] | undefined;
  faqs?: { question: string; answer: string }[] | undefined;
}

/**
 * Dynamically resolves the active client's origin (protocol + domain)
 * Works client-side in browser or server-side during SSR.
 */
export function getClientOrigin(requestOrHeaders?: Request | Headers | null, configuredDomain?: string | null): string {
  // 1. If explicit custom domain is configured in store settings
  if (configuredDomain && configuredDomain.trim()) {
    let d = configuredDomain.trim();
    if (!d.startsWith("http://") && !d.startsWith("https://")) {
      d = `https://${d}`;
    }
    return d.replace(/\/+$/, "");
  }

  // 2. Client-side browser execution: always 100% exact to active domain
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  // 3. Server-side SSR execution with Request or Headers
  if (requestOrHeaders) {
    const headers = "headers" in requestOrHeaders ? requestOrHeaders.headers : requestOrHeaders;
    const forwardedHost = headers.get("x-forwarded-host");
    const host = forwardedHost || headers.get("host");
    const proto = headers.get("x-forwarded-proto") || "https";

    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }

  // 4. Default fallback
  return "https://fishnfresh.store";
}

/**
 * Builds clean canonical URL without tracking params (utm_*, fbclid, etc.)
 */
export function buildCanonicalUrl(pathname = "/", origin = ""): string {
  const base = origin || getClientOrigin();
  const cleanPath = pathname.split("?")[0]?.replace(/\/+$/, "") || "";
  return `${base}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}` || `${base}/`;
}

/**
 * Constructs standard TanStack Start meta and link tags for route head definitions
 */
export function buildRouteSeo({
  title,
  description,
  keywords,
  image,
  pathname = "/",
  type = "website",
  noindex = false,
  storeInfo = {},
  origin = "",
}: PageSeoOptions & { storeInfo?: StoreSeoInfo; origin?: string }) {
  const clientOrigin = origin || getClientOrigin(null, storeInfo.customDomain);
  const storeName = storeInfo.storeName || "Fish N Fresh Hub";
  const canonical = buildCanonicalUrl(pathname, clientOrigin);

  // Formatted page title: "Page Name | Store Name" or default
  const fullTitle = title
    ? title.includes(storeName)
      ? title
      : `${title} | ${storeName}`
    : `${storeName} — Premium Dock Fresh Catch & Farm Fresh Meat`;

  const metaDesc =
    description ||
    storeInfo.description ||
    "Kasimedu Harbour Catch & Fresh Farm Meat delivered in 35 minutes. 100% chemical-free, lab-tested, temperature-controlled ice pack delivery with live order PIN.";

  const ogImg =
    image ||
    storeInfo.defaultOgImage ||
    `${clientOrigin}/icons/icon-512.png`;

  const kwList = Array.isArray(keywords)
    ? keywords.join(", ")
    : keywords ||
      "fresh fish online, buy seafood chennai, vanjaram fish price, prawn home delivery, kasimedu fresh fish, mutton curry cuts, chemical free seafood";

  const meta: Array<{ name?: string; property?: string; content: string }> = [
    { name: "title", content: fullTitle },
    { name: "description", content: metaDesc },
    { name: "keywords", content: kwList },
    {
      name: "robots",
      content: noindex
        ? "noindex, nofollow"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    },
    {
      name: "googlebot",
      content: noindex
        ? "noindex, nofollow"
        : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    },
    // Open Graph / Facebook / WhatsApp / LinkedIn
    { property: "og:site_name", content: storeName },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: metaDesc },
    { property: "og:url", content: canonical },
    { property: "og:type", content: type },
    { property: "og:image", content: ogImg },
    { property: "og:image:alt", content: fullTitle },
    { property: "og:locale", content: "en_IN" },
    // Twitter Cards
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: metaDesc },
    { name: "twitter:image", content: ogImg },
    { name: "twitter:domain", content: clientOrigin.replace(/^https?:\/\//, "") },
  ];

  // Search console verifications
  if (storeInfo.googleVerification) {
    meta.push({ name: "google-site-verification", content: storeInfo.googleVerification });
  }
  if (storeInfo.bingVerification) {
    meta.push({ name: "msvalidate.01", content: storeInfo.bingVerification });
  }

  const links = [
    { rel: "canonical", href: canonical },
  ];

  return { meta, links };
}

/**
 * Builds Schema.org WebSite JSON-LD with Sitelinks SearchBox
 */
export function buildWebSiteSchema(storeInfo: StoreSeoInfo, origin = ""): Record<string, any> {
  const clientOrigin = origin || getClientOrigin(null, storeInfo.customDomain);
  const name = storeInfo.storeName || "Fish N Fresh";

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${clientOrigin}/#website`,
    url: clientOrigin,
    name: name,
    alternateName: [name, `${name} Hub`, `${name} Online`],
    description: storeInfo.description || "Fresh ocean catch & meat express delivery.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${clientOrigin}/catalog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: ["en-IN", "ta-IN"],
  };
}

/**
 * Builds Schema.org LocalBusiness / Store / FishStore JSON-LD
 */
export function buildLocalBusinessSchema(storeInfo: StoreSeoInfo, origin = ""): Record<string, any> {
  const clientOrigin = origin || getClientOrigin(null, storeInfo.customDomain);
  const name = storeInfo.storeName || "Fish N Fresh";

  // Map vertical to specific Schema.org LocalBusiness sub-type
  let businessType = "Store";
  if (storeInfo.vertical === "seafood") businessType = "FishStore";
  else if (storeInfo.vertical === "chicken_meat" || storeInfo.vertical === "all_meat") businessType = "ButcherShop";

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": businessType,
    "@id": `${clientOrigin}/#store`,
    name: name,
    image: storeInfo.logoUrl || `${clientOrigin}/icons/icon-512.png`,
    url: clientOrigin,
    telephone: storeInfo.phone || "+919876543210",
    priceRange: "₹₹",
    currenciesAccepted: "INR",
    paymentAccepted: "Cash, UPI, Google Pay, PhonePe, Credit Card, Debit Card, Net Banking",
    hasMap: `https://maps.google.com/?q=${storeInfo.lat || 13.0827},${storeInfo.lng || 80.2707}`,
  };

  if (storeInfo.address) {
    schema["address"] = {
      "@type": "PostalAddress",
      streetAddress: storeInfo.address,
      addressLocality: "Chennai",
      addressRegion: "Tamil Nadu",
      postalCode: "600013",
      addressCountry: "IN",
    };
  }

  if (storeInfo.lat && storeInfo.lng) {
    schema["geo"] = {
      "@type": "GeoCoordinates",
      latitude: storeInfo.lat,
      longitude: storeInfo.lng,
    };
  }

  if (storeInfo.openingTime && storeInfo.closingTime) {
    schema["openingHoursSpecification"] = [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: storeInfo.openingTime,
        closes: storeInfo.closingTime,
      },
    ];
  }

  return schema;
}

/**
 * Builds Schema.org Product & Offer JSON-LD for individual product pages
 */
export function buildProductSchema(
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
    unit?: string | null | undefined;
    category?: string | null | undefined;
    image_url?: string | null | undefined;
    description?: string | null | undefined;
  },
  storeInfo: StoreSeoInfo,
  origin = ""
): Record<string, any> {
  const clientOrigin = origin || getClientOrigin(null, storeInfo.customDomain);
  const storeName = storeInfo.storeName || "Fish N Fresh";
  const productUrl = `${clientOrigin}/product/${product.id}`;

  const isAvailable = product.stock > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    image: product.image_url ? [product.image_url] : [`${clientOrigin}/placeholder.svg`],
    description:
      product.description ||
      `Fresh ${product.name} delivered hygienically cleaned and temperature controlled in 35 mins.`,
    sku: product.id,
    mpn: product.id,
    category: product.category || "Seafood",
    brand: {
      "@type": "Brand",
      name: storeName,
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: product.price,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
      itemCondition: "https://schema.org/NewCondition",
      availability: isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: storeName,
        url: clientOrigin,
      },
    },
  };
}

/**
 * Builds Schema.org BreadcrumbList JSON-LD
 */
export function buildBreadcrumbSchema(
  crumbs: { name: string; path: string }[],
  origin = ""
): Record<string, any> {
  const clientOrigin = origin || getClientOrigin();

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: c.name,
      item: c.path.startsWith("http") ? c.path : `${clientOrigin}${c.path.startsWith("/") ? c.path : `/${c.path}`}`,
    })),
  };
}

/**
 * Builds Schema.org FAQPage JSON-LD for rich expandable snippets in SERP
 */
export function buildFaqSchema(faqs: { question: string; answer: string }[]): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };
}
