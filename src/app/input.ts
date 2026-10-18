import { Button, type InputFrame } from '../sim';

const KEY_BUTTONS: Record<string, number> = {
  KeyQ: Button.Cast3,
  KeyE: Button.Cast4,
  Space: Button.Dodge,
  KeyF: Button.Interact,
};

/**
 * Collects keyboard and mouse state and turns it into one InputFrame per sim tick.
 * Uses KeyboardEvent.code so WASD works on any keyboard layout.
 */
export class InputSampler {
  /** Set false while a text field (dev console) has focus. */
  enabled = true;
  private readonly keys = new Set<string>();
  private mouseButtons = 0;
  private mouseX = 0;
  private mouseY = 0;

  constructor(private readonly surface: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseButtons = 0;
    });
    surface.addEventListener('mousemove', (e) => this.setMouse(e));
    surface.addEventListener('mousedown', (e) => {
      this.setMouse(e);
      if (e.button === 0) this.mouseButtons |= Button.Cast1;
      if (e.button === 2) this.mouseButtons |= Button.Cast2;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseButtons &= ~Button.Cast1;
      if (e.button === 2) this.mouseButtons &= ~Button.Cast2;
    });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Mouse position in CSS pixels relative to the game surface. */
  get mouse(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  sample(screenToWorld: (sx: number, sy: number) => { x: number; y: number }): InputFrame {
    const aim = screenToWorld(this.mouseX, this.mouseY);
    if (!this.enabled) return { moveX: 0, moveY: 0, aimX: aim.x, aimY: aim.y, buttons: 0 };
    const k = (code: string): number => (this.keys.has(code) ? 1 : 0);
    let buttons = this.mouseButtons;
    for (const [code, bit] of Object.entries(KEY_BUTTONS)) if (this.keys.has(code)) buttons |= bit;
    return {
      moveX: k('KeyD') + k('ArrowRight') - k('KeyA') - k('ArrowLeft'),
      moveY: k('KeyS') + k('ArrowDown') - k('KeyW') - k('ArrowUp'),
      aimX: aim.x,
      aimY: aim.y,
      buttons,
    };
  }

  private setMouse(e: MouseEvent): void {
    const r = this.surface.getBoundingClientRect();
    this.mouseX = e.clientX - r.left;
    this.mouseY = e.clientY - r.top;
  }
}
