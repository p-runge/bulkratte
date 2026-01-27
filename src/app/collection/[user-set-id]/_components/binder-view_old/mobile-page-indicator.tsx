import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MobilePageIndicatorProps {
  currentPage: number;
  totalPages: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function MobilePageIndicator({
  currentPage,
  totalPages,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: MobilePageIndicatorProps) {
  return (
    <div className="flex md:hidden justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrev}
        disabled={!canGoPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-muted-foreground self-center">
        {currentPage + 1} / {totalPages + 1}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onNext}
        disabled={!canGoNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
