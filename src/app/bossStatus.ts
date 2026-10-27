/**
 * The Fen bosses' readable state (playtest 8): which of its states the Glasswater Coil (DESIGN
 * §10.5) or the Old Bellwether (CONTENT §5) is in, what that does to the damage it takes, and the
 * pop label for entering it. Read-only over sim state, shared by the boss bar's state line
 * (ui/adventure/hudAdapter.ts) and the pop over the boss (render/bossPops.ts), so they never
 * disagree. Copy in data/ui.ts bossStateCopy.
 */
import { bossFightOf, enemyDef, isEnemyKind } from '../../data/enemies';
import { bossStateCopy } from '../../data/ui';
import type { Enemy, GameState } from '../sim';

export type BossStateId =
  'submerged' | 'surfaced' | 'exposed' | 'stranded' | 'iced' | 'overloaded' | 'shelled' | 'rung' | 'rolling';

/** guard: takes less damage; open: takes more; helpless: can't act; plain: normal. */
export type BossStateTone = 'guard' | 'plain' | 'open' | 'helpless';

export interface BossStatus {
  id: BossStateId;
  name: string;
  /** What the state does, "90% less damage". */
  does: string;
  /** "Submerged · 90% less damage". */
  line: string;
  tone: BossStateTone;
  /** The label popped over the boss when it enters this state, or null. */
  pop: string | null;
}

const TONE: Record<BossStateId, BossStateTone> = {
  submerged: 'guard',
  surfaced: 'plain',
  exposed: 'plain',
  stranded: 'open',
  iced: 'helpless',
  overloaded: 'helpless',
  shelled: 'guard',
  rung: 'open',
  rolling: 'guard',
};

/** The state id alone (cheap, for change detection). */
export function bossStateId(state: GameState, e: Enemy): { id: BossStateId; mult: number } | null {
  const fen = e.boss?.fen;
  if (!fen || !isEnemyKind(e.kind)) return null;
  const fight = bossFightOf(e.kind);
  if (fight === 'glasswater_coil') {
    const T = state.tuning;
    const id = fen.coil;
    const mult =
      id === 'submerged'
        ? e.boss!.phase >= 2
          ? T.bosses.coilDiveTaken
          : T.bosses.coilSubmergedTaken
        : id === 'stranded'
          ? T.swim.strandedTaken
          : 1;
    return { id, mult };
  }
  if (fight === 'bellwether') {
    const bell = enemyDef(e.kind).chemistry?.bell;
    if (!bell) return null;
    const s = e.special;
    // Open wins: it takes openTaken × even if it rolls while open.
    if (s.openLeft > 0) return { id: 'rung', mult: bell.openTaken };
    return { id: s.dashSpeed > 0 ? 'rolling' : 'shelled', mult: bell.shelledTaken };
  }
  return null;
}

/** The boss's state with its copy, or null for bosses without readable states. */
export function bossStatus(state: GameState, e: Enemy): BossStatus | null {
  const s = bossStateId(state, e);
  if (!s) return null;
  const copy = bossStateCopy[s.id]!;
  const pct = Math.round(Math.abs(1 - s.mult) * 100);
  const does = copy.does.replace('{pct}', String(pct));
  return { id: s.id, name: copy.name, does, line: `${copy.name} · ${does}`, tone: TONE[s.id], pop: copy.pop };
}
