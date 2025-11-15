import axios from "axios";
import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import { moderators } from "./moderators";

export interface Event {
  id: string;
  title: string;
  description: string;
  type: string;
  link: string | null;
  start_at: string;
  finish_at: string;
  active: boolean;
  created_at: string;
}

export interface WeekRange {
  start: Date;
  end: Date;
}

export function getWeekRange(): WeekRange {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    start: startOfWeek,
    end: endOfWeek,
  };
}

export function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");

  const dayText = isToday ? "HOJE" : date.toLocaleDateString("pt-BR");

  return `${dayText}, às ${hours}h${minutes !== "00" ? minutes : ""}`;
}

export function getAvailableModerators(eventDate: Date): string {
  const weekDays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const eventDayOfWeek = weekDays[eventDate.getDay()];

  const availableMods = moderators.filter((mod) =>
    mod.preferred_week_days.includes(eventDayOfWeek)
  );

  if (availableMods.length === 0) {
    return "Nenhum moderador disponível para este dia";
  }

  return availableMods.map((mod) => `<@${mod.id}>`).join(", ");
}

export function findLatestEvent(events: Event[]): Event | null {
  const sortedEvents = events.sort(
    (a, b) =>
      new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
  );

  return sortedEvents[0] ?? null;
}

export function findTodayEvent(events: Event[]): Event | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayEvents = events.filter((event) => {
    const eventDate = new Date(event.start_at);
    return eventDate >= today && eventDate < tomorrow;
  });

  if (todayEvents.length === 0) {
    return null;
  }

  todayEvents.sort(
    (a, b) =>
      new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );

  return todayEvents[0] ?? null;
}

export async function fetchWeeklyEvents(
  berolabEndpoint: string,
  berolabToken: string
): Promise<Event[]> {
  const weekRange = getWeekRange();

  const input = {
    json: {
      active: true,
      start_at: weekRange.start.toISOString(),
      finish_at: weekRange.end.toISOString(),
    },
    meta: {
      values: {
        start_at: ["Date"],
        finish_at: ["Date"],
      },
    },
  };

  const encodedInput = encodeURIComponent(JSON.stringify(input));
  const apiUrl = `${berolabEndpoint}/trpc/appointments.getBy?input=${encodedInput}`;

  const response = await axios.get(apiUrl, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${berolabToken}`,
    },
  });

  const data = response.data;

  if (data?.result?.data?.json) {
    return data.result.data.json as Event[];
  }

  return [];
}

export async function generateTwitterMessage(
  event: Event,
  model: LanguageModelV1
): Promise<string> {
  const eventTime = formatEventTime(event.start_at);

  const aiPrompt = `Você é o Brok, o bot da BeroLab. Crie uma mensagem de divulgação para o TWITTER sobre o evento da comunidade.

EXEMPLO DE FORMATO (siga exatamente esse estilo):
🔔 LEMBRETE!

🔔 Talk imperdível com @Pokemaobr sobre Diploma na área de TI.

🗓️ HOJE, às 19h ⏰

Ainda não faz parte da nossa comunidade? Vem pra #berolab 🏃‍♂️

INFORMAÇÕES DO EVENTO:
- Título: ${event.title}
- Tipo: ${event.type === "CALL" ? "Talk" : "Workshop sobre SaaS"}
- Descrição: ${event.description}
- Horário: ${eventTime}

REGRAS:
- Esta mensagem será postada no TWITTER, então adapte para essa plataforma
- Use exatamente o formato do exemplo acima
- Mantenha o tom animado e convidativo
- Use emojis relevantes
- Destaque o horário claramente
- Termine convidando para entrar na comunidade
- Seja breve e direto (máximo 280 caracteres se possível)
- NÃO mencione @ de usuários específicos (como @Pokemaobr) a menos que seja extremamente relevante

Gere APENAS a mensagem para o Twitter, sem explicações adicionais.`;

  const result = await generateText({
    model,
    prompt: aiPrompt,
  });

  return result.text.trim();
}

export interface EventEmbed {
  title: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline: boolean;
  }>;
  footer: {
    text: string;
  };
  timestamp: string;
}

export function buildEventEmbed(
  event: Event,
  twitterMessage: string
): EventEmbed {
  const eventDate = new Date(event.start_at);
  const formattedDate = eventDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const availableModerators = getAvailableModerators(eventDate);

  return {
    title: `📅 ${event.title}`,
    color: 0x5865f2,
    fields: [
      {
        name: "📍 Tipo",
        value: event.type === "CALL" ? "Talk" : "Workshop",
        inline: true,
      },
      {
        name: "📆 Data",
        value: formattedDate,
        inline: false,
      },
      {
        name: "⏰ Horário",
        value: formattedTime,
        inline: true,
      },
      {
        name: "👥 Moderadores Disponíveis",
        value: availableModerators,
        inline: false,
      },
      {
        name: "📝 Descrição",
        value:
          event.description.length > 1024
            ? `${event.description.substring(0, 1021)}...`
            : event.description,
        inline: false,
      },
      {
        name: "🐦 Mensagem para Twitter",
        value: twitterMessage,
        inline: false,
      },
    ],
    footer: {
      text: "BeroLab • Comunidade de Devs",
    },
    timestamp: new Date().toISOString(),
  };
}
