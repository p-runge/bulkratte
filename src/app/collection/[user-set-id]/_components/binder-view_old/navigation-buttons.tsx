import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface NavigationButtonsProps {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function NavigationButtons({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: NavigationButtonsProps) {
  return (
    <>
      {canGoPrev && (
        <Button
          variant="outline"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          onClick={onPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}
      {canGoNext && (
        <Button
          variant="outline"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden md:flex"
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}
