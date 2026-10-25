/** Small marks on bag tiles: the upgrade arrows, the keep padlock and the socket pips. */
import type { Verdict } from './upgrade';

export function Arrow({ verdict }: { verdict: Verdict }) {
  if (verdict === 'same') return null;
  const up = verdict === 'up';
  return (
    <svg
      class={`inv-arrow ${verdict}`}
      viewBox="0 0 16 16"
      role="img"
      aria-label={up ? 'Upgrade' : 'Downgrade'}
    >
      <title>{up ? 'Better than what you wear' : 'Worse than what you wear'}</title>
      <polygon points={up ? '8,2 14,10 10,10 10,14 6,14 6,10 2,10' : '8,14 14,6 10,6 10,2 6,2 6,6 2,6'} />
    </svg>
  );
}

export function Padlock({ locked }: { locked: boolean }) {
  return (
    <svg class="inv-padlock" viewBox="0 0 16 16" aria-hidden="true">
      {locked ? (
        <path d="M5 7V5a3 3 0 0 1 6 0v2h1.2c.5 0 .8.3.8.8v5.4c0 .5-.3.8-.8.8H3.8c-.5 0-.8-.3-.8-.8V7.8c0-.5.3-.8.8-.8H5Zm1.6 0h2.8V5a1.4 1.4 0 0 0-2.8 0v2Z" />
      ) : (
        <path d="M10.4 5.2a1.4 1.4 0 0 0-2.8 0V7h4.6c.5 0 .8.3.8.8v5.4c0 .5-.3.8-.8.8H3.8c-.5 0-.8-.3-.8-.8V7.8c0-.5.3-.8.8-.8H6V5.2a2.9 2.9 0 0 1 5.8 0v.4h-1.4v-.4Z" />
      )}
    </svg>
  );
}

/** One dot per Fuse socket: filled when a part sits in it. */
export function Pips({ sockets }: { sockets: readonly boolean[] }) {
  if (sockets.length === 0) return null;
  return (
    <span class="inv-pips" aria-hidden="true">
      {sockets.map((on, i) => (
        <i key={i} class={on ? 'on' : ''} />
      ))}
    </span>
  );
}
