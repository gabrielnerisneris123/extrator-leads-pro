# 🚀 Extrator Leads Pro

**CRM inteligente de geração de leads empresariais via Google Maps**

Sistema full-stack profissional que extrai automaticamente dados de empresas do Google Maps, enriquece com emails e redes sociais, e organiza tudo em um dashboard visual moderno.

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| 🗺️ **Scraping Google Maps** | Extração automática via Playwright, scroll infinito, anti-bloqueio |
| 📧 **Extração de Emails** | Visita websites, extrai emails com regex robusta |
| 📱 **Redes Sociais** | WhatsApp, Instagram, Facebook, LinkedIn |
| 📊 **Dashboard** | KPIs, gráficos, análise temporal, top cidades/nichos |
| 🔍 **Filtros Avançados** | Por cidade, estado, nicho, contatos, nota, status |
| 💼 **CRM Integrado** | Pipeline de vendas, notas, tags, status |
| 📤 **Exportação** | CSV, Excel formatado, JSON |
| 🔐 **Autenticação** | JWT com sessões persistentes |

---

## 🛠️ Stack

**Backend:** Python · FastAPI · SQLAlchemy · PostgreSQL · Playwright · BeautifulSoup  
**Frontend:** Next.js 14 · React · TailwindCSS · Shadcn/UI · Recharts · TanStack Table  
**Infra:** Docker · Docker Compose · Redis

---

## 🚀 Instalação Rápida

### Pré-requisitos
- Docker e Docker Compose
- OU: Python 3.11+ e Node.js 20+

### Com Docker (Recomendado)

```bash
# 1. Copie o arquivo de ambiente
cp .env.example .env

# 2. Edite as variáveis (opcional)
notepad .env

# 3. Suba todos os serviços
docker-compose up -d

# 4. Acesse
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Docs API: http://localhost:8000/docs
```

### Sem Docker (Desenvolvimento)

#### Backend
```bash
cd backend

# Crie virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Instale dependências
pip install -r requirements.txt

# Instale Playwright
playwright install chromium

# Configure .env
cp ../.env.example .env
# Edite DATABASE_URL para apontar para seu PostgreSQL local

# Rode as migrations
python -m app.main  # Cria tabelas automaticamente

# Inicie o servidor
uvicorn app.main:app --reload --port 8000
```

#### Frontend
```bash
cd frontend

# Instale dependências
npm install

# Configure
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Inicie
npm run dev
```

---

## 🔑 Acesso Padrão

| Campo | Valor |
|-------|-------|
| Email | `admin@leadspro.com` |
| Senha | `Admin@123456` |

---

## 📖 Como Usar

### 1. Criar um Job de Scraping

Acesse **Scraping** → preencha a busca:
```
academias em campinas sp
restaurantes em são paulo sp
gráficas em jundiaí sp
```

Configure o número máximo de resultados e clique em **Iniciar Extração**.

### 2. Acompanhar o Progresso

O job aparece na lista com:
- Barra de progresso em tempo real
- Contagem de leads e emails encontrados
- Logs detalhados do processo

### 3. Ver os Leads

Acesse **Leads** → use os filtros para:
- Buscar por nome, email, cidade
- Filtrar por status, nota mínima
- Filtrar por tipo de contato (email, WhatsApp, Instagram)

### 4. Gerenciar Pipeline

Clique em qualquer lead para:
- Atualizar status (Novo → Contato → Negociação → Fechado)
- Adicionar observações
- Ver histórico de notas

### 5. Exportar

Acesse **Exportar** → aplique filtros → baixe em CSV, Excel ou JSON.

---

## 🏗️ Arquitetura

```
extrator-leads/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # FastAPI routes
│   │   ├── core/            # Config, DB, Security
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic
│   │   └── scraper/         # Playwright + BeautifulSoup
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/             # Next.js pages
│       ├── components/      # React components
│       ├── lib/             # API client, utils
│       ├── store/           # Zustand state
│       └── types/           # TypeScript types
├── docker-compose.yml
└── .env.example
```

---

## 🔒 Segurança

- JWT com expiração configurável
- Senhas com bcrypt
- CORS configurado
- Rate limiting via delays humanizados no scraper
- User-agent rotation anti-detecção

---

## ⚙️ Variáveis de Ambiente

```env
# Banco de dados
POSTGRES_USER=leads_user
POSTGRES_PASSWORD=leads_pass123
POSTGRES_DB=leads_db

# Auth
SECRET_KEY=sua-chave-secreta-aqui

# Scraping
SCRAPER_HEADLESS=true       # false para ver o browser
SCRAPER_MAX_RETRIES=3
SCRAPER_DELAY_MIN=1500      # ms mínimo entre requests
SCRAPER_DELAY_MAX=4000      # ms máximo entre requests

# Admin padrão
ADMIN_EMAIL=admin@leadspro.com
ADMIN_PASSWORD=Admin@123456
```

---

## 📊 API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/auth/login` | Login |
| GET | `/api/v1/leads` | Listar leads (com filtros) |
| PATCH | `/api/v1/leads/{id}` | Atualizar lead |
| DELETE | `/api/v1/leads/{id}` | Excluir lead |
| POST | `/api/v1/scraping/jobs` | Criar job de scraping |
| GET | `/api/v1/scraping/jobs` | Listar jobs |
| GET | `/api/v1/dashboard/stats` | Estatísticas do dashboard |
| GET | `/api/v1/export/csv` | Exportar CSV |
| GET | `/api/v1/export/excel` | Exportar Excel |
| GET | `/api/v1/export/json` | Exportar JSON |

Documentação completa: `http://localhost:8000/docs`

---

## 📝 Licença

MIT — Use livremente para fins comerciais e pessoais.
