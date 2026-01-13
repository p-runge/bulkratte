"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface ProgressSegment {
  value: number;
  className?: string;
}

interface ProgressProps extends Omit<
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
  "value"
> {
  value?: number;
  segments?: ProgressSegment[];
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, segments, ...props }, ref) => {
  // Support both single value and multiple segments
  const hasSegments = segments && segments.length > 0;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
      {...props}
    >
      {hasSegments ? (
        // Multi-segment mode
        <div className="relative h-full w-full">
          {segments.map((segment, index) => (
            <div
              key={index}
              className={cn(
                "absolute top-0 left-0 h-full transition-all",
                segment.className || "bg-primary",
              )}
              style={{ width: `${segment.value || 0}%` }}
            />
          ))}
        </div>
      ) : (
        // Single value mode (backward compatible)
        <ProgressPrimitive.Indicator
          className="h-full w-full flex-1 bg-primary transition-all"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
export type { ProgressSegment };
