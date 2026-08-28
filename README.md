# Lazy Reader

O **Lumen Reader** é uma plataforma pessoal de leitura criada para centralizar livros e documentos, preservar o progresso do usuário e tornar a leitura mais prática com recursos de inteligência artificial.

O projeto permite importar arquivos locais ou do Google Drive, extrair conteúdo de documentos, identificar título, autor e capa, continuar a leitura do ponto salvo e conversar com um assistente contextual sobre o livro aberto.

## Principais funcionalidades

- Cadastro e autenticação com access token e refresh token.
- Biblioteca individual para cada usuário.
- Upload e processamento de arquivos de leitura.
- Importação de arquivos pelo Google Drive.
- Extração de título, autor, texto e capa dos livros.
- Busca de capa pela Open Library quando o arquivo não possui uma imagem adequada.
- Tela de leitura com progresso salvo.
- Assistente de leitura com IA baseado no conteúdo do livro.
- Destaques e anotações vinculados ao usuário.
- Interface escura e responsiva, focada em leitura.

<img width="1338" height="597" alt="image" src="https://github.com/user-attachments/assets/0cebe3b6-78bb-4ec7-9115-9fa677e3370f" />



## Arquitetura

O repositório contém duas aplicações independentes:

- `backend/`: API construída com NestJS, Fastify, Prisma e PostgreSQL.
- `frontend/`: aplicação web construída com Next.js, React, TypeScript e Tailwind CSS.

Durante o desenvolvimento, o frontend roda em `http://localhost:3000` e consome a API em `http://localhost:3001/api`.

## Requisitos

- Node.js compatível com as versões utilizadas pelos projetos.
- npm.
- Docker e Docker Compose.
- Credenciais do Google Cloud para utilizar a integração com o Drive.
- Chave da API da OpenAI para utilizar o assistente de leitura.

## Executando localmente

### Backend

Crie o arquivo `backend/.env` usando `backend/.env.example` como referência. Não versione esse arquivo.

```powershell
cd backend
npm install
docker compose up -d
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
```

A API ficará disponível em `http://localhost:3001/api`.

O seed de desenvolvimento cria o seguinte acesso:

- E-mail: `leitor@lumen.dev`
- Senha: `Lumen@123456`

Use essas credenciais apenas no ambiente local.

### Frontend

Crie o arquivo `frontend/.env.local` usando `frontend/.env.local.example` como referência.

```powershell
cd frontend
npm install
npm run dev
```

A aplicação ficará disponível em `http://localhost:3000`.

## Validação

```powershell
cd backend
npm run prisma:generate
npm run build

cd ../frontend
npm run build
npm run lint
```

## Prompts do projeto

Use esta seção para registrar os prompts importantes usados durante o desenvolvimento. Você pode duplicar o modelo abaixo para cada novo prompt.

### Prompt 01 — Título ou objetivo

**Contexto**

Descreva aqui o problema, a tela ou a funcionalidade relacionada ao prompt.

**Prompt**

```text
Cole aqui o prompt completo.
```

**Resultado esperado**

Descreva o comportamento ou resultado que o prompt deve produzir.

**Observações**

Registre decisões, limitações e melhorias que podem ser feitas depois.

---

### Prompt 02 — Título ou objetivo

**Contexto**

Adicione o contexto do próximo prompt.

**Prompt**

```text
Cole aqui o prompt completo.
```

**Resultado esperado**

Adicione o resultado esperado.

**Observações**

Adicione observações relevantes.

## Segurança

Nunca adicione ao Git arquivos `.env`, tokens, chaves de API, senhas reais ou credenciais do Google. Mantenha somente valores de exemplo nos arquivos destinados à documentação de configuração.
