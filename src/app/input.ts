import { Button, type InputFrame } from '../sim';

const KEY_BUTTONS: Record<string, number> = {
  KeyQ: Button.Cast3,
  KeyE: Button.Cast4,
  // Twin Threads' fifth slot; a no-op while it is locked (the lab's R reset is its own handler).
  KeyR: Button.Cast5,
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
  /**
   * Buttons pressed since the last sample. A tap whose press and release both land between two
   * samples (a long frame) still counts as held for one sample, so it is never lost.
   */
  private tapped = 0;
  private mouseX = 0;
  private mouseY = 0;

  constructor(private readonly surface: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);
      this.tapped |= KEY_BUTTONS[e.code] ?? 0;
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseButtons = 0;
      this.tapped = 0;
    });
    surface.addEventListener('mousemove', (e) => this.setMouse(e));
    surface.addEventListener('mousedown', (e) => {
      this.setMouse(e);
      if (e.button === 0) this.mouseButtons |= Button.Cast1;
      if (e.button === 2) this.mouseButtons |= Button.Cast2;
      if (this.enabled) this.tapped |= e.button === 0 ? Button.Cast1 : e.button === 2 ? Button.Cast2 : 0;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseButtons &= ~Button.Cast1;
      if (e.button === 2) this.mouseButtons &= ~Button.Cast2;
    });
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /**
   * Forgets taps not yet sampled. The app calls it on every frame the sim is paused, so a key
   * pressed in the pause menu or the title screen doesn't fire when play resumes.
   */
  dropTaps(): void {
    this.tapped = 0;
  }

  /** Mouse position in CSS pixels relative to the game surface. */
  get mouse(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  sample(screenToWorld: (sx: number, sy: number) => { x: number; y: number }): InputFrame {
    const aim = screenToWorld(this.mouseX, this.mouseY);
    const tapped = this.tapped;
    this.tapped = 0;
    if (!this.enabled) return { moveX: 0, moveY: 0, aimX: aim.x, aimY: aim.y, buttons: 0 };
    const k = (code: string): number => (this.keys.has(code) ? 1 : 0);
    let buttons = this.mouseButtons | tapped;
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
