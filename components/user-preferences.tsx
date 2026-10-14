"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { Check } from "lucide-react";

type ColorMode = "light" | "dark" | "system";
type AccentTheme = "ocean" | "emerald" | "violet" | "rose" | "amber";

type UserPreferences = {
  colorMode: ColorMode;
  accentTheme: AccentTheme;
  reducedMotion: boolean;
  highContrast: boolean;
};

type UserPreferencesContextValue = {
  preferences: UserPreferences;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  error: string | null;
};

const storageKey = "retain:user-preferences";

const defaultPreferences: UserPreferences = {
  colorMode: "light",
  accentTheme: "ocean",
  reducedMotion: false,
  highContrast: false,
};

const colorModes: Array<{
  value: ColorMode;
  label: string;
  description: string;
}> = [
  { value: "light", label: "Light", description: "Bright and clear" },
  { value: "dark", label: "Dark", description: "Easy on the eyes" },
  { value: "system", label: "System", description: "Follow your device" },
];

const accentThemes: Array<{
  value: AccentTheme;
  label: string;
  swatch: string;
}> = [
  { value: "ocean", label: "Ocean", swatch: "bg-sky-600" },
  { value: "emerald", label: "Emerald", swatch: "bg-emerald-600" },
  { value: "violet", label: "Violet", swatch: "bg-violet-600" },
  { value: "rose", label: "Rose", swatch: "bg-rose-600" },
  { value: "amber", label: "Amber", swatch: "bg-amber-600" },
];

const preferencesContext = createContext<UserPreferencesContextValue | null>(null);

function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark" || value === "system";
}

function isAccentTheme(value: unknown): value is AccentTheme {
  return (
    value === "ocean" ||
    value === "emerald" ||
    value === "violet" ||
    value === "rose" ||
    value === "amber"
  );
}

function parsePreferences(value: string | null): UserPreferences {
  if (!value) return defaultPreferences;

  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== "object" || parsed === null) {
    return defaultPreferences;
  }

  const saved = parsed as Record<string, unknown>;
  return {
    colorMode: isColorMode(saved.colorMode)
      ? saved.colorMode
      : defaultPreferences.colorMode,
    accentTheme: isAccentTheme(saved.accentTheme)
      ? saved.accentTheme
      : defaultPreferences.accentTheme,
    reducedMotion:
      typeof saved.reducedMotion === "boolean"
        ? saved.reducedMotion
        : defaultPreferences.reducedMotion,
    highContrast:
      typeof saved.highContrast === "boolean"
        ? saved.highContrast
        : defaultPreferences.highContrast,
  };
}

function applyPreferences(preferences: UserPreferences) {
  const root = document.documentElement;
  const darkMode =
    preferences.colorMode === "dark" ||
    (preferences.colorMode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", darkMode);
  root.dataset.colorTheme = preferences.accentTheme;
  root.dataset.reducedMotion = String(preferences.reducedMotion);
  root.dataset.highContrast = String(preferences.highContrast);
}

const defaultSnapshot: UserPreferencesContextValue = {
  preferences: defaultPreferences,
  updatePreference: () => undefined,
  error: null,
};

let snapshot = defaultSnapshot;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    snapshot = {
      ...defaultSnapshot,
      preferences: parsePreferences(localStorage.getItem(storageKey)),
    };
  } catch (loadError) {
    console.error("Unable to load saved appearance preferences.", loadError);
    snapshot = {
      ...defaultSnapshot,
      error: "Saved appearance preferences could not be loaded.",
    };
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return defaultSnapshot;
}

function savePreferences(preferences: UserPreferences) {
  let error: string | null = null;
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch (saveError) {
    console.error("Unable to save appearance preferences.", saveError);
    error = "Your changes apply now but could not be saved on this device.";
  }

  snapshot = {
    ...snapshot,
    preferences,
    error,
  };
  for (const listener of listeners) listener();
}

export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentSnapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const { preferences } = currentSnapshot;

  useEffect(() => applyPreferences(preferences), [preferences]);

  useEffect(() => {
    if (preferences.colorMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => applyPreferences(preferences);
    mediaQuery.addEventListener("change", syncSystemTheme);
    return () => mediaQuery.removeEventListener("change", syncSystemTheme);
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      savePreferences({ ...snapshot.preferences, [key]: value });
    },
    [],
  );

  return (
    <preferencesContext.Provider
      value={{
        preferences,
        updatePreference,
        error: currentSnapshot.error,
      }}
    >
      {children}
    </preferencesContext.Provider>
  );
}

function useUserPreferences() {
  const context = useContext(preferencesContext);
  if (!context) {
    throw new Error(
      "Appearance settings must be rendered within UserPreferencesProvider.",
    );
  }
  return context;
}

export function AppearanceSettings() {
  const { preferences, updatePreference, error } = useUserPreferences();

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Personal preferences
      </p>
      <h2 className="mt-2 text-xl font-semibold">Appearance & accessibility</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Customize how the workspace looks on this device. These preferences
        don&apos;t change settings for other people.
      </p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Display mode</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {colorModes.map((mode) => {
            const selected = preferences.colorMode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                aria-pressed={selected}
                onClick={() => updatePreference("colorMode", mode.value)}
                className={`flex min-h-20 items-start justify-between rounded-xl border p-3 text-left transition ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "border-border hover:bg-muted/50"}`}
              >
                <span>
                  <span className="block text-sm font-semibold">
                    {mode.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {mode.description}
                  </span>
                </span>
                {selected && (
                  <Check className="size-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Accent color</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {accentThemes.map((theme) => {
            const selected = preferences.accentTheme === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                aria-label={`${theme.label} accent`}
                aria-pressed={selected}
                onClick={() => updatePreference("accentTheme", theme.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${selected ? "border-primary bg-primary/5 font-semibold" : "border-border hover:bg-muted/50"}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-3 rounded-full ${theme.swatch}`}
                />
                {theme.label}
                {selected && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6 space-y-3">
        <legend className="text-sm font-medium">Accessibility</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
          <input
            type="checkbox"
            checked={preferences.reducedMotion}
            onChange={(event) =>
              updatePreference("reducedMotion", event.target.checked)
            }
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">Reduce motion</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Minimize animations and transitions throughout the workspace.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
          <input
            type="checkbox"
            checked={preferences.highContrast}
            onChange={(event) =>
              updatePreference("highContrast", event.target.checked)
            }
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium">Increase contrast</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Strengthen text and border contrast for improved readability.
            </span>
          </span>
        </label>
      </fieldset>

      {error && (
        <p role="status" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
