"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Github, Link2, Link2Off, Eye, EyeOff, CheckCircle2,
  Loader2, RefreshCw, UploadCloud, Lock, Globe,
  ExternalLink, ShieldAlert, Trash2, Plus, GitBranch,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { githubApi } from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type { GitHubRepo } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-slate-900 border border-slate-800 rounded-2xl p-6", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: {
  icon: React.ReactNode; title: string; subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Card 1: Conectar conta ────────────────────────────────────────────────────

function CardConectar({ connected, username, avatarUrl, onRefresh }: {
  connected: boolean;
  username?: string;
  avatarUrl?: string;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const connectMutation = useMutation({
    mutationFn: () => githubApi.connect(token),
    onSuccess: (data) => {
      toast.success(`Conectado como @${data.username}!`);
      setToken("");
      queryClient.invalidateQueries({ queryKey: ["github-status"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Token inválido");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: githubApi.disconnect,
    onSuccess: () => {
      toast.info("GitHub desconectado");
      queryClient.invalidateQueries({ queryKey: ["github-status"] });
    },
  });

  return (
    <Card>
      <SectionTitle
        icon={<Github size={18} className="text-white" />}
        title="Conta GitHub"
        subtitle="Conecte via Personal Access Token (PAT)"
      />

      {connected ? (
        /* ── Conectado ── */
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
            <img
              src={avatarUrl || `https://github.com/${username}.png`}
              alt={username}
              className="w-10 h-10 rounded-full ring-2 ring-green-500/40"
            />
            <div>
              <p className="text-sm font-semibold text-white">@{username}</p>
              <p className="text-xs text-green-400 flex items-center gap-1">
                <CheckCircle2 size={10} /> Conectado com sucesso
              </p>
            </div>
          </div>

          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 hover:bg-red-500/20 transition-all"
          >
            {disconnectMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Link2Off size={14} />}
            Desconectar
          </button>
        </div>
      ) : (
        /* ── Desconectado ── */
        <div className="space-y-4">
          <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-xl text-xs text-slate-400 space-y-1.5">
            <p className="font-medium text-slate-300">Como gerar um token:</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-500">
              <li>Acesse <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">github.com/settings/tokens</a></li>
              <li>Clique em <strong className="text-slate-300">Generate new token (classic)</strong></li>
              <li>Marque as permissões: <code className="bg-slate-800 px-1 rounded">repo</code> e <code className="bg-slate-800 px-1 rounded">read:user</code></li>
              <li>Copie e cole abaixo</li>
            </ol>
          </div>

          <div className="relative">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <button
            onClick={() => connectMutation.mutate()}
            disabled={!token || connectMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all"
          >
            {connectMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Validando...</>
              : <><Link2 size={14} /> Conectar ao GitHub</>}
          </button>
        </div>
      )}
    </Card>
  );
}

// ── Card 2: Repositório ───────────────────────────────────────────────────────

function CardRepositorio({ connected, repoName, repoUrl, onRefresh }: {
  connected: boolean;
  repoName?: string;
  repoUrl?: string;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(repoName || "extrator-leads");
  const [desc, setDesc] = useState("Gerado pelo Extrator Leads Pro");
  const [isPrivate, setIsPrivate] = useState(true);
  const [mode, setMode] = useState<"criar" | "selecionar">("criar");
  const [selectedRepo, setSelectedRepo] = useState("");

  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: ["github-repos"],
    queryFn: githubApi.repos,
    enabled: connected && mode === "selecionar",
  });

  const createMutation = useMutation({
    mutationFn: () => githubApi.createRepo(name, isPrivate, desc),
    onSuccess: (data) => {
      toast.success(`Repositório "${data.name}" criado!`);
      queryClient.invalidateQueries({ queryKey: ["github-status"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Erro ao criar repositório");
    },
  });

  const selectMutation = useMutation({
    mutationFn: () => {
      const repo = reposData?.repos.find((r: GitHubRepo) => r.full_name === selectedRepo);
      if (!repo) throw new Error("Selecione um repositório");
      return githubApi.createRepo(repo.name, repo.private, "");
    },
    onSuccess: (data) => {
      toast.success(`Repositório "${data.name}" selecionado!`);
      queryClient.invalidateQueries({ queryKey: ["github-status"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Erro");
    },
  });

  if (!connected) {
    return (
      <Card>
        <SectionTitle
          icon={<GitBranch size={18} className="text-slate-500" />}
          title="Repositório"
          subtitle="Conecte o GitHub primeiro"
        />
        <div className="py-8 text-center text-slate-600 text-sm">
          Conecte sua conta GitHub para configurar o repositório
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle
        icon={<GitBranch size={18} className="text-violet-400" />}
        title="Repositório"
        subtitle="Crie ou selecione onde o código será publicado"
      />

      {repoUrl && (
        <a
          href={repoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400 hover:bg-green-500/15 transition-all"
        >
          <CheckCircle2 size={14} />
          <span className="flex-1 truncate font-mono text-xs">{repoUrl}</span>
          <ExternalLink size={12} />
        </a>
      )}

      {/* Modo toggle */}
      <div className="flex gap-2 mb-4 p-1 bg-slate-800 rounded-xl">
        {[
          { id: "criar", label: "Criar novo", icon: <Plus size={12} /> },
          { id: "selecionar", label: "Usar existente", icon: <RefreshCw size={12} /> },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as "criar" | "selecionar")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all",
              mode === m.id ? "bg-violet-600 text-white shadow" : "text-slate-400 hover:text-white"
            )}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {mode === "criar" ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Nome do repositório</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="extrator-leads"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 mb-1.5 block">Descrição (opcional)</label>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descrição do repositório"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <div className="flex gap-2">
            {[
              { value: true,  icon: <Lock size={12} />,  label: "Privado" },
              { value: false, icon: <Globe size={12} />, label: "Público" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => setIsPrivate(opt.value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all",
                  isPrivate === opt.value
                    ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                )}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all"
          >
            {createMutation.isPending
              ? <><Loader2 size={14} className="animate-spin" /> Criando...</>
              : <><Plus size={14} /> Criar Repositório</>}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reposLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 size={18} className="animate-spin mr-2" /> Carregando repositórios...
            </div>
          ) : (
            <>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              >
                <option value="">Selecione um repositório...</option>
                {reposData?.repos.map((r: GitHubRepo) => (
                  <option key={r.id} value={r.full_name}>
                    {r.private ? "🔒" : "🌐"} {r.full_name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => selectMutation.mutate()}
                disabled={!selectedRepo || selectMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-all"
              >
                {selectMutation.isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Selecionando...</>
                  : <><CheckCircle2 size={14} /> Usar este repositório</>}
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Card 3: Publicar código ───────────────────────────────────────────────────

function CardPublicar({ connected, repoUrl, repoName, initialized, lastPush }: {
  connected: boolean;
  repoUrl?: string;
  repoName?: string;
  initialized: boolean;
  lastPush?: string;
}) {
  const queryClient = useQueryClient();
  const [log, setLog] = useState("");

  const pushMutation = useMutation({
    mutationFn: githubApi.push,
    onSuccess: (data) => {
      setLog(data.log);
      toast.success("Push realizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["github-status"] });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail || "Erro ao fazer push";
      setLog(detail);
      toast.error("Falha no push — veja o log abaixo");
    },
  });

  const canPush = connected && !!repoUrl;

  return (
    <Card>
      <SectionTitle
        icon={<UploadCloud size={18} className={canPush ? "text-blue-400" : "text-slate-500"} />}
        title="Publicar Código"
        subtitle="Faz upload e commit do código para o GitHub"
      />

      {/* Status */}
      <div className="mb-4 p-3 bg-slate-800/60 border border-slate-700 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Repositório</span>
          <span className={cn("font-medium", repoName ? "text-white" : "text-slate-600")}>
            {repoName || "Nenhum configurado"}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Status</span>
          <span className={cn(
            "font-medium flex items-center gap-1",
            initialized ? "text-green-400" : "text-slate-500"
          )}>
            {initialized ? <><CheckCircle2 size={10} /> Publicado</> : "Aguardando 1º push"}
          </span>
        </div>
        {lastPush && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Último push</span>
            <span className="text-slate-300">{formatDateTime(lastPush)}</span>
          </div>
        )}
      </div>

      {/* Aviso segurança */}
      <div className="flex items-start gap-2 mb-4 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
        <ShieldAlert size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-400">
          <strong className="text-amber-400">Protegidos e não enviados:</strong>{" "}
          <code className="text-slate-500">.env</code>,{" "}
          <code className="text-slate-500">leads.db</code>,{" "}
          <code className="text-slate-500">github_config.json</code>,{" "}
          <code className="text-slate-500">venv/</code>,{" "}
          <code className="text-slate-500">node_modules/</code>
        </p>
      </div>

      <button
        onClick={() => pushMutation.mutate()}
        disabled={!canPush || pushMutation.isPending}
        className={cn(
          "w-full flex items-center justify-center gap-2 font-semibold py-3 rounded-xl transition-all text-white",
          canPush
            ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 shadow-lg shadow-blue-500/20"
            : "bg-slate-800 border border-slate-700 opacity-50 cursor-not-allowed",
          pushMutation.isPending && "opacity-80"
        )}
      >
        {pushMutation.isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Publicando...</>
        ) : (
          <><UploadCloud size={16} /> {initialized ? "Atualizar no GitHub" : "🚀 Publicar Agora"}</>
        )}
      </button>

      {!canPush && (
        <p className="text-xs text-slate-600 text-center mt-2">
          {!connected ? "Conecte o GitHub primeiro" : "Configure um repositório primeiro"}
        </p>
      )}

      {/* Log */}
      {log && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-400 mb-1.5">Log do git:</p>
          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[10px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
            {log}
          </pre>
        </div>
      )}
    </Card>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["github-status"],
    queryFn: githubApi.status,
    refetchInterval: 30_000,
  });

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Configurações</h1>
            <p className="text-slate-500 text-sm mt-1">Integração GitHub e preferências do sistema</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["github-status"] })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 size={22} className="animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CardConectar
              connected={status?.connected ?? false}
              username={status?.username}
              avatarUrl={status?.avatar_url}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["github-status"] })}
            />
            <CardRepositorio
              connected={status?.connected ?? false}
              repoName={status?.repo_name}
              repoUrl={status?.repo_url}
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ["github-status"] })}
            />
            <CardPublicar
              connected={status?.connected ?? false}
              repoUrl={status?.repo_url}
              repoName={status?.repo_name}
              initialized={status?.initialized ?? false}
              lastPush={status?.last_push}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
