"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Star, Mail, Phone, Globe, Instagram, MessageCircle,
  MapPin, ChevronUp, ChevronDown, ChevronsUpDown,
  ExternalLink, MoreHorizontal, Pencil, Trash2, Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, getStatusConfig, getRatingColor, formatDate, truncate } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/types";
import LeadDetailModal from "./LeadDetailModal";

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "contato_iniciado", label: "Contato" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "descartado", label: "Descartado" },
];

function StatusBadge({ status }: { status: LeadStatus }) {
  const config = getStatusConfig(status);
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
      config.bg, config.color
    )}>
      {config.label}
    </span>
  );
}

function ContactIcon({
  active,
  icon: Icon,
  color,
  title,
}: {
  active: boolean;
  icon: React.ElementType;
  color: string;
  title: string;
}) {
  return (
    <span title={title}>
      <Icon
        size={13}
        className={active ? color : "text-slate-700"}
      />
    </span>
  );
}

interface Props {
  leads: Lead[];
  loading?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: string) => void;
  onUpdate?: (id: string, data: Partial<Lead>) => void;
  onDelete?: (id: string) => void;
}

export default function LeadsTable({
  leads,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onUpdate,
  onDelete,
}: Props) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dropdownId, setDropdownId] = useState<string | null>(null);

  function SortIcon({ field }: { field: string }) {
    if (sortBy !== field) return <ChevronsUpDown size={12} className="text-slate-600" />;
    return sortOrder === "asc"
      ? <ChevronUp size={12} className="text-blue-400" />
      : <ChevronDown size={12} className="text-blue-400" />;
  }

  function SortableHeader({ field, children }: { field: string; children: React.ReactNode }) {
    return (
      <button
        onClick={() => onSort?.(field)}
        className="flex items-center gap-1 text-left hover:text-white transition-colors"
      >
        {children}
        <SortIcon field={field} />
      </button>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-800/50 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="text-4xl mb-3">🔍</div>
        <h3 className="text-slate-300 font-medium mb-1">Nenhum lead encontrado</h3>
        <p className="text-slate-600 text-sm">Tente ajustar os filtros ou inicie um novo scraping</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                  <SortableHeader field="nome">Empresa</SortableHeader>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                  <SortableHeader field="cidade">Cidade</SortableHeader>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Nicho</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Contatos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                  <SortableHeader field="nota">Nota</SortableHeader>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                  <SortableHeader field="scraped_at">Capturado</SortableHeader>
                </th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {leads.map((lead, i) => (
                  <motion.tr
                    key={lead.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLead(lead)}
                  >
                    {/* Row number */}
                    <td className="px-4 py-3 text-xs text-slate-600">{i + 1}</td>

                    {/* Company name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
                          {lead.nome[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate max-w-[180px]">
                            {truncate(lead.nome, 28)}
                          </div>
                          {lead.email && (
                            <div className="text-xs text-slate-500 truncate max-w-[180px]">
                              {lead.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* City/State */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <MapPin size={11} />
                        <span className="text-xs truncate max-w-[100px]">
                          {[lead.cidade, lead.estado].filter(Boolean).join(", ") || "—"}
                        </span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-400 truncate max-w-[100px] block">
                        {lead.categoria || "—"}
                      </span>
                    </td>

                    {/* Contact icons */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ContactIcon active={lead.has_email} icon={Mail} color="text-blue-400" title={lead.email || "Email"} />
                        <ContactIcon active={lead.has_whatsapp} icon={MessageCircle} color="text-green-400" title={lead.whatsapp || "WhatsApp"} />
                        <ContactIcon active={lead.has_instagram} icon={Instagram} color="text-pink-400" title={lead.instagram || "Instagram"} />
                        <ContactIcon active={!!lead.telefone} icon={Phone} color="text-slate-300" title={lead.telefone || "Telefone"} />
                        <ContactIcon active={lead.has_website} icon={Globe} color="text-violet-400" title={lead.website || "Website"} />
                      </div>
                    </td>

                    {/* Rating */}
                    <td className="px-4 py-3">
                      {lead.nota ? (
                        <div className="flex items-center gap-1">
                          <Star size={11} className={getRatingColor(lead.nota)} fill="currentColor" />
                          <span className={cn("text-xs font-semibold", getRatingColor(lead.nota))}>
                            {lead.nota.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-600">
                            ({lead.total_reviews?.toLocaleString()})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          onUpdate?.(lead.id, { status: e.target.value as LeadStatus })
                        }
                        className="bg-transparent border-none text-xs focus:outline-none cursor-pointer"
                        style={{ padding: 0 }}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-slate-800">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {formatDate(lead.scraped_at)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() => setDropdownId(dropdownId === lead.id ? null : lead.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {dropdownId === lead.id && (
                          <div className="absolute right-0 top-8 z-20 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-1 min-w-[140px]">
                            <button
                              onClick={() => { setSelectedLead(lead); setDropdownId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                              <Eye size={12} /> Ver detalhes
                            </button>
                            {lead.google_maps_url && (
                              <a
                                href={lead.google_maps_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                              >
                                <ExternalLink size={12} /> Google Maps
                              </a>
                            )}
                            <hr className="border-slate-700 my-1" />
                            <button
                              onClick={() => { onDelete?.(lead.id); setDropdownId(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Lead detail modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(data) => {
            onUpdate?.(selectedLead.id, data);
            setSelectedLead({ ...selectedLead, ...data });
          }}
        />
      )}
    </>
  );
}
