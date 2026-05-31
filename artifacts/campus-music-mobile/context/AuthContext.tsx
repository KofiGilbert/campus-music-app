import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { setAuthTokenGetter, setBaseUrl, getMe } from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { resolveApiBaseUrl } from "@/constants/config";

const AUTH_KEY = "campus_music_auth";
const TOKEN_KEY = "campus_music_token";

// Configure where API requests are sent. Handles both local development
// (EXPO_PUBLIC_API_URL, web + native) and the Replit preview (EXPO_PUBLIC_DOMAIN,
// native). When null, requests use same-origin relative paths. See constants/config.ts.
setBaseUrl(resolveApiBaseUrl());

async function secureSetItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function secureGetItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  } else {
    return SecureStore.getItemAsync(key);
  }
}

async function secureDeleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "listener" | "artist";
  university: string;
  country: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (user: AuthUser, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          secureGetItem(TOKEN_KEY),
        ]);

        if (storedToken) {
          setToken(storedToken);
          setAuthTokenGetter(() => storedToken);

          try {
            const freshUser = await Promise.race([
              getMe(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("getMe timed out")), 8000),
              ),
            ]);
            const authUser: AuthUser = {
              id: freshUser.id,
              name: freshUser.name,
              email: freshUser.email,
              role: freshUser.role as "listener" | "artist",
              university: freshUser.university,
              country: freshUser.country,
              avatarUrl: freshUser.avatarUrl ?? null,
            };
            setUser(authUser);
            await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
          } catch (err: unknown) {
            const isAuthError = err instanceof ApiError && (err as ApiError).status === 401;
            if (isAuthError) {
              // Token is invalid or expired — clear the session
              setToken(null);
              setAuthTokenGetter(null);
              await Promise.all([
                AsyncStorage.removeItem(AUTH_KEY),
                secureDeleteItem(TOKEN_KEY),
              ]);
            } else {
              // Transient network error — keep cached user to allow offline access
              if (storedUser) setUser(JSON.parse(storedUser));
            }
          }
        } else if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch {}
      finally { setIsLoading(false); }
    })();
  }, []);

  const signIn = useCallback(async (u: AuthUser, t: string) => {
    setUser(u);
    setToken(t);
    setAuthTokenGetter(() => t);
    try {
      await Promise.all([
        AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u)),
        secureSetItem(TOKEN_KEY, t),
      ]);
    } catch {}
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);
    setToken(null);
    setAuthTokenGetter(null);
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_KEY),
        secureDeleteItem(TOKEN_KEY),
      ]);
    } catch {}
  }, []);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(AUTH_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!user,
      signIn,
      signOut,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
