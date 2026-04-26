export class Story {
  constructor(data) {
    this.figureId = data.figureId;
    this.title = data.title;
    this.scenes = data.scenes;
    this.index = 0;
  }

  get current() { return this.scenes[this.index]; }
  get hasNext()  { return this.index < this.scenes.length - 1; }
  get hasPrev()  { return this.index > 0; }

  next() { if (this.hasNext) this.index++; }
  prev() { if (this.hasPrev) this.index--; }
  reset() { this.index = 0; }
}
