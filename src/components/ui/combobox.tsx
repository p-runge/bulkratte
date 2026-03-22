"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxPropsBase = {
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
};

type ComboboxPropsSingle = ComboboxPropsBase & {
  multi?: false;
  value: string;
  onValueChange: (value: string) => void;
};

type ComboboxPropsMulti = ComboboxPropsBase & {
  multi: true;
  value: string[];
  onValueChange: (value: string[]) => void;
  /**
   * Plural noun shown in the "N {countLabel}" summary when ≥2 items are
   * selected (e.g. "sets", "rarities"). Defaults to "selected".
   */
  countLabel?: string;
};

export type ComboboxProps = ComboboxPropsSingle | ComboboxPropsMulti;

export function Combobox(props: ComboboxProps) {
  const {
    options,
    placeholder = "Select...",
    searchPlaceholder = "Search...",
    emptyMessage = "No results found.",
    className,
  } = props;

  const [open, setOpen] = React.useState(false);

  const isSelected = (optionValue: string) =>
    props.multi
      ? props.value.includes(optionValue)
      : optionValue === props.value;

  const hasSelections = props.multi ? props.value.length > 0 : !!props.value;

  const handleSelect = (optionValue: string) => {
    if (props.multi) {
      const next = props.value.includes(optionValue)
        ? props.value.filter((v) => v !== optionValue)
        : [...props.value, optionValue];
      props.onValueChange(next);
      // Stay open to allow further selection
    } else {
      props.onValueChange(optionValue === props.value ? "" : optionValue);
      setOpen(false);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (props.multi) {
      props.onValueChange([]);
    } else {
      props.onValueChange("");
    }
  };

  /** The visible label shown in the button trigger. */
  const visibleLabel = props.multi
    ? props.value.length === 0
      ? null
      : props.value.length === 1
        ? (options.find((o) => o.value === props.value[0])?.label ??
          props.value[0])
        : `${props.value.length} ${props.countLabel ?? "selected"}`
    : (options.find((o) => o.value === props.value)?.label ?? null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-max justify-between bg-background font-normal",
            hasSelections
              ? "hover:text-foreground"
              : "text-muted-foreground hover:text-muted-foreground",
            className,
          )}
          onKeyDown={(e) => {
            if (!open && (e.key === "Backspace" || e.key === "Delete")) {
              if (props.multi && props.value.length > 0) {
                e.preventDefault();
                props.onValueChange(props.value.slice(0, -1));
              } else if (!props.multi && props.value) {
                e.preventDefault();
                props.onValueChange("");
              }
            }
          }}
        >
          {/*
           * Invisible grid stack: placeholder + all option labels occupy the
           * same cell so the button always sizes to the widest one. The visible
           * text is layered on top in the same cell — no layout shift on change.
           */}
          <span className="grid items-center">
            <span
              aria-hidden
              className="invisible pointer-events-none col-start-1 row-start-1 select-none whitespace-nowrap"
            >
              {placeholder}
            </span>
            {options.map((o) => (
              <span
                key={o.value}
                aria-hidden
                className="invisible pointer-events-none col-start-1 row-start-1 select-none whitespace-nowrap"
              >
                {o.label}
              </span>
            ))}
            <span className="col-start-1 row-start-1 text-left">
              {visibleLabel ?? placeholder}
            </span>
          </span>

          <span className="flex items-center gap-0.5 ml-1 shrink-0">
            {hasSelections && (
              <span
                role="button"
                aria-label="Clear"
                className="rounded p-0.5 opacity-50 hover:opacity-100"
                onClick={clearAll}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      isSelected(option.value) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
