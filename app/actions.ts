"use server";
import { createClient } from "redis";
import { cookies } from "next/headers";

type VoteResults = Record<string, number>;
const OPTIONS = [
  "OpenClaw: Einsatz im Mittelstand",
  "Agentic AI: Wenn Agenten zu Arbeitskräften werden",
  "LLMs in der Softwareentwicklung",
  "Prompt Engineering als Kompetenz",
  "KI-Akzeptanz in Organisationen",
  "Vibe Coding: Programmieren ohne Programmierkenntnisse",
  "KI und Nachhaltigkeit: Der ökologische Fußabdruck",
  "KI-generierte Inhalte in der Hochschullehre",
  "Chatbot-Qualität im Kundenservice",
  "KI-Transformation im regionalen Mittelstand",
] as const;
const VALID_OPTIONS = new Set<string>(OPTIONS);
const VOTES_KEY = "votes";
const USER_VOTES_KEY = "user_votes";
const VOTER_COOKIE = "voter_id";

type AppRedisClient = ReturnType<typeof createClient>;

let redisClient: AppRedisClient | null = null;

function getRedisUrl(): string | null {
  return (
    process.env.REDIS_URL ??
    process.env.REDIS_TLS_URL ??
    process.env.VERCEL_REDIS_URL ??
    null
  );
}

async function getRedisClient(): Promise<AppRedisClient> {
  const url = getRedisUrl();

  if (!url) {
    throw new Error(
      "Redis ist nicht konfiguriert. Setze REDIS_URL (oder REDIS_TLS_URL / VERCEL_REDIS_URL) mit einer redis:// oder rediss:// Verbindung."
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

export async function getRedisHealth(): Promise<{ ok: boolean; message: string }> {
  const url = getRedisUrl();

  if (!url) {
    return {
      ok: false,
      message:
        "Redis ist nicht konfiguriert. Setze REDIS_URL (oder REDIS_TLS_URL / VERCEL_REDIS_URL).",
    };
  }

  try {
    const redis = await getRedisClient();
    const pong = await redis.ping();

    if (pong !== "PONG") {
      return {
        ok: false,
        message: "Redis antwortet unerwartet auf den Health-Check.",
      };
    }

    return { ok: true, message: "Redis verbunden." };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler";
    return {
      ok: false,
      message: `Redis nicht erreichbar: ${detail}`,
    };
  }
}

async function getOrCreateVoterId(): Promise<string> {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(VOTER_COOKIE)?.value;

  if (existingId) {
    return existingId;
  }

  const newId = crypto.randomUUID();
  cookieStore.set(VOTER_COOKIE, newId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return newId;
}

export async function selectOption(option: string) {
  if (!VALID_OPTIONS.has(option)) {
    throw new Error("Ungültige Option.");
  }

  const redis = await getRedisClient();
  const voterId = await getOrCreateVoterId();
  const rawUserVotes = await redis.hGet(USER_VOTES_KEY, voterId);
  let selectedOptions: string[] = [];

  if (rawUserVotes) {
    try {
      const parsed = JSON.parse(rawUserVotes);
      if (Array.isArray(parsed)) {
        selectedOptions = parsed.filter((entry): entry is string => typeof entry === "string");
      }
    } catch {
      selectedOptions = [];
    }
  }

  if (selectedOptions.includes(option)) {
    return;
  }

  selectedOptions.push(option);
  const tx = redis.multi();
  tx.hIncrBy(VOTES_KEY, option, 1);
  tx.hSet(USER_VOTES_KEY, voterId, JSON.stringify(selectedOptions));
  await tx.exec();
}

export async function getResults(): Promise<VoteResults> {
  const redis = await getRedisClient();
  // Holt alle Stimmen aus der Datenbank
  const results = await redis.hGetAll(VOTES_KEY);

  if (!results || Object.keys(results).length === 0) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(results).map(([key, value]) => [key, Number(value ?? 0)])
  );
}