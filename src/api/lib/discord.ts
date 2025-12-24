import { REST } from "@discordjs/rest";
import { Routes, type APIChannel, ChannelType } from "discord-api-types/v10";

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_TOKEN ?? ""
);

const guildId = process.env.DISCORD_GUILD_ID!;

export async function getGuildChannels(): Promise<APIChannel[]> {
  const channels = (await rest.get(
    Routes.guildChannels(guildId)
  )) as APIChannel[];

  // Filter only text channels
  return channels.filter(
    (channel) =>
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement
  );
}

export async function sendMessage(
  channelId: string,
  content: string
): Promise<unknown> {
  return rest.post(Routes.channelMessages(channelId), {
    body: { content },
  });
}

export { rest, guildId };
