import { useState, useCallback } from "react";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface UseServerPaginationOptions {
  defaultPageSize?: number;
}

export function useServerPagination(options?: UseServerPaginationOptions) {
  const defaultSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultSize);
  const [totalItems, setTotalItems] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const rangeFrom = (safePage - 1) * pageSize;
  const rangeTo = rangeFrom + pageSize - 1;

  const startIndex = rangeFrom;
  const endIndex = Math.min(rangeFrom + pageSize, totalItems);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  const resetPage = useCallback(() => setCurrentPage(1), []);

  return {
    currentPage: safePage,
    pageSize,
    totalPages,
    totalItems,
    setTotalItems,
    setCurrentPage,
    setPageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    startIndex,
    endIndex,
    resetPage,
    rangeFrom,
    rangeTo,
  };
}
