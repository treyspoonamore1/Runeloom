/**
 * A fixture passive tree standing in for the passive-tree agent's data/passives.ts: a start node,
 * a Weaver ring, Ember / Rime / Tempest arms with a notable and a keystone each, and Warden nodes
 * between the arms. `fixtureTree(20)` is the screenshot tree; larger sizes test performance.
 */
import type { PassiveArea, PassiveNodeView, PassiveTreeView } from '../tree/adapter';

const ARMS: Array<{
  area: PassiveArea;
  angle: number;
  small: string[];
  notables: Array<[string, string]>;
  keystone: [string, string];
}> = [
  {
    area: 'ember',
    angle: -150,
    small: ['+8% Fire damage', '+6% Ignite effect', '+4% terrain effect duration'],
    notables: [
      ['Kindler', 'Fire you create spreads 30% faster. +10% Fire damage'],
      ['Slow Burn', 'Ignite lasts 50% longer'],
      ['Oilcraft', 'Oiled enemies take 25% more Fire damage'],
    ],
    keystone: [
      'Pyre Walker',
      "You're immune to all terrain fire. While standing on burning ground, you deal 20% more damage",
    ],
  },
  {
    area: 'rime',
    angle: -30,
    small: ['+8% Frost damage', '+6% chill effect', '+5% Freeze duration'],
    notables: [
      ['Deep Freeze', 'Freeze lasts 0.4 s longer. +15% chill build-up'],
      ['Brittle', 'Chilled and Frozen enemies take 25% more Strike damage'],
      ['Long Winter', 'Ice and ice bridges you create last 50% longer'],
    ],
    keystone: ['Hydromancer', "You're always Wet. Dodging leaves shallow water along your path for 6 s"],
  },
  {
    area: 'tempest',
    angle: 90,
    small: ['+8% Storm damage', '+6% Shock effect', '+5% conduction range'],
    notables: [
      ['Overcharge', 'Charge you create lasts 0.5 s longer. +10% Storm damage'],
      ['Rainshadow', 'Wet enemies take 15% more Storm damage'],
      ['Conduit', 'Water you electrify conducts 15 cells farther'],
    ],
    keystone: ['Stormglass', 'Ice and ice bridges conduct Storm like water'],
  },
];

const WEAVER_SMALL = ['+3% cast speed', '+4% mana regeneration', '+5% branch damage'];
const WARDEN_SMALL = ['+5 maximum life', '+4% dodge recharge', '+6% Fire resistance'];

const rad = (deg: number) => (deg * Math.PI) / 180;

/** About `size` nodes (at least 20). Deterministic. */
export function fixtureTree(size = 20): PassiveTreeView {
  const nodes: PassiveNodeView[] = [];
  const byId = new Map<string, PassiveNodeView>();
  const connect = (a: string, b: string) => {
    byId.get(a)?.links.push(b);
    byId.get(b)?.links.push(a);
  };
  const push = (n: Omit<PassiveNodeView, 'links'>, link?: string) => {
    const node: PassiveNodeView = { ...n, links: [] };
    nodes.push(node);
    byId.set(node.id, node);
    if (link) connect(link, node.id);
    return node;
  };
  push({
    id: 'start',
    name: 'Loomwright',
    type: 'start',
    area: 'weaver',
    x: 0,
    y: 0,
    text: ['Where your Pattern begins'],
  });
  // Weaver ring: one node toward each arm, plus Spellwright.
  const ringR = 110;
  const ring: string[] = [];
  ARMS.forEach((arm, i) => {
    const id = `weaver_${i}`;
    push(
      {
        id,
        name: 'Weaver',
        type: 'small',
        area: 'weaver',
        x: ringR * Math.cos(rad(arm.angle)),
        y: ringR * Math.sin(rad(arm.angle)),
        text: [WEAVER_SMALL[i]!],
      },
      'start',
    );
    ring.push(id);
  });
  push(
    {
      id: 'spellwright',
      name: 'Spellwright',
      type: 'notable',
      area: 'weaver',
      x: 0,
      y: -ringR * 1.25,
      text: ['+1 Capacity'],
    },
    'start',
  );

  // Arm length grows with the requested size: 4 nodes per arm at 20; each extra spine step on a
  // bigger tree adds about 2 nodes per arm (twigs every other step).
  const extra = Math.max(0, size - 20);
  const spine = 4 + Math.floor(extra / 6);
  const step = size > 20 ? 70 : 85;
  ARMS.forEach((arm, ai) => {
    let prev = ring[ai]!;
    const a = rad(arm.angle);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    for (let k = 1; k <= spine; k++) {
      const r = ringR + step * k;
      const last = k === spine;
      const mid = !last && k % 3 === 2;
      const ni = Math.floor(k / 3) % arm.notables.length;
      const id = `${arm.area}_${k}`;
      const [name, text] = last
        ? arm.keystone
        : mid
          ? arm.notables[ni]!
          : [cap(arm.area), arm.small[k % arm.small.length]!];
      push(
        {
          id,
          name,
          type: last ? 'keystone' : mid ? 'notable' : 'small',
          area: arm.area,
          x: r * ux,
          y: r * uy,
          text: [text],
        },
        prev,
      );
      // Side twigs on bigger trees: two nodes off the spine, either side.
      if (size > 20 && !last && k % 2 === 0) {
        for (const side of [-1, 1]) {
          const tid = `${id}_t${side}`;
          const tx = r * ux - side * uy * 70;
          const ty = r * uy + side * ux * 70;
          push(
            {
              id: tid,
              name: cap(arm.area),
              type: 'small',
              area: arm.area,
              x: tx,
              y: ty,
              text: [arm.small[(k + 1) % arm.small.length]!],
            },
            id,
          );
        }
      }
      prev = id;
    }
  });
  // Warden nodes between neighboring arms, on an outer arc, joining the arms' second nodes.
  ARMS.forEach((arm, ai) => {
    const next = ARMS[(ai + 1) % ARMS.length]!;
    let mid = (arm.angle + next.angle) / 2;
    if (next.angle < arm.angle) mid += 180;
    const r = ringR + 150;
    push(
      {
        id: `warden_${ai}`,
        name: ai === 2 ? 'Second Wind' : 'Warden',
        type: ai === 2 ? 'notable' : 'small',
        area: 'warden',
        x: r * Math.cos(rad(mid)),
        y: r * Math.sin(rad(mid)),
        text: [ai === 2 ? '+1 dodge charge' : WARDEN_SMALL[ai]!],
      },
      `${arm.area}_1`,
    );
    connect(`warden_${ai}`, `${next.area}_1`);
  });
  return { nodes, start: 'start' };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
