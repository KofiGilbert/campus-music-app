import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  setAuthTokenGetter,
  setBaseUrl,
  setRefreshHandler,
  getMe,
  refresh as refreshTokens,
  logout as logoutRequest,
  ApiError,
} from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { resolveApiBaseUrl } from "@/constants/config";

const AUTH_KEY = "campus_music_auth";
const TOKEN_KEY = "campus_music_token";
const REFRESH_KEY = "campus_music_refresh_token";

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
  emailVerified: boolean;
}

function toAuthUser(u: {
  id: string;
  name: string;
  email: string;
  role: string;
  university: string;
  country: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
}): AuthUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "listener" | "artist",
    university: u.university,
    country: u.country,
    avatarUrl: u.avatarUrl ?? null,
    emailVerified: u.emailVerified,
  };
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (user: AuthUser, accessToken: string, refreshToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (partial: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Live token refs so the auth-token getter + refresh handler (registered once)
  // always read the current values across rotations.
  const tokenRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);

  const setAccessToken = useCallback((t: string | null) => {
    tokenRef.current = t;
    setTokenState(t);
  }, []);

  // Clear all session state + storage locally (no network call).
  const clearSession = useCallback(async () => {
    setUser(null);
    setAccessToken(null);
    refreshRef.current = null;
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_KEY),
        secureDeleteItem(TOKEN_KEY),
        secureDeleteItem(REFRESH_KEY),
      ]);
    } catch {}
  }, [setAccessToken]);

  // Register the bearer-token getter and the 401 refresh handler once. The
  // handler rotates the stored refresh token, persists the new pair, and returns
  // the new access token to retry with — or signs out if rotation fails.
  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    setRefreshHandler(async () => {
      const rt = refreshRef.current;
      if (!rt) return null;
      try {
        const result = await refreshTokens({ refreshToken: rt });
        setAccessToken(result.accessToken);
        refreshRef.current = result.refreshToken;
        await Promise.all([
          secureSetItem(TOKEN_KEY, result.accessToken),
          secureSetItem(REFRESH_KEY, result.refreshToken),
        ]);
        return result.accessToken;
      } catch {
        await clearSession();
        return null;
      }
    });
    return () => {
      setAuthTokenGetter(null);
      setRefreshHandler(null);
    };
  }, [setAccessToken, clearSession]);

  // Restore a stored session on launch.
  useEffect(() => {
    (async () => {
      try {
        const [storedUser, storedToken, storedRefresh] = await Promise.all([
          AsyncStorage.getItem(AUTH_KEY),
          secureGetItem(TOKEN_KEY),
          secureGetItem(REFRESH_KEY),
        ]);

        if (storedRefresh) refreshRef.current = storedRefresh;

        if (storedToken) {
          setAccessToken(storedToken);
          try {
            // getMe benefits from the 401 interceptor: an expired access token is
            // transparently refreshed before this resolves.
            const freshUser = await Promise.race([
              getMe(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("getMe timed out")), 8000),
              ),
            ]);
            const authUser = toAuthUser(freshUser);
            setUser(authUser);
            await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(authUser));
          } catch (err: unknown) {
            const isAuthError = err instanceof ApiError && err.status === 401;
            if (isAuthError) {
              // Still 401 after a refresh attempt — the session is dead.
              await clearSession();
            } else if (storedUser) {
              // Transient network error — keep the cached user for offline access.
              setUser(JSON.parse(storedUser));
            }
          }
        } else if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch {
      } finally {
        setIsLoading(false);
      }
    })();
  }, [setAccessToken, clearSession]);

  const signIn = useCallback(
    async (u: AuthUser, accessToken: string, refreshToken: string) => {
      setUser(u);
      setAccessToken(accessToken);
      refreshRef.current = refreshToken;
      try {
        await Promise.all([
          AsyncStorage.setItem(AUTH_KEY, JSON.stringify(u)),
          secureSetItem(TOKEN_KEY, accessToken),
          secureSetItem(REFRESH_KEY, refreshToken),
        ]);
      } catch {}
    },
    [setAccessToken],
  );

  const signOut = useCallback(async () => {
    const rt = refreshRef.current;
    if (rt) {
      // Best-effort server-side revocation of the refresh-token family.
      try {
        await logoutRequest({ refreshToken: rt });
      } catch {}
    }
    await clearSession();
  }, [clearSession]);

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(AUTH_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signOut,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
