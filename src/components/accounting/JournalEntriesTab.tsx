import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Plus, Pencil, Trash2, MoreHorizontal, Check, X, Clock, Link } from "lucide-react";
import { format } from "date-fns";
import { JournalEntry, DeleteRequest } from "./types";
import PaginationControls from "@/components/shared/PaginationControls";
import { usePagination } from "@/hooks/use-pagination";

interface JournalEntriesTabProps {
  entries: JournalEntry[];
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
  entries, pendingDeleteRequests, isManager,
  canEditEntry, canDeleteEntry,
  onCreateEntry, onEditEntry, onPostEntry,
  onDeleteEntry, onRequestDelete,
  onReviewDeleteRequest, isReviewPending,
}: JournalEntriesTabProps) => {
  const [entryFilter, setEntryFilter] = useState({ status: "ALL", search: "" });

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (entryFilter.status !== "ALL" && e.status !== entryFilter.status) return false;
      if (entryFilter.search && !e.entry_number?.toLowerCase().includes(entryFilter.search.toLowerCase()) && !e.description.toLowerCase().includes(entryFilter.search.toLowerCase())) return false;
      return true;
    });
  }, [entries, entryFilter]);

  const pagination = usePagination(filteredEntries);

  return (
    <div className="space-y-4">
      {/* Pending delete requests for managers */}
      {isManager && pendingDeleteRequests.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-destructive" />
              Solicitudes de eliminación pendientes ({pendingDeleteRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Asiento</TableHead>
                  <TableHead className="w-28">Fecha</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-28">Solicitado</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeleteRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-mono text-sm">{req.journal_entries?.entry_number}</TableCell>
                    <TableCell>{req.journal_entries?.date ? format(new Date(req.journal_entries.date), "dd/MM/yyyy") : ""}</TableCell>
                    <TableCell className="max-w-[250px] truncate">{req.reason || "Sin motivo"}</TableCell>
                    <TableCell>{format(new Date(req.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline" size="icon" className="h-7 w-7 text-primary"
                          onClick={() => onReviewDeleteRequest(req.id, true)}
                          disabled={isReviewPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => onReviewDeleteRequest(req.id, false)}
                          disabled={isReviewPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar asiento..." className="pl-8" value={entryFilter.search} onChange={e => { setEntryFilter(prev => ({ ...prev, search: e.target.value })); pagination.resetPage(); }} />
        </div>
        <Select value={entryFilter.status} onValueChange={v => { setEntryFilter(prev => ({ ...prev, status: v })); pagination.resetPage(); }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Borrador</SelectItem>
            <SelectItem value="POSTED">Contabilizado</SelectItem>
          </SelectContent>
        </Select>
        {isManager && (
          <Button size="sm" onClick={onCreateEntry}>
            <Plus className="mr-1 h-4 w-4" /> Nuevo asiento
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Nº Asiento</TableHead>
              <TableHead className="w-28">Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-28">Estado</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sin asientos</TableCell></TableRow>
            ) : pagination.paginatedItems.map(e => (
              <TableRow key={e.id}>
                <TableCell className="font-mono text-sm">
                  {e.entry_number}
                  {e.invoice_id && <Link className="inline ml-1 h-3 w-3 text-muted-foreground" />}
                </TableCell>
                <TableCell>{format(new Date(e.date), "dd/MM/yyyy")}</TableCell>
                <TableCell className="max-w-[300px] truncate">{e.description}</TableCell>
                <TableCell>
                  <Badge variant={e.status === "POSTED" ? "default" : "secondary"}>
                    {e.status === "POSTED" ? "Contabilizado" : "Borrador"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canEditEntry(e) && (
                        <DropdownMenuItem onClick={() => onEditEntry(e)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </DropdownMenuItem>
                      )}
                      {isManager && e.status === "DRAFT" && (
                        <DropdownMenuItem onClick={() => onPostEntry(e.id)}>
                          <Check className="mr-2 h-4 w-4" /> Contabilizar
                        </DropdownMenuItem>
                      )}
                      {canDeleteEntry(e) && (
                        <>
                          <DropdownMenuSeparator />
                          {isManager ? (
                            <DropdownMenuItem className="text-destructive" onClick={() => onDeleteEntry(e)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-destructive" onClick={() => onRequestDelete(e)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Solicitar eliminación
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredEntries.length > 0 && (
          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              startIndex={pagination.startIndex}
              endIndex={pagination.endIndex}
              onPageChange={pagination.setCurrentPage}
              onPageSizeChange={pagination.setPageSize}
              pageSizeOptions={pagination.pageSizeOptions}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default JournalEntriesTab;
