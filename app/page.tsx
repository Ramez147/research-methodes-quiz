"use client";
import { useState, useEffect } from 'react';
import { selectOption, getResults, getRedisHealth } from './actions';

const OPTIONS = ["Loyalty Programm", "Kursplattform", "Stundendashboard"] as const;

type VoteOption = (typeof OPTIONS)[number];
type VoteResults = Record<VoteOption, number>;

const EMPTY_RESULTS: VoteResults = {
  "Loyalty Programm": 0,
  "Kursplattform": 0,
  "Stundendashboard": 0,
};

function normalizeResults(raw: Record<string, unknown> | null | undefined): VoteResults {
  return {
    "Loyalty Programm": Number(raw?.["Loyalty Programm"] ?? 0),
    "Kursplattform": Number(raw?.["Kursplattform"] ?? 0),
    "Stundendashboard": Number(raw?.["Stundendashboard"] ?? 0),
  };
}

export default function Home() {
  const [selected, setSelected] = useState<VoteOption | null>(null);
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

    setSelected(option);
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
      <h1 className="text-3xl font-bold mb-8">Was möchtest du trinken?</h1>
      {redisStatus && (
        <p className={`mb-2 text-sm ${isRedisReady ? 'text-green-700' : 'text-red-700'}`}>
          {redisStatus}
        </p>
      )}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      
      <div className="flex gap-4 mb-12">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            disabled={isInteractionBlocked}
            className={`px-6 py-3 rounded-lg border-2 transition ${selected === opt ? "bg-blue-500 text-white" : "bg-white"} ${isInteractionBlocked ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-50"}`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-md">
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