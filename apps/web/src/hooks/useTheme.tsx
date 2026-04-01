import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  cycleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  isDark: false,
  setMode: () => {},
  cycleMode: () => {},
});

function getSystemDark(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return getSystemDark();
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("theme") as ThemeMode | null;
    return stored && ["light", "dark", "system"].includes(stored)
      ? stored
      : "system";
  });

  const [isDark, setIsDark] = useState(() => resolveIsDark(mode));

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem("theme", m);
  }, []);

  const cycleMode = useCallback(() => {
    setMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light");
  }, [mode, setMode]);

  // Re-evaluate isDark when mode changes or system preference changes
  useEffect(() => {
    setIsDark(resolveIsDark(mode));

    if (mode === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [mode]);

  // Set data-theme attribute on <html> for CSS variables
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, cycleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
