import { Button } from "@/components/ui/button";
import { ImagePlus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";

const MAX_PHOTO_BYTES = 200 * 1024; // 200 KB as string length

/**
 * Scale an image file to fit within a max byte length, reducing quality as needed.
 */
function scaleImageToSize(
  file: File,
  maxLength: number = MAX_PHOTO_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const tryEncode = (dim: number, quality: number): string | null => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > dim || height > dim) {
            if (width > height) {
              height = Math.round((height / width) * dim);
              width = dim;
            } else {
              width = Math.round((width / height) * dim);
              height = dim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return null;
          ctx.drawImage(img, 0, 0, width, height);
          return canvas.toDataURL("image/jpeg", quality);
        };

        const dims = [1200, 800, 400, 200];
        const qualities = [0.9, 0.7, 0.5, 0.3, 0.1];

        for (const dim of dims) {
          for (const q of qualities) {
            const result = tryEncode(dim, q);
            if (result && result.length <= maxLength) {
              resolve(result);
              return;
            }
          }
        }

        reject(new Error("Image could not be compressed to fit within 200 KB"));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Hook for managing multiple photo uploads with preview and compression.
 */
export function useMultiPhotoUpload(initialPhotos?: string[] | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(initialPhotos ?? []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const encoded = await Promise.all(
        files.map((file) => scaleImageToSize(file)),
      );
      setPhotos((prev) => [...prev, ...encoded]);
    } catch {
      setError("One or more images could not be compressed to fit within 200 KB.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  return {
    fileInputRef,
    photos,
    isProcessing,
    error,
    handleAddPhotos,
    handleRemovePhoto,
  };
}

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

interface MultiPhotoUploadProps {
  photos: string[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isProcessing?: boolean;
  error?: string | null;
  onAddPhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
}

export function MultiPhotoUpload({
  photos,
  fileInputRef,
  isProcessing,
  error,
  onAddPhotos,
  onRemovePhoto,
}: MultiPhotoUploadProps) {
  const intl = useIntl();

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((src, index) => (
          <div key={index} className="relative">
            <img
              src={src}
              alt={intl.formatMessage(
                {
                  id: "form.field.photos.preview.alt",
                  defaultMessage: "Photo {n}",
                },
                { n: index + 1 },
              )}
              className="w-20 h-20 object-cover rounded border"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={() => onRemovePhoto(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onAddPhotos}
            className="hidden"
            id="multi-photo-upload"
          />
          <label htmlFor="multi-photo-upload">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="w-20 h-20 border-dashed"
              asChild
              disabled={isProcessing}
            >
              <span>
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </span>
            </Button>
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        {intl.formatMessage({
          id: "form.field.photos.description",
          defaultMessage: "Photos are automatically compressed to max 200 KB each.",
        })}
      </p>
    </div>
  );
}
