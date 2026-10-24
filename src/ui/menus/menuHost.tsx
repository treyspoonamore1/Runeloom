/**
 * Opening and closing the adventure menus (I inventory, P passive tree, M region map, C crafting
 * bench, L loot filter, H Hearth): like the Loom, the sim pauses and player input is off while one is open.
 */
import type { Session } from '../../app/session';
import { CraftScreen } from '../craft/craftScreen';
import { FilterScreen } from '../filter/filterScreen';
import { InventoryScreen } from '../inventory/inventory';
import { invDialog } from '../inventory/slots';
import { MapScreen } from '../map/mapScreen';
import { TreeScreen } from '../tree/treeScreen';
import { HearthScreen } from '../hearth/hearthScreen';
import { hearthUnlocked } from '../hearth/hearthSignals';
import { escapeInMenu, menuTip, MENUS, type MenuId } from './frame';

export const isMenu = (s: string): s is MenuId => MENUS.some((m) => m.id === s);

/** The menu a key code opens, if any. */
export const menuForKey = (code: string): MenuId | undefined => {
  const id = MENUS.find((m) => m.code === code)?.id;
  return id === 'hearth' && !hearthUnlocked.peek() ? undefined : id;
};

export function MenuScreens(p: {
  screen: string;
  session: Session;
  onTab(id: MenuId): void;
  onClose(): void;
}) {
  if (p.screen === 'inventory')
    return <InventoryScreen session={p.session} onTab={p.onTab} onClose={p.onClose} />;
  if (p.screen === 'tree') return <TreeScreen session={p.session} onTab={p.onTab} onClose={p.onClose} />;
  if (p.screen === 'map') return <MapScreen session={p.session} onTab={p.onTab} onClose={p.onClose} />;
  if (p.screen === 'craft') return <CraftScreen session={p.session} onTab={p.onTab} onClose={p.onClose} />;
  if (p.screen === 'filter') return <FilterScreen session={p.session} onTab={p.onTab} onClose={p.onClose} />;
  if (p.screen === 'hearth') return <HearthScreen session={p.session} onTab={p.onTab} onClose={p.onClose} />;
  return null;
}

/**
 * A keydown while a menu is open. Esc closes a dialog first, then the menu; the menu's own key
 * closes it; another menu key switches. Returns true when handled.
 */
export function menuKey(e: KeyboardEvent, open: MenuId, go: (id: MenuId | null) => void): boolean {
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!escapeInMenu()) go(null);
    return true;
  }
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return false;
  const id = menuForKey(e.code);
  if (!id || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return false;
  e.preventDefault();
  invDialog.value = null;
  menuTip.value = null;
  go(id === open ? null : id);
  return true;
}
