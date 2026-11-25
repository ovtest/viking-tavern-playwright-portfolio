/** Saved session (cookie) of VIKING_NAME, written by auth.setup.ts. */
export const AUTH_FILE = ".auth/viking.json";

/** A saga number the tests use when the exact night doesn't matter but should be the same every run. */
export const TEST_SAGA = 4217;

/** A new Viking's Coin Pouch, and the most it can hold. */
export const FULL_POUCH = 100;

/** Rooms with a fixed role in the tavern (see the app's docs/SPEC.md, section 2.1). */
export const ROOMS = {
  kitchen: 0, // Kitchen Fellowship: free, only when Lady Owner offers it
  jarl: 1, // The Jarl's Chamber: the most expensive room (45–60 silver)
  goatStable: 17, // only when Lady Owner offers it (2–5 silver)
  /** Regular rooms that have no night event, for tests that need a quiet room. */
  quiet: [4, 5, 14, 15, 16],
} as const;

/** All regular rooms (1–16). */
export const REGULAR_ROOMS = Array.from({ length: 16 }, (_, i) => i + 1);

/** Every company that can come to Mead & Feast; five come each night, picked by the saga number. */
export const COMPANIES = ["robin-hood", "lady", "mice", "french-guests", "pirates", "dragons", "druid"] as const;
export const PLACES = 5;
