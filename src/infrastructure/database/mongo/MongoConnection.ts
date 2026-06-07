import { MongoClient } from "mongodb";
import { getServerEnv } from "@/shared/env";

let clientPromise: Promise<MongoClient> | undefined;

export function getMongoClient() {
  if (!clientPromise) {
    const { MONGODB_URI } = getServerEnv();
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 20,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000
    });

    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getMongoDatabase() {
  const client = await getMongoClient();
  return client.db();
}
