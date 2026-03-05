"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
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

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
};

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-max justify-between bg-background font-normal",
            selectedLabel
              ? "hover:text-foreground"
              : "text-muted-foreground hover:text-muted-foreground",
            className,
          )}
          onKeyDown={(e) => {
            if (
              selectedLabel &&
              !open &&
              (e.key === "Backspace" || e.key === "Delete")
            ) {
              e.preventDefault();
              onValueChange("");
            }
          }}
        >
          {/* Invisible grid stack: all labels + placeholder occupy the same cell so the
              browser sizes the button to the widest one — like a native <select>. */}
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
              {selectedLabel ?? placeholder}
            </span>
          </span>
          <span className="flex items-center gap-0.5">
            {selectedLabel && (
              <span
                role="button"
                aria-label="Clear"
                className="rounded p-0.5 opacity-50 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  onValueChange("");
                }}
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
                  onSelect={() => {
                    onValueChange(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
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
