/** M4 console commands: give <rune>, level <n> (CLAUDE.md debug features), M6 sigil <tier> [mods]. They mark the session edited. */
import type { Session } from '../../app/session';
import { runeByNotation } from '../../../data/runes';
import { giveRunes, giveSigil, setHeroLevel } from '../../sim/hero/debug';
import { isRiftModId, RIFT_TIERS, riftMods, type RiftModId } from '../../../data/rift';
import { CommandError, type CommandRegistry } from './commands';

export interface HeroEnv {
  session: Session;
}

export function registerHeroCommands<C extends HeroEnv>(reg: CommandRegistry<C>): void {
  reg.register({
    name: 'give',
    usage: 'give <rune> [count] [level]',
    summary: 'Adventure: add rune items to the pouch (and unlock the rune), e.g. give OnHit 2 5.',
    run: (args, c) => {
      const def = args[0] === undefined ? undefined : runeByNotation(args[0]);
      if (!def) throw new CommandError('Usage: give <rune> [count] [level], e.g. give Frost 2');
      const count = args[1] === undefined ? 1 : Number(args[1]);
      const level = args[2] === undefined ? 1 : Number(args[2]);
      if (!Number.isInteger(count) || count < 1 || count > 20)
        throw new CommandError('count must be 1 to 20.');
      if (!Number.isInteger(level) || level < 1 || level > 20)
        throw new CommandError('level must be 1 to 20.');
      if (c.session.state.mode !== 'adventure') return 'Runes are unlimited outside adventure mode.';
      giveRunes(c.session.state, def.id, count, level);
      c.session.markEdited();
      return `Gave ${count} ${def.name} rune${count === 1 ? '' : 's'} (level ${level}).`;
    },
  });
  reg.register({
    name: 'level',
    usage: 'level <n>',
    summary: 'Set the character level (full heal).',
    run: (args, c) => {
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n < 1 || n > 100) throw new CommandError('Usage: level <n> (1 to 100)');
      setHeroLevel(c.session.state, n);
      c.session.markEdited();
      const p = c.session.state.player;
      return `Level ${n}: life ${p.maxLife}, mana ${p.maxMana}.`;
    },
  });
  reg.register({
    name: 'sigil',
    usage: 'sigil <tier> [modifier ...]',
    summary: `Adventure: a Rift Sigil (and the tier ladder to open it), e.g. sigil 5 brutal drought. Modifiers: ${Object.keys(riftMods).join(', ')}.`,
    run: (args, c) => {
      const tier = Number(args[0]);
      if (!Number.isInteger(tier) || tier < 1 || tier > RIFT_TIERS)
        throw new CommandError(`Usage: sigil <tier 1-${RIFT_TIERS}> [modifier ...]`);
      const mods: RiftModId[] = [];
      for (const m of args.slice(1)) {
        const id = m.toLowerCase();
        if (!isRiftModId(id))
          throw new CommandError(`Unknown modifier "${m}". Known: ${Object.keys(riftMods).join(', ')}`);
        if (!mods.includes(id)) mods.push(id);
      }
      if (c.session.state.mode !== 'adventure') return 'Rift Sigils exist in adventure mode only.';
      giveSigil(c.session.state, tier, mods);
      c.session.markEdited();
      return `Gave a tier ${tier} Rift Sigil${mods.length ? ` (${mods.join(', ')})` : ''}. Open it from the map at a Loom Stone.`;
    },
  });
}
