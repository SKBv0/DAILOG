import React, { createContext, useContext, useState } from "react";
import { ThemeConfig, darkTheme } from "./theme";

export type ThemeName = "dark";

interface ThemeContextType {
  theme: ThemeConfig;
  themeName: ThemeName;
  updateTheme: (newTheme: Partial<ThemeConfig>) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const themeName: ThemeName = "dark";

  const [customTheme, setCustomTheme] = useState<Partial<ThemeConfig>>({});

  const baseTheme = darkTheme;
  const theme: ThemeConfig = {
    ...baseTheme,
    ...customTheme,
  };

  const updateTheme = (newTheme: Partial<ThemeConfig>) => {
    setCustomTheme((currentCustomTheme) => ({
      ...currentCustomTheme,
      ...newTheme,
    }));
  };

  return (
    <ThemeContext.Provider value={{ theme, themeName, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
