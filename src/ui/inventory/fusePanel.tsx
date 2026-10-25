/** The equipped spindle's Fuse sockets: drop a part to fuse it; a fused part offers Unfuse. */
import { UNFUSE_KEEP_COST } from '../../app/hero';
import type { Session } from '../../app/session';
import type { HeroState } from '../../sim/hero/types';
import { PartArt } from '../items/itemArt';
import { tipFor } from '../menus/frame';
import { itemDescription, partDescription, socketsOf } from './adapter';
import { dropTarget } from './equipment';
import { askUnfuse, dragging, fuse } from './slots';
import { equippedItem } from './stats';
import { PartTip } from './tips';

export function FusePanel({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const sp = equippedItem(hero, 'spindle');
  const n = sp ? socketsOf(sp) : 0;
  const used = sp ? sp.fused.filter((f) => f !== null).length : 0;
  const drag = dragging.value;
  return (
    <div class="inv-fuse" aria-label="Fuse">
      <h3>
        Fuse
        <small>
          {sp ? itemDescription(sp).name : 'No spindle'}
          {n > 0 ? ` · ${used}/${n}` : ''}
        </small>
      </h3>
      {n === 0 ? (
        <p class="mn-muted">{sp ? 'This spindle has no Fuse socket.' : 'Equip a spindle to fuse parts.'}</p>
      ) : null}
      <div class="inv-sockets">
        {Array.from({ length: n }, (_, i) => {
          const part = sp!.fused[i] ?? null;
          if (part) {
            const d = partDescription(part);
            return (
              <button
                key={i}
                type="button"
                class="inv-socket full"
                aria-label={`Socket ${i + 1}: ${d.name}. Click to unfuse`}
                onClick={() => askUnfuse(sp!.uid, i, part)}
                {...tipFor('magic', () => <PartTip part={part} fused />)}
              >
                <span class="inv-art sm">
                  <PartArt part={part.part} tier={part.tier} size="sm" />
                </span>
                <span class="inv-slot-txt">
                  <small>Socket {i + 1}</small>
                  <b>{d.name}</b>
                  {d.lines[0] ? <em>{d.lines[0]}</em> : null}
                </span>
                <span class="inv-unfuse">Unfuse</span>
              </button>
            );
          }
          return (
            <div
              key={i}
              class={`inv-socket empty${drag?.kind === 'part' ? ' lit' : ''}`}
              {...dropTarget(
                (p) => p.kind === 'part',
                (p) => {
                  const pt = hero.parts.find((x) => x.uid === p.uid);
                  if (pt) fuse(session, pt, i);
                },
              )}
            >
              <span class="inv-ring" />
              <span class="inv-slot-txt">
                <small>Socket {i + 1}</small>
                <b>Empty</b>
                <em>
                  {hero.parts.length > 0
                    ? 'Drop a part here, or click one in the bag'
                    : 'Monsters drop Fuse parts'}
                </em>
              </span>
            </div>
          );
        })}
      </div>
      {n > 0 ? (
        <p class="mn-help">
          Unfusing destroys the part, unless you pay {UNFUSE_KEEP_COST} Thread Scrap to keep it.
        </p>
      ) : null}
    </div>
  );
}
