"use client";
import { useState, useEffect } from 'react';
import { selectOption, getResults } from './actions';

const OPTIONS = ["Kaffee ☕", "Tee 🍵", "Mate 🧉"] as const;

type VoteOption = (typeof OPTIONS)[number];
type VoteResults = Record<VoteOption, number>;

const EMPTY_RESULTS: VoteResults = {
  "Kaffee ☕": 0,
  "Tee 🍵": 0,
  "Mate 🧉": 0,
};

function normalizeResults(raw: Record<string, unknown> | null | undefined): VoteResults {
  return {
    "Kaffee ☕": Number(raw?.["Kaffee ☕"] ?? 0),
    "Tee 🍵": Number(raw?.["Tee 🍵"] ?? 0),
    "Mate 🧉": Number(raw?.["Mate 🧉"] ?? 0),
  };
}

export default function Home() {
  const [selected, setSelected] = useState<VoteOption | null>(null);
  const [results, setResults] = useState<VoteResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Funktion zum Laden der aktuellen Ergebnisse
  const loadResults = async () => {
    const data = await getResults();
    setResults(normalizeResults(data as Record<string, unknown>));
  };

  useEffect(() => {
    let isActive = true;

    // Fetch asynchron im Effect, um kein synchrones setState im Effect-Body zu triggern.
    void getResults()
      .then((data) => {
        if (!isActive) {
          return;
        }
        setResults(normalizeResults(data as Record<string, unknown>));
      })
      .catch(() => {
        if (isActive) {
          setError('Ergebnisse konnten nicht geladen werden.');
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-10 bg-gray-50 text-gray-800">
      <h1 className="text-3xl font-bold mb-8">Was möchtest du trinken?</h1>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      
      <div className="flex gap-4 mb-12">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => handleSelect(opt)}
            disabled={isSubmitting}
            className={`px-6 py-3 rounded-lg border-2 transition ${selected === opt ? "bg-blue-500 text-white" : "bg-white"} ${isSubmitting ? "opacity-60 cursor-not-allowed" : "hover:bg-blue-50"}`}
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