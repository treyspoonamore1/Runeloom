/** Button bits in InputFrame.buttons. */
export const Button = {
  Cast1: 1 << 0, // LMB
  Cast2: 1 << 1, // RMB
  Cast3: 1 << 2, // Q
  Cast4: 1 << 3, // E
  Dodge: 1 << 4, // Space
  Interact: 1 << 5, // F
} as const;

export type ButtonName = keyof typeof Button;

/**
 * Everything the sim learns from the player in one tick. Plain data, so it can
 * be recorded for replays and produced by bots.
 */
export interface InputFrame {
  /** Desired move direction, components in [-1, 1]. Not required to be normalized. */
  moveX: number;
  moveY: number;
  /** Aim point in world cells. */
  aimX: number;
  aimY: number;
  /** Bitmask of Button values held this tick. */
  buttons: number;
}

export const NEUTRAL_INPUT: Readonly<InputFrame> = Object.freeze({
  moveX: 0,
  moveY: 0,
  aimX: 0,
  aimY: 0,
  buttons: 0,
});

export function isHeld(buttons: number, b: number): boolean {
  return (buttons & b) !== 0;
}

/** True on the tick the button goes down. */
export function wasPressed(prevButtons: number, buttons: number, b: number): boolean {
  return (buttons & b) !== 0 && (prevButtons & b) === 0;
}
