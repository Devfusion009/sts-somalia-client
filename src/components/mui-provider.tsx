"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useMemo } from "react";
import { useTheme as useNextTheme } from "next-themes";

/**
 * Scoped Material UI bridge.
 *
 * MUI is used deliberately narrowly in this codebase: icons (@mui/icons-material)
 * plus a handful of self-contained components (Rating, Autocomplete, Skeleton,
 * Chip, Fab, Accordion) inside the marketing pages. Every existing form/portal
 * primitive stays on the Base UI wrappers in components/ui — two full design
 * systems fighting over the same buttons would be a regression, not an upgrade.
 *
 * Two things matter for correctness here:
 *
 * 1. NO CssBaseline. MUI's baseline resets margins/typography globally and would
 *    fight Tailwind's own preflight. Tailwind owns the document; MUI only styles
 *    its own components.
 * 2. Emotion (which MUI styles with) emits UNLAYERED CSS, and unlayered rules beat
 *    anything inside a cascade layer — which is where Tailwind v4 puts its
 *    utilities. So Tailwind classes silently lose against MUI's own styles. The
 *    rule in this repo: style MUI components with `sx`/theme, style everything
 *    else with Tailwind. Don't try to override MUI internals with className.
 *
 * Colors mirror globals.css so MUI surfaces track the STS brand and the
 * next-themes dark class in both directions.
 */
export function MuiProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useNextTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";

  const theme = useMemo(
    () =>
      createTheme({
        cssVariables: true,
        palette: {
          mode,
          primary: {
            main: mode === "dark" ? "#2dd4b4" : "#00947c",
            contrastText: mode === "dark" ? "#04211c" : "#ffffff",
          },
          secondary: {
            main: mode === "dark" ? "#fb8b3c" : "#f4711c",
            contrastText: "#ffffff",
          },
          warning: { main: mode === "dark" ? "#fbbf24" : "#f59e0b" },
          background: {
            default: mode === "dark" ? "#061412" : "#f8fbfa",
            paper: mode === "dark" ? "#0a211d" : "#ffffff",
          },
          text: {
            primary: mode === "dark" ? "#e2f3ee" : "#10312c",
            secondary: mode === "dark" ? "#8fb3ab" : "#5f7873",
          },
          divider: mode === "dark" ? "rgba(255,255,255,0.1)" : "#dfeae6",
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily: "var(--font-sans)",
          h1: { fontFamily: "var(--font-heading)" },
          h2: { fontFamily: "var(--font-heading)" },
          h3: { fontFamily: "var(--font-heading)" },
          h4: { fontFamily: "var(--font-heading)" },
          button: { textTransform: "none", fontWeight: 600 },
        },
        components: {
          // Keep MUI from injecting its own focus-ring/typography opinions where
          // the surrounding Tailwind design already handles them.
          MuiButtonBase: { defaultProps: { disableRipple: false } },
          MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
        },
      }),
    [mode]
  );

  return (
    <AppRouterCacheProvider options={{ key: "mui", enableCssLayer: true }}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </AppRouterCacheProvider>
  );
}
