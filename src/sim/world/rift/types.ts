/** A rift run as the world keeps it (M6): enough to rebuild every room text (rift/generate.ts). */
import type { RiftModId } from '../../../../data/rift';

export interface RiftSpec {
  /** Counts rifts opened in this save; room ids carry it, so two rifts never share flags. */
  index: number;
  seed: number;
  /** 1–16. */
  tier: number;
  mods: RiftModId[];
  /** Where the rift was opened, and where it leads back to: a Loom Stone. */
  home: { roomId: string; key: string };
}
