import { useEffect, type ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import { DEFAULT_THEME } from '../lib/theme-presets';

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const { data: theme } = useTheme();

  useEffect(() => {
    const colors = theme ?? DEFAULT_THEME;
    const root = document.documentElement;
    root.style.setProperty('--color-primary', colors.primaryColor);
    root.style.setProperty('--color-secondary', colors.secondaryColor);
    root.style.setProperty('--color-accent', colors.accentColor);
    root.style.setProperty('--color-background', colors.backgroundColor);
    root.style.setProperty('--color-surface', colors.surfaceColor);
    root.style.setProperty('--color-text', colors.textColor);
  }, [theme]);

  return <>{children}</>;
}
