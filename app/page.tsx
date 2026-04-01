"use client";
import { useState, useEffect } from 'react';
import { selectOption, getResults, getRedisHealth } from './actions';

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

type VoteOption = (typeof OPTIONS)[number];
type VoteResults = Record<VoteOption, number>;

const EMPTY_RESULTS: VoteResults = {
  "OpenClaw: Einsatz im Mittelstand": 0,
  "Agentic AI: Wenn Agenten zu Arbeitskräften werden": 0,
  "LLMs in der Softwareentwicklung": 0,
  "Prompt Engineering als Kompetenz": 0,
  "KI-Akzeptanz in Organisationen": 0,
  "Vibe Coding: Programmieren ohne Programmierkenntnisse": 0,
  "KI und Nachhaltigkeit: Der ökologische Fußabdruck": 0,
  "KI-generierte Inhalte in der Hochschullehre": 0,
  "Chatbot-Qualität im Kundenservice": 0,
  "KI-Transformation im regionalen Mittelstand": 0,
};

function normalizeResults(raw: Record<string, unknown> | null | undefined): VoteResults {
  return {
    "OpenClaw: Einsatz im Mittelstand": Number(raw?.["OpenClaw: Einsatz im Mittelstand"] ?? 0),
    "Agentic AI: Wenn Agenten zu Arbeitskräften werden": Number(raw?.["Agentic AI: Wenn Agenten zu Arbeitskräften werden"] ?? 0),
    "LLMs in der Softwareentwicklung": Number(raw?.["LLMs in der Softwareentwicklung"] ?? 0),
    "Prompt Engineering als Kompetenz": Number(raw?.["Prompt Engineering als Kompetenz"] ?? 0),
    "KI-Akzeptanz in Organisationen": Number(raw?.["KI-Akzeptanz in Organisationen"] ?? 0),
    "Vibe Coding: Programmieren ohne Programmierkenntnisse": Number(raw?.["Vibe Coding: Programmieren ohne Programmierkenntnisse"] ?? 0),
    "KI und Nachhaltigkeit: Der ökologische Fußabdruck": Number(raw?.["KI und Nachhaltigkeit: Der ökologische Fußabdruck"] ?? 0),
    "KI-generierte Inhalte in der Hochschullehre": Number(raw?.["KI-generierte Inhalte in der Hochschullehre"] ?? 0),
    "Chatbot-Qualität im Kundenservice": Number(raw?.["Chatbot-Qualität im Kundenservice"] ?? 0),
    "KI-Transformation im regionalen Mittelstand": Number(raw?.["KI-Transformation im regionalen Mittelstand"] ?? 0),
  };
}

export default function Home() {
  const [selected, setSelected] = useState<VoteOption[]>([]);
  const [results, setResults] = useState<VoteResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redisStatus, setRedisStatus] = useState<string | null>(null);
  const [isRedisReady, setIsRedisReady] = useState<boolean | null>(null);

  // Funktion zum Laden der aktuellen Ergebnisse
  const loadResults = async () => {
    const data = await getResults();
    setResults(normalizeResults(data as Record<string, unknown>));
  };

  useEffect(() => {
    let isActive = true;

    // Fetch asynchron im Effect, um kein synchrones setState im Effect-Body zu triggern.
    void Promise.all([getResults(), getRedisHealth()])
      .then(([data, health]) => {
        if (!isActive) {
          return;
        }

        setResults(normalizeResults(data as Record<string, unknown>));
        setIsRedisReady(health.ok);
        setRedisStatus(health.message);

        if (!health.ok) {
          setError('Datenbankverbindung fehlt. Bitte Konfiguration prüfen.');
        }
      })
      .catch(() => {
        if (isActive) {
          setError('Ergebnisse konnten nicht geladen werden.');
          setIsRedisReady(false);
          setRedisStatus('Redis-Status konnte nicht geprüft werden.');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const handleSelect = async (option: VoteOption) => {
    if (isRedisReady === false) {
      setError('Stimmen ist aktuell nicht möglich, weil Redis nicht erreichbar ist.');
      return;
    }

    setSelected((prev) => (prev.includes(option) ? prev : [...prev, option]));
    setIsSubmitting(true);
    setError(null);

    try {
      await selectOption(option); // In DB speichern
      await loadResults(); // UI aktualisieren
    } catch {
      setError('Stimme konnte nicht gespeichert werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInteractionBlocked = isSubmitting || isRedisReady === false;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-50 text-gray-800">
      <h1 className="text-3xl font-bold mb-8">Was möchtest du machen?</h1>
      {redisStatus && (
        <p className={`mb-2 text-sm ${isRedisReady ? 'text-green-700' : 'text-red-700'}`}>
          {redisStatus}
        </p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      
      <div className="grid w-full max-w-5xl gap-3 mb-12 sm:grid-cols-2">
        {OPTIONS.map((opt) => (
          <label
            key={opt}
            className={`flex items-start gap-3 p-4 rounded-lg border-2 transition ${selected.includes(opt) ? "bg-blue-50 border-blue-500" : "bg-white border-gray-300"} ${isInteractionBlocked ? "opacity-60" : "hover:border-blue-300"}`}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-blue-600"
              checked={selected.includes(opt)}
              disabled={isInteractionBlocked || selected.includes(opt)}
              onChange={(event) => {
                if (event.target.checked) {
                  void handleSelect(opt);
                }
              }}
            />
            <span className="text-sm sm:text-base">{opt}</span>
          </label>
        ))}
      </div>

      <div className="w-full max-w-lg p-6 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2">Aktuelle Ergebnisse:</h2>
        {isLoading ? (
          <p className="text-sm text-gray-600">Lade Ergebnisse...</p>
        ) : (
          OPTIONS.map((opt) => (
            <div key={opt} className="flex justify-between py-1">
              <span>{opt}:</span>
              <span className="font-mono font-bold">{results[opt]} Stimmen</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}