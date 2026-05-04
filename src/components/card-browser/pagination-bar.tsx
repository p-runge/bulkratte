"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { FormattedMessage } from "react-intl";

/** Build the list of page numbers (0-indexed) to show, inserting null for ellipsis gaps. */
export function buildPageWindow(
  page: number,
  totalPages: number,
): (number | null)[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const pages: (number | null)[] = [0];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages - 2, page + 2);
  if (start > 1) pages.push(null);
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 2) pages.push(null);
  pages.push(totalPages - 1);
  return pages;
}

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  const window = buildPageWindow(page, totalPages);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div />
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page > 0) onPageChange(page - 1);
              }}
              aria-disabled={page === 0}
              className={page === 0 ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>

          {window.map((p, i) =>
            p === null ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(p);
                  }}
                >
                  {p + 1}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages - 1) onPageChange(page + 1);
              }}
              aria-disabled={page >= totalPages - 1}
              className={
                page >= totalPages - 1 ? "pointer-events-none opacity-50" : ""
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <span className="text-sm text-muted-foreground tabular-nums text-right">
        <FormattedMessage
          id="card.browser.pagination.range"
          defaultMessage="{from}–{to} of {total} cards"
          values={{ from, to, total }}
        />
      </span>
    </div>
  );
}
