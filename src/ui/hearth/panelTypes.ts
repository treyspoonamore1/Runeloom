import type { Session } from '../../app/session';
import type { HearthEdit } from '../../sim/meta/edits';
import type { HearthSnapshot } from './adapter';

/** What every Hearth sub-panel gets. */
export interface PanelProps {
  session: Session;
  snap: HearthSnapshot;
  /** Sends an edit; shows its refusal inline. True when it applied. `ok` is a confirmation note. */
  act(edit: HearthEdit, ok?: string): boolean;
}
