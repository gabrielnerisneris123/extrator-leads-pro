export type LeadStatus =
  | "novo"
  | "contato_iniciado"
  | "negociacao"
  | "fechado"
  | "descartado";

export type JobStatus =
  | "pendente"
  | "executando"
  | "concluido"
  | "erro"
  | "cancelado";

export interface Lead {
  id: string;
  nome: string;
  categoria?: string;
  website?: string;
  telefone?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  google_maps_url?: string;
  nota?: number;
  total_reviews?: number;
  place_id?: string;
  status: LeadStatus;
  observacoes?: string;
  tags?: string[];
  has_email: boolean;
  has_whatsapp: boolean;
  has_instagram: boolean;
  has_website: boolean;
  scraped_at: string;
  updated_at: string;
  job_id?: string;
  notes?: LeadNote[];
}

export interface LeadNote {
  id: string;
  content: string;
  created_at: string;
}

export interface LeadListResponse {
  items: Lead[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ScrapingJob {
  id: string;
  query: string;
  cidade?: string;
  estado?: string;
  nicho?: string;
  max_results: number;
  status: JobStatus;
  progress: number;
  total_found: number;
  total_scraped: number;
  total_emails: number;
  error_message?: string;
  logs?: string;
  config?: {
    only_with_phone?: boolean;
    only_with_email?: boolean;
  };
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

export interface DashboardStats {
  total_leads: number;
  leads_with_email: number;
  leads_with_whatsapp: number;
  leads_with_instagram: number;
  leads_novos: number;
  leads_em_negociacao: number;
  leads_fechados: number;
  taxa_email: number;
  taxa_whatsapp: number;
  total_jobs: number;
  jobs_running: number;
  leads_by_cidade: Array<{ cidade: string; count: number }>;
  leads_by_nicho: Array<{ nicho: string; count: number }>;
  leads_by_status: Array<{ status: string; count: number }>;
  leads_by_day: Array<{ day: string; count: number }>;
  top_cidades: Array<{ cidade: string; count: number }>;
  top_nichos: Array<{ nicho: string; count: number }>;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface GitHubStatus {
  connected: boolean;
  username?: string;
  avatar_url?: string;
  repo_name?: string;
  repo_url?: string;
  initialized: boolean;
  last_push?: string;
  project_root?: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
}

export interface LeadFilters {
  search?: string;
  cidade?: string;
  estado?: string;
  categoria?: string;
  status?: LeadStatus;
  has_email?: boolean;
  has_whatsapp?: boolean;
  has_instagram?: boolean;
  has_telefone?: boolean;
  nota_min?: number;
  reviews_min?: number;
  page?: number;
  size?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}
