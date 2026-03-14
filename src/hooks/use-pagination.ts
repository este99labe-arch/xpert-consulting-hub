import { useState, useMemo, useCallback } from "react";

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50];

interface UsePaginationOptions {
  defaultPageSize?: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  paginatedItems: T[];
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  pageSizeOptions: number[];
  startIndex: number;
  endIndex: number;
  resetPage: () => void;
}

export function usePagination<T>(
  items: T[],
  options?: UsePaginationOptions
): UsePaginationReturn<T> {
  const defaultSize = options?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(defaultSize);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page if items changed
  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  const paginatedItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [items, startIndex, endIndex]
  );

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
    paginatedItems,
    setCurrentPage,
    setPageSize,
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    startIndex,
    endIndex,
    resetPage,
  };
}
