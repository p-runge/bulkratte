"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComponentProps, MouseEvent, ReactNode, useState } from "react";
import { FormattedMessage } from "react-intl";

type Props = ComponentProps<typeof Button> & {
  children: ReactNode;
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

export default function ConfirmButton({
  children,
  title,
  description,
  cancelLabel,
  confirmLabel,
  destructive,
  onClick,
  ...buttonProps
}: Props) {
  const [open, setOpen] = useState(false);

  function handleClose() {
    setOpen(false);
  }

  function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
    handleClose();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} {...buttonProps}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={handleClose} variant="outline">
              {cancelLabel ?? (
                <FormattedMessage
                  id="confirm.button.cancel.label"
                  defaultMessage="Cancel"
                />
              )}
            </Button>
            <Button
              onClick={handleConfirm}
              variant={destructive ? "destructive" : "default"}
            >
              {confirmLabel ?? (
                <FormattedMessage
                  id="confirm.button.confirm.label"
                  defaultMessage="Confirm"
                />
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
