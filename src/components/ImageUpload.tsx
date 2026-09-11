import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadCloud, Loader2, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { compressImageFile } from "@/lib/imageOptimizer";

interface ImageUploadProps {
  onUpload: (url: string) => void;
  onRemove?: (() => void) | undefined;
  currentImage?: string | null | undefined;
  compact?: boolean | undefined;
  maxSizeMB?: number | undefined;
  label?: string | undefined;
}

export function ImageUpload({
  onUpload,
  onRemove,
  currentImage,
  compact = false,
  maxSizeMB = 0.2, // Default 200KB limit for products & banners
  label,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Compress to requested maximum size (0.2MB for products/banners, 0.5MB for logo)
      const compressedFile = await compressImageFile(file, maxSizeMB, 1200);

      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("images").getPublicUrl(filePath);

      onUpload(data.publicUrl);
      const kbSize = Math.round(compressedFile.size / 1024);
      toast.success(`Image uploaded & optimized (${kbSize} KB)`);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  if (compact) {
    return (
      <div className="relative size-16 sm:size-20 shrink-0 overflow-hidden rounded-2xl border border-border/80 bg-muted/40 group shadow-2xs">
        {currentImage ? (
          <img
            src={currentImage}
            alt="Product"
            className="size-full object-cover transition duration-200 group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
            }}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xl bg-muted text-muted-foreground">
            🐟
          </div>
        )}

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
          <Camera className="size-5" />
        </div>

        <div className="absolute bottom-1 right-1 rounded-full bg-black/70 p-1 text-white shadow-xs backdrop-blur-xs">
          {uploading ? (
            <Loader2 className="size-3 animate-spin text-amber-400" />
          ) : (
            <Camera className="size-3" />
          )}
        </div>

        <Input
          type="file"
          accept="image/*"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFileChange}
          disabled={uploading}
          title="Click to update photo"
        />
      </div>
    );
  }

  const maxKb = Math.round(maxSizeMB * 1024);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {currentImage && (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/40 shadow-2xs">
          <img
            src={currentImage}
            alt="Current preview"
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
            }}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Input 
            type="file" 
            accept="image/*" 
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button variant="outline" className="pointer-events-none rounded-xl text-xs font-semibold h-9" disabled={uploading}>
            {uploading ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <UploadCloud className="mr-1.5 size-3.5" />}
            {uploading ? "Compressing & Uploading..." : (label || "Upload Image")}
          </Button>
        </div>

        {onRemove && currentImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl h-9 text-xs text-destructive hover:bg-destructive/10 gap-1"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" /> Remove
          </Button>
        )}

        <span className="text-[10px] text-muted-foreground font-medium px-2 py-0.5 rounded-md bg-muted border border-border/50">
          Max {maxKb} KB auto-compressed
        </span>
      </div>
    </div>
  );
}
