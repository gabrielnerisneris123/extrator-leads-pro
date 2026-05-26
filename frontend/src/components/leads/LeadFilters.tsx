"use client";

import { useState } from "react";
import {
  Search, SlidersHorizontal, X, ChevronDown,
  Phone, Mail, MessageCircle, Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadFilters, LeadStatus } from "@/types";

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "contato_iniciado", label: "Contato Iniciado" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "descartado", label: "Descartado" },
];

// ── Quick contact filter chip ──────────────────────────────────────────────
interface ChipProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  colorClass: string;   // tailwind color classes when active
  onClick: () => void;
}

function ContactChip({ label, icon, active, colorClass, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      title={active ? `Remover filtro: ${label}` : `Apenas com ${label}`}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all select-none",
        active
          ? colorClass
          : "bg-slate-800/70 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
      )}
    >
      {icon}
      {label}
      {active && <X size={10} className="ml-0.5 opacity-70" />}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
interface Props {
  filters: LeadFilters;
  onChange: (filters: Partial<LeadFilters>) => void;
  totalLeads?: number;
}

export default function LeadFilters({ filters, onChange, totalLeads }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvancedFilters =
    filters.cidade ||
    filters.estado ||
    filters.categoria ||
    filters.status ||
    filters.nota_min ||
    filters.reviews_min;

  const hasContactFilters =
    filters.has_telefone !== undefined ||
    filters.has_email !== undefined ||
    filters.has_whatsapp !== undefined ||
    filters.has_instagram !== undefined;

  const clearAll = () => {
    onChange({
      search: "",
      cidade: undefined,
      estado: undefined,
      categoria: undefined,
      status: undefined,
      has_email: undefined,
      has_whatsapp: undefined,
      has_instagram: undefined,
      has_telefone: undefined,
      nota_min: undefined,
      reviews_min: undefined,
      page: 1,
    });
  };

  // Toggle: se já ativo → remove; se inativo → ativa
  const toggle = (key: keyof LeadFilters, current: boolean | undefined) =>
    onChange({ [key]: current === true ? undefined : true, page: 1 });

  return (
    <div className="space-y-3">
      {/* ── Row 1: search + filter toggle + total ── */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={filters.search || ""}
            onChange={(e) => onChange({ search: e.target.value, page: 1 })}
            placeholder="Buscar por nome, email, cidade, nicho..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ search: "", page: 1 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={cn(
            "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap",
            showAdvanced || hasAdvancedFilters
              ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
          )}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {hasAdvancedFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          <ChevronDown size={12} className={cn("transition-transform", showAdvanced ? "rotate-180" : "")} />
        </button>

        {(hasAdvancedFilters || hasContactFilters || filters.search) && (
          <button
            onClick={clearAll}
            title="Limpar todos os filtros"
            className="px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/30 text-sm transition-all"
          >
            <X size={14} />
          </button>
        )}

        {totalLeads !== undefined && (
          <div className="text-xs text-slate-500 whitespace-nowrap px-1">
            <span className="text-white font-semibold">{totalLeads.toLocaleString()}</span> leads
          </div>
        )}
      </div>

      {/* ── Row 2: Contact quick-filters (sempre visíveis) ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium mr-1">Contato:</span>

        <ContactChip
          label="Telefone"
          icon={<Phone size={11} />}
          active={filters.has_telefone === true}
          colorClass="bg-sky-600/25 border-sky-500/50 text-sky-300"
          onClick={() => toggle("has_telefone", filters.has_telefone)}
        />
        <ContactChip
          label="Email"
          icon={<Mail size={11} />}
          active={filters.has_email === true}
          colorClass="bg-violet-600/25 border-violet-500/50 text-violet-300"
          onClick={() => toggle("has_email", filters.has_email)}
        />
        <ContactChip
          label="WhatsApp"
          icon={<MessageCircle size={11} />}
          active={filters.has_whatsapp === true}
          colorClass="bg-emerald-600/25 border-emerald-500/50 text-emerald-300"
          onClick={() => toggle("has_whatsapp", filters.has_whatsapp)}
        />
        <ContactChip
          label="Instagram"
          icon={<Instagram size={11} />}
          active={filters.has_instagram === true}
          colorClass="bg-pink-600/25 border-pink-500/50 text-pink-300"
          onClick={() => toggle("has_instagram", filters.has_instagram)}
        />

        {hasContactFilters && (
          <button
            onClick={() =>
              onChange({
                has_telefone: undefined,
                has_email: undefined,
                has_whatsapp: undefined,
                has_instagram: undefined,
                page: 1,
              })
            }
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-1"
          >
            limpar
          </button>
        )}
      </div>

      {/* ── Advanced filters (colapsável) ── */}
      {showAdvanced && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 animate-slide-up">
          {/* City */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Cidade</label>
            <input
              value={filters.cidade || ""}
              onChange={(e) => onChange({ cidade: e.target.value || undefined, page: 1 })}
              placeholder="Ex: São Paulo"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          {/* State */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Estado</label>
            <input
              value={filters.estado || ""}
              onChange={(e) => onChange({ estado: e.target.value || undefined, page: 1 })}
              placeholder="Ex: SP"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Nicho</label>
            <input
              value={filters.categoria || ""}
              onChange={(e) => onChange({ categoria: e.target.value || undefined, page: 1 })}
              placeholder="Ex: Academias"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Status CRM</label>
            <select
              value={filters.status || ""}
              onChange={(e) =>
                onChange({ status: (e.target.value as LeadStatus) || undefined, page: 1 })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Rating min */}
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block font-medium">Nota mínima</label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="5"
              value={filters.nota_min || ""}
              onChange={(e) =>
                onChange({ nota_min: e.target.value ? Number(e.target.value) : undefined, page: 1 })
              }
              placeholder="Ex: 4.0"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
            />
          </div>
        </div>
      )}
    </div>
  );
}
