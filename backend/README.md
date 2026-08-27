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
| GET | `/api/auth/google` | Inicia login e conexão com Google Drive |
| GET | `/api/drive/reading-files` | Lista PDFs e EPUBs do Google Drive |
| GET | `/api/drive/files/:fileId/content` | Baixa o arquivo original do Drive |
| POST | `/api/drive/files/:fileId/import` | Importa, extrai e organiza o livro para leitura |
| GET/POST | `/api/books` | Lista/cria livros do usuário |
| GET/DELETE | `/api/books/:bookId` | Obtém/remove um livro próprio |
| GET | `/api/books/:bookId/content` | Retorna as seções processadas em ordem de leitura |
| PATCH | `/api/books/:bookId/progress` | Salva posição e porcentagem |
| POST | `/api/books/upload` | Envia e processa um PDF ou EPUB diretamente |
| POST | `/api/books/:bookId/assistant` | Analisa um trecho com o assistente de leitura |
| GET | `/api/books/:bookId/cover` | Retorna a capa armazenada do livro |
| POST | `/api/books/:bookId/cover/refresh` | Procura uma capa pelo título e autor |

Nas rotas protegidas, envie `Authorization: Bearer <accessToken>`.

## Google Login e Drive

1. No [Google Cloud Console](https://console.cloud.google.com/), crie ou selecione um projeto e ative a **Google Drive API**.
2. Em **APIs e Services > Credentials**, crie uma credencial **OAuth client ID** do tipo **Web application**.
3. Adicione `http://localhost:3001/api/auth/google/callback` em **Authorized redirect URIs**.
4. Copie o Client ID e Client Secret para as variáveis `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` do `.env`.
5. Gere a chave de cifra de tokens e guarde-a fora do Git:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

6. Cole o resultado em `GOOGLE_TOKEN_ENCRYPTION_KEY` e execute uma nova migração:

```powershell
npm run prisma:migrate -- --name add_google_account
```

O login começa em `GET /api/auth/google`. Após a autorização, a API salva o refresh token do Google cifrado e redireciona o navegador para `FRONTEND_URL/auth/callback`.

Com o access token da sua API, use `GET /api/drive/reading-files` para listar PDFs e EPUBs do Drive e `GET /api/drive/files/:fileId/content` para baixá-los. O escopo `drive.readonly` permite leitura dos arquivos e requer verificação do Google antes de disponibilizar o produto publicamente.

Para preparar um arquivo para o leitor, chame `POST /api/drive/files/:fileId/import`. A API cria o livro com status `PENDING` e envia o trabalho para uma fila Redis. Um worker baixa o arquivo, extrai o texto localmente, normaliza o conteúdo e persiste páginas de PDF ou capítulos de EPUB como seções ordenadas. Consulte o status e o resultado em `GET /api/books/:bookId/content`. O tamanho máximo padrão é 50 MB e pode ser configurado por `MAX_IMPORT_FILE_SIZE_MB`.

Quando uma página de PDF não contém texto suficiente, o worker renderiza a página e aplica OCR local em português com Tesseract. A fila tenta novamente falhas transitórias três vezes por padrão. Redis é iniciado pelo `docker compose` e pode ser configurado por `REDIS_URL`.

O upload direto não depende do Google Drive: envie um formulário `multipart/form-data` com o arquivo no campo `file` para `POST /api/books/upload`. Para habilitar o assistente de leitura, configure `OPENAI_API_KEY` e, opcionalmente, `OPENAI_MODEL`.

Durante o processamento, a API extrai a capa indicada no EPUB ou renderiza a primeira página do PDF. Quando não encontra uma imagem no arquivo, consulta a Open Library pelo título e autor, respeitando o limite de uma busca por segundo, e armazena o resultado localmente. Configure `OPEN_LIBRARY_CONTACT_EMAIL` para identificar chamadas frequentes conforme as orientações do serviço.

## Upload e IA

O próximo módulo deve gerar URL de upload temporária para storage de objetos (Cloudflare R2, S3 ou Supabase Storage). O banco guarda somente metadados e a URL do arquivo. A extração e reformatação por IA deve rodar numa fila separada depois do upload.
