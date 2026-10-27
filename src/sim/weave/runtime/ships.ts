/** Runes the spell runtime compiles with (split from loadout.ts so loadoutContext.ts can use it). */
import { shipsThrough } from '../../../../data/runes';

/**
 * Runes the sim accepts (CONTENT §1 "Ships"): M2, M5, M7 and M8 (no M3, M4 or M6 runes exist; the
 * only M7 rune is the Shatter trigger, and M8 phase 1 adds only Tide and Gale).
 */
export const RUNTIME_SHIPS = shipsThrough('M8');
