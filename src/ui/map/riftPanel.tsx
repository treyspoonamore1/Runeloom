/**
 * The map screen's rift section (M6): at a Loom Stone, the Rift Sigils the hero holds with their
 * modifiers and an Open button each (HeroEdit 'openRift'); inside a rift, what it is and how to
 * get home.
 */
import type { Session } from '../../app/session';
import { heroOf, sendEdit } from '../heroAdapter';
import { note } from '../menus/frame';
import { riftSummary, sigilViews, type ModLine } from './riftModel';
import { deepRiftsOpen, maxRiftTier, riftOpenCap } from '../../sim/meta/view';
import { freeSigilError } from '../../sim/world/rift/run';

/** The eel-coil lock badge on a flooded (tier 9+, Coil alive) sigil. */
function LockBadge() {
  return (
    <svg class="rf-lock" viewBox="0 0 16 16" role="img" aria-label="Locked">
      <path d="M4 7V5a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" stroke-width="1.6" />
      <rect x="2.5" y="7" width="11" height="7.5" rx="1.5" fill="currentColor" />
      <path
        d="M5 12c1-2 2-2 3 0s2 2 3 0"
        fill="none"
        stroke="#1a1626"
        stroke-width="1.2"
        stroke-linecap="round"
      />
    </svg>
  );
}

function Mods(p: { mods: readonly ModLine[] }) {
  if (p.mods.length === 0) return <p class="mn-muted rf-none">No modifiers</p>;
  return (
    <ul class="rf-mods">
      {p.mods.map((m) => (
        <li key={m.id} class={`rf-mod ${m.kind}`}>
          <b>{m.name}</b> {m.text}
        </li>
      ))}
    </ul>
  );
}

export function RiftPanel(p: { session: Session; standing: boolean; onOpened(): void }) {
  const s = p.session.state;
  const hero = heroOf(p.session);
  const rift = riftSummary(s.world, Object.keys(s.rooms));
  if (rift)
    return (
      <section class="rf-panel" aria-label="This rift">
        <h3 class="mp-sub">Tier {rift.tier} Rift</h3>
        <p class="mn-muted">
          Area level {rift.areaLevel} · {rift.cleared} / {rift.rooms} rooms cleared
        </p>
        <Mods mods={rift.mods} />
        {rift.bonus ? <p class="rf-bonus">{rift.bonus}</p> : null}
        <p class="mn-help">
          {rift.bossDead
            ? 'The boss is dead: the door behind its arena leads home to the Loom Stone.'
            : 'Kill the boss at the far end to complete the rift. Leaving by the way you came, or dying, spends the sigil.'}
        </p>
      </section>
    );
  const views = sigilViews(
    hero.sigils,
    hero.riftTier,
    p.standing,
    false,
    maxRiftTier(hero),
    deepRiftsOpen(s.world),
  );
  const takeFree = () => {
    const why = sendEdit(p.session, { kind: 'freeSigil' });
    if (why) note(why);
  };
  const open = (uid: number) => {
    const why = sendEdit(p.session, { kind: 'openRift', uid });
    if (why) note(why);
    else p.onOpened();
  };
  return (
    <section class="rf-panel" aria-label="Rift Sigils">
      <h3 class="mp-sub">Rift Sigils</h3>
      <p class="mn-muted">
        {hero.riftTier > 0
          ? `Best rift completed: tier ${hero.riftTier}. Sigils up to tier ${Math.min(riftOpenCap(hero, s.world), hero.riftTier + 1)} open${hero.riftTier + 1 > maxRiftTier(hero) ? ' (Rekindle to go higher)' : ''}.`
          : 'Complete a rift to climb the tiers. Tier 1 sigils open now.'}
      </p>
      {views.length === 0 ? (
        freeSigilError(s) === null ? (
          <>
            <p class="mn-muted">
              You hold no sigils. The Loom offers a plain one so you can always start again.
            </p>
            <button type="button" class="mn-btn rf-free" onClick={takeFree}>
              Take a tier 1 sigil
            </button>
          </>
        ) : (
          <p class="mn-muted">You hold no sigils. The Cinder Warden guards the first; rifts drop more.</p>
        )
      ) : null}
      <div class="rf-list">
        {views.map((v) => (
          <div key={v.uid} class={`rf-sigil${v.blocked ? ' blocked' : ''}${v.locked ? ' locked' : ''}`}>
            <div class="rf-head">
              <b>
                {v.locked ? <LockBadge /> : null}
                {v.name}
              </b>
              <small>Area level {v.areaLevel}</small>
            </div>
            <Mods mods={v.mods} />
            {v.bonus ? <p class="rf-bonus">{v.bonus}</p> : null}
            {v.locked ? <p class="rf-locked-line">{v.blocked}</p> : null}
            <button
              type="button"
              class="mn-btn gold rf-open"
              disabled={v.blocked !== null && !v.locked}
              title={v.blocked ?? 'Open a rift with this sigil'}
              onClick={() => open(v.uid)}
            >
              {v.locked || v.blocked === null ? 'Open rift' : v.blocked}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
