"use client";

import { motion } from "framer-motion";
import { Users, Mail, MessageCircle, Instagram, TrendingUp, Briefcase } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { DashboardStats } from "@/types";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: number;
  index: number;
}

function KPICard({ title, value, subtitle, icon: Icon, color, bgColor, trend, index }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", bgColor)}>
          <Icon size={18} className={color} />
        </div>
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg",
            trend >= 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"
          )}>
            <TrendingUp size={10} className={trend < 0 ? "rotate-180" : ""} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-2xl font-bold text-white tracking-tight">
          {typeof value === "number" ? formatNumber(value) : value}
        </div>
        <div className="text-sm font-medium text-slate-300">{title}</div>
        {subtitle && (
          <div className="text-xs text-slate-500">{subtitle}</div>
        )}
      </div>
    </motion.div>
  );
}

interface Props {
  stats: DashboardStats;
  loading?: boolean;
}

export default function KPICards({ stats, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-36 shimmer" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Total de Leads",
      value: stats.total_leads,
      subtitle: `${stats.jobs_running > 0 ? `${stats.jobs_running} job(s) ativos` : "Todos os leads"}`,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/15",
    },
    {
      title: "Com Email",
      value: stats.leads_with_email,
      subtitle: `${stats.taxa_email}% do total`,
      icon: Mail,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/15",
    },
    {
      title: "Com WhatsApp",
      value: stats.leads_with_whatsapp,
      subtitle: `${stats.taxa_whatsapp}% do total`,
      icon: MessageCircle,
      color: "text-green-400",
      bgColor: "bg-green-500/15",
    },
    {
      title: "Com Instagram",
      value: stats.leads_with_instagram,
      subtitle: "Links de perfil",
      icon: Instagram,
      color: "text-pink-400",
      bgColor: "bg-pink-500/15",
    },
    {
      title: "Em Negociação",
      value: stats.leads_em_negociacao,
      subtitle: `${stats.leads_fechados} fechados`,
      icon: TrendingUp,
      color: "text-orange-400",
      bgColor: "bg-orange-500/15",
    },
    {
      title: "Jobs de Scraping",
      value: stats.total_jobs,
      subtitle: `${stats.jobs_running} em execução`,
      icon: Briefcase,
      color: "text-violet-400",
      bgColor: "bg-violet-500/15",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, i) => (
        <KPICard key={i} {...card} index={i} />
      ))}
    </div>
  );
}
