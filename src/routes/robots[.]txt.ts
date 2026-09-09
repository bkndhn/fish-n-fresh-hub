import { createFileRoute } from "@tanstack/react-router";
import { getClientOrigin } from "@/lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getClientOrigin(request);

        const content = `# Robots.txt for Multi-Client Store
# Auto-generated based on client domain: ${origin}

User-agent: *
Allow: /
Allow: /catalog
Allow: /product/
Allow: /terms
Allow: /licence
Disallow: /admin
Disallow: /admin/*
Disallow: /account
Disallow: /cart
Disallow: /checkout
Disallow: /api/
Disallow: /*?*utm_
Disallow: /*?*fbclid

# Disallow aggressive AI training scrapers from private portals
User-agent: GPTBot
Disallow: /admin
Disallow: /checkout

User-agent: CCBot
Disallow: /admin

# Point to dynamic client sitemap
Sitemap: ${origin}/sitemap.xml
`;

        return new Response(content, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      },
    },
  },
});
