/**
 * The app's identity, in exactly one place.
 *
 * The name was spelled four different ways across the repo (FinFire,
 * Finfire, Fin Extinguisher, CashCue), which is the kind of drift a judge
 * spots on the first slide. Every user-facing mention now reads from here,
 * so changing the name is a one-line edit rather than a hunt.
 */

export const APP_NAME = 'Fin Extinguisher';

export const APP_TAGLINE = 'Put out money problems before they start';

/**
 * NOT derived from APP_NAME on purpose:
 *   - the storage key would orphan every saved account if it changed
 *   - the Expo slug identifies the project to Expo's build service
 * Both stay as they are, whatever the app is called.
 */
export const STORAGE_NAMESPACE = '@finfire';
