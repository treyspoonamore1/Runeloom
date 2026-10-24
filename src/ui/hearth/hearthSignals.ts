/**
 * Small shared signals of the Hearth UI. No imports besides signals, so the menu frame can read
 * them without a cycle.
 */
import { signal } from '@preact/signals';

/** The Hearth has been lit (or fixtures stand in): its tab and H key exist. Set by the HUD each frame. */
export const hearthUnlocked = signal(false);

/** Sub-tabs of the Hearth menu. */
export type HearthTab =
  'buildings' | 'garden' | 'expeditions' | 'salvage' | 'spindlewright' | 'rekindle' | 'cartographer';

/** The open (or next-opened) Hearth sub-tab. A station sets it before the menu opens. */
export const hearthTab = signal<HearthTab>('buildings');

/** Bumped by the Hearth screen's ticker so open panels re-read the live state. */
export const hearthPulse = signal(0);
