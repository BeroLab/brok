import { MongoClient } from "mongodb";

const client = new MongoClient(
  process.env.DATABASE_URL || "mongodb://localhost:27017/brok?replicaSet=rs0"
);

export const db = client.db("brok");
export { client };
