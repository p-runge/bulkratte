import { Button } from "@/components/ui/button";
import { ImagePlus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";

async function uploadToR2(blob: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, filename);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Upload failed");
  const { key } = (await res.json()) as { key: string };
  return `/api/images/${key}`;
}

/**
 * Compress an image file to fit within maxBytes, reducing dimensions and
 * quality as needed. Returns a JPEG Blob.
 */
function compressImage(
  file: File,
  maxBytes: number = 200 * 1024,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const dims = [1200, 800, 400, 200];
        const qualities = [0.9, 0.7, 0.5, 0.3, 0.1];

        for (const dim of dims) {
          for (const q of qualities) {
            const canvas = document.createElement("canvas");
            let { width, height } = img;
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
            if (!ctx) continue;
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL("image/jpeg", q);
            if (dataUrl.length <= maxBytes) {
              canvas.toBlob(
                (blob) => {
                  if (blob) resolve(blob);
                  else reject(new Error("Canvas toBlob failed"));
                },
                "image/jpeg",
                q,
              );
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
 * Scale an image file to fit within maxDimension while maintaining aspect
 * ratio. Returns a Blob.
 */
function scaleImage(file: File, maxDimension: number = 100): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob failed"));
          },
          file.type,
          0.9,
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Hook for managing multiple photo uploads. Compresses each photo and uploads
 * it to R2, storing the resulting URLs in state.
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
      const urls = await Promise.all(
        files.map(async (file) => {
          const blob = await compressImage(file);
          return uploadToR2(blob, file.name);
        }),
      );
      setPhotos((prev) => [...prev, ...urls]);
    } catch {
      setError("One or more photos could not be uploaded. Please try again.");
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
 * Hook for managing a single image upload. Shows a local preview immediately
 * while uploading to R2 in the background. Returns the R2 URL via `image`.
 */
export function useImageUpload(initialImage?: string | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialImage ?? null,
  );
  const [image, setImage] = useState<string | undefined>(
    initialImage ?? undefined,
  );

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<string | undefined> => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    try {
      const blob = await scaleImage(file);
      const url = await uploadToR2(blob, file.name);
      setImage(url);
      return url;
    } catch (err) {
      setImagePreview(null);
      console.error("Error uploading image:", err);
      throw err;
    }
  };

  const handleRemoveImage = () => {
    setImage(undefined);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          defaultMessage:
            "Photos are automatically compressed to max 200 KB each.",
        })}
      </p>
    </div>
  );
}
