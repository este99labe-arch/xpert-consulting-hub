import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

/** Misma clave que lee el script del index.html. Si cambia una, cambia la otra. */
export const THEME_KEY = "xpert-theme";
const DEFAULT_THEME: Theme = "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const readStored = (): Theme => {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : DEFAULT_THEME;
  } catch {
    // Navegación privada o almacenamiento bloqueado: se usa el tema por defecto
    return DEFAULT_THEME;
  }
};

const applyTheme = (t: Theme) => {
  document.documentElement.classList.toggle("dark", t === "dark");
  // Hace que los controles nativos (scrollbars, selectores de fecha) acompañen
  document.documentElement.style.colorScheme = t;
};

/**
 * Tema de la aplicación: Midnight (oscuro) o Daylight (claro).
 *
 * La elección se guarda en localStorage, así que es por navegador y persiste
 * entre sesiones. No va en el perfil del usuario a propósito: es una
 * preferencia del dispositivo —la misma persona puede querer claro en el
 * portátil y oscuro en el móvil— y guardarla en servidor obligaría a esperar
 * a que cargue la sesión para saber con qué tema pintar.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(readStored);

  // El script del index.html ya aplicó la clase antes del primer pintado;
  // esto la mantiene sincronizada con los cambios posteriores.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Si se cambia el tema en otra pestaña, esta se entera
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* almacenamiento bloqueado */ }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
};
