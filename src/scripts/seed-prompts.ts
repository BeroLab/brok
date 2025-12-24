import { PrismaClient } from "../generated/prisma";
import { IDENTITY_PROMPT, ACID_PROMPT, LAELE_PROMPT } from "../ai/prompts";

const prisma = new PrismaClient();

const initialPrompts = [
  {
    slug: "informative",
    name: "Modo Informativo",
    description: "Modo padrão do Brok - informativo, motivacional e focado em ação",
    content: IDENTITY_PROMPT,
    isActive: true,
  },
  {
    slug: "acid",
    name: "Modo Ácido",
    description: "Versão sem filtro - humor negro, sarcasmo e verdades desconfortáveis",
    content: ACID_PROMPT,
    isActive: true,
  },
  {
    slug: "laele",
    name: "Modo Laele",
    description: "Tiradas rápidas e zoação de brotheragem - leve e engraçado",
    content: LAELE_PROMPT,
    isActive: true,
  },
];

async function seedPrompts() {
  console.log("Seeding prompts...");

  for (const prompt of initialPrompts) {
    const existing = await prisma.prompt.findUnique({
      where: { slug: prompt.slug },
    });

    if (existing) {
      console.log(`Prompt "${prompt.slug}" already exists, skipping...`);
      continue;
    }

    await prisma.prompt.create({ data: prompt });
    console.log(`Created prompt: ${prompt.slug}`);
  }

  console.log("Seeding complete!");
}

async function seedAdminUser() {
  const discordId = process.env.ADMIN_DISCORD_ID;
  const discordName = process.env.ADMIN_DISCORD_NAME || "Admin";

  if (!discordId) {
    console.log("No ADMIN_DISCORD_ID set, skipping admin user creation...");
    return;
  }

  const existing = await prisma.adminUser.findUnique({
    where: { discordId },
  });

  if (existing) {
    console.log(`Admin user "${discordId}" already exists, skipping...`);
    return;
  }

  await prisma.adminUser.create({
    data: {
      discordId,
      discordName,
      role: "admin",
    },
  });
  console.log(`Created admin user: ${discordName} (${discordId})`);
}

async function main() {
  try {
    await seedPrompts();
    await seedAdminUser();
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
