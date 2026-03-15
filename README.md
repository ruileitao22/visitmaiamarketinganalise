# Visit Maia Dashboard (GA4 + Search Console + Login)

Dashboard com autenticação obrigatória, gestão de utilizadores e recolha automática de dados reais:

- Login obrigatório para acesso ao painel
- Cada utilizador autenticado pode criar novos utilizadores (email/password)
- Integração com Google Analytics 4 + Search Console
- Atualização automática diária (cron)

## 1) Instalar dependências

```bash
npm install
```

## 2) Configurar ambiente

1. Copia `.env.example` para `.env`
2. Preenche:

- `JWT_SECRET`
- `GA4_PROPERTY_ID`
- `GSC_SITE_URL` (ex: `sc-domain:visitmaia.pt`)
- `GOOGLE_APPLICATION_CREDENTIALS` **ou** `GOOGLE_SERVICE_ACCOUNT_JSON`
- `SEO_AGENT_WEBHOOK_URL` (URL do webhook do n8n para o Agente SEO)
- `SEO_AGENT_WEBHOOK_BEARER` (opcional, token Bearer)
- `SEO_AGENT_WEBHOOK_API_KEY` (opcional, header `x-api-key`)
- `SEO_AGENT_TIMEOUT_MS` (opcional, default `20000`)

### Permissões Google necessárias

A Service Account tem de ter acesso de leitura:

- GA4 Property (`Viewer/Analyst`)
- Search Console Property (`Restricted/Full` no site)

## 3) Correr o projeto

```bash
npm start
```

Servidor: [http://localhost:3000](http://localhost:3000)

## 4) Endpoints principais

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/users` (protegido)
- `GET /api/users` (protegido)
- `GET /api/dashboard` (protegido)
- `POST /api/dashboard/sync` (protegido)
- `GET /api/seo-agent/status` (protegido)
- `POST /api/seo-agent/chat` (protegido)

## 5) Atualização diária automática

Controlada por:

- `DASHBOARD_SYNC_CRON` (default: `0 6 * * *`)
- `DASHBOARD_SYNC_TZ` (default: `Europe/Lisbon`)

A cada execução, os dados são guardados em cache em ficheiro JSON local (`dashboard-store.json`).

