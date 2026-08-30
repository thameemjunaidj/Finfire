/** Black, white, and red keep warnings visually unambiguous. */
export const colors = {
  background: '#000000',
  backgroundRaised: '#0A0A0A',
  surface: '#121212',
  surfaceRaised: '#1C1C1C',
  border: '#2E2E2E',
  primary: '#FF1A0D',
  primarySoft: '#2B0906',
  safe: '#FFFFFF',
  safeSoft: '#161616',
  /**
   * The one colour outside black/white/red, and it earns its place.
   *
   * Money health is the only number in the app where high is good. Rendering
   * "94 out of 100" in the same white as everything else told the reader
   * nothing, and rendering it in red said the opposite of what it meant. Green
   * is the only colour a person reads as "you are fine" without being taught.
   */
  healthy: '#2BD97C',
  healthySoft: '#062015',
  watch: '#FFB3A8',
  watchSoft: '#2A1310',
  high: '#FF6B57',
  highSoft: '#331009',
  critical: '#FF1A0D',
  criticalSoft: '#3B0805',
  text: '#FFFFFF',
  textSecondary: '#B5B5B5',
  textMuted: '#7A7A7A',
  white: '#FFFFFF',
  black: '#000000',
  overlay: '#0A0A0AF2',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
};
