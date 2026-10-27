/**
 * Presentation numbers for the menus and the adventure HUD (M4). They never touch the sim, so they
 * live here rather than in tuning.ts (which is cloned into every GameState and stored in replays).
 */
export const uiTuning = {
  /** Seconds a pickup toast stays on screen. */
  toastSeconds: 3.2,
  /** Seconds a level-up toast stays on screen (it carries the "passive point" hint). */
  levelToastSeconds: 5,
  /** Most pickup toasts shown at once; older ones leave first. */
  maxToasts: 5,
  /** Same-kind pickups within this many seconds merge into one toast ("+3 Thread Scrap"). */
  toastMergeSeconds: 1.2,
  /** Show the HUD's small "F  Station" prompt at a hub station. Off: the hub draws its own world-space prompt (render/hub). */
  stationPrompt: false,
  /** Salvage Loom toasts ("+3 Thread Scrap") merge over this longer window: it fires on every pickup. */
  salvageMergeSeconds: 2.5,
  /**
   * The item-get panel for a new element rune: sim seconds to wait after a boss drops it (the
   * Cinder Warden's Storm), so his death plays first. A shrine's rune shows at once.
   */
  elementAfterBossSeconds: 2,
  /** Passive tree zoom limits and the step per wheel notch or +/- key. */
  treeZoomMin: 0.35,
  treeZoomMax: 2.6,
  treeZoomStep: 1.15,
  /** Pixels the tree pans per arrow-key press (Shift or WASD). */
  treePanStep: 60,
  /** Region map: padding around the layout, in screen pixels. */
  mapPadding: 28,
  /**
   * Region map: one room's cell in map units (the world's region map is an integer grid), and the
   * room size in tiles that fills a cell (smaller rooms draw smaller, down to half a cell).
   */
  mapCell: { w: 3, h: 2, tilesPerW: 48, tilesPerH: 24 },
} as const;

/**
 * The inventory (M7.5 menu pass). Presentation only, like the rest of this file.
 *
 * Upgrade markers: an unequipped item gets a green up arrow when swapping it into its slot raises
 * `score` by at least `minGain`. `score` adds up the rows of the character sheet (the numbers
 * src/ui/inventory/stats.ts statRows shows, from HeroMods) times these weights, so a stat counts
 * only as far as the sheet shows it: resistances stop at the cap. Weights are points per sheet
 * unit: `perUnit` rows use the row's own number (1 life, 1 Capacity, 1 mana per second), `perPoint`
 * rows use a fraction of 1 as whole percentage points (0.12 is 12). A row with no weight is worth 0.
 * Rough scale: 10 life = 1 point, 1% damage or resistance = 0.25 to 0.3, +1 Capacity = 6, a Dodge
 * charge = 4. Rows the sheet doesn't show can't count. For charms the swap goes into the empty
 * charm slot, else the weaker one (the better score once swapped in).
 */
export const inventoryUi = {
  /** localStorage key for the bag's sort, filters and "upgrades only" toggle. */
  prefsKey: 'runeloom.inventory.v1',
  upgrade: {
    /** Smallest score gain that shows the green arrow (and the smallest loss for the red one). */
    minGain: 0.5,
    /** Weights by sheet row key; points per sheet unit. */
    perUnit: {
      life: 0.1,
      mana: 0.05,
      regen: 0.5,
      strikeFlat: 0.4,
      capacity: 6,
      dodges: 4,
    } as Record<string, number>,
    /** Weights by sheet row key; points per percentage point (the row value × 100). */
    perPoint: {
      fireInc: 0.25,
      frostInc: 0.25,
      stormInc: 0.25,
      physInc: 0.25,
      branchInc: 0.15,
      crit: 0.6,
      castSpeed: 0.4,
      manaCost: 0.3,
      fireRes: 0.3,
      frostRes: 0.3,
      stormRes: 0.3,
      move: 0.3,
      dodgeRecharge: 0.1,
      projLess: 0.4,
      ailDur: 0.1,
      igniteEff: 0.1,
      chillGain: 0.1,
      freezeDur: 0.1,
      terrainDur: 0.08,
      spread: 0.08,
    } as Record<string, number>,
  },
  /** Bulk salvage's "all Normal" etc.: the rarities each preset takes (unique items never). */
  bulkSalvage: {
    normal: ['normal'],
    normalMagic: ['normal', 'magic'],
  } as Record<string, readonly string[]>,
  /** Rarities that ask for confirmation on shift-click salvage. */
  confirmSalvageRarities: ['rare', 'unique'] as readonly string[],
} as const;

/**
 * Intro cards (DESIGN §3: "boss intro cards"; CONTENT §9.1, §13), shown in the center banner:
 * - a region boss's when it wakes ('bossAwake'), its name and a line about it;
 * - a region's when the player first enters its first room ('roomEnter' with firstVisit), in
 *   place of that room's banner.
 * Rift versions of the bosses show only their bars (the rift has its own banners).
 */
export const introCards: {
  bosses: Readonly<Record<string, { title: string; sub: string }>>;
  regions: Readonly<Record<string, { title: string; sub: string }>>;
} = {
  bosses: {
    tar_matriarch: { title: 'The Tar Matriarch', sub: "Mother of the Kiln's tar crews" },
    cinder_warden: { title: 'The Cinder Warden', sub: "Keeper of the Sunken Kiln's fire" },
    bellwether: { title: 'The Old Bellwether', sub: "The Foundry's old shift bell, grown into a beast" },
    glasswater_coil: { title: 'The Glasswater Coil', sub: 'Lightning asleep in the Glass Eye' },
  },
  regions: {
    'fen/g1_storm_landing': { title: 'Glasswater Fen', sub: 'Area level 18 to 24' },
  },
};

/**
 * The Fen bosses' state line under the boss bar and the pop label over the boss (playtest 8:
 * "I could still hit it [under water]", "I couldn't figure out what to do with the bells"):
 * each state's name, what it does ({pct} is filled from the live damage multiplier), and the pop
 * shown when the boss enters it (null: no pop). src/app/bossStatus.ts picks the state.
 */
export const bossStateCopy: Readonly<Record<string, { name: string; does: string; pop: string | null }>> = {
  // The Glasswater Coil (DESIGN §10.5).
  submerged: { name: 'Submerged', does: '{pct}% less damage', pop: null },
  surfaced: { name: 'Surfaced', does: 'full damage', pop: null },
  exposed: { name: 'Exposed', does: "full damage, can't dive", pop: null },
  stranded: { name: 'Stranded', does: '{pct}% more damage', pop: 'STRANDED' },
  iced: { name: 'Iced', does: "can't move or attack", pop: 'ICED' },
  overloaded: { name: 'Overloaded', does: 'stunned', pop: 'OVERLOADED' },
  // The Old Bellwether (CONTENT §5).
  shelled: { name: 'Shelled', does: '{pct}% less damage', pop: null },
  // No pop: the shared ring effect already shows "RUNG!" over anything rung (pt8hits).
  rung: { name: 'Rung open', does: '{pct}% more damage', pop: null },
  rolling: { name: 'Rolling', does: "can't be rung", pop: null },
};
