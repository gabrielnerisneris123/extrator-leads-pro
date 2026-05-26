"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileJson, ChevronLeft, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import LeadsTable from "@/components/leads/LeadsTable";
import LeadFilters from "@/components/leads/LeadFilters";
import { leadsApi, exportApi } from "@/lib/api";
import type { LeadFilters as LeadFiltersType } from "@/types";

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<LeadFiltersType>({
    page: 1,
    size: 50,
    sort_by: "scraped_at",
    sort_order: "desc",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["leads", filters],
    queryFn: () => leadsApi.list(filters),
    placeholderData: (prev) => prev,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      leadsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: () => toast.error("Erro ao atualizar lead"),
  });

  const deleteMutation = useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead excluído com sucesso");
    },
    onError: () => toast.error("Erro ao excluir lead"),
  });

  const handleFilterChange = useCallback((newFilters: Partial<LeadFiltersType>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleSort = useCallback((field: string) => {
    setFilters((prev) => ({
      ...prev,
      sort_by: field,
      sort_order: prev.sort_by === field && prev.sort_order === "desc" ? "asc" : "desc",
      page: 1,
    }));
  }, []);

  const totalPages = data?.pages || 1;
  const currentPage = filters.page || 1;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Leads</h1>
            <p className="text-slate-500 text-sm mt-1">
              Gerencie todos os seus leads captados
            </p>
          </div>
          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportApi.csv(filters)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all text-sm"
            >
              <Download size={14} /> CSV
            </button>
            <button
              onClick={() => exportApi.excel(filters)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all text-sm"
            >
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        </div>

        {/* Filters */}
        <LeadFilters
          filters={filters}
          onChange={handleFilterChange}
          totalLeads={data?.total}
        />

        {/* Table */}
        <LeadsTable
          leads={data?.items || []}
          loading={isLoading}
          sortBy={filters.sort_by}
          sortOrder={filters.sort_order}
          onSort={handleSort}
          onUpdate={(id, updateData) =>
            updateMutation.mutate({ id, data: updateData })
          }
          onDelete={(id) => deleteMutation.mutate(id)}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Página {currentPage} de {totalPages} · {data?.total.toLocaleString()} leads total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFilterChange({ page: currentPage - 1 })}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                <ChevronLeft size={14} /> Anterior
              </button>

              {/* Page numbers */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => handleFilterChange({ page })}
                      className={`w-9 h-9 rounded-xl text-sm font-medium transition-all ${
                        page === currentPage
                          ? "bg-blue-600 text-white"
                          : "bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handleFilterChange({ page: currentPage + 1 })}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
              >
                Próxima <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
