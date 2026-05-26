"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Play, StopCircle, Trash2, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Loader2,
  ChevronDown, ChevronUp, Zap,
  Phone, Mail, Filter, Target, Package,
  TriangleAlert, CreditCard,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { scrapingApi } from "@/lib/api";
import { cn, getJobStatusConfig, formatDateTime } from "@/lib/utils";
import type { ScrapingJob } from "@/types";

// ─── Schemas ────────────────────────────────────────────────────────────────

const schemaRapida = z.object({
  query: z.string().min(3, "Digite pelo menos 3 caracteres"),
  max_results: z.coerce.number().min(1).max(100).default(20),
});

const schemaVolume = z.object({
  nicho: z.string().min(2, "Digite o nicho (ex: academias)"),
  cidade: z.string().min(2, "Digite a cidade"),
  estado: z.string().length(2, "Selecione o estado"),
  max_results: z.coerce.number().min(100).max(1000).default(100),
  confirmado: z.boolean().refine((v) => v === true, {
    message: "Confirme que entende o custo antes de iniciar",
  }),
});

type FormRapida = z.infer<typeof schemaRapida>;
type FormVolume = z.infer<typeof schemaVolume>;

// ─── Constantes ─────────────────────────────────────────────────────────────

const EXEMPLOS_RAPIDOS = [
  "academias em campinas sp",
  "restaurantes em são paulo sp",
  "gráficas em jundiaí sp",
  "clínicas em belo horizonte mg",
  "pet shops em curitiba pr",
];

const EXEMPLOS_NICHO = [
  "academias", "restaurantes", "gráficas", "clínicas odontológicas",
  "pet shops", "advogados", "escolas de inglês", "salões de beleza",
  "mecânicas", "imobiliárias",
];

const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC",
  "SP","SE","TO",
];

// ─── Componente de status do job ─────────────────────────────────────────────

function JobStatusIcon({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    pendente:  <Clock size={14} className="text-slate-400" />,
    executando:<Loader2 size={14} className="text-blue-400 animate-spin" />,
    concluido: <CheckCircle2 size={14} className="text-green-400" />,
    erro:      <AlertCircle size={14} className="text-red-400" />,
    cancelado: <StopCircle size={14} className="text-slate-400" />,
  };
  return <>{icons[status] || null}</>;
}

function JobCard({ job, onCancel, onDelete }: {
  job: ScrapingJob;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = getJobStatusConfig(job.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <JobStatusIcon status={job.status} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white text-sm truncate">{job.query}</h3>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium",
                statusConfig.bg, statusConfig.color
              )}>
                {statusConfig.label}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
              {job.cidade && <span>📍 {job.cidade}</span>}
              {job.nicho  && <span>🏷️ {job.nicho}</span>}
              <span>Meta: {job.max_results}</span>
              <span>{formatDateTime(job.created_at)}</span>
              {job.config?.only_with_phone && (
                <span className="flex items-center gap-1 text-sky-400">
                  <Phone size={10} /> telefone
                </span>
              )}
              {job.config?.only_with_email && (
                <span className="flex items-center gap-1 text-violet-400">
                  <Mail size={10} /> email
                </span>
              )}
            </div>

            {job.status === "executando" && (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">
                    {job.total_scraped} / {job.total_found || job.max_results} leads
                  </span>
                  <span className="text-blue-400 font-medium">{job.progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${job.progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                  />
                </div>
              </div>
            )}

            {job.status === "concluido" && (
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="text-green-400 font-semibold">{job.total_scraped}</span> leads
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="text-blue-400 font-semibold">{job.total_emails}</span> emails
                </div>
              </div>
            )}

            {job.error_message && (
              <div className="mt-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                {job.error_message}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {job.status === "executando" && (
              <button
                onClick={() => onCancel(job.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cancelar"
              >
                <StopCircle size={14} />
              </button>
            )}
            {["concluido","erro","cancelado"].includes(job.status) && (
              <button
                onClick={() => onDelete(job.id)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Excluir"
              >
                <Trash2 size={14} />
              </button>
            )}
            {job.logs && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 transition-colors"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && job.logs && (
        <div className="border-t border-slate-800 px-4 py-3">
          <pre className="text-[10px] text-slate-500 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
            {job.logs}
          </pre>
        </div>
      )}
    </motion.div>
  );
}

// ─── Indicador de créditos ────────────────────────────────────────────────────

function CreditBadge({ credits }: { credits: number }) {
  const color =
    credits <= 1 ? "text-green-400 bg-green-500/10 border-green-500/20" :
    credits <= 5 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" :
                   "text-red-400 bg-red-500/10 border-red-500/20";
  return (
    <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium", color)}>
      <CreditCard size={10} />
      {credits} crédito{credits !== 1 ? "s" : ""}
    </span>
  );
}

// ─── Formulário Busca Rápida ──────────────────────────────────────────────────

function FormBuscaRapida({
  onSubmit,
  loading,
}: {
  onSubmit: (query: string, max: number, phone: boolean, email: boolean) => void;
  loading: boolean;
}) {
  const [exIdx, setExIdx] = useState(0);
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [onlyEmail, setOnlyEmail] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormRapida>({
    resolver: zodResolver(schemaRapida),
    defaultValues: { max_results: 20 },
  });

  const maxVal = Number(watch("max_results")) || 20;
  const credits = Math.ceil(maxVal / 20);

  useEffect(() => {
    const t = setInterval(() => setExIdx((i) => (i + 1) % EXEMPLOS_RAPIDOS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const submit = (data: FormRapida) => {
    onSubmit(data.query, data.max_results, onlyPhone, onlyEmail);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {/* Query */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          Busca no Google Maps
        </label>
        <textarea
          {...register("query")}
          rows={3}
          placeholder={EXEMPLOS_RAPIDOS[exIdx]}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 resize-none"
        />
        {errors.query && <p className="text-red-400 text-xs mt-1">{errors.query.message}</p>}
        <p className="text-xs text-slate-600 mt-1">Formato: "nicho em cidade estado"</p>
      </div>

      {/* Max results */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          Máximo de resultados
        </label>
        <input
          {...register("max_results")}
          type="number" min={1} max={100}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500/40"
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-slate-600">Máximo 100 neste modo</p>
          <CreditBadge credits={credits} />
        </div>
        {credits > 5 && (
          <p className="text-xs text-yellow-400/80 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 mt-1">
            ⚠️ Use o <strong>Modo Volume</strong> para buscas grandes.
          </p>
        )}
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={12} className="text-slate-500" />
          <label className="text-xs font-medium text-slate-400">Salvar apenas com:</label>
        </div>
        {[
          { state: onlyPhone, set: setOnlyPhone, icon: <Phone size={13} />, label: "Telefone obrigatório", active: "bg-sky-600/20 border-sky-500/50 text-sky-300", toggle: "bg-sky-500" },
          { state: onlyEmail, set: setOnlyEmail, icon: <Mail size={13} />,  label: "Email obrigatório",   active: "bg-violet-600/20 border-violet-500/50 text-violet-300", toggle: "bg-violet-500" },
        ].map(({ state, set, icon, label, active, toggle }) => (
          <button
            key={label} type="button" onClick={() => set(!state)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
              state ? active : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
            )}
          >
            <span className="flex items-center gap-2">{icon}{label}</span>
            <span className={cn("w-8 h-4 rounded-full relative flex-shrink-0", state ? toggle : "bg-slate-700")}>
              <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", state ? "translate-x-4" : "translate-x-0.5")} />
            </span>
          </button>
        ))}
      </div>

      <button
        type="submit" disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20"
      >
        {loading ? <><Loader2 size={15} className="animate-spin" /> Iniciando...</> : <><Play size={15} /> Iniciar Extração</>}
      </button>

      {/* Exemplos */}
      <div>
        <p className="text-xs text-slate-600 mb-2 font-medium">Exemplos rápidos:</p>
        <div className="space-y-1">
          {EXEMPLOS_RAPIDOS.map((ex, i) => (
            <button key={i} type="button" onClick={() => setValue("query", ex)}
              className="w-full text-left text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 px-2 py-1.5 rounded-lg transition-colors">
              {ex}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

// ─── Formulário Busca em Volume ───────────────────────────────────────────────

function FormBuscaVolume({
  onSubmit,
  loading,
}: {
  onSubmit: (query: string, max: number, phone: boolean, email: boolean) => void;
  loading: boolean;
}) {
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [onlyEmail, setOnlyEmail] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormVolume>({
    resolver: zodResolver(schemaVolume),
    defaultValues: { max_results: 100, confirmado: false },
  });

  const maxVal   = Number(watch("max_results")) || 100;
  const credits  = Math.ceil(maxVal / 20);
  const confirmado = watch("confirmado");

  const submit = (data: FormVolume) => {
    const query = `${data.nicho} em ${data.cidade} ${data.estado}`;
    onSubmit(query, data.max_results, onlyPhone, onlyEmail);
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">

      {/* Aviso inicial */}
      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
        <TriangleAlert size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/90">
          Este modo faz <strong>múltiplas chamadas</strong> à SerpAPI.
          Cada 20 resultados = 1 crédito. Use com atenção ao seu saldo.
        </p>
      </div>

      {/* Campos separados */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">Nicho / Segmento</label>
        <input
          {...register("nicho")}
          placeholder="academias, restaurantes, gráficas..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
        />
        {errors.nicho && <p className="text-red-400 text-xs mt-1">{errors.nicho.message}</p>}
        <div className="flex flex-wrap gap-1 mt-2">
          {EXEMPLOS_NICHO.slice(0, 5).map((n) => (
            <button key={n} type="button" onClick={() => setValue("nicho", n)}
              className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white hover:border-violet-500/50 transition-all">
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="text-xs font-medium text-slate-400 mb-2 block">Cidade</label>
          <input
            {...register("cidade")}
            placeholder="São Paulo, Campinas..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
          {errors.cidade && <p className="text-red-400 text-xs mt-1">{errors.cidade.message}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-slate-400 mb-2 block">Estado</label>
          <select
            {...register("estado")}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          >
            <option value="">UF</option>
            {ESTADOS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
          </select>
          {errors.estado && <p className="text-red-400 text-xs mt-1">{errors.estado.message}</p>}
        </div>
      </div>

      {/* Prévia da query */}
      {watch("nicho") && watch("cidade") && watch("estado") && (
        <div className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-xl">
          <p className="text-xs text-slate-500 mb-0.5">Busca que será feita:</p>
          <p className="text-sm text-white font-mono">
            "{watch("nicho")} em {watch("cidade")} {watch("estado")}"
          </p>
        </div>
      )}

      {/* Quantidade */}
      <div>
        <label className="text-xs font-medium text-slate-400 mb-2 block">
          Quantidade de resultados
        </label>
        <input
          {...register("max_results")}
          type="number" min={100} max={1000} step={20}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
        />
        {errors.max_results && <p className="text-red-400 text-xs mt-1">{errors.max_results.message}</p>}

        {/* Indicador visual de créditos */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Custo estimado</span>
            <CreditBadge credits={credits} />
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                credits <= 10 ? "bg-green-500" :
                credits <= 25 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${Math.min((credits / 50) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-600">
            {credits} crédito{credits !== 1 ? "s" : ""} × ~R$0,05 = ~R${(credits * 0.05).toFixed(2)} estimado
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Filter size={12} className="text-slate-500" />
          <label className="text-xs font-medium text-slate-400">Salvar apenas com:</label>
        </div>
        {[
          { state: onlyPhone, set: setOnlyPhone, icon: <Phone size={13} />, label: "Telefone obrigatório", active: "bg-sky-600/20 border-sky-500/50 text-sky-300", toggle: "bg-sky-500" },
          { state: onlyEmail, set: setOnlyEmail, icon: <Mail size={13} />,  label: "Email obrigatório",   active: "bg-violet-600/20 border-violet-500/50 text-violet-300", toggle: "bg-violet-500" },
        ].map(({ state, set, icon, label, active, toggle }) => (
          <button key={label} type="button" onClick={() => set(!state)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm font-medium transition-all",
              state ? active : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
            )}>
            <span className="flex items-center gap-2">{icon}{label}</span>
            <span className={cn("w-8 h-4 rounded-full relative flex-shrink-0", state ? toggle : "bg-slate-700")}>
              <span className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform", state ? "translate-x-4" : "translate-x-0.5")} />
            </span>
          </button>
        ))}
      </div>

      {/* Confirmação obrigatória */}
      <label className={cn(
        "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
        confirmado
          ? "bg-green-500/10 border-green-500/30"
          : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
      )}>
        <input type="checkbox" {...register("confirmado")} className="mt-0.5 accent-green-500" />
        <span className="text-xs text-slate-300">
          Entendo que esta busca usará <strong className="text-white">{credits} crédito{credits !== 1 ? "s" : ""}</strong> da
          minha conta SerpAPI e confirmo que desejo continuar.
        </span>
      </label>
      {errors.confirmado && (
        <p className="text-red-400 text-xs -mt-2">{errors.confirmado.message}</p>
      )}

      <button
        type="submit" disabled={loading || !confirmado}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/20"
      >
        {loading ? <><Loader2 size={15} className="animate-spin" /> Iniciando...</> : <><Package size={15} /> Iniciar Busca em Volume</>}
      </button>
    </form>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ScrapingPage() {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<"rapida" | "volume">("rapida");

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["scraping-jobs"],
    queryFn: () => scrapingApi.listJobs(),
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: ({ query, max_results, onlyPhone, onlyEmail }: {
      query: string; max_results: number; onlyPhone: boolean; onlyEmail: boolean;
    }) => scrapingApi.createJob(query, max_results, onlyPhone, onlyEmail),
    onSuccess: (job) => {
      toast.success(`Job iniciado! Buscando: "${job.query}"`);
      queryClient.invalidateQueries({ queryKey: ["scraping-jobs"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Erro ao criar job");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: scrapingApi.cancelJob,
    onSuccess: () => {
      toast.info("Job cancelado");
      queryClient.invalidateQueries({ queryKey: ["scraping-jobs"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: scrapingApi.deleteJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scraping-jobs"] }),
  });

  const handleSubmit = (query: string, max_results: number, onlyPhone: boolean, onlyEmail: boolean) => {
    createMutation.mutate({ query, max_results, onlyPhone, onlyEmail });
  };

  const jobs: ScrapingJob[] = jobsData?.items || [];
  const activeJobs = jobs.filter((j) => j.status === "executando").length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Scraping</h1>
          <p className="text-slate-500 text-sm mt-1">
            Extraia leads automaticamente do Google Maps
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Painel de configuração */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-6">

              {/* Seletor de modo */}
              <div className="flex gap-2 mb-5 p-1 bg-slate-800 rounded-xl">
                <button
                  onClick={() => setModo("rapida")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                    modo === "rapida"
                      ? "bg-blue-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  <Target size={13} /> Busca Rápida
                </button>
                <button
                  onClick={() => setModo("volume")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
                    modo === "volume"
                      ? "bg-violet-600 text-white shadow"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  <Package size={13} /> Volume
                </button>
              </div>

              {/* Descrição do modo */}
              <AnimatePresence mode="wait">
                {modo === "rapida" ? (
                  <motion.div
                    key="desc-rapida"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-start gap-2 mb-4 p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl"
                  >
                    <Zap size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-300 font-medium">🎯 Busca Rápida</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        1 campo · até 100 resultados · <span className="text-green-400">1–5 créditos</span>
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="desc-volume"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-start gap-2 mb-4 p-3 bg-violet-500/5 border border-violet-500/15 rounded-xl"
                  >
                    <Package size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-300 font-medium">📦 Busca em Volume</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Nicho + Cidade + Estado · até 1000 resultados · <span className="text-yellow-400">5–50 créditos</span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Formulário ativo */}
              <AnimatePresence mode="wait">
                {modo === "rapida" ? (
                  <motion.div key="form-rapida" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                    <FormBuscaRapida onSubmit={handleSubmit} loading={createMutation.isPending} />
                  </motion.div>
                ) : (
                  <motion.div key="form-volume" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    <FormBuscaVolume onSubmit={handleSubmit} loading={createMutation.isPending} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Lista de jobs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Histórico de Jobs
                {activeJobs > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full font-medium">
                    {activeJobs} ativo{activeJobs > 1 ? "s" : ""}
                  </span>
                )}
              </h2>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ["scraping-jobs"] })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
              >
                <RefreshCw size={12} /> Atualizar
              </button>
            </div>

            {jobsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-slate-900 border border-slate-800 rounded-2xl shimmer" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
                <div className="text-4xl mb-3">🔎</div>
                <h3 className="text-slate-300 font-medium mb-1">Nenhum job ainda</h3>
                <p className="text-slate-600 text-sm">Configure uma busca e inicie a extração</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onCancel={(id) => cancelMutation.mutate(id)}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
