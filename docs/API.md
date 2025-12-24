# Brok Admin API - Documentação

## Visão Geral

A API do Brok Admin é construída com Hono e oferece endpoints para gerenciar o bot Discord da BeroLab. Todas as rotas protegidas requerem autenticação via Discord OAuth.

**Base URL:** `http://localhost:3001` (dev) ou sua URL de produção

---

## Autenticação

### Como funciona

1. Usuário faz login via Discord OAuth
2. Better Auth cria uma sessão e armazena cookies
3. Requisições subsequentes incluem o cookie de sessão automaticamente
4. Middleware verifica se o Discord ID do usuário está na whitelist `AdminUser`

### Configuração no Frontend

```typescript
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL, // http://localhost:3001
});

export const { signIn, signOut, useSession } = authClient;
```

### Login com Discord

```typescript
// components/login-button.tsx
import { signIn } from "@/lib/auth-client";

export function LoginButton() {
  const handleLogin = () => {
    signIn.social({
      provider: "discord",
      callbackURL: "/dashboard", // redirect após login
    });
  };

  return <button onClick={handleLogin}>Entrar com Discord</button>;
}
```

### Verificar Sessão

```typescript
// hooks/use-auth.ts
import { useSession } from "@/lib/auth-client";

export function useAuth() {
  const { data: session, isPending } = useSession();

  return {
    user: session?.user,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
  };
}
```

### Configurar Fetch com Credenciais

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include", // IMPORTANTE: envia cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "API Error");
  }

  return res.json();
}
```

---

## Endpoints

### Health Check

```
GET /health
```

Verifica se a API está funcionando.

**Response:**
```json
{ "status": "ok" }
```

---

## Rotas de Autenticação

Todas gerenciadas pelo Better Auth em `/api/auth/*`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/auth/session` | Retorna sessão atual |
| POST | `/api/auth/sign-in/social` | Inicia OAuth flow |
| POST | `/api/auth/sign-out` | Encerra sessão |

---

## Prompts

### Listar Todos os Prompts

```
GET /api/prompts
```

**Response:**
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "slug": "informative",
    "name": "Modo Informativo",
    "description": "Modo padrão do Brok",
    "content": "Você é o Brok...",
    "isActive": true,
    "createdAt": "2025-01-22T10:00:00.000Z",
    "updatedAt": "2025-01-22T10:00:00.000Z"
  }
]
```

**Exemplo no Frontend:**
```typescript
// hooks/use-prompts.ts
import useSWR from "swr";
import { api } from "@/lib/api";

export function usePrompts() {
  return useSWR("/api/prompts", (url) => api(url));
}
```

---

### Obter Prompt por Slug

```
GET /api/prompts/:slug
```

**Parâmetros:**
- `slug` - Identificador único do prompt (ex: "informative", "acid", "laele")

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "slug": "informative",
  "name": "Modo Informativo",
  "description": "Modo padrão do Brok",
  "content": "Você é o Brok...",
  "isActive": true,
  "createdAt": "2025-01-22T10:00:00.000Z",
  "updatedAt": "2025-01-22T10:00:00.000Z"
}
```

**Erros:**
- `404` - Prompt não encontrado

---

### Criar Novo Prompt

```
POST /api/prompts
```

**Body:**
```json
{
  "slug": "custom-mode",
  "name": "Modo Customizado",
  "description": "Descrição opcional",
  "content": "Você é o Brok em modo customizado...",
  "isActive": true
}
```

**Validações:**
- `slug`: 1-50 caracteres, apenas letras minúsculas, números e hífens
- `name`: 1-100 caracteres
- `description`: máximo 500 caracteres (opcional)
- `content`: obrigatório, sem limite

**Response:** `201 Created`
```json
{
  "id": "507f1f77bcf86cd799439012",
  "slug": "custom-mode",
  ...
}
```

**Erros:**
- `409` - Slug já existe

**Exemplo no Frontend:**
```typescript
async function createPrompt(data: CreatePromptData) {
  return api("/api/prompts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
```

---

### Atualizar Prompt

```
PATCH /api/prompts/:slug
```

**Body:** (todos os campos são opcionais)
```json
{
  "name": "Novo Nome",
  "description": "Nova descrição",
  "content": "Novo conteúdo do prompt...",
  "isActive": false
}
```

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "slug": "informative",
  "name": "Novo Nome",
  ...
}
```

**Erros:**
- `404` - Prompt não encontrado

---

### Deletar Prompt

```
DELETE /api/prompts/:slug
```

**Response:**
```json
{ "success": true }
```

**Erros:**
- `404` - Prompt não encontrado

---

### Toggle Ativo/Inativo

```
POST /api/prompts/:slug/toggle
```

Alterna o status `isActive` do prompt.

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "slug": "informative",
  "isActive": false,
  ...
}
```

---

## FAQs

### Buscar FAQs

```
GET /api/faqs
```

**Query Parameters:**
- `q` - Termo de busca (opcional)
- `limit` - Itens por página (1-100, default: 20)
- `offset` - Pular N itens (default: 0)

**Exemplos:**
```
GET /api/faqs?q=berolab&limit=10
GET /api/faqs?limit=20&offset=40
```

**Response:**
```json
{
  "items": [
    {
      "id": "507f1f77bcf86cd799439013",
      "question": "O que é a BeroLab?",
      "answer": "BeroLab é uma comunidade...",
      "createdBy": "123456789",
      "createdAt": "2025-01-22T10:00:00.000Z",
      "updatedAt": "2025-01-22T10:00:00.000Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

**Exemplo no Frontend:**
```typescript
// hooks/use-faqs.ts
import useSWR from "swr";
import { api } from "@/lib/api";

export function useFaqs(search?: string, page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  if (search) params.set("q", search);

  return useSWR(`/api/faqs?${params}`, (url) => api(url));
}
```

---

### Obter FAQ por ID

```
GET /api/faqs/:id
```

**Response:**
```json
{
  "id": "507f1f77bcf86cd799439013",
  "question": "O que é a BeroLab?",
  "answer": "BeroLab é uma comunidade...",
  "createdBy": "123456789",
  "createdAt": "2025-01-22T10:00:00.000Z",
  "updatedAt": "2025-01-22T10:00:00.000Z"
}
```

---

### Deletar FAQ

```
DELETE /api/faqs/:id
```

**Response:**
```json
{ "success": true }
```

---

## Canais do Discord

### Listar Canais

```
GET /api/channels
```

Retorna todos os canais de texto do servidor configurado.

**Response:**
```json
[
  {
    "id": "1234567890123456789",
    "name": "geral",
    "type": 0,
    "parentId": "9876543210987654321"
  },
  {
    "id": "1234567890123456790",
    "name": "anuncios",
    "type": 5,
    "parentId": null
  }
]
```

**Tipos de Canal:**
- `0` - GUILD_TEXT (texto normal)
- `5` - GUILD_ANNOUNCEMENT (anúncios)

**Exemplo no Frontend:**
```typescript
// hooks/use-channels.ts
import useSWR from "swr";
import { api } from "@/lib/api";

export function useChannels() {
  return useSWR("/api/channels", (url) => api(url));
}
```

---

## Mensagens

### Enviar Mensagem

```
POST /api/messages
```

Envia uma mensagem como o bot Brok em um canal específico.

**Body:**
```json
{
  "channelId": "1234567890123456789",
  "content": "Olá, essa é uma mensagem do admin! 🚀"
}
```

**Validações:**
- `channelId`: obrigatório, deve ser um canal válido do servidor
- `content`: 1-2000 caracteres

**Response:**
```json
{
  "success": true,
  "message": { ... } // objeto da mensagem criada
}
```

**Erros:**
- `404` - Canal não encontrado no servidor
- `500` - Falha ao enviar mensagem

**Exemplo no Frontend:**
```typescript
async function sendMessage(channelId: string, content: string) {
  return api("/api/messages", {
    method: "POST",
    body: JSON.stringify({ channelId, content }),
  });
}
```

---

## Códigos de Erro

| Código | Descrição |
|--------|-----------|
| `400` | Bad Request - Dados inválidos |
| `401` | Unauthorized - Não autenticado |
| `403` | Forbidden - Não é admin |
| `404` | Not Found - Recurso não existe |
| `409` | Conflict - Recurso já existe |
| `500` | Internal Server Error |

**Formato de Erro:**
```json
{
  "error": "Mensagem descritiva do erro"
}
```

---

## Configuração de CORS

A API aceita requisições do origin configurado em `API_CORS_ORIGIN`.

**Desenvolvimento:**
```env
API_CORS_ORIGIN=http://localhost:3000
```

**Produção:**
```env
API_CORS_ORIGIN=https://admin.berolab.app
```

---

## Variáveis de Ambiente Necessárias

```env
# API
API_PORT=3001
API_BASE_URL=http://localhost:3001
API_CORS_ORIGIN=http://localhost:3000
BETTER_AUTH_SECRET=sua_chave_secreta_aqui

# Discord OAuth (criar em https://discord.com/developers/applications)
DISCORD_CLIENT_ID=seu_client_id
DISCORD_CLIENT_SECRET=seu_client_secret

# Database
DATABASE_URL=mongodb://localhost:27017/brok?replicaSet=rs0

# Discord Bot (já existente)
DISCORD_TOKEN=seu_bot_token
DISCORD_GUILD_ID=id_do_servidor
```

---

## Exemplo Completo: Hook de Prompts com CRUD

```typescript
// hooks/use-prompts.ts
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";

interface Prompt {
  id: string;
  slug: string;
  name: string;
  description?: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function usePrompts() {
  const { data, error, isLoading } = useSWR<Prompt[]>(
    "/api/prompts",
    (url) => api(url)
  );

  const createPrompt = async (data: Omit<Prompt, "id" | "createdAt" | "updatedAt">) => {
    const result = await api<Prompt>("/api/prompts", {
      method: "POST",
      body: JSON.stringify(data),
    });
    mutate("/api/prompts");
    return result;
  };

  const updatePrompt = async (slug: string, data: Partial<Prompt>) => {
    const result = await api<Prompt>(`/api/prompts/${slug}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    mutate("/api/prompts");
    return result;
  };

  const deletePrompt = async (slug: string) => {
    await api(`/api/prompts/${slug}`, { method: "DELETE" });
    mutate("/api/prompts");
  };

  const togglePrompt = async (slug: string) => {
    const result = await api<Prompt>(`/api/prompts/${slug}/toggle`, {
      method: "POST",
    });
    mutate("/api/prompts");
    return result;
  };

  return {
    prompts: data ?? [],
    isLoading,
    error,
    createPrompt,
    updatePrompt,
    deletePrompt,
    togglePrompt,
  };
}
```
