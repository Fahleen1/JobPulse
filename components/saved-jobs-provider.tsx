"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "jobpulse:saved-jobs";

export interface SavedJobRef {
  id: string;
  slug: string;
  title: string;
  company_name: string;
  savedAt: string;
}

function readSaved(): SavedJobRef[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as SavedJobRef[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSaved(items: SavedJobRef[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

interface SavedJobsContextValue {
  saved: SavedJobRef[];
  ready: boolean;
  isSaved: (id: string) => boolean;
  toggle: (job: Omit<SavedJobRef, "savedAt">) => void;
  remove: (id: string) => void;
}

const SavedJobsContext = createContext<SavedJobsContextValue | null>(null);

export function SavedJobsProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<SavedJobRef[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSaved(readSaved());
    setReady(true);
  }, []);

  const isSaved = useCallback(
    (id: string) => saved.some((j) => j.id === id),
    [saved],
  );

  const toggle = useCallback((job: Omit<SavedJobRef, "savedAt">) => {
    setSaved((prev) => {
      const exists = prev.some((j) => j.id === job.id);
      const next = exists
        ? prev.filter((j) => j.id !== job.id)
        : [{ ...job, savedAt: new Date().toISOString() }, ...prev];
      writeSaved(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((j) => j.id !== id);
      writeSaved(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ saved, ready, isSaved, toggle, remove }),
    [saved, ready, isSaved, toggle, remove],
  );

  return (
    <SavedJobsContext.Provider value={value}>
      {children}
    </SavedJobsContext.Provider>
  );
}

export function useSavedJobs(): SavedJobsContextValue {
  const ctx = useContext(SavedJobsContext);
  if (!ctx) {
    throw new Error("useSavedJobs must be used within SavedJobsProvider");
  }
  return ctx;
}
