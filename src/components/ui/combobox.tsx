"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
      // Stay open to allow multi-select
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between bg-background font-normal",
            props.multi ? "w-full min-h-10 h-auto items-start py-1.5" : "w-max",
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
          {props.multi ? (
            /* Multi: chip display */
            <span className="flex flex-wrap gap-1 flex-1 items-center min-w-0">
              {props.value.length > 0 ? (
                props.value.map((v) => {
                  const label = options.find((o) => o.value === v)?.label ?? v;
                  return (
                    <Badge
                      key={v}
                      variant="secondary"
                      className="text-xs font-normal gap-1 pr-1 max-w-full"
                    >
                      <span className="truncate">{label}</span>
                      <span
                        role="button"
                        aria-label={`Remove ${label}`}
                        className="rounded opacity-60 hover:opacity-100 cursor-pointer shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onValueChange(
                            props.value.filter((x) => x !== v),
                          );
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </Badge>
                  );
                })
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </span>
          ) : (
            /* Single: invisible sizing trick */
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
                {options.find((o) => o.value === props.value)?.label ??
                  placeholder}
              </span>
            </span>
          )}

          <span className="flex items-center gap-0.5 ml-1 shrink-0 self-center">
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
