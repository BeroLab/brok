import { PrismaClient } from "../generated/prisma";
import { MongoClient, ObjectId } from "mongodb";

const prisma = new PrismaClient();
const mongoClient = new MongoClient(process.env.DATABASE_URL!);

async function main() {
  await mongoClient.connect();
  const db = mongoClient.db("brok");

  // Check current state
  console.log("=== Current Accounts ===");
  const accounts = await db.collection("account").find({ providerId: "discord" }).toArray();
  console.log(JSON.stringify(accounts, null, 2));

  console.log("\n=== Current Admins ===");
  const admins = await prisma.adminUser.findMany();
  console.log(JSON.stringify(admins, null, 2));

  // Add admin if not exists
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { discordId: "875824126663749632" }
  });

  if (!existingAdmin) {
    const admin = await prisma.adminUser.create({
      data: {
        discordId: "875824126663749632",
        discordName: "Duca",
        role: "admin"
      }
    });
    console.log("\n✅ Admin created:", admin);
  } else {
    console.log("\n✅ Admin already exists:", existingAdmin);
  }

  // Check if account exists for user 694be22ceb8130eb18677c34
  const userId = "694be22ceb8130eb18677c34";
  const existingAccount = await db.collection("account").findOne({
    userId: new ObjectId(userId),
    providerId: "discord"
  });

  if (!existingAccount) {
    const result = await db.collection("account").insertOne({
      accountId: "875824126663749632",
      providerId: "discord",
      userId: new ObjectId(userId),
      accessToken: null,
      refreshToken: null,
      scope: "email,identify",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log("\n✅ Account linked:", result.insertedId);
  } else {
    console.log("\n✅ Account already linked:", existingAccount._id);
  }

  await prisma.$disconnect();
  await mongoClient.close();
}

main().catch(console.error);
