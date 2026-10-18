/** M2 console commands: weave, weaves, spindle (CLAUDE.md debug features). */
import { getLoadout, SANDBOX_SPINDLES, SLOT_LABELS } from '../../app/loadout';
import type { Session } from '../../app/session';
import { spindles, type SpindleId } from '../../../data/spindles';
import { compiledLine, parseSlot } from '../loom/describe';
import { applySpindle, applyWeave } from '../loom/loadoutStore';
import { CommandError, type CommandRegistry } from './commands';

export interface M2Env {
  session: Session;
}

const WEAVE_USAGE = 'weave <slot> <notation>  (slot 1-4 or LMB/RMB/Q/E; "weave <slot> clear" empties it)';

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
  ];
}

export function registerM2Commands<C extends M2Env>(reg: CommandRegistry<C>): void {
  reg.register({
    name: 'weave',
    usage: 'weave <slot> <notation>',
    summary: 'Put a weave in slot 1-4 (or LMB/RMB/Q/E), e.g. weave 3 Cast > Lob[Fire]. "clear" empties it.',
    run: (args, c) => {
      const slot = parseSlot(args[0]);
      if (slot === null) throw new CommandError(`Usage: ${WEAVE_USAGE}`);
      const label = SLOT_LABELS[slot]!;
      const text = args.slice(1).join(' ').trim();
      if (text === '') {
        const s = getLoadout(c.session).slots[slot]!;
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
    summary: 'List the four weave slots and the spindle.',
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
