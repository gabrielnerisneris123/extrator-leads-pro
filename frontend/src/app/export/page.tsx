"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileJson, FileText, Filter, Sparkles } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { exportApi } from "@/lib/api";
import type { LeadStatus } from "@/types";

const STATUS_OPTIONS: { value: LeadStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "novo", label: "Novo" },
  { value: "contato_iniciado", label: "Contato Iniciado" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "descartado", label: "Descartado" },
];

function ExportCard({
  icon: Icon,
  title,
  description,
  ext,
  color,
  bgColor,
  borderColor,
  onExport,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  ext: string;
  color: string;
  bgColor: string;
  borderColor: string;
  onExport: () => void;
}) {
  return (
    <div className={`bg-slate-900 border rounded-2xl p-6 hover:${borderColor} transition-all group`}>
      <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center mb-4`}>
        <Icon size={22} className={color} />
      </div>
      <h3 className="font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-5">{description}</p>
      <button
        onClick={onExport}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${bgColor} ${color} hover:opacity-90`}
      >
        <Download size={15} /> Exportar {ext}
      </button>
    </div>
  );
}

export default function ExportPage() {
  const [filters, setFilters] = useState({
    cidade: "",
    estado: "",
    categoria: "",
    status: "" as LeadStatus | "",
    has_email: false,
    has_whatsapp: false,
  });

  const getActiveFilters = () => {
    const active: any = {};
    if (filters.cidade) active.cidade = filters.cidade;
    if (filters.estado) active.estado = filters.estado;
    if (filters.categoria) active.categoria = filters.categoria;
    if (filters.status) active.status = filters.status;
    if (filters.has_email) active.has_email = true;
    if (filters.has_whatsapp) active.has_whatsapp = true;
    return active;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Exportar Dados</h1>
          <p className="text-slate-500 text-sm mt-1">
            Exporte seus leads em diferentes formatos
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Filter size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-white">Filtros de exportação</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Cidade</label>
                  <input
                    value={filters.cidade}
                    onChange={(e) => setFilters((f) => ({ ...f, cidade: e.target.value }))}
                    placeholder="Ex: São Paulo"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Estado</label>
                  <input
                    value={filters.estado}
                    onChange={(e) => setFilters((f) => ({ ...f, estado: e.target.value }))}
                    placeholder="Ex: SP"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Nicho</label>
                  <input
                    value={filters.categoria}
                    onChange={(e) => setFilters((f) => ({ ...f, categoria: e.target.value }))}
                    placeholder="Ex: Academias"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as LeadStatus }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.has_email}
                      onChange={(e) => setFilters((f) => ({ ...f, has_email: e.target.checked }))}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-slate-400">Apenas com email</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.has_whatsapp}
                      onChange={(e) => setFilters((f) => ({ ...f, has_whatsapp: e.target.checked }))}
                      className="w-4 h-4 accent-green-500"
                    />
                    <span className="text-sm text-slate-400">Apenas com WhatsApp</span>
                  </label>
                </div>

                <button
                  onClick={() => setFilters({
                    cidade: "", estado: "", categoria: "", status: "",
                    has_email: false, has_whatsapp: false,
                  })}
                  className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          </div>

          {/* Export cards */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ExportCard
                icon={FileText}
                title="CSV"
                description="Formato universal. Compatível com Excel, Google Sheets e qualquer CRM."
                ext=".csv"
                color="text-blue-400"
                bgColor="bg-blue-500/15"
                borderColor="border-blue-500/30"
                onExport={() => {
                  toast.info("Preparando CSV...");
                  exportApi.csv(getActiveFilters());
                }}
              />
              <ExportCard
                icon={FileSpreadsheet}
                title="Excel"
                description="Planilha formatada com estilos, filtros automáticos e cores."
                ext=".xlsx"
                color="text-emerald-400"
                bgColor="bg-emerald-500/15"
                borderColor="border-emerald-500/30"
                onExport={() => {
                  toast.info("Preparando Excel...");
                  exportApi.excel(getActiveFilters());
                }}
              />
              <ExportCard
                icon={FileJson}
                title="JSON"
                description="Formato estruturado para integração com outros sistemas e APIs."
                ext=".json"
                color="text-violet-400"
                bgColor="bg-violet-500/15"
                borderColor="border-violet-500/30"
                onExport={() => {
                  toast.info("Preparando JSON...");
                  // Similar to exportApi but for JSON
                  const token = localStorage.getItem("token");
                  const params = new URLSearchParams();
                  const activeFilters = getActiveFilters();
                  Object.entries(activeFilters).forEach(([k, v]) => {
                    params.append(k, String(v));
                  });
                  const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/export/json?${params}`;
                  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                    .then((r) => r.blob())
                    .then((blob) => {
                      const blobUrl = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = blobUrl;
                      link.setAttribute("download", "leads.json");
                      link.click();
                    });
                }}
              />
            </div>

            {/* Tips */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={15} className="text-yellow-400" />
                <h3 className="text-sm font-semibold text-white">Dicas de exportação</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { tip: "Use filtros para exportar apenas leads com email para campanhas de email marketing" },
                  { tip: "Exporte leads com WhatsApp para disparos no WhatsApp Business" },
                  { tip: "Filtre por cidade + nicho para criar listas segmentadas por região" },
                  { tip: "O formato Excel inclui formatação profissional pronta para apresentações" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                    <p className="text-xs text-slate-400">{item.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
