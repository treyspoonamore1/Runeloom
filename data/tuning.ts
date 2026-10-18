/**
 * Feel values (DESIGN §4). Every number here is a starting guess, editable live
 * in the F2 tuning panel. When the designer pastes tuning JSON back, apply it
 * here exactly.
 */
export const defaultTuning = {
  player: {
    /** Collision radius in cells. */
    radius: 1.5,
    /** Top speed, cells per second. */
    moveSpeed: 26,
    /** Seconds from standstill to top speed. */
    accelTime: 0.06,
    /** Seconds from top speed to standstill. */
    decelTime: 0.05,
    /** Cells travelled by one dodge. */
    dodgeDistance: 12,
    /** Seconds one dodge takes. */
    dodgeDuration: 0.18,
    /** Invulnerable seconds from dodge start. */
    dodgeIframes: 0.15,
    dodgeCharges: 2,
    /** Seconds to regain one dodge charge. */
    dodgeRecharge: 1.4,
  },
  camera: {
    /** Look-ahead toward the cursor as a fraction of the screen size. */
    lookAhead: 0.15,
    /**
     * Follow smoothing time constant in seconds: the camera closes 63% of the gap
     * to its target in this time, 95% in three times it (lower is snappier, 0 locks on).
     */
    smoothing: 0.1,
    /** Extra zoom on top of resolution scaling. */
    zoom: 1,
    /** Cells of void the view may show beyond the room edge when the room is larger than the view. */
    edgeMargin: 2,
  },
};

export type Tuning = typeof defaultTuning;

export function cloneTuning(t: Tuning = defaultTuning): Tuning {
  return JSON.parse(JSON.stringify(t)) as Tuning;
}
