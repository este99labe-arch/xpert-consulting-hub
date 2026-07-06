import { Skeleton } from "@/components/ui/skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

/** Esqueleto de carga estándar para tablas y listas (evita spinners a pantalla vacía). */
const TableSkeleton = ({ rows = 6, columns = 4 }: TableSkeletonProps) => (
  <div className="space-y-3 p-4" role="status" aria-label="Cargando datos">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-3">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={c} className={`h-4 ${c === 0 ? "w-1/4" : c === columns - 1 ? "w-16" : "flex-1"}`} />
        ))}
      </div>
    ))}
  </div>
);

export default TableSkeleton;
