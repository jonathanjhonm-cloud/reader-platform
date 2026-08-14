# Reader API

Backend do leitor: NestJS + Fastify + Prisma + PostgreSQL. Todos os registros de livros são sempre filtrados pelo usuário autenticado.

## Rodar localmente

1. Instale Node.js 22 LTS e Docker Desktop.
2. Copie `.env.example` para `.env` e substitua os segredos JWT.
3. Execute `docker compose up -d`.
4. Execute `npm install`.
5. Execute `npm run prisma:generate` e `npm run prisma:migrate -- --name init`.
6. Execute `npm run start:dev`.

A API estará em `http://localhost:3001/api`.

## Rotas iniciais

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cria usuário e sessão |
| POST | `/api/auth/login` | Faz login |
| POST | `/api/auth/refresh` | Renova o access token pelo cookie HttpOnly |
| POST | `/api/auth/logout` | Encerra a sessão atual |
| GET | `/api/auth/me` | Dados do usuário autenticado |
| GET/POST | `/api/books` | Lista/cria livros do usuário |
| GET/DELETE | `/api/books/:bookId` | Obtém/remove um livro próprio |
| PATCH | `/api/books/:bookId/progress` | Salva posição e porcentagem |

Nas rotas protegidas, envie `Authorization: Bearer <accessToken>`.

## Upload e IA

O próximo módulo deve gerar URL de upload temporária para storage de objetos (Cloudflare R2, S3 ou Supabase Storage). O banco guarda somente metadados e a URL do arquivo. A extração e reformatação por IA deve rodar numa fila separada depois do upload.
