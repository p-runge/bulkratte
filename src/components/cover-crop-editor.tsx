"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCallback, useRef, useState } from "react";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { useIntl } from "react-intl";

export type CoverCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const CARD_ASPECT = 245 / 337;

function defaultCrop(width: number, height: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, CARD_ASPECT, width, height),
    width,
    height,
  );
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
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>(
    undefined,
  );

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth: nW, naturalHeight: nH } = e.currentTarget;

      if (initialCrop) {
        // Convert stored natural-px crop → percentage crop for react-image-crop
        setCrop({
          unit: "%",
          x: (initialCrop.x / nW) * 100,
          y: (initialCrop.y / nH) * 100,
          width: (initialCrop.width / nW) * 100,
          height: (initialCrop.height / nH) * 100,
        });
      } else {
        setCrop(defaultCrop(nW, nH));
      }
    },
    [initialCrop],
  );

  const handleSave = () => {
    const img = imgRef.current;
    if (!img || !crop) return;

    const { naturalWidth: nW, naturalHeight: nH } = img;

    if (completedCrop) {
      // User interacted — use pixel crop from onComplete (display px → natural px)
      const { width: displayW, height: displayH } = img.getBoundingClientRect();
      const scaleX = nW / displayW;
      const scaleY = nH / displayH;
      onSave({
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY,
      });
    } else if (crop.unit === "%") {
      // Initial crop loaded but not interacted with — convert % → natural px
      onSave({
        x: (crop.x / 100) * nW,
        y: (crop.y / 100) * nH,
        width: (crop.width / 100) * nW,
        height: (crop.height / 100) * nH,
      });
    }
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

        <div className="flex justify-center max-h-[60vh] overflow-auto">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={CARD_ASPECT}
            className="max-w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
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
