import type { SpellId } from '../../data/spells';

/** Spell icon for an action-bar slot: flat shapes with a dark outline, like the game's art. */
export function SpellIcon(p: { spell: SpellId }) {
  if (p.spell === 'fire_bolt') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M17 2c1 6 8 9 8 16.5A9 9 0 0 1 7 18.5c0-3.4 2-5.6 3.6-7.9.8 2.2 1.9 3.3 3.2 3.9C14.6 10.700 16.600 7.300 17 2z"
          fill="#ff7a2f"
          stroke="#2a1c1f"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path
          d="M16.500 13c.4 3.300 4.500 5 4.500 9a5 5 0 0 1-10 0c0-2 1.100-3.200 2-4.400.5 1.200 1.100 1.800 1.800 2.100.9-1.700 1.500-3.900 1.700-6.700z"
          fill="#ffd75a"
        />
        <path d="M16 20c.3 1.800 2 2.500 2 4a2 2 0 0 1-4 0c0-1 .8-1.700 1.200-2.500z" fill="#fff4c4" />
      </svg>
    );
  }
  if (p.spell === 'strike') {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          d="M4 26C6 12 16 3 29 5 20 8 12 15 8 29z"
          fill="#fff4d6"
          stroke="#2a1c1f"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <path d="M9 26c2-8 7-14 15-18-6 5-10 11-12 20z" fill="#f1dbab" />
        <path d="M23 20l5 5M26 17l4 4" stroke="#fff4d6" stroke-width="1.800" stroke-linecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="10" fill="#8c82b8" stroke="#2a1c1f" stroke-width="2" />
    </svg>
  );
}

/** The game's emblem: a woven rune on an indigo medallion. */
export function Emblem() {
  return (
    <svg class="rl-emblem" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#2a1c1f" />
      <circle cx="50" cy="50" r="42" fill="#f2c35b" />
      <circle cx="50" cy="50" r="37" fill="#2b2557" />
      <circle
        cx="50"
        cy="50"
        r="37"
        fill="none"
        stroke="#a8782a"
        stroke-width="1.500"
        stroke-dasharray="2 4"
      />
      <g fill="none" stroke="#2a1c1f" stroke-width="9" stroke-linecap="round">
        <path d="M30 22C60 36 40 64 70 78" />
        <path d="M70 22C40 36 60 64 30 78" />
        <path d="M50 18V82" />
      </g>
      <g fill="none" stroke-width="5" stroke-linecap="round">
        <path d="M30 22C60 36 40 64 70 78" stroke="#c4623a" />
        <path d="M70 22C40 36 60 64 30 78" stroke="#8fb0ff" />
        <path d="M50 18V82" stroke="#ffe9a8" />
      </g>
      <path
        d="M50 38 62 50 50 62 38 50z"
        fill="#ffe9a8"
        stroke="#2a1c1f"
        stroke-width="3"
        stroke-linejoin="round"
      />
    </svg>
  );
}
