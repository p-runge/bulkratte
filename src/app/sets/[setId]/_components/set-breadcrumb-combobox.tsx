"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useIntl } from "react-intl";

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
import type { Set } from "@/lib/db";
import { cn } from "@/lib/utils";

type SetBreadcrumbComboboxProps = {
  sets: Set[];
  currentSetId: string;
};

export function SetBreadcrumbCombobox({
  sets,
  currentSetId,
}: SetBreadcrumbComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const intl = useIntl();

  const currentSet = sets.find((s) => s.id === currentSetId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="link"
          role="combobox"
          aria-expanded={open}
          className="h-auto gap-1 p-0!"
        >
          {currentSet?.name}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput
            placeholder={intl.formatMessage({
              id: "page.set.breadcrumb.search",
              defaultMessage: "Search sets...",
            })}
          />
          <CommandList>
            <CommandEmpty>
              {intl.formatMessage({
                id: "page.set.breadcrumb.empty",
                defaultMessage: "No sets found",
              })}
            </CommandEmpty>
            <CommandGroup>
              {sets.map((set) => (
                <CommandItem
                  key={set.id}
                  value={set.name}
                  onSelect={() => {
                    router.push(`/sets/${set.id}`);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentSetId === set.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {set.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
