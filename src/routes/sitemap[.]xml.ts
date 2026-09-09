import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getClientOrigin } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = getClientOrigin(request);

        const supabaseUrl =
          process.env["VITE_SUPABASE_URL"] ||
          process.env["SUPABASE_URL"] ||
          "https://placeholder.supabase.co";
        const supabaseKey =
          process.env["VITE_SUPABASE_ANON_KEY"] ||
          process.env["SUPABASE_ANON_KEY"] ||
          process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
          "placeholder-key";

        let products: any[] = [];
        try {
          if (supabaseUrl && !supabaseUrl.includes("placeholder")) {
            const supabase = createClient(supabaseUrl, supabaseKey);
            const { data } = await supabase
              .from("products")
              .select("id, name, image_url, updated_at, created_at, category")
              .eq("is_available", true);
            if (data) products = data;
          }
        } catch (e) {
          console.error("Error fetching products for dynamic sitemap:", e);
        }

        const now = new Date().toISOString();

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Core Storefront Pages -->
  <url>
    <loc>${origin}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${origin}/catalog</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${origin}/terms</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>${origin}/licence</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>

  <!-- Live Dynamic Product Pages with Google Image Sitemaps -->
  ${products
    .map((p) => {
      const pUrl = `${origin}/product/${p.id}`;
      const lastMod = p.updated_at || p.created_at || now;
      const cleanName = (p.name || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
      const cleanImg = (p.image_url || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const imageBlock = cleanImg
        ? `\n    <image:image>\n      <image:loc>${cleanImg}</image:loc>\n      <image:title>${cleanName}</image:title>\n    </image:image>`
        : "";
      return `<url>
    <loc>${pUrl}</loc>
    <lastmod>${new Date(lastMod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${imageBlock}
  </url>`;
    })
    .join("\n  ")}
</urlset>`;

        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
