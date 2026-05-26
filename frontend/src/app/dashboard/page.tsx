"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { RefreshCw, BarChart3, TrendingUp } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import KPICards from "@/components/dashboard/KPICards";
import Charts from "@/components/dashboard/Charts";
import { dashboardApi } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function DashboardPage() {
  const { data: stats, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.stats,
    refetchInterval: 30000, // Auto-refresh every 30s
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">
              Visão geral da sua operação de leads
            </p>
          </div>
          <div className="flex items-center gap-3">
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-slate-500">
                Atualizado: {formatDateTime(new Date(dataUpdatedAt).toISOString())}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-all text-sm"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <KPICards stats={stats!} loading={isLoading} />

        {/* Charts */}
        {stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-300">Análise Visual</h2>
            </div>
            <Charts stats={stats} />
          </motion.div>
        )}

        {/* Empty state */}
        {!isLoading && stats?.total_leads === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <TrendingUp size={28} className="text-blue-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">Nenhum lead ainda</h3>
            <p className="text-slate-500 text-sm mb-6">
              Crie seu primeiro job de scraping para começar a capturar leads
            </p>
            <a
              href="/scraping"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Iniciar Scraping
            </a>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
