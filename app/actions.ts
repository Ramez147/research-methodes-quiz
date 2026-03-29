"use server";
import { createClient } from "redis";

type VoteResults = Record<string, number>;

type AppRedisClient = ReturnType<typeof createClient>;

let redisClient: AppRedisClient | null = null;

async function getRedisClient(): Promise<AppRedisClient> {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error(
      "Redis ist nicht konfiguriert. Setze REDIS_URL (z. B. redis://...)."
    );
  }

  if (!redisClient) {
    redisClient = createClient({ url });
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
}

export async function selectOption(option: string) {
  const redis = await getRedisClient();
  // Erhöht den Zähler für die gewählte Option um 1
  await redis.hIncrBy("votes", option, 1);
}

export async function getResults(): Promise<VoteResults> {
  const redis = await getRedisClient();
  // Holt alle Stimmen aus der Datenbank
  const results = await redis.hGetAll("votes");

  if (!results || Object.keys(results).length === 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(results).map(([key, value]) => [key, Number(value ?? 0)])
  );
}