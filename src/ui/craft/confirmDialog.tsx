/** The confirmation a Rare asks for before a craft, with "don't ask again this session". */
import { useState } from 'preact/hooks';
import type { Session } from '../../app/session';
import { currencies } from '../../../data/currency';
import { Dialog } from '../menus/frame';
import { cancelPending, confirmPending, craftPending } from './craftState';

export function ConfirmDialog({ session }: { session: Session }) {
  const p = craftPending.value;
  const [dontAsk, setDontAsk] = useState(false);
  if (!p) return null;
  const name = currencies[p.currency].name;
  return (
    <Dialog title={`Use ${name}?`} onCancel={cancelPending}>
      <p>
        Use <b>{name}</b> on <b>{p.name}</b>?
      </p>
      <p class="mn-muted">{p.why}</p>
      <label class="cr-ask">
        <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk((e.currentTarget as HTMLInputElement).checked)} />
        Don’t ask again this session
      </label>
      <div class="mn-acts">
        <button type="button" class="mn-btn" onClick={cancelPending}>
          Cancel <kbd>Esc</kbd>
        </button>
        <button type="button" class="mn-btn gold" onClick={() => confirmPending(session, dontAsk)}>
          Use {name}
        </button>
      </div>
    </Dialog>
  );
}
