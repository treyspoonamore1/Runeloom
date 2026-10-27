/** M2 console commands: weave, weaves, spindle (CLAUDE.md debug features). */
import { getLoadout, SANDBOX_SPINDLES, SLOT_LABELS, slotViewOf } from '../../app/loadout';
import type { Session } from '../../app/session';
import { spindles, type SpindleId } from '../../../data/spindles';
import { compiledLine, parseSlot } from '../loom/describe';
import { applySpindle, applyWeave } from '../loom/loadoutStore';
import { CommandError, type CommandRegistry } from './commands';
import { LOCKED_SLOT_MESSAGE } from '../../sim/weave/runtime/slots';

export interface M2Env {
  session: Session;
}

const WEAVE_USAGE =
  'weave <slot> <notation>  (slot 1-4 or LMB/RMB/Q/E, 5 or R with Twin Threads, 6-9 or LMB2/RMB2/Q2/E2 for bar 2; "weave <slot> clear" empties it)';

/** Resolves a sandbox spindle from its id, a unique prefix, or its name ("ash", "Heartwood"). */
export function resolveSpindle(word: string): SpindleId {
  const w = word.toLowerCase().replace(/\s+spindle$/, '');
  const exact = SANDBOX_SPINDLES.find((id) => id === w || spindles[id].name.toLowerCase() === `${w} spindle`);
  if (exact) return exact;
  const hits = SANDBOX_SPINDLES.filter((id) => id.startsWith(w));
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1) throw new CommandError(`"${word}" matches ${hits.join(', ')}.`);
  throw new CommandError(`Unknown spindle "${word}". Spindles: ${SANDBOX_SPINDLES.join(', ')}`);
}

function slotLines(session: Session): string[] {
  const l = getLoadout(session);
  const sp = spindles[l.spindleId];
  return [
    `Spindle: ${sp.name} (Capacity ${l.capacity})`,
    ...l.slots.map(
      (s) =>
        `${String(s.slot + 1)} ${s.label.padEnd(3)}  ${s.notation ?? '(empty)'}  [${compiledLine(s.compiled)}]`,
    ),
    `Live bar: ${l.activeBar + 1} of 2 (X swaps)`,
  ];
}

export function registerM2Commands<C extends M2Env>(reg: CommandRegistry<C>): void {
  reg.register({
    name: 'weave',
    usage: 'weave <slot> <notation>',
    summary:
      'Put a weave in slot 1-4 (or LMB/RMB/Q/E; 5 or R with Twin Threads; 6-9 or LMB2/RMB2/Q2/E2 on bar 2), e.g. weave 3 Cast > Lob[Fire]. "clear" empties it.',
    run: (args, c) => {
      const slot = parseSlot(args[0]);
      if (slot === null) throw new CommandError(`Usage: ${WEAVE_USAGE}`);
      const label = SLOT_LABELS[slot]!;
      const text = args.slice(1).join(' ').trim();
      const view = slotViewOf(getLoadout(c.session), slot);
      if (!view) throw new CommandError(`${label} is locked: ${LOCKED_SLOT_MESSAGE}.`);
      if (text === '') {
        const s = view;
        return `${label}: ${s.notation ?? '(empty)'}  [${compiledLine(s.compiled)}]`;
      }
      const clear = /^(clear|none|empty|-)$/i.test(text);
      const r = applyWeave(c.session, slot, clear ? null : text);
      if (r.parseError) {
        const e = r.parseError;
        throw new CommandError(
          [
            `${label} unchanged. ${e.message}`,
            `  ${text}`,
            `  ${' '.repeat(e.index)}${'^'.repeat(Math.max(1, e.length))}`,
          ].join('\n'),
        );
      }
      if (r.compiled && !r.compiled.ok)
        throw new CommandError(`${label} unchanged: ${r.compiled.error.message}.`);
      if (clear) return `${label} emptied.`;
      return `${label}: ${r.view.notation}  [${compiledLine(r.view.compiled)}]`;
    },
  });

  reg.register({
    name: 'weaves',
    summary: 'List the weave slots (both bars, and R with Twin Threads), the live bar and the spindle.',
    run: (_a, c) => slotLines(c.session),
  });

  reg.register({
    name: 'spindle',
    usage: 'spindle [id]',
    summary: `Switch spindle: ${SANDBOX_SPINDLES.join(', ')}. No argument lists them.`,
    run: (args, c) => {
      if (args[0] === undefined) {
        const cur = getLoadout(c.session).spindleId;
        return SANDBOX_SPINDLES.map((id) => {
          const s = spindles[id];
          return `${id === cur ? '*' : ' '} ${id.padEnd(10)} Capacity ${String(s.capacity).padStart(2)}  ${s.implicitText}`;
        });
      }
      const id = resolveSpindle(args.join(' '));
      const l = applySpindle(c.session, id);
      const broken = l.slots.filter((s) => s.compiled && !s.compiled.ok);
      return [
        `Spindle: ${spindles[id].name} (Capacity ${l.capacity}).`,
        ...broken.map(
          (s) => `  ${s.label} doesn't fire until fixed: ${s.compiled!.ok ? '' : s.compiled!.error.message}`,
        ),
      ];
    },
  });
}
