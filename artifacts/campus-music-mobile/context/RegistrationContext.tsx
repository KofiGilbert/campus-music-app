import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useState } from "react";

const REG_KEY = "campus_music_reg_draft";

export interface RegistrationDraft {
  role?: "listener" | "artist";
  email?: string;
  name?: string;
  university?: string;
  country?: string;
  password?: string;
}

interface RegistrationContextType {
  draft: RegistrationDraft;
  setField: <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => void;
  clearDraft: () => void;
}

const RegistrationContext = createContext<RegistrationContextType | null>(null);

export function RegistrationProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<RegistrationDraft>({});

  const setField = useCallback(<K extends keyof RegistrationDraft>(
    key: K,
    value: RegistrationDraft[K]
  ) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      AsyncStorage.setItem(REG_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraft({});
    AsyncStorage.removeItem(REG_KEY).catch(() => {});
  }, []);

  return (
    <RegistrationContext.Provider value={{ draft, setField, clearDraft }}>
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const ctx = useContext(RegistrationContext);
  if (!ctx) throw new Error("useRegistration must be used within RegistrationProvider");
  return ctx;
}
