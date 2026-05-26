import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LeadStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusConfig(status: LeadStatus) {
  const configs: Record<LeadStatus, { label: string; color: string; bg: string }> = {
    novo: { label: "Novo", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30" },
    contato_iniciado: { label: "Contato", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30" },
    negociacao: { label: "Negociação", color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30" },
    fechado: { label: "Fechado", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30" },
    descartado: { label: "Descartado", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30" },
  };
  return configs[status] || configs.novo;
}

export function getRatingColor(nota?: number): string {
  if (!nota) return "text-slate-500";
  if (nota >= 4.5) return "text-green-400";
  if (nota >= 4.0) return "text-yellow-400";
  if (nota >= 3.0) return "text-orange-400";
  return "text-red-400";
}

export function truncate(str: string, length: number): string {
  return str.length > length ? `${str.substring(0, length)}...` : str;
}

export function getJobStatusConfig(status: string) {
  const configs: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
    pendente: { label: "Pendente", color: "text-slate-400", bg: "bg-slate-500/20" },
    executando: { label: "Executando", color: "text-blue-400", bg: "bg-blue-500/20", pulse: true },
    concluido: { label: "Concluído", color: "text-green-400", bg: "bg-green-500/20" },
    erro: { label: "Erro", color: "text-red-400", bg: "bg-red-500/20" },
    cancelado: { label: "Cancelado", color: "text-slate-400", bg: "bg-slate-500/20" },
  };
  return configs[status] || configs.pendente;
}
