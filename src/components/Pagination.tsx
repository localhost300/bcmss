
import React from "react";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: React.Dispatch<React.SetStateAction<number>>;
};

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) {
      return;
    }

    onPageChange(page);
  };
  const goToPrevious = () => goToPage(currentPage - 1);
  const goToNext = () => goToPage(currentPage + 1);

  const createPageList = () => {
    const pages: number[] = [];
    const windowSize = 2;
    const start = Math.max(1, currentPage - windowSize);
    const end = Math.min(totalPages, currentPage + windowSize);

    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (start > 1) {
      pages.unshift(1);
      if (start > 2) {
        pages.splice(1, 0, -1);
      }
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push(-2);
      }
      pages.push(totalPages);
    }

    return pages;
  };

  const pagesToRender = createPageList();
  return (
    <div className="flex items-center justify-center gap-3 py-4 text-sm">
      <button
        onClick={goToPrevious}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        Prev
      </button>

      <div className="flex items-center gap-1">
        {pagesToRender.map((page, index) => {
          if (page < 0) {
            return (
              <span key={`ellipsis-${page}-${index}`} className="px-2 text-gray-400">
                &hellip;
              </span>
            );
          }

          const isActive = page === currentPage;

          return (
            <button
              key={page}
              onClick={() => goToPage(page)}
              className={`px-3 py-1 rounded-md text-sm ${
                isActive
                  ? "bg-lamaPurple text-white"
                  : "text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          );
        })}
      </div>

      <button
        onClick={goToNext}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded-md border border-gray-200 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;

