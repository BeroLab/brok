# Rate Limiting System

Este documento descreve o sistema de rate limiting e controle de spam implementado no bot Brok.

## Visão Geral

O sistema foi projetado para proteger contra spam e custos excessivos de IA em comunidades grandes, implementando múltiplas camadas de proteção usando Redis e BullMQ.

## Arquitetura

### Componentes Principais

1. **Redis** (`src/config/redis.ts`)
   - Armazenamento em memória para rate limiting
   - Gerenciamento de filas com BullMQ
   - Retry logic e reconexão automática

2. **Rate Limiter** (`src/services/rate-limiter.ts`)
   - Cooldown por usuário (30 segundos)
   - Limite de concorrência global (5 processamentos simultâneos)
   - Prevenção de processamento duplicado por canal

3. **Debouncer** (`src/services/debouncer.ts`)
   - Agrupa mensagens consecutivas do mesmo usuário
   - Janela de 5 segundos para detecção
   - Processa múltiplas perguntas em uma única chamada de IA

4. **Message Queue** (`src/services/message-queue.ts`)
   - Fila persistente com BullMQ
   - 3 tentativas automáticas em caso de falha
   - Processamento assíncrono respeitando limites

## Camadas de Proteção

### 1. Verificação de Canal Ocupado
```
⚠️ já to respondendo outra mensagem aqui, peraí que logo respondo você!
```
Previne múltiplas mensagens sendo processadas no mesmo canal simultaneamente.

### 2. Cooldown do Usuário (30s)
```
⏳ calma aí mano, espera mais X segundos antes de me marcar de novo!
```
Força intervalo mínimo entre mensagens do mesmo usuário.

### 3. Debouncing Inteligente (5s)
```
📝 recebi! aguarda só um pouquinho que eu to juntando suas mensagens...
```
Detecta mensagens consecutivas e as agrupa em uma única chamada de IA.

### 4. Limite de Concorrência Global (5)
```
🚦 to processando muita coisa agora, aguarda um pouquinho e me marca de novo!
```
Limita o número máximo de chamadas de IA simultâneas em todo o bot.

## Configuração

### Variáveis de Ambiente

```env
# Redis
REDIS_URL=redis://default:password@host:port

# Rate Limiting
RATE_LIMIT_USER_COOLDOWN_SECONDS=30      # Cooldown entre mensagens por usuário
RATE_LIMIT_GLOBAL_CONCURRENT=5           # Máximo de processamentos simultâneos
DEBOUNCE_WINDOW_MS=5000                  # Janela de debouncing em milissegundos
```

### Valores Recomendados

- **RATE_LIMIT_USER_COOLDOWN_SECONDS**: 30 segundos (ajustar conforme necessidade)
- **RATE_LIMIT_GLOBAL_CONCURRENT**: 5 (ajustar baseado na capacidade do servidor)
- **DEBOUNCE_WINDOW_MS**: 5000ms (5 segundos para agrupar mensagens)

## Fluxo de Processamento

```
1. Usuário menciona o bot
   ↓
2. Verifica se canal está ocupado → REJEITA se sim
   ↓
3. Verifica cooldown do usuário → REJEITA se em cooldown
   ↓
4. Adiciona mensagem ao debouncer
   ↓
5. Se não deve processar ainda → AGUARDA debouncing
   ↓
6. Verifica concorrência global → REJEITA se >= 5
   ↓
7. Adiciona à fila Redis
   ↓
8. Worker processa quando há slot disponível
   ↓
9. Adquire slot global
   ↓
10. Marca canal como processando
    ↓
11. Busca mensagens do debouncer
    ↓
12. Processa com IA
    ↓
13. Responde ao usuário
    ↓
14. Registra cooldown
    ↓
15. Libera slot e canal
```

## Estrutura Redis

### Keys Utilizadas

- `cooldown:{userId}` - TTL: 30s - Controla cooldown por usuário
- `global:concurrent` - Counter - Número de processamentos ativos
- `processing:{channelId}` - TTL: 300s - Marca canal como ocupado
- `debounce:{userId}` - TTL: 5s - Armazena mensagens para debouncing

### Filas BullMQ

- `ai-messages` - Fila principal de processamento
  - Attempts: 3
  - Backoff: Exponential (2s base)
  - Concurrency: 5
  - Retention: 100 completed jobs (24h), 1000 failed jobs (7 dias)

## Monitoramento

### Logs do Sistema

```
✅ Redis connected successfully
🚀 Redis is ready to accept commands
🚀 Message queue worker started
✅ Worker context initialized
✅ Job {id} completed successfully
❌ Job {id} failed after all retries: {error}
```

### Verificação de Saúde

Para verificar o estado atual do Redis e da fila:

```typescript
// Concorrência atual
const concurrent = await rateLimiter.getCurrentConcurrency();

// Verificar se canal está processando
const isBusy = await rateLimiter.isChannelProcessing(channelId);

// Verificar cooldown do usuário
const { allowed, remainingSeconds } = await rateLimiter.canUserSendMessage(userId);
```

## Tratamento de Erros

### Falhas Temporárias
- Retry automático com backoff exponencial
- Até 3 tentativas

### Falhas Permanentes
```
❌ po deu ruim aqui. tentei várias vezes mas deu algum erro. me marca de novo depois, tmj 🤙
```

### Reconexão Redis
- Retry strategy: 50ms * tentativas (max 2000ms)
- Reconecta automaticamente em erros READONLY

## Custos Estimados

Com as proteções implementadas:

- **Por usuário**: Máximo 1 mensagem a cada 30s
- **Global**: Máximo 5 processamentos simultâneos
- **Debouncing**: Reduz chamadas em ~40% para usuários que enviam múltiplas mensagens

### Exemplo de Comunidade Grande (1000 usuários ativos)

Cenário pior caso (sem debouncing):
- 1000 usuários × 2 mensagens/minuto = 2000 mensagens/minuto
- Com cooldown de 30s: ~1000 mensagens/minuto
- Com concorrência de 5: Processadas em ordem na fila

Cenário real (com debouncing):
- Redução de ~40% = ~600 mensagens processadas/minuto
- ~36.000 mensagens/hora (máximo teórico)
- Na prática, muito menor devido ao cooldown e comportamento real dos usuários

## Ajustes Futuros

### Aumentar Proteção
- Diminuir `RATE_LIMIT_USER_COOLDOWN_SECONDS` (ex: 60s)
- Diminuir `RATE_LIMIT_GLOBAL_CONCURRENT` (ex: 3)
- Adicionar limite horário/diário por usuário

### Relaxar Proteção
- Aumentar `RATE_LIMIT_USER_COOLDOWN_SECONDS` (ex: 15s)
- Aumentar `RATE_LIMIT_GLOBAL_CONCURRENT` (ex: 10)
- Reduzir `DEBOUNCE_WINDOW_MS` (ex: 3000ms)

## Troubleshooting

### Bot não responde
1. Verificar logs do Redis: `✅ Redis connected successfully`
2. Verificar worker: `🚀 Message queue worker started`
3. Verificar variáveis de ambiente no `.env`

### Muitas mensagens de "aguarda"
- Ajustar `RATE_LIMIT_GLOBAL_CONCURRENT` para valor maior
- Verificar performance do servidor de IA

### Usuários reclamando de cooldown muito longo
- Ajustar `RATE_LIMIT_USER_COOLDOWN_SECONDS` para valor menor
- Considerar implementar bypass para roles específicos

## Segurança

### Dados Sensíveis
- Nunca commitar `.env` no Git
- Usar `.env.example` como template
- Rotacionar credenciais Redis periodicamente

### Redis
- Configurar autenticação forte
- Usar conexão TLS em produção
- Limitar acesso por IP quando possível
