/** M4 console commands: give <rune>, level <n> (CLAUDE.md debug features). They mark the session edited. */
import type { Session } from '../../app/session';
import { runeByNotation } from '../../../data/runes';
import { giveRunes, setHeroLevel } from '../../sim/hero/debug';
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
}
