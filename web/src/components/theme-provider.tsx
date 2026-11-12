"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // colour-scheme is handled by `html.dark` in globals.css; letting next-themes
      // also write an inline style on <html> adds a needless hydration diff.
      enableColorScheme={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
