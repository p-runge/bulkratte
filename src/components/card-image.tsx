"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CARD_BORDER_RADIUS } from "@/lib/card-config";
import Image from "next/image";

type CardImageDialogProps = {
  large: string;
  alt: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CardImageDialog({
  large,
  alt,
  open,
  onOpenChange,
}: CardImageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-screen h-screen flex items-center justify-center bg-black/50 p-0 sm:max-w-none border-none"
        style={{ borderRadius: 0 }}
        onClick={(e) => {
          // Close when clicking outside the image
          if (e.target === e.currentTarget) {
            onOpenChange(false);
          }
        }}
      >
        <DialogTitle className="sr-only">Big image</DialogTitle>
        <Image
          src={large}
          alt={alt}
          width={600}
          height={825}
          unoptimized
          className="w-auto h-auto object-contain"
          style={{ borderRadius: CARD_BORDER_RADIUS }}
          draggable={false}
          priority
        />
      </DialogContent>
    </Dialog>
  );
}
