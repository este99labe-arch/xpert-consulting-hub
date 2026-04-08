import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, MoreVertical, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { JournalEntry, DeleteRequest } from "./types";
import PaginationControls from "@/components/shared/PaginationControls";
import { useServerPagination } from "@/hooks/use-server-pagination";

interface JournalEntriesTabProps {
  accountId: string;
  pendingDeleteRequests: DeleteRequest[];
  isManager: boolean;
  canEditEntry: (e: JournalEntry) => boolean;
  canDeleteEntry: (e: JournalEntry) => boolean;
  onCreateEntry: () => void;
  onEditEntry: (entry: JournalEntry) => void;
  onPostEntry: (entryId: string) => void;
  onDeleteEntry: (entry: JournalEntry) => void;
  onRequestDelete: (entry: JournalEntry) => void;
  onReviewDeleteRequest: (requestId: string, approved: boolean) => void;
  isReviewPending: boolean;
}

const JournalEntriesTab = ({
  accountId, pendingDeleteRequests, isManager,
  canEditEntry, canDeleteEntry,
  onCreateEntry, onEditEntry, onPostEntry, onDeleteEntry, onRequestDelete,
  onReviewDeleteRequest, isReviewPending,
}: JournalEntriesTabProps) => {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const pagination = useServerPagination();

  const { data: entryResult } = useQuery({
    queryKey: ["journal-entries-paginated", accountId, pagination.currentPage, pagination.pageSize, debouncedSearch, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("journal_entries")
        .select("*", { count: "exact" })
        .eq("account_id", accountId)
        .order("date", { ascending: false });

      if (debouncedSearch) {
        query = query.or(`entry_number.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%`);
      }
      if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
      query = query.range(pagination.rangeFrom, pagination.rangeTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data || []) as JournalEntry[], count: count || 0 };
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (entryResult) pagination.setTotalItems(entryResult.count);
  }, [entryResult?.count]);

  const entries = entryResult?.data || [];

  return (
    <div className="space-y-4">
      {isManager && pendingDeleteRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Solicitudes de eliminación pendientes
            <Badge variant="secondary">{pendingDeleteRequests.length}</Badge>
          </h3>
          <div className="space-y-2">
            {pendingDeleteRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between bg-background rounded-lg border p-3">
                <div className="text-sm">
                  <span className="font-mono font-semibold">{req.journal_entries?.entry_number || "—"}</span>
                  <span className="mx-2 text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{req.journal_entries?.description || ""}</span>
                  {req.reason && <span className="text-xs text-muted-foreground italic ml-2">({req.reason})</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={isReviewPending} onClick={() => onReviewDeleteRequest(req.id, false)}>Rechazar</Button>
                  <Button size="sm" variant="destructive" disabled={isReviewPending} onClick={() => onReviewDeleteRequest(req.id, true)}>Aprobar</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar asiento..." value={search} onChange={(e) => { setSearch(e.target.value); pagination.resetPage(); }} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); pagination.resetPage(); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="POSTED">Contabilizado</SelectItem>
          </SelectContent>
        </Select>
        {isManager && (
          <Button size="sm" onClick={onCreateEntry}><Plus className="h-4 w-4 mr-1" />Nuevo asiento</Button>
        )}
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {entries.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Sin asientos contables</Card>
        ) : entries.map(entry => (
          <Card key={entry.id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-sm">{entry.entry_number || "—"}</span>
              <Badge variant={entry.status === "POSTED" ? "default" : "secondary"}>
                {entry.status === "POSTED" ? "Contabilizado" : "Borrador"}
              </Badge>
            </div>
            <p className="text-sm truncate">{entry.description || "Sin descripción"}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{format(new Date(entry.date), "dd/MM/yyyy")}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditEntry(entry) && <DropdownMenuItem onClick={() => onEditEntry(entry)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>}
                  {entry.status === "DRAFT" && isManager && <DropdownMenuItem onClick={() => onPostEntry(entry.id)}><CheckCircle className="h-4 w-4 mr-2" />Contabilizar</DropdownMenuItem>}
                  {canDeleteEntry(entry) ? (
                    <DropdownMenuItem onClick={() => onDeleteEntry(entry)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
                  ) : entry.status !== "DRAFT" ? (
                    <DropdownMenuItem onClick={() => onRequestDelete(entry)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Solicitar eliminación</DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="rounded-md border hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin asientos contables</TableCell></TableRow>
            )}
            {entries.map(entry => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-sm">{entry.entry_number || "—"}</TableCell>
                <TableCell>{format(new Date(entry.date), "dd/MM/yyyy")}</TableCell>
                <TableCell className="max-w-[300px] truncate">{entry.description || "—"}</TableCell>
                <TableCell>
                  <Badge variant={entry.status === "POSTED" ? "default" : "secondary"}>
                    {entry.status === "POSTED" ? "Contabilizado" : "Borrador"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEditEntry(entry) && <DropdownMenuItem onClick={() => onEditEntry(entry)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>}
                      {entry.status === "DRAFT" && isManager && <DropdownMenuItem onClick={() => onPostEntry(entry.id)}><CheckCircle className="h-4 w-4 mr-2" />Contabilizar</DropdownMenuItem>}
                      {canDeleteEntry(entry) ? (
                        <DropdownMenuItem onClick={() => onDeleteEntry(entry)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
                      ) : entry.status !== "DRAFT" ? (
                        <DropdownMenuItem onClick={() => onRequestDelete(entry)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Solicitar eliminación</DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {entries.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage} totalPages={pagination.totalPages}
          totalItems={pagination.totalItems} pageSize={pagination.pageSize}
          startIndex={pagination.startIndex} endIndex={pagination.endIndex}
          onPageChange={pagination.setCurrentPage} onPageSizeChange={pagination.setPageSize}
          pageSizeOptions={pagination.pageSizeOptions}
        />
      )}
    </div>
  );
};

export default JournalEntriesTab;
