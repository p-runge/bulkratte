import {
  CoverCropEditor,
  type CoverCrop,
} from "@/components/cover-crop-editor";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/react";
import imageCompression from "browser-image-compression";
import { Crop, ImagePlus, Star, Upload, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { useIntl } from "react-intl";

async function toBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

type PendingPhoto = { preview: string; file: File };

/**
 * Hook for managing multiple photo uploads. Files are stored locally until
 * `uploadPending()` is called (e.g. on form submit), at which point they are
 * compressed and uploaded to R2.
 */
export function useMultiPhotoUpload(
  initialPhotos?: string[] | null,
  initialCoverPhotoUrl?: string | null,
  initialCoverCrop?: CoverCrop | null,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploaded, setUploaded] = useState<string[]>(initialPhotos ?? []);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [coverIndex, setCoverIndex] = useState<number | null>(() => {
    if (initialCoverPhotoUrl && initialPhotos) {
      const idx = initialPhotos.indexOf(initialCoverPhotoUrl);
      return idx >= 0 ? idx : null;
    }
    return null;
  });
  const [coverCrop, setCoverCrop] = useState<CoverCrop | null>(
    initialCoverCrop ?? null,
  );

  const { mutateAsync: uploadFile } = api.upload.uploadFile.useMutation();

  const photos = [...uploaded, ...pending.map((p) => p.preview)];

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPending((prev) => [
      ...prev,
      ...files.map((file) => ({ file, preview: URL.createObjectURL(file) })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePhoto = (index: number) => {
    setCoverIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) {
        setCoverCrop(null);
        return null;
      }
      if (index < prev) return prev - 1;
      return prev;
    });

    if (index < uploaded.length) {
      setUploaded((prev) => prev.filter((_, i) => i !== index));
    } else {
      const pendingIndex = index - uploaded.length;
      setPending((prev) => {
        URL.revokeObjectURL(prev[pendingIndex]!.preview);
        return prev.filter((_, i) => i !== pendingIndex);
      });
    }
  };

  const handleSetCover = (index: number) => {
    const isDeselecting = coverIndex === index;
    setCoverIndex(isDeselecting ? null : index);
    if (isDeselecting) setCoverCrop(null);
  };

  const handleSetCoverCrop = (crop: CoverCrop | null) => {
    setCoverCrop(crop);
  };

  /** Upload all pending files to R2. Returns photos, cover URL, and cover crop. */
  const uploadPending = async (): Promise<{
    photos: string[];
    coverPhotoUrl: string | null;
    coverCrop: CoverCrop | null;
  }> => {
    if (pending.length === 0) {
      const coverPhotoUrl =
        coverIndex !== null ? (uploaded[coverIndex] ?? null) : null;
      return { photos: uploaded, coverPhotoUrl, coverCrop };
    }
    const newUrls = await Promise.all(
      pending.map(async ({ file }) => {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          fileType: "image/jpeg",
        });
        const data = await toBase64(compressed);
        const { url } = await uploadFile({
          data,
          filename: compressed.name,
          contentType: compressed.type,
        });
        return url;
      }),
    );
    pending.forEach((p) => URL.revokeObjectURL(p.preview));
    const finalPhotos = [...uploaded, ...newUrls];
    setUploaded(finalPhotos);
    setPending([]);
    const coverPhotoUrl =
      coverIndex !== null ? (finalPhotos[coverIndex] ?? null) : null;
    return { photos: finalPhotos, coverPhotoUrl, coverCrop };
  };

  return {
    fileInputRef,
    photos,
    coverIndex,
    coverCrop,
    handleAddPhotos,
    handleRemovePhoto,
    handleSetCover,
    handleSetCoverCrop,
    uploadPending,
  };
}

/**
 * Hook for managing a single image upload. The selected file is stored locally
 * and shown as a preview. Call `upload()` on form submit to compress and upload
 * to R2, which returns the proxy URL.
 */
export function useImageUpload(initialImage?: string | null) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | undefined>(
    initialImage ?? undefined,
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  const { mutateAsync: uploadFile } = api.upload.uploadFile.useMutation();

  const imagePreview = pendingPreview ?? uploadedUrl ?? null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
  };

  /** Upload the pending file to R2. Returns the proxy URL (or the existing URL if nothing is pending). */
  const upload = async (): Promise<string | undefined> => {
    if (!pendingFile) return uploadedUrl;
    const compressed = await imageCompression(pendingFile, {
      maxSizeMB: 0.05,
      maxWidthOrHeight: 100,
      useWebWorker: true,
      fileType: "image/jpeg",
    });
    const data = await toBase64(compressed);
    const { url } = await uploadFile({
      data,
      filename: compressed.name,
      contentType: compressed.type,
    });
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setUploadedUrl(url);
    setPendingFile(null);
    setPendingPreview(null);
    return url;
  };

  const handleRemoveImage = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingFile(null);
    setPendingPreview(null);
    setUploadedUrl(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return {
    fileInputRef,
    imagePreview,
    handleImageUpload,
    upload,
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
        </div>
      </div>
    </div>
  );
}

interface MultiPhotoUploadProps {
  photos: string[];
  coverIndex: number | null;
  coverCrop: CoverCrop | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onAddPhotos: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onSetCover: (index: number) => void;
  onSetCoverCrop: (crop: CoverCrop | null) => void;
}

export function MultiPhotoUpload({
  photos,
  coverIndex,
  coverCrop,
  fileInputRef,
  onAddPhotos,
  onRemovePhoto,
  onSetCover,
  onSetCoverCrop,
}: MultiPhotoUploadProps) {
  const intl = useIntl();
  const [cropEditorOpen, setCropEditorOpen] = useState(false);

  const handleStarClick = (index: number) => {
    const isNewCover = coverIndex !== index;
    onSetCover(index);
    if (isNewCover) {
      setCropEditorOpen(true);
    }
  };

  const handleCropSave = (crop: CoverCrop) => {
    onSetCoverCrop(crop);
    setCropEditorOpen(false);
  };

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
              className={`w-20 h-20 object-cover rounded border-2 transition-colors ${
                coverIndex === index
                  ? "border-yellow-400"
                  : "border-transparent"
              }`}
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={() => onRemovePhoto(index)}
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant={coverIndex === index ? "default" : "secondary"}
              size="icon"
              className="absolute -bottom-2 -right-2 h-6 w-6"
              title={intl.formatMessage({
                id: "form.field.photos.set_cover",
                defaultMessage: "Set as cover",
              })}
              onClick={() => handleStarClick(index)}
            >
              <Star
                className="h-3 w-3"
                fill={coverIndex === index ? "currentColor" : "none"}
              />
            </Button>
            {coverIndex === index && (
              <Button
                type="button"
                variant={coverCrop ? "default" : "secondary"}
                size="icon"
                className="absolute -bottom-2 -left-2 h-6 w-6"
                title={intl.formatMessage({
                  id: "form.field.photos.crop_cover",
                  defaultMessage: "Crop cover photo",
                })}
                onClick={() => setCropEditorOpen(true)}
              >
                <Crop className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
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
            >
              <span>
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </span>
            </Button>
          </label>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {intl.formatMessage({
          id: "form.field.photos.description",
          defaultMessage:
            "Photos are automatically compressed to max 200 KB each.",
        })}
      </p>

      {cropEditorOpen && coverIndex !== null && photos[coverIndex] && (
        <CoverCropEditor
          photoUrl={photos[coverIndex]}
          initialCrop={coverCrop}
          onSave={handleCropSave}
          onClose={() => setCropEditorOpen(false)}
        />
      )}
    </div>
  );
}
