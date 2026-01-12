import { useState, useEffect } from "react";

export const CARDS_PER_PAGE = 9; // 3x3 grid

interface UseBinderPaginationProps {
  totalItems: number;
}

export function useBinderPagination({ totalItems }: UseBinderPaginationProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const PAGES_VISIBLE = isMobile ? 1 : 2;

  // Calculate total content pages (without covers)
  const totalContentPages = Math.ceil(totalItems / CARDS_PER_PAGE);

  // Build pages array with cover pages on desktop
  const buildPagesArray = <T>(items: T[], fillValue: T): T[][] => {
    const pages: T[][] = [];

    // On desktop, add an empty first page so the first real page appears on the right
    if (!isMobile) {
      pages.push(Array(CARDS_PER_PAGE).fill(fillValue));
    }

    // Add content pages
    for (let i = 0; i < totalContentPages; i++) {
      const page = items.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE);
      // Pad to CARDS_PER_PAGE
      while (page.length < CARDS_PER_PAGE) {
        page.push(fillValue);
      }
      pages.push(page);
    }

    // On desktop, if we have an odd number of content pages, add one more empty page
    // to simulate the back side of a physical binder sheet
    if (!isMobile && totalContentPages % 2 === 1) {
      pages.push(Array(CARDS_PER_PAGE).fill(fillValue));
    }

    // On desktop, add an empty last page so the last real page appears on the left
    if (!isMobile) {
      pages.push(Array(CARDS_PER_PAGE).fill(fillValue));
    }

    return pages;
  };

  // Calculate if a page is a cover page
  const isCoverPage = (pageNumber: number, totalPages: number): boolean => {
    if (isMobile) return false;
    return pageNumber === 1 || pageNumber === totalPages;
  };

  // Get actual page number for display (excluding cover pages)
  const getDisplayPageNumber = (pageNumber: number): number => {
    return pageNumber - (isMobile ? 0 : 1);
  };

  // Navigation
  const getTotalPages = (pages: unknown[][]): number => pages.length;

  const getMaxPageGroup = (totalPages: number): number => {
    return Math.max(0, Math.ceil(totalPages / PAGES_VISIBLE) - 1);
  };

  const canGoNext = (totalPages: number): boolean => {
    const maxPageGroup = getMaxPageGroup(totalPages);
    return currentPage < maxPageGroup;
  };

  const canGoPrev = (): boolean => {
    return currentPage > 0;
  };

  const goNext = (totalPages: number) => {
    if (canGoNext(totalPages)) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const goPrev = () => {
    if (canGoPrev()) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Arrow key support
  const useKeyboardNavigation = (totalPages: number) => {
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goPrev();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          goNext(totalPages);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentPage, totalPages]);
  };

  // Swipe support
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0]!.clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0]!.clientX);
  };

  const onTouchEnd = (totalPages: number) => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && canGoNext(totalPages)) {
      goNext(totalPages);
    } else if (isRightSwipe && canGoPrev()) {
      goPrev();
    }
  };

  // Get visible pages
  const getVisiblePages = <T>(pages: T[][]): T[][] => {
    const startPageIndex = currentPage * PAGES_VISIBLE;
    return pages.slice(startPageIndex, startPageIndex + PAGES_VISIBLE);
  };

  const getStartPageIndex = (): number => {
    return currentPage * PAGES_VISIBLE;
  };

  return {
    // State
    currentPage,
    setCurrentPage,
    isMobile,
    PAGES_VISIBLE,

    // Methods
    buildPagesArray,
    isCoverPage,
    getDisplayPageNumber,
    getTotalPages,
    getMaxPageGroup,
    canGoNext,
    canGoPrev,
    goNext,
    goPrev,
    useKeyboardNavigation,
    getVisiblePages,
    getStartPageIndex,

    // Touch handlers
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
