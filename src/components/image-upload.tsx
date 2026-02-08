import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";
import { useState, useRef } from "react";
import { useIntl } from "react-intl";

/**
 * Scale an image file to a maximum dimension while maintaining aspect ratio
 */
function scaleImage(file: File, maxDimension: number = 100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Scale down if either dimension is larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Convert to base64
        const base64 = canvas.toDataURL(file.type);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Hook for managing image upload with preview and scaling
 */
export function useImageUpload(initialImage?: string | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialImage ?? null,
  );
  const [image, setImage] = useState<string | undefined>(
    initialImage || undefined,
  );

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64Image = await scaleImage(file);
      setImage(base64Image);
      setImagePreview(base64Image);
      return base64Image;
    } catch (error) {
      console.error("Error processing image:", error);
      throw error;
    }
  };

  const handleRemoveImage = () => {
    setImage(undefined);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return {
    fileInputRef,
    imagePreview,
    image,
    handleImageUpload,
    handleRemoveImage,
  };
}

interface ImageUploadProps {
  imagePreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export function ImageUpload({
  imagePreview,
  fileInputRef,
  onImageUpload,
  onRemoveImage,
}: ImageUploadProps) {
  const intl = useIntl();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {intl.formatMessage({
          id: "form.field.image.label",
          defaultMessage: "Set Image (optional)",
        })}
      </label>
      <div className="flex items-center gap-4">
        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt={intl.formatMessage({
                id: "form.field.image.preview.alt",
                defaultMessage: "Set preview",
              })}
              className="w-16 h-16 object-contain rounded border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={onRemoveImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
            <Upload className="h-6 w-6" />
          </div>
        )}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            className="hidden"
            id="image-upload"
          />
          <label htmlFor="image-upload">
            <Button type="button" variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                {intl.formatMessage({
                  id: "form.field.image.upload",
                  defaultMessage: "Upload Image",
                })}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            {intl.formatMessage({
              id: "form.field.image.description",
              defaultMessage:
                "Images will be automatically scaled to max 100px",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
