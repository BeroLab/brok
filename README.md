# Desenvolvimento do brok

[x] Configurar o bot do discord
[x] Adicionar o bot do discord a um servidor de testes
[x] Instalar lib do discord e enviar primeira mensagem
[x] Adicionar IA no bot (usando OpenRouter com Gemini 2.5 Flash)
[x] Adicionar um RAG básico no bot
[ ] Colocar debouncing e timeout
[ ] Adicionar stemming e proteção contra prompt injection (se der tempo)

## Funcionalidades

- **Resposta com IA**: Mencione o bot em qualquer mensagem e ele responderá usando o modelo Gemini 2.0 Flash através do OpenRouter
- **Indicador de digitação**: O bot mostra uma mensagem "🤔 Pensando na resposta..." enquanto processa sua pergunta
- **Tratamento de erros**: Caso ocorra algum problema, o bot informa o usuário com uma mensagem de erro
- **Comando /registrar-faq**: Adiciona perguntas e respostas ao FAQ do bot através de um comando slash

## Variáveis de Ambiente

Crie um arquivo `.env.local` com as seguintes variáveis:

```
DISCORD_TOKEN=seu_token_do_discord
DISCORD_APPLICATION_ID=id_da_aplicacao_discord
OPENROUTER_API_KEY=sua_chave_do_openrouter
DATABASE_URL=sua_connection_string_mongodb
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