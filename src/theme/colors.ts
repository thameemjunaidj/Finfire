/**
 * CashCue theme — black, white and red.
 *
 * Three colours only. Black is the ground, white is information, red is
 * attention. That constraint is doing real work here: in a warning app, if
 * everything can be coloured then nothing reads as urgent. Because red is the
 * only hue on screen, a single red number pulls the eye instantly.
 *
 * Severity is expressed as INTENSITY of red rather than different hues —
 * pale red for watch, mid red for high, full red for critical — so the scale
 * still reads correctly to colour-blind users and in a photo of a phone
 * screen taken from the back of a demo room.
 *
 * Every token name from the previous palette is kept, so no other file has to
 * change to adopt this.
 */

export const colors = {
  // --- Ground: near-black, layered so cards separate without borders shouting.
  background: '#000000',
  backgroundRaised: '#0A0A0A',
  surface: '#121212',
  surfaceRaised: '#1C1C1C',
  border: '#2E2E2E',

  // --- Brand red.
  primary: '#FF1A0D',
  primarySoft: '#2B0906',

  /**
   * Severity scale. "Safe" is deliberately white, not green: nothing is wrong,
   * so nothing should be coloured. Red appears only when it means something.
   */
  safe: '#FFFFFF',
  safeSoft: '#161616',
  watch: '#FFB3A8',
  watchSoft: '#2A1310',
  high: '#FF6B57',
  highSoft: '#331009',
  critical: '#FF1A0D',
  criticalSoft: '#3B0805',

  // --- Type.
  text: '#FFFFFF',
  textSecondary: '#B5B5B5',
  textMuted: '#7A7A7A',

  white: '#FFFFFF',
  black: '#000000',

  /** Translucent black for the floating tab bar. */
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
