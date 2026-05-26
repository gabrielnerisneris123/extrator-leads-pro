"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Mail, Phone, Globe, Instagram, Facebook, Linkedin,
  MessageCircle, MapPin, Star, ExternalLink, Tag, StickyNote,
  CheckCircle2, Clock
} from "lucide-react";
import { cn, getStatusConfig, getRatingColor, formatDateTime, truncate } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/types";
import { leadsApi } from "@/lib/api";
import { toast } from "sonner";

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "contato_iniciado", label: "Contato Iniciado" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "descartado", label: "Descartado" },
];

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  color = "text-slate-400",
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  href?: string;
  color?: string;
}) {
  if (!value) return null;
  const content = (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60">
      <Icon size={14} className={cn("flex-shrink-0 mt-0.5", color)} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 mb-0.5">{label}</div>
        <div className="text-sm text-slate-200 break-all">{value}</div>
      </div>
      {href && (
        <ExternalLink size={12} className="text-slate-600 flex-shrink-0 mt-0.5" />
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="hover:bg-slate-800/40 rounded-lg transition-colors block px-1 -mx-1">
        {content}
      </a>
    );
  }
  return <div className="px-1 -mx-1">{content}</div>;
}

interface Props {
  lead: Lead;
  onClose: () => void;
  onUpdate: (data: Partial<Lead>) => void;
}

export default function LeadDetailModal({ lead, onClose, onUpdate }: Props) {
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [obs, setObs] = useState(lead.observacoes || "");

  const statusConfig = getStatusConfig(status);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setStatus(newStatus);
    try {
      await leadsApi.update(lead.id, { status: newStatus });
      onUpdate({ status: newStatus });
      toast.success("Status atualizado!");
    } catch {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleObsBlur = async () => {
    if (obs !== lead.observacoes) {
      try {
        await leadsApi.update(lead.id, { observacoes: obs });
        onUpdate({ observacoes: obs });
        toast.success("Observação salva!");
      } catch {
        toast.error("Erro ao salvar observação");
      }
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await leadsApi.addNote(lead.id, noteText);
      setNoteText("");
      toast.success("Nota adicionada!");
    } catch {
      toast.error("Erro ao adicionar nota");
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="relative ml-auto w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-white text-base leading-tight">{lead.nome}</h2>
              <div className="flex items-center gap-2 mt-1">
                {lead.categoria && (
                  <span className="text-xs text-slate-500">{lead.categoria}</span>
                )}
                {lead.nota && (
                  <>
                    <span className="text-slate-700">·</span>
                    <div className="flex items-center gap-1">
                      <Star size={10} className={getRatingColor(lead.nota)} fill="currentColor" />
                      <span className={cn("text-xs", getRatingColor(lead.nota))}>
                        {lead.nota.toFixed(1)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex-shrink-0"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Status selector */}
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-xs text-slate-500 mb-2 font-medium">Status do pipeline</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => {
                  const cfg = getStatusConfig(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusChange(opt.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                        status === opt.value
                          ? cn(cfg.bg, cfg.color, "border-current/40")
                          : "bg-slate-800/50 text-slate-500 border-slate-700 hover:text-slate-300"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Contact info */}
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-xs text-slate-500 mb-2 font-medium">Contato</p>
              <InfoRow icon={Mail} label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} color="text-blue-400" />
              <InfoRow icon={Phone} label="Telefone" value={lead.telefone} href={lead.telefone ? `tel:${lead.telefone}` : undefined} color="text-slate-400" />
              <InfoRow icon={MessageCircle} label="WhatsApp" value={lead.whatsapp} href={lead.whatsapp ? `https://wa.me/${lead.whatsapp.replace(/\D/g, "")}` : undefined} color="text-green-400" />
              <InfoRow icon={Instagram} label="Instagram" value={lead.instagram} href={lead.instagram || undefined} color="text-pink-400" />
              <InfoRow icon={Facebook} label="Facebook" value={lead.facebook} href={lead.facebook || undefined} color="text-blue-500" />
              <InfoRow icon={Linkedin} label="LinkedIn" value={lead.linkedin} href={lead.linkedin || undefined} color="text-blue-400" />
              <InfoRow icon={Globe} label="Website" value={lead.website} href={lead.website || undefined} color="text-violet-400" />
            </div>

            {/* Location */}
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-xs text-slate-500 mb-2 font-medium">Localização</p>
              <InfoRow icon={MapPin} label="Endereço" value={lead.endereco} color="text-orange-400" />
              <InfoRow icon={MapPin} label="Cidade/Estado" value={[lead.cidade, lead.estado].filter(Boolean).join(" — ")} color="text-orange-400" />
              {lead.google_maps_url && (
                <a href={lead.google_maps_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  <ExternalLink size={12} /> Ver no Google Maps
                </a>
              )}
            </div>

            {/* Observations */}
            <div className="px-5 py-4 border-b border-slate-800">
              <p className="text-xs text-slate-500 mb-2 font-medium">Observações</p>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                onBlur={handleObsBlur}
                rows={3}
                placeholder="Adicione observações sobre este lead..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none"
              />
            </div>

            {/* Notes */}
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-3 font-medium">Notas do histórico</p>
              <div className="flex gap-2 mb-3">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                  placeholder="Adicionar nota..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                />
                <button
                  onClick={handleAddNote}
                  disabled={addingNote || !noteText.trim()}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors"
                >
                  {addingNote ? "..." : "Salvar"}
                </button>
              </div>

              {lead.notes && lead.notes.length > 0 ? (
                <div className="space-y-2">
                  {[...lead.notes].reverse().map((note) => (
                    <div key={note.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-slate-300">{note.content}</p>
                      <p className="text-[10px] text-slate-600 mt-1.5">
                        {formatDateTime(note.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600 text-center py-4">Nenhuma nota ainda</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-800 flex items-center gap-3">
            <div className="text-xs text-slate-600">
              Capturado: {formatDateTime(lead.scraped_at)}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
