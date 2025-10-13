import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_TOKEN ?? ""
);

const commands = [
  {
    name: "registrar-faq",
    description: "Registra uma nova pergunta e resposta no FAQ",
    options: [
      {
        name: "pergunta",
        description: "A pergunta do FAQ",
        type: 3,
        required: true,
      },
      {
        name: "resposta",
        description: "A resposta da pergunta",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "acido",
    description: "Ativa o modo ácido do bot (humor pesado tipo brok do Twitter)",
  },
  {
    name: "informativo",
    description: "Ativa o modo informativo do bot (padrão, educado e útil)",
  },
  {
    name: "laele",
    description: "Ativa o modo laele do bot (brotheragem, tiradas rápidas e zoeira leve)",
  },
];

async function registerCommands() {
  try {
    console.log("Starting to register slash commands...");

    const applicationId = process.env.DISCORD_APPLICATION_ID;

    if (!applicationId) {
      throw new Error("DISCORD_APPLICATION_ID is not set in environment");
    }

    await rest.put(Routes.applicationCommands(applicationId), {
      body: commands,
    });

    console.log("Successfully registered slash commands!");
  } catch (error) {
    console.error("Error registering commands:", error);
    process.exit(1);
  }
}

registerCommands();
