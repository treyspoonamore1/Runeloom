/** The HUD's view: play overlays (bar, waves, banners, adventure additions, death) and every screen. */
import type { Session } from '../app/session';
import type { AdventureFlow } from '../app/adventure';
import { AdventureDeath, AdventureHudView, type AdventureHud } from './adventure/adventureHud';
import { Bar, WavePanel, type Sigs } from './hudBar';
import { LoomPanel, type LoomController } from './loom/loom';
import type { MenuId } from './menus/frame';
import { isMenu, MenuScreens } from './menus/menuHost';
import { PauseMenu, type PauseActions } from './pauseMenu';
import { StartScreen } from './startScreen';
import { TitleScreen } from './title/titleScreen';
import { ItemGetPanel } from './itemGet/itemGetPanel';
import type { ItemGetView } from './itemGet/itemGetModel';

export interface HudAppProps {
  s: Sigs;
  session: Session;
  play(): void;
  pause: PauseActions;
  loom: LoomController;
  closeLoom(): void;
  /** The new-element panel's view and its close (true: on into the Loom). */
  itemGet: { view: { value: ItemGetView | null }; close(toLoom: boolean): void };
  adv: AdventureHud;
  flow: AdventureFlow | null;
  menu(id: MenuId | null): void;
  started(): void;
  scenes: ReadonlyArray<{ id: string; label: string }> | null;
  onScene(id: string): void;
  tick(): void;
}

export function HudApp(p: HudAppProps) {
  const { s } = p;
  const screen = s.screen.value;
  const v = s.snap.value;
  const banner = s.banner.value;
  const adventure = p.session.state.mode === 'adventure';
  const playing = screen !== 'start' && screen !== 'title';
  return (
    <>
      {playing ? (
        <>
          {s.hurt.value > 0 && !v.dead ? <div class="rl-hurt" key={`hurt-${s.hurt.value}`} /> : null}
          {v.lifeFrac < 0.3 && !v.dead ? <div class="rl-lowlife" /> : null}
          <Bar s={s} />
          <WavePanel s={s} />
          {adventure ? <AdventureHudView snap={p.adv.snap} /> : null}
          {banner ? (
            <div class="rl-banner" key={`banner-${banner.id}`}>
              <h2>{banner.title}</h2>
              {banner.sub ? <p>{banner.sub}</p> : null}
            </div>
          ) : null}
          {v.dead && adventure ? <AdventureDeath session={p.session} seconds={v.respawnSec} /> : null}
          {v.dead && !adventure ? (
            <div class="rl-dead">
              <div>
                <h2>You fell.</h2>
                <p>Rewoven in {v.respawnSec}…</p>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {screen === 'start' ? <StartScreen onPlay={p.play} /> : null}
      {screen === 'title' && p.flow ? (
        <TitleScreen
          flow={p.flow}
          onStarted={p.started}
          scenes={p.scenes}
          onScene={p.onScene}
          tick={p.tick}
        />
      ) : null}
      {screen === 'pause' ? <PauseMenu {...p.pause} /> : null}
      {screen === 'loom' ? <LoomPanel loom={p.loom} onClose={p.closeLoom} /> : null}
      {screen === 'itemGet' && p.itemGet.view.value ? (
        <ItemGetPanel
          view={p.itemGet.view.value}
          onLoom={() => p.itemGet.close(true)}
          onContinue={() => p.itemGet.close(false)}
        />
      ) : null}
      {isMenu(screen) ? (
        <MenuScreens
          screen={screen}
          session={p.session}
          onTab={(id) => p.menu(id)}
          onClose={() => p.menu(null)}
        />
      ) : null}
    </>
  );
}
