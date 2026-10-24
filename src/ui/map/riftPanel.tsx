/**
 * The map screen's rift section (M6): at a Loom Stone, the Rift Sigils the hero holds with their
 * modifiers and an Open button each (HeroEdit 'openRift'); inside a rift, what it is and how to
 * get home.
 */
import type { Session } from '../../app/session';
import { heroOf, sendEdit } from '../heroAdapter';
import { note } from '../menus/frame';
import { riftSummary, sigilViews, type ModLine } from './riftModel';
import { maxRiftTier } from '../../sim/meta/view';
import { freeSigilError } from '../../sim/world/rift/run';

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
  const views = sigilViews(hero.sigils, hero.riftTier, p.standing, false, maxRiftTier(hero));
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
          ? `Best rift completed: tier ${hero.riftTier}. Sigils up to tier ${Math.min(maxRiftTier(hero), hero.riftTier + 1)} open${hero.riftTier + 1 > maxRiftTier(hero) ? ' (Rekindle to go higher)' : ''}.`
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
          <div key={v.uid} class={`rf-sigil${v.blocked ? ' blocked' : ''}`}>
            <div class="rf-head">
              <b>{v.name}</b>
              <small>Area level {v.areaLevel}</small>
            </div>
            <Mods mods={v.mods} />
            {v.bonus ? <p class="rf-bonus">{v.bonus}</p> : null}
            <button
              type="button"
              class="mn-btn gold rf-open"
              disabled={v.blocked !== null}
              title={v.blocked ?? 'Open a rift with this sigil'}
              onClick={() => open(v.uid)}
            >
              {v.blocked ?? 'Open rift'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
