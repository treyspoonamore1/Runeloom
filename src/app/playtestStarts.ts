/**
 * Playtest starts (dev builds): saves from the headless bots that jump into the M7 endgame and,
 * from M8, to the Fen's door. The
 * title screen loads one exactly as Import does (flow.importText). Regenerate the files with
 * `npm run sim -- --playtest-saves` (tools/lib/playtestSaves.ts).
 */
import afterWarden from '../../data/playtest/after_warden.json?raw';
import midClimb from '../../data/playtest/mid_climb.json?raw';
import fenStart from '../../data/playtest/fen_start.json?raw';

export interface PlaytestStart {
  id: 'after_warden' | 'mid_climb' | 'fen_start';
  label: string;
  /** Where you start and what to try. */
  blurb: string;
  /** The save's JSON text. */
  text: string;
}

export const playtestStarts: readonly PlaytestStart[] = [
  {
    id: 'after_warden',
    label: 'After the Cinder Warden',
    blurb: 'Travel to the Hearth from the map (M)',
    text: afterWarden,
  },
  {
    id: 'mid_climb',
    label: 'Mid-climb (tier 7, Hearth built)',
    blurb: 'Clear tier 8 to unlock Rekindle',
    text: midClimb,
  },
  {
    id: 'fen_start',
    label: 'Glasswater Fen (tier 8, storm door open)',
    blurb: "Walk north through the storm door in Warden's Hearth",
    text: fenStart,
  },
];
