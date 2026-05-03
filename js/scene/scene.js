import { composeScene } from './background.js';
import { figures } from './figures.js';

export class Scene {
  constructor(elementId) {
    this.el = document.getElementById(elementId);
    this.tick = 0;
    this._timer = null;
    this._clickHandler = null;
  }

  onFigureClick(handler) {
    this._clickHandler = handler;
  }

  start() {
    this._render();
    this._setupClicks();
    this._timer = setInterval(() => {
      this.tick++;
      this._render();
    }, 1000);
  }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
  }

  _render() {
    this.el.innerHTML = composeScene(figures, this.tick);
  }

  // Event delegation: one listener on the parent, not re-added every tick.
  _setupClicks() {
    this.el.addEventListener('click', e => {
      const span = e.target.closest('.figure');
      if (span && this._clickHandler) {
        this._clickHandler(parseInt(span.dataset.figure));
      }
    });
  }
}
