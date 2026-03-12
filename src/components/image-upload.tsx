import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/react";
import imageCompression from "browser-image-compression";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";

/**
 * Hook for managing multiple photo uploads. Compresses each photo with
 * browser-image-compression and uploads to R2 via a presigned PUT URL,
 * storing the resulting proxy URLs in state.
 */
export function useMultiPhotoUpload(initialPhotos?: string[] | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>(initialPhotos ?? []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: createPresignedUploadUrl } =
    api.upload.createPresignedUploadUrl.useMutation();

  const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const urls = await Promise.all(
        files.map(async (file) => {
          const compressed = await imageCompression(file, {
            maxSizeMB: 0.2,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
            fileType: "image/jpeg",
          });
          const { uploadUrl, key } = await createPresignedUploadUrl({
            filename: compressed.name,
            contentType: compressed.type,
          });
          await fetch(uploadUrl, {
            method: "PUT",
            body: compressed,
            headers: { "Content-Type": compressed.type },
          });
          return `/api/images/${key}`;
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
 * Hook for managing a single image upload. Shows a local object URL
 * immediately for instant feedback, then replaces it with the R2 proxy URL
 * once the upload completes. Returns `isUploading` to drive loading UI.
 */
export function useImageUpload(initialImage?: string | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    initialImage ?? null,
  );
  const [image, setImage] = useState<string | undefined>(
    initialImage ?? undefined,
  );
  const [isUploading, setIsUploading] = useState(false);

  const { mutateAsync: createPresignedUploadUrl } =
    api.upload.createPresignedUploadUrl.useMutation();

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<string | undefined> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 100,
        useWebWorker: true,
        fileType: "image/jpeg",
      });
      const { uploadUrl, key } = await createPresignedUploadUrl({
        filename: compressed.name,
        contentType: compressed.type,
      });
      await fetch(uploadUrl, {
        method: "PUT",
        body: compressed,
        headers: { "Content-Type": compressed.type },
      });
      const url = `/api/images/${key}`;
      setImage(url);
      setImagePreview(url);
      return url;
    } catch (err) {
      setImagePreview(null);
      console.error("Error uploading image:", err);
      throw err;
    } finally {
      setIsUploading(false);
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
    isUploading,
    handleImageUpload,
    handleRemoveImage,
  };
}

interface ImageUploadProps {
  imagePreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading?: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export function ImageUpload({
  imagePreview,
  fileInputRef,
  isUploading,
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
            <Image
              src={imagePreview}
              alt={intl.formatMessage({
                id: "form.field.image.preview.alt",
                defaultMessage: "Set preview",
              })}
              width={64}
              height={64}
              unoptimized
              className="w-16 h-16 object-contain rounded border"
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded bg-background/60">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!isUploading && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={onRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="w-16 h-16 border-2 border-dashed rounded flex items-center justify-center text-muted-foreground">
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Upload className="h-6 w-6" />
            )}
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
            disabled={isUploading}
          />
          <label htmlFor="image-upload">
            <Button
              type="button"
              variant="outline"
              asChild
              disabled={isUploading}
            >
              <span>
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {intl.formatMessage({
                  id: "form.field.image.upload",
                  defaultMessage: "Upload Image",
                })}
              </span>
            </Button>
          </label>
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
            <Image
              src={src}
              alt={intl.formatMessage(
                {
                  id: "form.field.photos.preview.alt",
                  defaultMessage: "Photo {n}",
                },
                { n: index + 1 },
              )}
              width={80}
              height={80}
              unoptimized
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
            disabled={isProcessing}
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
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
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
