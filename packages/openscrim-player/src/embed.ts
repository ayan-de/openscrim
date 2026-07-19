import { createPlayer } from './player.js';
import type { PlayerOptions } from './player.js';

export { createPlayer };
export type { Player, PlayerOptions } from './player.js';

/**
 * Script-tag auto-init: any element with `data-openscrim-src` becomes a
 * player. Optional attributes: data-autoplay, data-speed, data-theme,
 * data-height.
 *
 *   <div data-openscrim-src="/recordings/intro.tantrica" data-height="400px"></div>
 *   <script src="https://cdn.jsdelivr.net/npm/@thisisayande/openscrim-player/dist/embed.global.js"></script>
 */
function initAll(): void {
  const elements = document.querySelectorAll<HTMLElement>(
    '[data-openscrim-src]:not([data-openscrim-initialized])'
  );
  elements.forEach((element) => {
    element.setAttribute('data-openscrim-initialized', 'true');
    const options: PlayerOptions = {
      src: element.dataset.openscrimSrc,
      autoplay: element.dataset.autoplay !== undefined,
      theme: element.dataset.theme === 'light' ? 'light' : 'dark',
    };
    if (element.dataset.speed) options.speed = Number(element.dataset.speed);
    if (element.dataset.height) options.height = element.dataset.height;
    createPlayer(element, options).catch((error) => {
      console.error('[openscrim] failed to initialize player:', error);
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
}
