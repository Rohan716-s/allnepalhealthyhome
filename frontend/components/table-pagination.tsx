"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= pageSize) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const visiblePages = pages.length <= 7
    ? pages
    : Array.from(new Set([1, Math.max(1, page - 1), page, Math.min(totalPages, page + 1), totalPages])).sort((a, b) => a - b);

  return (
    <nav
      aria-label="Table pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"
    >
      <p className="text-xs font-semibold text-slate-500">
        Showing {first}–{last} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={15} /> Previous
        </Button>
        {visiblePages.map((number, index) => {
          const previous = visiblePages[index - 1];
          return (
            <span key={number} className="flex items-center gap-1">
              {previous && number - previous > 1 && <span className="px-1 text-slate-400">…</span>}
              <Button
                type="button"
                variant={number === page ? "default" : "outline"}
                size="sm"
                aria-label={`Go to page ${number}`}
                aria-current={number === page ? "page" : undefined}
                onClick={() => onPageChange(number)}
              >
                {number}
              </Button>
            </span>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight size={15} />
        </Button>
      </div>
    </nav>
  );
}
