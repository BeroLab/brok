# Brok Admin - Especificação do Frontend

## Visão Geral

Dashboard administrativo para gerenciar o bot Brok da BeroLab. Interface minimalista, focada em produtividade, com visual dark mode inspirado no Discord.

**Stack Sugerida:**
- Next.js 14+ (App Router)
- Tailwind CSS + shadcn/ui
- SWR para data fetching
- Better Auth para autenticação

---

## Arquitetura de Páginas

```
/                       → Redirect para /dashboard ou /login
/login                  → Tela de login (Discord OAuth)
/dashboard              → Overview do bot
/dashboard/prompts      → Gerenciamento de prompts
/dashboard/prompts/[slug] → Editor de prompt
/dashboard/faqs         → Base de conhecimento
/dashboard/channels     → Lista de canais + envio de mensagens
/dashboard/settings     → Configurações
```

---

## Telas

### 1. Login (`/login`)

**Layout:** Centralizado, minimalista

**Elementos:**
- Logo do Brok (ou BeroLab)
- Título: "Brok Admin"
- Subtítulo: "Acesso restrito à equipe BeroLab"
- Botão: "Entrar com Discord" (ícone Discord)
- Footer discreto: "Apenas membros autorizados"

**Comportamento:**
- Se já autenticado → redirect para `/dashboard`
- Após login → redirect para `/dashboard`
- Se não autorizado (não está na whitelist) → mostrar erro amigável

```
┌─────────────────────────────────────┐
│                                     │
│            🤖 Brok Admin            │
│                                     │
│     Acesso restrito à equipe        │
│                                     │
│    ┌───────────────────────────┐    │
│    │  🎮 Entrar com Discord    │    │
│    └───────────────────────────┘    │
│                                     │
│      Apenas membros autorizados     │
│                                     │
└─────────────────────────────────────┘
```

---

### 2. Dashboard (`/dashboard`)

**Layout:** Sidebar fixa + área de conteúdo

**Sidebar:**
```
┌──────────────────┐
│ 🤖 Brok Admin    │
├──────────────────┤
│ 📊 Dashboard     │ ← ativo
│ 📝 Prompts       │
│ ❓ FAQs          │
│ 💬 Canais        │
│ ⚙️  Configurações │
├──────────────────┤
│                  │
│ ─────────────────│
│ 👤 Duca          │
│    Sair          │
└──────────────────┘
```

**Conteúdo Principal - Cards de Overview:**

```
┌─────────────────────────────────────────────────────┐
│ Dashboard                                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ 📝 Prompts  │  │ ❓ FAQs     │  │ 💬 Canais   │  │
│  │     3       │  │    47       │  │    12       │  │
│  │ ativos      │  │ cadastrados │  │ disponíveis │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Status do Bot                                   ││
│  │ ● Online - Servidor: BeroLab                    ││
│  │ Última atividade: há 2 minutos                  ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Ações Rápidas                                   ││
│  │                                                 ││
│  │ [Editar Prompt Principal] [Enviar Mensagem]    ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Componentes:**
- Card de estatísticas (prompts ativos, FAQs, canais)
- Status do bot (online/offline)
- Ações rápidas (links para tarefas comuns)

---

### 3. Prompts (`/dashboard/prompts`)

**Layout:** Lista de prompts com ações

```
┌─────────────────────────────────────────────────────┐
│ Prompts                              [+ Novo Prompt]│
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ ● Modo Informativo              slug: informative│
│  │   Modo padrão do Brok - informativo e motivacional│
│  │   ────────────────────────────────────────────── │
│  │   [Editar]  [Desativar]  [Visualizar]           ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ ● Modo Ácido                         slug: acid ││
│  │   Versão sem filtro - humor negro e sarcasmo    ││
│  │   ────────────────────────────────────────────── │
│  │   [Editar]  [Desativar]  [Visualizar]           ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ ● Modo Laele                        slug: laele ││
│  │   Tiradas rápidas e zoação de brotheragem       ││
│  │   ────────────────────────────────────────────── │
│  │   [Editar]  [Desativar]  [Visualizar]           ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Lista todos os prompts
- Indicador visual de ativo/inativo (● verde/cinza)
- Botão para criar novo prompt
- Ações: Editar, Toggle ativo, Visualizar, Deletar (com confirmação)

**Modal de Visualização:**
- Mostra o prompt completo formatado
- Botão para copiar conteúdo

---

### 4. Editor de Prompt (`/dashboard/prompts/[slug]`)

**Layout:** Editor de texto grande com preview

```
┌─────────────────────────────────────────────────────┐
│ ← Voltar    Editando: Modo Informativo    [Salvar] │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Nome                                               │
│  ┌─────────────────────────────────────────────────┐│
│  │ Modo Informativo                                ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Slug (não editável)                                │
│  ┌─────────────────────────────────────────────────┐│
│  │ informative                                     ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Descrição                                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ Modo padrão do Brok - informativo...            ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Conteúdo do Prompt                                 │
│  ┌─────────────────────────────────────────────────┐│
│  │ Você é o Brok, o bot do Discord da BeroLab...   ││
│  │                                                 ││
│  │ ⚠️ REGRA CRÍTICA - SEMPRE SEJA BREVE:          ││
│  │ • MÁXIMO 2-4 linhas por resposta               ││
│  │ • Seja direto, sem enrolação                   ││
│  │ ...                                            ││
│  │                                                 ││
│  │                                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  [x] Prompt ativo                                   │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │     Cancelar     │  │      Salvar      │         │
│  └──────────────────┘  └──────────────────┘         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Campo de texto grande para o prompt (textarea com ~20 linhas)
- Contagem de caracteres
- Toggle de ativo/inativo
- Botão salvar com feedback visual
- Unsaved changes warning ao sair

**Extras sugeridos:**
- Syntax highlighting para markdown
- Botão para inserir variáveis comuns (ex: `<user_message>`)
- Preview de como o prompt ficaria formatado

---

### 5. FAQs (`/dashboard/faqs`)

**Layout:** Tabela pesquisável com paginação

```
┌─────────────────────────────────────────────────────┐
│ Base de Conhecimento (FAQs)                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔍 ┌─────────────────────────────────────────────┐ │
│     │ Buscar perguntas ou respostas...            │ │
│     └─────────────────────────────────────────────┘ │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Pergunta              │ Resposta       │ Ações  ││
│  ├───────────────────────┼────────────────┼────────┤│
│  │ O que é a BeroLab?    │ BeroLab é u... │ 👁️ 🗑️  ││
│  │ Como funciona o XP?   │ O sistema d... │ 👁️ 🗑️  ││
│  │ Quando abre a Season? │ As Seasons ... │ 👁️ 🗑️  ││
│  │ ...                   │ ...            │ ...    ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Mostrando 1-20 de 47    [<] [1] [2] [3] [>]       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Busca em tempo real (debounced)
- Paginação
- Visualizar FAQ completo (modal)
- Deletar FAQ (com confirmação)
- Ordenar por data de criação

**Nota:** FAQs são criados pelo comando `/registrar-faq` no Discord, não pelo admin.

---

### 6. Canais (`/dashboard/channels`)

**Layout:** Lista de canais + formulário de envio

```
┌─────────────────────────────────────────────────────┐
│ Canais do Servidor                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Enviar Mensagem como Brok                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ Canal:  [▼ Selecione um canal           ]       ││
│  │         • geral                                 ││
│  │         • anuncios                              ││
│  │         • dev-talk                              ││
│  │         • ...                                   ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │ Mensagem:                                       ││
│  │ ┌───────────────────────────────────────────┐   ││
│  │ │                                           │   ││
│  │ │                                           │   ││
│  │ │                                           │   ││
│  │ └───────────────────────────────────────────┘   ││
│  │                                    0/2000       ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│                               [Enviar Mensagem]     │
│                                                     │
│  ────────────────────────────────────────────────── │
│                                                     │
│  Canais Disponíveis (12)                            │
│                                                     │
│  📢 anuncios                                        │
│  💬 geral                                           │
│  💻 dev-talk                                        │
│  🎮 off-topic                                       │
│  ...                                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Dropdown de seleção de canal
- Textarea para mensagem (max 2000 chars)
- Contagem de caracteres
- Feedback de sucesso/erro
- Lista de todos os canais disponíveis

**Extras sugeridos:**
- Suporte a emojis do servidor
- Preview de como a mensagem aparecerá
- Histórico de mensagens enviadas pelo admin

---

### 7. Configurações (`/dashboard/settings`)

**Layout:** Formulário de configurações

```
┌─────────────────────────────────────────────────────┐
│ Configurações                                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Sua Conta                                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ 👤 Duca                                         ││
│  │ Discord ID: 123456789                           ││
│  │ Role: admin                                     ││
│  │                                                 ││
│  │ [Sair da Conta]                                 ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Informações do Bot                                 │
│  ┌─────────────────────────────────────────────────┐│
│  │ Nome: Brok                                      ││
│  │ Servidor: BeroLab                               ││
│  │ Status: ● Online                                ││
│  │ Uptime: 3 dias, 14 horas                        ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
│  Administradores                                    │
│  ┌─────────────────────────────────────────────────┐│
│  │ 👤 Duca (você)      admin                       ││
│  │ 👤 Outro Admin      admin                       ││
│  │                                                 ││
│  │ (Gerenciado diretamente no banco de dados)      ││
│  └─────────────────────────────────────────────────┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Mostrar informações do usuário logado
- Status do bot
- Lista de administradores (read-only por enquanto)
- Botão de logout

---

## Componentes Reutilizáveis

### 1. Layout Principal
```typescript
// components/layout/dashboard-layout.tsx
- Sidebar com navegação
- Header com breadcrumb
- Container do conteúdo
- User dropdown
```

### 2. Sidebar
```typescript
// components/layout/sidebar.tsx
- Logo
- Links de navegação (com ícones)
- Indicador de página ativa
- User info + logout
```

### 3. Card de Estatística
```typescript
// components/ui/stat-card.tsx
- Ícone
- Número grande
- Label
- Cor customizável
```

### 4. Modal de Confirmação
```typescript
// components/ui/confirm-modal.tsx
- Título
- Mensagem
- Botões Cancelar/Confirmar
- Variante destrutiva (vermelho)
```

### 5. Toast de Feedback
```typescript
// components/ui/toast.tsx
- Sucesso (verde)
- Erro (vermelho)
- Info (azul)
- Auto-dismiss
```

### 6. Empty State
```typescript
// components/ui/empty-state.tsx
- Ícone
- Título
- Descrição
- Ação opcional (botão)
```

---

## Estados de UI

### Loading
- Skeleton loaders para listas
- Spinner para ações
- Disable de botões durante submissão

### Erro
- Toast para erros de ação
- Página de erro para falhas críticas
- Retry button quando aplicável

### Vazio
- Ilustração + mensagem amigável
- CTA para criar primeiro item

### Sucesso
- Toast com mensagem
- Redirect ou atualização da lista

---

## Responsividade

### Desktop (>1024px)
- Sidebar fixa visível
- Layout em grid

### Tablet (768-1024px)
- Sidebar colapsável
- Cards em 2 colunas

### Mobile (<768px)
- Sidebar como drawer
- Cards em 1 coluna
- Tabelas viram cards

---

## Paleta de Cores (Dark Mode)

```css
:root {
  /* Background */
  --bg-primary: #0f0f0f;      /* Fundo principal */
  --bg-secondary: #1a1a1a;    /* Cards, sidebar */
  --bg-tertiary: #252525;     /* Inputs, hovers */

  /* Text */
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --text-muted: #666666;

  /* Accent (BeroLab) */
  --accent-primary: #7c3aed;  /* Roxo */
  --accent-hover: #6d28d9;

  /* Status */
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --info: #3b82f6;

  /* Discord */
  --discord-blurple: #5865F2;
}
```

---

## Fluxos Importantes

### Login
```
1. Usuário acessa /login
2. Clica "Entrar com Discord"
3. Redirect para Discord OAuth
4. Discord autoriza → callback
5. Better Auth cria sessão
6. Verifica se Discord ID está em AdminUser
   - Sim → redirect /dashboard
   - Não → mostra erro "Acesso negado"
```

### Editar Prompt
```
1. Lista de prompts → clica "Editar"
2. Carrega página do editor com dados
3. Usuário edita campos
4. Clica "Salvar"
5. API PATCH /api/prompts/:slug
6. Sucesso → toast + redirect para lista
7. Erro → toast com mensagem
```

### Enviar Mensagem
```
1. Seleciona canal no dropdown
2. Digita mensagem (validação de tamanho)
3. Clica "Enviar"
4. API POST /api/messages
5. Sucesso → toast + limpa formulário
6. Erro → toast com mensagem
```

---

## Estrutura de Pastas Sugerida

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # DashboardLayout
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Overview
│   │   ├── prompts/
│   │   │   ├── page.tsx        # Lista
│   │   │   └── [slug]/
│   │   │       └── page.tsx    # Editor
│   │   ├── faqs/
│   │   │   └── page.tsx
│   │   ├── channels/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   └── layout.tsx
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── dashboard-layout.tsx
│   ├── ui/                      # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   └── ...
│   ├── prompts/
│   │   ├── prompt-list.tsx
│   │   ├── prompt-card.tsx
│   │   └── prompt-editor.tsx
│   ├── faqs/
│   │   ├── faq-table.tsx
│   │   └── faq-modal.tsx
│   └── channels/
│       ├── channel-select.tsx
│       └── message-form.tsx
├── hooks/
│   ├── use-auth.ts
│   ├── use-prompts.ts
│   ├── use-faqs.ts
│   └── use-channels.ts
├── lib/
│   ├── api.ts
│   ├── auth-client.ts
│   └── utils.ts
└── types/
    └── index.ts
```

---

## Próximos Passos para Implementação

1. **Setup inicial**
   - Criar projeto Next.js
   - Configurar Tailwind + shadcn/ui
   - Configurar Better Auth client

2. **Autenticação**
   - Implementar página de login
   - Configurar middleware de proteção de rotas
   - Testar fluxo OAuth com Discord

3. **Layout**
   - Criar DashboardLayout com sidebar
   - Implementar navegação

4. **Páginas**
   - Dashboard (overview)
   - Prompts (CRUD completo)
   - FAQs (listagem + busca)
   - Canais (envio de mensagens)
   - Settings

5. **Polish**
   - Loading states
   - Error handling
   - Responsividade
   - Animações sutis
