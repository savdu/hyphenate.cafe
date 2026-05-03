import { Scene } from './scene/scene.js';
import { StoryRenderer } from './story/storyRenderer.js';
import { stories } from './story/stories/index.js';

const scene = new Scene('scene');
const storyRenderer = new StoryRenderer('story', 'scene');

scene.onFigureClick(figureId => {
  const story = stories[figureId];
  if (story) {
    scene.stop();
    storyRenderer.show(story);
  }
});

storyRenderer.onReturn(() => {
  storyRenderer.hide();
  scene.start();
});

scene.start();
