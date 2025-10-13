# Desenvolvimento do brok

[x] Configurar o bot do discord
[x] Adicionar o bot do discord a um servidor de testes
[x] Instalar lib do discord e enviar primeira mensagem
[x] Adicionar IA no bot (usando OpenRouter com Gemini 2.0 Flash)
[ ] Adicionar um RAG básico no bot
[ ] Adicionar stemming e proteção contra prompt injection (se der tempo)

## Funcionalidades

- **Resposta com IA**: Mencione o bot em qualquer mensagem e ele responderá usando o modelo Gemini 2.0 Flash através do OpenRouter
- **Indicador de digitação**: O bot mostra uma mensagem "🤔 Pensando na resposta..." enquanto processa sua pergunta
- **Tratamento de erros**: Caso ocorra algum problema, o bot informa o usuário com uma mensagem de erro

## Variáveis de Ambiente

Crie um arquivo `.env.local` com as seguintes variáveis:

```
DISCORD_TOKEN=seu_token_do_discord
OPENROUTER_API_KEY=sua_chave_do_openrouter
```