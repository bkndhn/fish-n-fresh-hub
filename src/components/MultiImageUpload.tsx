import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, X, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { compressImageFile, optimizeImageUrl } from "@/lib/imageOptimizer";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export function MultiImageUpload({
  urls,
  onChange,
  maxImages = 5,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (urls.length + files.length > maxImages) {
      toast.error(`You can only upload up to ${maxImages} images`);
      return;
    }

    setUploading(true);
    try {
      const newUrls = [...urls];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const compressedFile = await compressImageFile(file, 0.1, 1200);

        const fileExt = file.name.split(".").pop() || "jpg";
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(filePath, compressedFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from("images").getPublicUrl(filePath);
        newUrls.push(data.publicUrl);
      }

      onChange(newUrls);
      toast.success(`Successfully uploaded ${files.length} image(s)`);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
      // reset file input
      event.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newUrls = [...urls];
    newUrls.splice(index, 1);
    onChange(newUrls);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(urls);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onChange(items);
  };

  return (
    <div className="space-y-3">
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="gallery" direction="horizontal">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className="flex flex-wrap gap-3"
            >
              {urls.map((url, index) => (
                <Draggable key={url} draggableId={url} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="relative size-24 shrink-0 overflow-hidden rounded-xl border group"
                    >
                      <img
                        src={optimizeImageUrl(url, { width: 300, quality: 75 })}
                        alt={`Gallery ${index}`}
                        className="size-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div {...provided.dragHandleProps} className="absolute inset-0 flex items-center justify-center text-white/70 hover:text-white cursor-grab">
                          <GripVertical className="size-6" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); removeImage(index); }}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors z-10"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              
              {urls.length < maxImages && (
                <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-dashed hover:bg-muted/50 transition-colors flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    {uploading ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
                    <span className="text-[10px] font-medium">{urls.length}/{maxImages}</span>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </div>
              )}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
