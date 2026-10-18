/**
 * The HUD's four spell slots, read from the loadout contract (getLoadout + slotTimers) and the
 * player's cast state. Pure, so it runs in Node tests; values are quantized so the HUD only
 * re-renders when something visible changes.
 */
import type { LoadoutView, SlotTimers } from '../app/loadout';
import { weaveGlyph, weaveShortName } from './loom/describe';
import { castProgress, quantize } from './hudModel';

export interface SlotSnap {
  slot: number;
  key: string;
  notation: string | null;
  /** "Fire Bolt", "Strike", or "Empty". */
  name: string;
  /** Glyph: root form and first element ids. */
  form: string | null;
  element: string | null;
  /** Mana per fire, or null if unknown (empty or unreadable). */
  cost: number | null;
  affordable: boolean;
  /** 0..1 cast sweep. */
  progress: number;
  casting: boolean;
  /** Automatic trigger: the button does nothing; shows an "auto" badge and a cooldown sweep. */
  auto: boolean;
  /** 0..1 cooldown left (automatic triggers), 0 when ready. */
  cooldown: number;
  /** Why the slot's weave doesn't fire (doesn't fit the spindle), or null. */
  warn: string | null;
}

export interface CasterView {
  mana: number;
  castSlot: number;
  castLeft: number;
  castTime: number;
}

export function slotSnaps(
  loadout: LoadoutView,
  caster: CasterView,
  timers: (slot: number) => SlotTimers,
): SlotSnap[] {
  return loadout.slots.map((s) => {
    const c = s.compiled;
    const cost = c ? (c.ok ? c.program.mana : (c.costs?.mana ?? null)) : null;
    const g = weaveGlyph(s.notation);
    const t = s.automatic ? timers(s.slot) : { cooldownLeft: 0, cooldownTotal: 0 };
    const casting = !s.automatic && caster.castSlot === s.slot;
    return {
      slot: s.slot,
      key: s.label,
      notation: s.notation,
      name: weaveShortName(s.notation),
      form: g.form,
      element: g.element,
      cost: cost === null ? null : Math.round(cost * 10) / 10,
      affordable: cost === null || caster.mana >= cost,
      progress: casting ? castProgress(caster.castSlot, caster.castLeft, caster.castTime, s.slot) : 0,
      casting,
      auto: s.automatic,
      cooldown: t.cooldownTotal > 0 ? quantize(t.cooldownLeft / t.cooldownTotal, 40) : 0,
      warn: c && !c.ok ? c.error.message : null,
    };
  });
}
