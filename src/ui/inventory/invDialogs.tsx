/** The inventory's confirmations: a single salvage, the bulk salvage and unfusing a part. */
import { UNFUSE_KEEP_COST } from '../../app/hero';
import type { Session } from '../../app/session';
import { heroOf } from '../heroAdapter';
import { Dialog } from '../menus/frame';
import { partName, salvageValue } from './adapter';
import { PRESET_LABELS, summarizePresets, SALVAGE_PRESETS } from './salvageSel';
import { bulkSalvage, filterHides, invDialog, keepProblem, salvage, unfuse } from './slots';

function Bulk({ session, preset }: { session: Session; preset: (typeof SALVAGE_PRESETS)[number] }) {
  const cancel = () => (invDialog.value = null);
  const sums = summarizePresets(heroOf(session), filterHides, salvageValue);
  const cur = sums.find((s) => s.preset === preset)!;
  return (
    <Dialog title="Salvage items" onCancel={cancel}>
      <div class="inv-presets" role="radiogroup" aria-label="What to salvage">
        {sums.map((s) => (
          <button
            key={s.preset}
            type="button"
            role="radio"
            class="inv-preset"
            aria-checked={s.preset === preset}
            disabled={s.uids.length === 0}
            onClick={() => (invDialog.value = { kind: 'bulk', preset: s.preset })}
          >
            <span>{PRESET_LABELS[s.preset]}</span>
            <small>
              {s.uids.length} item{s.uids.length === 1 ? '' : 's'} · {s.scrap} Scrap
            </small>
          </button>
        ))}
      </div>
      <p>
        {cur.uids.length === 0 ? (
          'Nothing matches.'
        ) : (
          <>
            Destroys <b>{cur.uids.length}</b> item{cur.uids.length === 1 ? '' : 's'} for{' '}
            <b>{cur.scrap} Thread Scrap</b>.
          </>
        )}
      </p>
      <p class="mn-help">Worn, unique, kept (padlock) and fused items are never touched.</p>
      <div class="mn-acts">
        <button type="button" class="mn-btn" onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          class="mn-btn danger"
          disabled={cur.uids.length === 0}
          onClick={() => bulkSalvage(session, cur.uids)}
        >
          Salvage {cur.uids.length} (+{cur.scrap} Scrap)
        </button>
      </div>
    </Dialog>
  );
}

export function Dialogs({ session }: { session: Session }) {
  const d = invDialog.value;
  if (!d) return null;
  const cancel = () => (invDialog.value = null);
  if (d.kind === 'bulk') return <Bulk session={session} preset={d.preset} />;
  if (d.kind === 'salvage')
    return (
      <Dialog title={`Salvage ${d.name}?`} onCancel={cancel}>
        <p>
          It is destroyed for <b>{d.value} Thread Scrap</b>.
        </p>
        <div class="mn-acts">
          <button type="button" class="mn-btn" onClick={cancel}>
            Keep it
          </button>
          <button type="button" class="mn-btn danger" onClick={() => salvage(session, d.uid)}>
            Salvage
          </button>
        </div>
      </Dialog>
    );
  const hero = heroOf(session);
  const why = keepProblem(hero.threadScrap);
  return (
    <Dialog title={`Unfuse ${partName(d.part)}?`} onCancel={cancel}>
      <p>Take the part out of its socket. Without paying, the part is destroyed.</p>
      <div class="mn-acts">
        <button type="button" class="mn-btn" onClick={cancel}>
          Cancel
        </button>
        <button
          type="button"
          class="mn-btn danger"
          onClick={() => unfuse(session, d.spindleUid, d.socket, false)}
        >
          Destroy it
        </button>
        <button
          type="button"
          class="mn-btn gold"
          disabled={why !== null}
          title={why ?? undefined}
          onClick={() => unfuse(session, d.spindleUid, d.socket, true)}
        >
          Keep it ({UNFUSE_KEEP_COST} Thread Scrap)
        </button>
      </div>
      {why ? <p class="mn-why">{why}.</p> : null}
    </Dialog>
  );
}
