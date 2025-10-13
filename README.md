# Desenvolvimento do brok

[x] Configurar o bot do discord
[x] Adicionar o bot do discord a um servidor de testes
[x] Instalar lib do discord e enviar primeira mensagem
[x] Adicionar IA no bot (usando OpenRouter com Gemini 2.5 Flash)
[x] Adicionar um RAG básico no bot
[x] Colocar debouncing e timeout (Rate Limiting completo com Redis)
[ ] Adicionar stemming e proteção contra prompt injection (se der tempo)

## Funcionalidades

- **Resposta com IA**: Mencione o bot em qualquer mensagem e ele responderá usando o modelo Gemini 2.0 Flash através do OpenRouter
- **Indicador de digitação**: O bot mostra uma mensagem "🤔 Pensando na resposta..." enquanto processa sua pergunta
- **Tratamento de erros**: Caso ocorra algum problema, o bot informa o usuário com uma mensagem de erro
- **Comando /registrar-faq**: Adiciona perguntas e respostas ao FAQ do bot através de um comando slash
- **Rate Limiting & Anti-Spam**: Sistema completo de proteção contra spam com:
  - Cooldown de 30s entre mensagens por usuário
  - Máximo de 5 processamentos simultâneos
  - Debouncing inteligente que agrupa mensagens consecutivas
  - Fila persistente com Redis para gerenciar requisições
  - Proteção contra processamento duplicado no mesmo canal

Para mais detalhes sobre o sistema de rate limiting, veja [RATE_LIMITING.md](./RATE_LIMITING.md).

## Variáveis de Ambiente

Crie um arquivo `.env` com as seguintes variáveis (veja `.env.example` como referência):

```
# Discord
DISCORD_TOKEN=seu_token_do_discord
DISCORD_APPLICATION_ID=id_da_aplicacao_discord
OPENROUTER_API_KEY=sua_chave_do_openrouter

# Database
DATABASE_URL=sua_connection_string_mongodb

# Redis (para rate limiting e fila)
REDIS_URL=redis://default:password@host:port

# Rate Limiting (opcional, valores padrão mostrados)
RATE_LIMIT_USER_COOLDOWN_SECONDS=30
RATE_LIMIT_GLOBAL_CONCURRENT=5
DEBOUNCE_WINDOW_MS=5000
```

## Configuração Inicial

### 1. Instalar dependências

```bash
bun install
```

### 2. Configurar o banco de dados

```bash
bunx prisma generate
```

### 3. Registrar comandos slash no Discord

Antes de usar os comandos slash, você precisa registrá-los na API do Discord:

```bash
bun run register-commands
```

Este comando registra o `/registrar-faq` e outros comandos slash no Discord.

## Comandos Disponíveis

### /registrar-faq

Adiciona uma nova entrada no FAQ do bot.

**Parâmetros:**
- `pergunta` (obrigatório): A pergunta a ser adicionada ao FAQ
- `resposta` (obrigatório): A resposta correspondente à pergunta

**Exemplo:**
```
/registrar-faq pergunta:"Como faço para usar o bot?" resposta:"Mencione o bot em uma mensagem para ele responder com IA!"
```

O comando salva automaticamente o ID do usuário que criou a entrada.