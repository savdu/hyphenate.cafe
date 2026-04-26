import { Story } from './story.js';

export class StoryRenderer {
  constructor(storyElementId, sceneElementId) {
    this.storyEl  = document.getElementById(storyElementId);
    this.sceneEl  = document.getElementById(sceneElementId);
    this.artEl    = document.getElementById('story-art');
    this.textEl   = document.getElementById('story-text');
    this.backBtn  = document.getElementById('story-back');
    this.nextBtn  = document.getElementById('story-next');
    this.returnBtn = document.getElementById('story-return');
    this._returnHandler = null;
    this._story = null;
    this._bindNav();
  }

  onReturn(handler) {
    this._returnHandler = handler;
  }

  show(storyData) {
    this._story = new Story(storyData);
    this._story.reset();
    this.sceneEl.style.visibility = 'hidden';
    this.storyEl.hidden = false;
    this._render();
  }

  hide() {
    this.storyEl.hidden = true;
    this.sceneEl.style.visibility = 'visible';
  }

  _render() {
    const scene = this._story.current;
    this.artEl.textContent  = scene.art;
    this.textEl.textContent = scene.text;
    this.backBtn.disabled   = !this._story.hasPrev;
    this.nextBtn.disabled   = !this._story.hasNext;
  }

  _bindNav() {
    this.backBtn.addEventListener('click', () => {
      this._story.prev();
      this._render();
    });
    this.nextBtn.addEventListener('click', () => {
      this._story.next();
      this._render();
    });
    this.returnBtn.addEventListener('click', () => {
      if (this._returnHandler) this._returnHandler();
    });
  }
}
