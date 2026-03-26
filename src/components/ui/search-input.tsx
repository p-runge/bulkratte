import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type SearchInputProps = Omit<React.ComponentProps<"input">, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export function SearchInput({
  value,
  onChange,
  className,
  ...props
}: SearchInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hasValue = value.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onChange("");
      props.onKeyDown?.(e);
    } else {
      props.onKeyDown?.(e);
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        {...props}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="pr-8"
      />
      <button
        type="button"
        aria-label="Clear search"
        tabIndex={hasValue ? 0 : -1}
        onClick={() => {
          onChange("");
          inputRef.current?.focus();
        }}
        className={cn(
          "absolute right-2 flex items-center justify-center rounded-sm transition-opacity text-muted-foreground hover:text-foreground cursor-pointer",
          hasValue ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
