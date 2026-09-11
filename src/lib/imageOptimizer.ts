import imageCompression from "browser-image-compression";

export interface OptimizeOptions {
  width?: number;
  quality?: number;
  format?: "webp" | "auto";
}

/**
 * Optimizes image URLs on-the-fly (Unsplash, Cloudinary, Supabase Storage)
 * to deliver lightweight modern WebP images under 200KB with retina clarity.
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  options: OptimizeOptions = {}
): string {
  if (!url) return "";

  const { width = 700, quality = 75, format = "webp" } = options;

  // Unsplash CDN dynamic optimization
  if (url.includes("images.unsplash.com")) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("auto", "format");
      parsed.searchParams.set("fit", "crop");
      parsed.searchParams.set("w", String(width));
      parsed.searchParams.set("q", String(quality));
      if (format === "webp") {
        parsed.searchParams.set("fm", "webp");
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  // Cloudinary dynamic optimization
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    const transform = `q_auto:eco,f_auto,w_${width},c_limit`;
    return url.replace("/upload/", `/upload/${transform}/`);
  }

  // Supabase Storage render optimization (if configured)
  if (url.includes("supabase.co/storage/v1/object/public/")) {
    try {
      const parsed = new URL(url);
      if (!parsed.searchParams.has("width")) {
        parsed.searchParams.set("width", String(width));
        parsed.searchParams.set("quality", String(quality));
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  return url;
}

/**
 * Compresses an image file before upload to meet strict size limits:
 * - Products and Banners: <= 200KB (maxSizeMB: 0.2)
 * - Brand Logo: <= 500KB (maxSizeMB: 0.5)
 */
export async function compressImageFile(
  file: File,
  maxSizeMB = 0.2,
  maxWidthOrHeight = 1200
): Promise<File> {
  // If file is already smaller than requested target, keep as is
  const targetBytes = maxSizeMB * 1024 * 1024;
  if (file.size <= targetBytes && file.type === "image/webp") {
    return file;
  }

  const compressionOptions = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    initialQuality: 0.8,
  };

  try {
    return await imageCompression(file, compressionOptions);
  } catch (err) {
    console.warn("Client image compression fallback:", err);
    return file;
  }
}
