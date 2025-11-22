import { DevTool } from '@hookform/devtools'
import { zodResolver } from '@hookform/resolvers/zod'
import React, { useCallback, useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import type z from 'zod'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type {
  FieldValues,
  Path,
  SubmitHandler,
  UseFormProps,
  UseFormReturn,
} from 'react-hook-form'
import { cn } from '../utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRHFForm<T extends z.ZodObject<any>>(
  schema: T,
  options?: UseFormProps<z.infer<T> & FieldValues>,
) {
  return useForm<z.infer<T> & FieldValues>({
    // zodResolver expects the schema input to be assignable to FieldValues;
    // cast to any here to satisfy the resolver overload while keeping external types unchanged.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    ...options,
  })
}

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'>;

export function RHFForm<T extends FieldValues>({
  form,
  onSubmit,
  children,
  className,
  ...props
}: Props<T>) {
  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (form.formState.isDirty) {
      /**
       * Preventing the default behavior in the "beforeunload" event triggers a native
       * browser prompt asking the user to confirm if they want to leave the page.
       */
      event.preventDefault()
    }
  }

  useEffect(() => {
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <form onSubmit={form.handleSubmit(onSubmit)} {...props}>
        <fieldset
          disabled={form.formState.isSubmitting}
          className={cn('w-full border-none p-0 m-0', className)}
        >
          {children}
        </fieldset>
      </form>
      <DevTool control={form.control} />
    </>
  )
}

/**
 * Hook to get a close handler that prompts the user before closing if there are unsaved changes.
 * This must be used in the parent component that controls whether the form is mounted.
 *
 * @example
 * const form = useRHFForm(schema)
 * const handleClose = useFormCloseHandler(form, onClose)
 * return <Dialog onClose={handleClose}>...</Dialog>
 */
export function useFormCloseHandler<T extends FieldValues>(
  form: UseFormReturn<T>,
  onClose: () => void,
) {
  const intl = useIntl()

  return useCallback(() => {
    if (form.formState.isDirty) {
      const confirmed = window.confirm(
        intl.formatMessage({
          id: 'form.unsavedChanges',
          defaultMessage:
            'You have unsaved changes. Are you sure you want to close?',
        }),
      )
      if (!confirmed) {
        return
      }
    }
    onClose()
  }, [form.formState.isDirty, intl, onClose])
}

type FormFieldProps<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: Path<T>
  description?: React.ReactNode;
}

export function FormField<T extends FieldValues>({ form, name, description }: FormFieldProps<T>) {
  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={field.name}>Name</FieldLabel>
          <Input {...field} id={field.name} aria-invalid={fieldState.invalid} />
          {description && <FieldDescription>{description}</FieldDescription>}
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : <p className='text-sm'>&nbsp;</p>}
        </Field>
      )}
    />
  )
}
