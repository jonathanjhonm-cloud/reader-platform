# Lumen Reader — Instruções para agentes

## Visão geral

Este repositório contém uma plataforma pessoal de leitura. Há dois aplicativos independentes:

- `backend/`: API NestJS com Fastify, Prisma e PostgreSQL.
- `frontend/`: aplicação Next.js com App Router, Tailwind CSS 4 e componentes no padrão shadcn/ui.

O backend é a fonte de verdade de autenticação, conteúdo por usuário, progresso, marcações e integração Google Drive. O frontend consome a API em `http://localhost:3001/api` durante o desenvolvimento.

## Convenções gerais

- Use `npm` como gerenciador de pacotes nos dois aplicativos. Não introduza `pnpm-lock.yaml`, Yarn ou Bun.
- Faça mudanças mínimas, focadas e compatíveis com o código existente.
- Nunca leia, exponha, modifique ou versione arquivos `.env`, `.env.local` ou credenciais.
- Mantenha arquivos de exemplo (`.env.example` e `.env.local.example`) atualizados sempre que uma nova variável for exigida.
- Não altere migrações Prisma já aplicadas. Para mudanças de schema, crie uma nova migração.
- Preserve o português brasileiro nas mensagens destinadas ao usuário e na interface.
- Antes de alterações grandes, inspecione os arquivos relevantes e verifique o status Git.

## Backend (`backend/`)

### Stack e arquitetura

- NestJS 11 com adaptador Fastify.
- Prisma ORM e PostgreSQL 16 via `docker-compose.yml`.
- Todas as rotas HTTP têm o prefixo `/api`.
- Autenticação usa access token JWT no header `Authorization: Bearer <token>` e refresh token em cookie `HttpOnly`.
- O acesso a livros, progresso, anotações e destaques deve sempre ser filtrado pelo usuário autenticado (`userId`). Nunca aceite `userId` diretamente do cliente.
- Tokens da conta Google são persistidos cifrados. Preserve a variável `GOOGLE_TOKEN_ENCRYPTION_KEY` e nunca retorne tokens Google nas respostas da API.

### Comandos

Execute os comandos dentro de `backend/`:

```powershell
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:migrate -- --name <nome_da_migracao>
npm run build
npm run start:dev
```

### Mudanças no banco

1. Edite `backend/prisma/schema.prisma`.
2. Gere uma migração descritiva com `npm run prisma:migrate -- --name <nome_da_migracao>`.
3. Verifique se a migração nova está em `backend/prisma/migrations/`.
4. Rode `npm run build`.

Não use `prisma db push` como substituto de migrações versionadas.

### Google OAuth e Drive

- Login: `GET /api/auth/google`.
- Callback: `GET /api/auth/google/callback`.
- Listagem de arquivos de leitura: `GET /api/drive/reading-files`.
- Download autorizado: `GET /api/drive/files/:fileId/content`.
- Para desenvolvimento, o callback registrado no Google Cloud deve ser `http://localhost:3001/api/auth/google/callback` e `FRONTEND_URL` deve ser `http://localhost:3000`.

## Frontend (`frontend/`)

### Stack e arquitetura

- Next.js App Router, React e TypeScript.
- Tailwind CSS 4.
- Componentes reutilizáveis ficam em `frontend/components/ui/` e seguem o padrão shadcn/ui.
- Utilitários compartilhados ficam em `frontend/lib/`.
- A URL da API vem de `NEXT_PUBLIC_API_URL`, com fallback para `http://localhost:3001/api`.
- Mantenha o visual escuro, simples e focado em leitura: superfícies discretas, bordas suaves, boa hierarquia tipográfica e sidebar responsiva.

### Comandos

Execute os comandos dentro de `frontend/`:

```powershell
npm install
npm run dev
npm run build
npm run lint
```

### Integração com API

- Centralize chamadas HTTP em `frontend/lib/api.ts`.
- Envie `credentials: 'include'` em fluxos que dependem do refresh token.
- Não guarde refresh tokens no frontend.
- O access token pode ficar apenas em memória ou `sessionStorage`; não use `localStorage`.
- Para novas telas protegidas, trate ausência ou expiração de sessão redirecionando para `/login`.

## Validação antes de concluir

Escolha os comandos aplicáveis às mudanças realizadas:

```powershell
# backend
cd backend
npm run prisma:generate
npm run build

# frontend
cd ../frontend
npm run build
npm run lint
```

Se algum comando não puder ser executado, explique o motivo e informe exatamente o que falta para validá-lo.

## Git

- Não inclua `.env`, `.env.local`, `node_modules`, `dist`, `.next` ou dados locais no Git.
- Prefira commits pequenos, com mensagens claras em inglês, por exemplo: `feat: add reader highlights`.
- Antes de commitar, confira `git status` e confirme que nenhum segredo está preparado para envio.
