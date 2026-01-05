"use client"

import { FormattedMessage } from 'react-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ComponentProps, MouseEvent, ReactNode, useState } from 'react'

type Props = ComponentProps<typeof Button> & {
  children: ReactNode
  title: string
  description: string
  destructive?: boolean
}

export default function ConfirmButton({
  children,
  title,
  description,
  destructive,
  onClick,
  ...buttonProps
}: Props) {
  const [open, setOpen] = useState(false)

  function handleClose() {
    setOpen(false)
  }

  function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    handleClose()
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
              <FormattedMessage
                id="confirm-button.cancel"
                defaultMessage="Cancel"
              />
            </Button>
            <Button
              onClick={handleConfirm}
              variant={destructive ? 'destructive' : 'default'}
            >
              <FormattedMessage
                id="confirm-button.confirm"
                defaultMessage="Confirm"
              />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
