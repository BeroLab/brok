# API de Análise de Currículos

Este documento descreve as rotas da API para enviar notificações de análise de currículos para o Discord.

## Base URL

```
http://localhost:3000
```

A porta pode ser configurada através da variável de ambiente `PORT`.

## Rotas

### 1. POST /api/analise/sucesso

Envia uma notificação de sucesso quando a análise do currículo é concluída.

**Request Body:**

```json
{
  "nome": "João Silva",
  "email": "joao.silva@email.com",
  "analise": "Análise detalhada do currículo gerada por IA..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Análise enviada com sucesso para o Discord!"
}
```

**Response (400 Bad Request):**

```json
{
  "success": false,
  "message": "Dados inválidos",
  "errors": [
    {
      "path": ["nome"],
      "message": "Nome é obrigatório"
    }
  ]
}
```

**Embed no Discord:**

- Título: "✅ Análise de Currículo Concluída"
- Cor: Verde (#00ff00)
- Campos:
  - 👤 Candidato: Nome do usuário
  - 📧 Email: Email do usuário
  - 📄 Análise Gerada: Texto da análise (truncado em 4000 caracteres)

### 2. POST /api/analise/erro

Envia uma notificação quando o usuário não envia o anexo do currículo.

**Request Body:**

```json
{
  "nome": "Maria Santos",
  "email": "maria.santos@email.com"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Notificação de erro enviada para o Discord!"
}
```

**Response (400 Bad Request):**

```json
{
  "success": false,
  "message": "Dados inválidos",
  "errors": [
    {
      "path": ["email"],
      "message": "Email é obrigatório"
    }
  ]
}
```

**Embed no Discord:**

- Título: "❌ Currículo Não Enviado"
- Cor: Vermelho (#ff0000)
- Campos:
  - 👤 Usuário: Nome do usuário
  - 📧 Email: Email do usuário
  - ⚠️ Problema: Descrição do erro

### 3. GET /health

Verifica o status do servidor.

**Response (200 OK):**

```json
{
  "status": "ok",
  "timestamp": "2025-11-07T12:00:00.000Z"
}
```

## Exemplos de Uso

### cURL - Rota de Sucesso

```bash
curl -X POST http://localhost:3000/api/analise/sucesso \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "email": "joao.silva@email.com",
    "analise": "O candidato demonstra excelente conhecimento em TypeScript e Node.js..."
  }'
```

### cURL - Rota de Erro

```bash
curl -X POST http://localhost:3000/api/analise/erro \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Maria Santos",
    "email": "maria.santos@email.com"
  }'
```

### JavaScript (fetch)

```javascript
// Sucesso
fetch("http://localhost:3000/api/analise/sucesso", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    nome: "João Silva",
    email: "joao.silva@email.com",
    analise: "Análise detalhada do currículo...",
  }),
})
  .then((res) => res.json())
  .then((data) => console.log(data));

// Erro
fetch("http://localhost:3000/api/analise/erro", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    nome: "Maria Santos",
    email: "maria.santos@email.com",
  }),
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

## Configuração

### Variáveis de Ambiente

- `PORT`: Porta do servidor HTTP (padrão: 3000)
- `DISCORD_TOKEN`: Token do bot do Discord (obrigatório)

### Canal do Discord

O canal de destino está configurado no código:

```typescript
const CHANNEL_ID = "1436186861642055792";
```

Para alterar o canal, modifique essa constante em `src/server.ts`.

## CORS

A API está configurada com CORS aberto (`Access-Control-Allow-Origin: *`) para permitir requisições de qualquer origem.

## Notas

- A análise é truncada em 4000 caracteres no embed do Discord devido às limitações da plataforma
- Todos os erros são logados no console do servidor
- As validações são feitas usando Zod para garantir a integridade dos dados
