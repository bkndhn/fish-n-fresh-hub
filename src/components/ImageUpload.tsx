import { useState } from "react";
import imageCompression from "browser-image-compression";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadCloud, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  onUpload: (url: string) => void;
  currentImage?: string | null;
  compact?: boolean;
}

export function ImageUpload({ onUpload, currentImage, compact = false }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Compress to max 200kb
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      
      const compressedFile = await imageCompression(file, options);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      
      onUpload(data.publicUrl);
      toast.success("Image updated successfully");
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

  return (
    <div className="flex items-center gap-4">
      {currentImage && (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/40">
          <img
            src={currentImage}
            alt="Current"
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=800";
            }}
          />
        </div>
      )}
      <div className="relative">
        <Input 
          type="file" 
          accept="image/*" 
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <Button variant="outline" className="pointer-events-none rounded-xl" disabled={uploading}>
          {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UploadCloud className="mr-2 size-4" />}
          {uploading ? "Uploading..." : "Upload Image"}
        </Button>
      </div>
    </div>
  );
}
