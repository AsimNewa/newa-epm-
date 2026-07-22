export interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
}

export const THEME_PRESETS: Record<string, ThemeColors> = {
  'newa-dark': {
    primaryColor: '#14213D',
    secondaryColor: '#8B93A0',
    accentColor: '#C9CED6',
    backgroundColor: '#0F1B2D',
    surfaceColor: '#16213E',
    textColor: '#FFFFFF',
  },
  'newa-light': {
    primaryColor: '#14213D',
    secondaryColor: '#8B93A0',
    accentColor: '#1C2B4A',
    backgroundColor: '#F4F5F7',
    surfaceColor: '#FFFFFF',
    textColor: '#1C2433',
  },
};

export const DEFAULT_THEME: ThemeColors = THEME_PRESETS['newa-dark'];
