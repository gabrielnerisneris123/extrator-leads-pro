"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart,
  Line, Area, AreaChart, Legend
} from "recharts";
import { motion } from "framer-motion";
import type { DashboardStats } from "@/types";
import { truncate } from "@/lib/utils";

const COLORS = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316",
];

const STATUS_COLORS: Record<string, string> = {
  novo: "#3b82f6",
  contato_iniciado: "#f59e0b",
  negociacao: "#f97316",
  fechado: "#10b981",
  descartado: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  contato_iniciado: "Contato",
  negociacao: "Negociação",
  fechado: "Fechado",
  descartado: "Descartado",
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800 rounded-2xl p-6"
    >
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

const customTooltipStyle = {
  contentStyle: {
    backgroundColor: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "12px",
    color: "#f1f5f9",
    fontSize: "12px",
  },
  cursor: { fill: "rgba(59, 130, 246, 0.05)" },
};

interface Props {
  stats: DashboardStats;
}

export default function Charts({ stats }: Props) {
  // Prepare status pie data
  const statusData = stats.leads_by_status.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || "#6b7280",
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Leads by day (area chart) */}
      <ChartCard
        title="Leads capturados (30 dias)"
        subtitle="Evolução temporal de novos leads"
      >
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={stats.leads_by_day}>
            <defs>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="#475569"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis stroke="#475569" tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip
              {...customTooltipStyle}
              labelFormatter={(v) => new Date(v).toLocaleDateString("pt-BR")}
              formatter={(v: number) => [v, "Leads"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorLeads)"
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Leads by city */}
      <ChartCard title="Leads por Cidade" subtitle="Top 10 cidades">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={stats.leads_by_cidade.slice(0, 8)}
            layout="vertical"
            margin={{ left: 0, right: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" stroke="#475569" tick={{ fill: "#64748b", fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="cidade"
              width={80}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              tickFormatter={(v) => truncate(v || "", 10)}
            />
            <Tooltip
              {...customTooltipStyle}
              formatter={(v: number) => [v, "Leads"]}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]}>
              {stats.leads_by_cidade.slice(0, 8).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Status breakdown (donut) */}
      <ChartCard title="Status dos Leads" subtitle="Distribuição por pipeline">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={statusData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {statusData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={customTooltipStyle.contentStyle}
              formatter={(v: number, name: string) => [v, name]}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: "#94a3b8", fontSize: "11px" }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Leads by niche */}
      <ChartCard
        title="Leads por Nicho"
        subtitle="Top segmentos de mercado"
      >
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={stats.leads_by_nicho.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="nicho"
              stroke="#475569"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickFormatter={(v) => truncate(v || "", 8)}
            />
            <YAxis stroke="#475569" tick={{ fill: "#64748b", fontSize: 10 }} />
            <Tooltip
              {...customTooltipStyle}
              formatter={(v: number) => [v, "Leads"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {stats.leads_by_nicho.slice(0, 8).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Email vs WhatsApp bars */}
      <ChartCard
        title="Contatos por Cidade"
        subtitle="Emails e WhatsApp por região"
      >
        <div className="space-y-3 mt-1">
          {stats.top_cidades.slice(0, 6).map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 truncate max-w-[120px]">
                  {item.cidade || "Sem cidade"}
                </span>
                <span className="text-xs font-semibold text-white">{item.count}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min((item.count / (stats.top_cidades[0]?.count || 1)) * 100, 100)}%`,
                  }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Top niches progress */}
      <ChartCard title="Top Nichos" subtitle="Segmentos mais presentes">
        <div className="space-y-3 mt-1">
          {stats.top_nichos.slice(0, 6).map((item, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400 truncate max-w-[120px]">
                  {item.nicho || "Sem nicho"}
                </span>
                <span className="text-xs font-semibold text-white">{item.count}</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min((item.count / (stats.top_nichos[0]?.count || 1)) * 100, 100)}%`,
                  }}
                  transition={{ delay: i * 0.1, duration: 0.6 }}
                  className="h-full rounded-full bg-violet-500"
                />
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}
