/**
 * Region map (M, and when touching a Loom Stone): rooms as boxes in the world agent's layout,
 * visited / current / unexplored, Loom Stones, and travel between activated Loom Stones plus
 * Rest while standing at one. M6: Rift Sigils to open at a Loom Stone; in a rift, its own map.
 */
import type { Session } from '../../app/session';
import { uiTuning } from '../../../data/ui';
import { heroRev, sendEdit } from '../heroAdapter';
import { MenuFrame, note, type MenuId } from '../menus/frame';
import { mapProgress, regionLayout } from './adapter';
import { placeMap, travelTargets, type PlacedRoom } from './mapModel';
import { injectMapStyle } from './mapStyle';
import { RiftPanel } from './riftPanel';

/** The SVG's virtual size; it scales to the panel with preserveAspectRatio. */
const VW = 1000;
const VH = 640;

function RoomBox({
  r,
  stones,
  canTravel,
  onTravel,
}: {
  r: PlacedRoom;
  stones: readonly string[];
  canTravel: boolean;
  onTravel(key: string): void;
}) {
  const known = r.vis === 'visited' || r.vis === 'current';
  // Shrink long names to fit the box (about 0.56 em per glyph); below 9 px, squeeze them instead.
  const maxW = r.w - 14;
  const fit = maxW / (r.room.name.length * 0.56);
  const fs = Math.max(9, Math.min(16, r.w / 8, fit));
  const squeeze = fit < 9;
  return (
    <g class={`mp-room ${r.vis} g-${r.room.region}${r.room.side ? ' side' : ''}`}>
      <rect x={r.x + 3} y={r.y + 3} width={r.w - 6} height={r.h - 6} rx={8} />
      {known ? (
        <text
          x={r.x + r.w / 2}
          y={r.y + r.h / 2 + fs * 0.35}
          font-size={fs}
          class="mp-name"
          {...(squeeze ? { textLength: maxW, lengthAdjust: 'spacingAndGlyphs' } : {})}
        >
          {r.room.name}
        </text>
      ) : (
        <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 7} font-size={20} class="mp-q">
          ?
        </text>
      )}
      {known
        ? r.room.loomStones.map((k, i) => {
            const on = stones.includes(`${r.room.id}#${k}`);
            const cx = r.x + r.w - 16 - i * 22;
            const cy = r.y + 17;
            const travel = on && canTravel;
            return (
              <g
                key={k}
                class={`mp-stone${on ? ' on' : ''}${travel ? ' go' : ''}`}
                role={travel ? 'button' : undefined}
                tabIndex={travel ? 0 : undefined}
                aria-label={travel ? `Travel to ${r.room.name}` : undefined}
                onClick={travel ? () => onTravel(k) : undefined}
                onKeyDown={(e) => travel && (e.key === 'Enter' || e.key === ' ') && onTravel(k)}
              >
                <title>
                  {on
                    ? `Loom Stone (active)${travel ? ': click to travel' : ''}`
                    : 'Loom Stone (not yet touched)'}
                </title>
                <path d={`M${cx - 6} ${cy + 9}V${cy - 3}l6-7 6 7v12z`} />
                <circle cx={cx} cy={cy + 1} r={2.6} class="mp-gem" />
              </g>
            );
          })
        : null}
      {r.vis === 'current' ? <circle class="mp-you" cx={r.x + 18} cy={r.y + r.h - 18} r={7} /> : null}
    </g>
  );
}

export function MapScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectMapStyle();
  void heroRev.value;
  const layout = regionLayout(p.session);
  const prog = mapProgress(p.session);
  const placed = placeMap(layout, prog.visited, prog.current, VW, VH, uiTuning.mapPadding);
  const targets = travelTargets(layout, prog.activated, prog.standing);
  const here = layout.rooms.find((r) => r.id === prog.current);
  const travel = (roomId: string, key: string) => {
    const why = sendEdit(p.session, { kind: 'travel', roomId, key });
    if (why) note(why);
    else p.onClose();
  };
  const rest = () => {
    const why = sendEdit(p.session, { kind: 'rest' });
    note(why ?? 'Rested. Life and mana are full; enemies have returned.', why === null);
  };
  return (
    <MenuFrame
      id="map"
      title={p.session.state.world.rift ? 'Rift map' : 'Region map'}
      onTab={p.onTab}
      onClose={p.onClose}
      bodyClass="mp-body"
    >
      <section class="mn-panel mp-main" aria-label="Map">
        <svg
          class="mp-svg"
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Rooms you have visited"
        >
          {placed.regions.map((g) => (
            <g key={g.id} class={`mp-region g-${g.id}`}>
              <rect x={g.x - 12} y={g.y - 30} width={g.w + 24} height={g.h + 42} rx={16} />
            </g>
          ))}
          {placed.links.map((l) => (
            <g
              key={`${l.link.a}-${l.link.b}`}
              class={`mp-link${l.known ? ' known' : ''}${l.link.door ? ` door-${l.link.door}` : ''}`}
            >
              <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
              {l.link.door ? <circle cx={(l.x1 + l.x2) / 2} cy={(l.y1 + l.y2) / 2} r={6} /> : null}
            </g>
          ))}
          {placed.rooms.map((r) => (
            <RoomBox
              key={r.room.id}
              r={r}
              stones={prog.activated}
              canTravel={!!prog.standing}
              onTravel={(k) => travel(r.room.id, k)}
            />
          ))}
          {placed.regions.map((g) => (
            <text key={g.id} class={`mp-region-name g-${g.id}`} x={g.x - 2} y={g.y - 10}>
              {g.name}
            </text>
          ))}
        </svg>
      </section>
      <aside class="mn-panel mp-side" aria-label="Where you are">
        <h3>You are here</h3>
        <p class="mp-here">{here?.name ?? prog.current}</p>
        {prog.standing ? (
          <>
            <p class="mn-muted">You stand at a Loom Stone.</p>
            <button type="button" class="mn-btn gold mp-rest" onClick={rest}>
              Rest at the Loom Stone
            </button>
            <p class="mn-help">Resting refills life and mana. Cleared rooms fill with enemies again.</p>
            <h3 class="mp-sub">Travel</h3>
            {targets.length === 0 ? (
              <p class="mn-muted">Touch other Loom Stones to travel between them.</p>
            ) : null}
            <div class="mp-travel">
              {targets.map((t) => (
                <button
                  key={`${t.roomId}#${t.key}`}
                  type="button"
                  class="mn-btn"
                  onClick={() => travel(t.roomId, t.key)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </>
        ) : p.session.state.world.rift ? null : (
          <p class="mn-muted">Stand at a Loom Stone to rest or travel between the ones you have touched.</p>
        )}
        <RiftPanel session={p.session} standing={!!prog.standing} onOpened={p.onClose} />
        <div class="mp-legend" aria-hidden="true">
          <span class="current">
            <i /> You are here
          </span>
          <span class="visited">
            <i /> Visited
          </span>
          <span class="unknown">
            <i /> Unexplored
          </span>
          <span class="stone">
            <i /> Loom Stone
          </span>
        </div>
      </aside>
    </MenuFrame>
  );
}
