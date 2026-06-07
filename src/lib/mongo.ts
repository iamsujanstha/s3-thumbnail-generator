import { MongoClient } from "mongodb";
import { getEnv } from "@/lib/env";

let _client: Promise<MongoClient> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  if (!_client) {
    const client = new MongoClient(getEnv().MONGODB_URI, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
    });
    _client = client.connect();
  }
  return _client;
}

export async function getDb() {
  return (await getMongoClient()).db();
}
