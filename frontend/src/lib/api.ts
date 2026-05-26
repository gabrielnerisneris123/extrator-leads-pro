import axios from "axios";
import type {
  AuthResponse,
  Lead,
  LeadFilters,
  LeadListResponse,
  ScrapingJob,
  DashboardStats,
  GitHubStatus,
  GitHubRepo,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

// Token injection
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth error handling
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── AUTH ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post("/auth/login", { email, password });
    return data;
  },
  register: async (
    email: string,
    password: string,
    full_name: string
  ): Promise<AuthResponse> => {
    const { data } = await api.post("/auth/register", {
      email,
      password,
      full_name,
    });
    return data;
  },
  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  },
};

// ── LEADS ────────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: async (filters: LeadFilters = {}): Promise<LeadListResponse> => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== "")
    );
    const { data } = await api.get("/leads", { params });
    return data;
  },

  get: async (id: string): Promise<Lead> => {
    const { data } = await api.get(`/leads/${id}`);
    return data;
  },

  update: async (id: string, payload: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.patch(`/leads/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/leads/${id}`);
  },

  addNote: async (id: string, content: string) => {
    const { data } = await api.post(`/leads/${id}/notes`, { content });
    return data;
  },
};

// ── SCRAPING ─────────────────────────────────────────────────────────────────
export const scrapingApi = {
  createJob: async (
    query: string,
    max_results = 100,
    only_with_phone = false,
    only_with_email = false,
  ): Promise<ScrapingJob> => {
    const { data } = await api.post("/scraping/jobs", {
      query,
      max_results,
      only_with_phone,
      only_with_email,
    });
    return data;
  },

  listJobs: async (page = 1, size = 20) => {
    const { data } = await api.get("/scraping/jobs", { params: { page, size } });
    return data;
  },

  getJob: async (id: string): Promise<ScrapingJob> => {
    const { data } = await api.get(`/scraping/jobs/${id}`);
    return data;
  },

  cancelJob: async (id: string) => {
    const { data } = await api.post(`/scraping/jobs/${id}/cancel`);
    return data;
  },

  deleteJob: async (id: string) => {
    await api.delete(`/scraping/jobs/${id}`);
  },
};

// ── GITHUB ───────────────────────────────────────────────────────────────────
export const githubApi = {
  status: async (): Promise<GitHubStatus> => {
    const { data } = await api.get("/github/status");
    return data;
  },
  connect: async (token: string) => {
    const { data } = await api.post("/github/connect", { token });
    return data;
  },
  disconnect: async () => {
    const { data } = await api.delete("/github/disconnect");
    return data;
  },
  repos: async (): Promise<{ repos: GitHubRepo[] }> => {
    const { data } = await api.get("/github/repos");
    return data;
  },
  createRepo: async (name: string, isPrivate: boolean, description: string) => {
    const { data } = await api.post("/github/create-repo", {
      name,
      private: isPrivate,
      description,
    });
    return data;
  },
  push: async (): Promise<{ success: boolean; log: string }> => {
    const { data } = await api.post("/github/push");
    return data;
  },
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: async (): Promise<DashboardStats> => {
    const { data } = await api.get("/dashboard/stats");
    return data;
  },
};

// ── EXPORT ───────────────────────────────────────────────────────────────────
export const exportApi = {
  csv: (filters: Partial<LeadFilters> = {}) => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.append(k, String(v));
    });
    const url = `${API_URL}/api/v1/export/csv?${params}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "leads.csv");
    // Add auth header via fetch
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.click();
      });
  },

  excel: (filters: Partial<LeadFilters> = {}) => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params.append(k, String(v));
    });
    const url = `${API_URL}/api/v1/export/excel?${params}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.setAttribute("download", "leads.xlsx");
        link.click();
      });
  },
};
