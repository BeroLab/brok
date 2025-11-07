import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { z } from "zod";

const CHANNEL_ID = "1436186861642055792";
const MENTION_USER_ID = "875824126663749632";
const MENTION_ROLE_ID = "1380019324932198400";

const sucessoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  analise: z.string().min(1, "Análise é obrigatória"),
});

const erroSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  email: z.string().min(1, "Email é obrigatório"),
});

export function startServer(rest: REST) {
  const server = Bun.serve({
    port: process.env.PORT ?? 3000,
    async fetch(req) {
      const url = new URL(req.url);

      // CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      // Handle CORS preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      }

      // Rota de sucesso
      if (url.pathname === "/api/analise/sucesso" && req.method === "POST") {
        try {
          const body = await req.json();
          const validatedData = sucessoSchema.parse(body);

          // Discord embed limits:
          // - Description: 4096 characters
          // - Field value: 1024 characters
          // - Total embed: 6000 characters

          const maxDescriptionLength = 4000; // Deixar margem de segurança
          const analiseLength = validatedData.analise.length;

          // Se a análise couber na descrição, usar descrição
          if (analiseLength <= maxDescriptionLength) {
            const embed = {
              title: "✅ Análise de Currículo Concluída",
              description: validatedData.analise,
              color: 0x00ff00, // Verde
              fields: [
                {
                  name: "👤 Candidato",
                  value: validatedData.nome,
                  inline: true,
                },
                {
                  name: "📧 Email",
                  value: validatedData.email,
                  inline: true,
                },
              ],
              footer: {
                text: "Análise gerada por IA",
              },
              timestamp: new Date().toISOString(),
            };

            await rest.post(Routes.channelMessages(CHANNEL_ID), {
              body: {
                content: `<@${MENTION_USER_ID}> <@&${MENTION_ROLE_ID}>`,
                embeds: [embed],
              },
            });
          } else {
            // Se a análise for muito grande, enviar como arquivo .txt
            const embed = {
              title: "✅ Análise de Currículo Concluída",
              description: `Nova análise de currículo foi gerada com sucesso!`,
              color: 0x00ff00, // Verde
              fields: [
                {
                  name: "👤 Candidato",
                  value: validatedData.nome,
                  inline: true,
                },
                {
                  name: "📧 Email",
                  value: validatedData.email,
                  inline: true,
                },
                {
                  name: "📄 Análise",
                  value: "A análise completa está disponível no arquivo anexo abaixo.",
                  inline: false,
                },
              ],
              footer: {
                text: `Análise gerada por IA • ${analiseLength} caracteres`,
              },
              timestamp: new Date().toISOString(),
            };

            // Criar arquivo txt com a análise
            const fileName = `analise_${validatedData.nome.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.txt`;
            const fileContent = `Análise de Currículo
Candidato: ${validatedData.nome}
Email: ${validatedData.email}
Data: ${new Date().toLocaleString("pt-BR")}

${"=".repeat(80)}

${validatedData.analise}`;

            // Criar FormData com o arquivo
            const formData = new FormData();
            formData.append(
              "payload_json",
              JSON.stringify({
                content: `<@${MENTION_USER_ID}> <@&${MENTION_ROLE_ID}>`,
                embeds: [embed],
              })
            );
            formData.append(
              "files[0]",
              new Blob([fileContent], { type: "text/plain" }),
              fileName
            );

            // Enviar embed com arquivo
            await rest.post(Routes.channelMessages(CHANNEL_ID), {
              body: formData,
            });
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: "Análise enviada com sucesso para o Discord!",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        } catch (error) {
          console.error("Erro na rota de sucesso:", error);

          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Dados inválidos",
                errors: error.errors,
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              }
            );
          }

          return new Response(
            JSON.stringify({
              success: false,
              message: "Erro ao processar a requisição",
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }
      }

      // Rota de erro
      if (url.pathname === "/api/analise/erro" && req.method === "POST") {
        try {
          const body = await req.json();
          const validatedData = erroSchema.parse(body);

          // Criar embed de erro
          const embed = {
            title: "❌ Currículo Não Enviado",
            description: `O usuário não enviou o anexo do currículo`,
            color: 0xff0000, // Vermelho
            fields: [
              {
                name: "👤 Usuário",
                value: validatedData.nome,
                inline: true,
              },
              {
                name: "📧 Email",
                value: validatedData.email,
                inline: true,
              },
              {
                name: "⚠️ Problema",
                value:
                  "O usuário tentou enviar uma análise mas não anexou o currículo necessário.",
                inline: false,
              },
            ],
            footer: {
              text: "Sistema de Análise de Currículos",
            },
            timestamp: new Date().toISOString(),
          };

          // Enviar mensagem para o canal do Discord
          await rest.post(Routes.channelMessages(CHANNEL_ID), {
            body: {
              content: `<@${MENTION_USER_ID}> <@&${MENTION_ROLE_ID}>`,
              embeds: [embed],
            },
          });

          return new Response(
            JSON.stringify({
              success: true,
              message: "Notificação de erro enviada para o Discord!",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        } catch (error) {
          console.error("Erro na rota de erro:", error);

          if (error instanceof z.ZodError) {
            return new Response(
              JSON.stringify({
                success: false,
                message: "Dados inválidos",
                errors: error.errors,
              }),
              {
                status: 400,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              }
            );
          }

          return new Response(
            JSON.stringify({
              success: false,
              message: "Erro ao processar a requisição",
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }
      }

      // Rota de health check
      if (url.pathname === "/health" && req.method === "GET") {
        return new Response(
          JSON.stringify({
            status: "ok",
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // 404
      return new Response(
        JSON.stringify({
          success: false,
          message: "Rota não encontrada",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    },
  });

  console.log(`🚀 Servidor HTTP rodando na porta ${server.port}`);
  return server;
}
