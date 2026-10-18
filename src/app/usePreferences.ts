import { useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

function readPreference(
  key: "design" | "sidebar" | "navigation" | "density",
  fallback: string,
) {
  try {
    const saved = localStorage.getItem(`winprogman-${key}`);
    if (
      key === "design" &&
      (saved === "classic" ||
        saved === "color" ||
        saved === "split-compact" ||
        saved === "slate")
    )
      return saved;
    if (key === "sidebar" && (saved === "labels" || saved === "icons"))
      return saved;
    if (key === "navigation" && (saved === "sidebar" || saved === "top"))
      return saved;
    if (key === "density" && (saved === "comfortable" || saved === "compact"))
      return saved;
  } catch {
    /* Session only. */
  }
  return fallback;
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Session only. */
  }
}

/** Appearance choices, kept in localStorage and mirrored onto <html>. */
export function usePreferences() {
  const [design, setDesign] = useState(() =>
    readPreference("design", "classic"),
  );
  const [sidebar, setSidebar] = useState(() =>
    readPreference("sidebar", "labels"),
  );
  const [navigation, setNavigation] = useState(() =>
    readPreference("navigation", "sidebar"),
  );
  const [density, setDensity] = useState(() =>
    readPreference("density", "comfortable"),
  );
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    try {
      const saved = localStorage.getItem("winprogman-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Storage may be unavailable in private browser contexts.
    }
    return "system";
  });
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
    };
    apply();
    system.addEventListener("change", apply);
    remember("winprogman-theme", theme);
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.design = design;
    remember("winprogman-design", design);
  }, [design]);
  useEffect(() => {
    document.documentElement.dataset.density = density;
    remember("winprogman-density", density);
  }, [density]);
  useEffect(() => remember("winprogman-sidebar", sidebar), [sidebar]);
  useEffect(() => remember("winprogman-navigation", navigation), [navigation]);
  return {
    design,
    setDesign,
    sidebar,
    setSidebar,
    navigation,
    setNavigation,
    density,
    setDensity,
    theme,
    setTheme,
  };
}

export type Preferences = ReturnType<typeof usePreferences>;
