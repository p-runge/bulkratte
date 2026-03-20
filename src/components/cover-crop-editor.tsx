"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCallback, useState } from "react";
import ReactCrop, {
  type PercentCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useIntl } from "react-intl";
import { CARD_ASPECT_RATIO, CARD_FRAME_INSET } from "@/lib/card-config";

/**
 * Crop coordinates as percentages (0–100) of the image's natural dimensions.
 * Using percentages makes the values display-independent (no DPR or zoom issues).
 */
export type CoverCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function defaultCrop(width: number, height: number): PercentCrop {
  return centerCrop(
    makeAspectCrop(
      { unit: "%", height: 100 - 2 * CARD_FRAME_INSET },
      CARD_ASPECT_RATIO,
      width,
      height,
    ),
    width,
    height,
  ) as PercentCrop;
}

interface CoverCropEditorProps {
  photoUrl: string;
  initialCrop?: CoverCrop | null;
  onSave: (crop: CoverCrop) => void;
  onClose: () => void;
}

export function CoverCropEditor({
  photoUrl,
  initialCrop,
  onSave,
  onClose,
}: CoverCropEditorProps) {
  const intl = useIntl();

  // Crop state is always kept as PercentCrop (unit: "%", values 0–100).
  // This avoids any display-pixel coordinate issues on mobile/high-DPR screens.
  const [crop, setCrop] = useState<PercentCrop | undefined>(
    initialCrop ? { unit: "%", ...initialCrop } : undefined,
  );

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      // Only set a default crop if there is no initial crop to restore
      if (!initialCrop) {
        const { naturalWidth: nW, naturalHeight: nH } = e.currentTarget;
        setCrop(defaultCrop(nW, nH));
      }
    },
    [initialCrop],
  );

  const handleSave = () => {
    if (!crop) return;
    // crop.x/y/width/height are already 0–100% — pass straight through
    onSave({ x: crop.x, y: crop.y, width: crop.width, height: crop.height });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {intl.formatMessage({
              id: "dialog.crop_cover.title",
              defaultMessage: "Crop Cover Photo",
            })}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {intl.formatMessage({
            id: "dialog.crop_cover.description",
            defaultMessage:
              "Drag the rectangle to frame the card. It will be shown in the binder view.",
          })}
        </p>

        <div className="flex justify-center overflow-hidden">
          <ReactCrop
            crop={crop}
            // Use the PercentCrop (second arg) so values are always image-relative percentages
            onChange={(_, pc) => setCrop(pc)}
            aspect={CARD_ASPECT_RATIO}
            className="max-w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={intl.formatMessage({
                id: "dialog.crop_cover.image.alt",
                defaultMessage: "Photo to crop",
              })}
              onLoad={handleImageLoad}
              className="max-w-full max-h-[55vh] object-contain"
            />
          </ReactCrop>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {intl.formatMessage({
              id: "common.button.cancel",
              defaultMessage: "Cancel",
            })}
          </Button>
          <Button onClick={handleSave} disabled={!crop}>
            {intl.formatMessage({
              id: "common.button.save",
              defaultMessage: "Save",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
