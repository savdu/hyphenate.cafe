// Each figure has two animation frames: face and body.
// Face/body are the only parts that change between ticks — everything else is static background.
export const figures = {
  1: {
    id: 1,
    label: 'hula girl',
    frames: [
      { face: '(✿◠ᵕ◠)', body: '\\|/' },
      { face: '(◠ᵕ◠✿)', body: '\\|/' },
    ],
  },
  2: {
    id: 2,
    label: 'couple',
    frames: [
      { face: '(•◡•) ≧◡≦', body: '|\\ . /|' },
      { face: '≧◡≦ (•◡•)', body: '|\\ . /|' },
    ],
  },
  3: {
    id: 3,
    label: 'anxious one',
    frames: [
      { face: '◕_◕', body: '~~~' },
      { face: '◕_◕', body: '(c)' },
    ],
  },
  4: {
    id: 4,
    label: 'waving',
    frames: [
      { face: ' (._.)', body: '/|\\   ' },
      { face: '\\(^-^)', body: ' |\\   ' },
    ],
  },
  5: {
    id: 5,
    label: 'grind mode',
    frames: [
      { face: 'ᕙ(`▽´)ᕗ', body: '(  )' },
      { face: 'ᕙ(`ᵕ´)ᕗ', body: '(  )' },
    ],
  },
  6: {
    id: 6,
    label: 'zoned out',
    frames: [
      { face: '(º﹃º)', body: '/|\\' },
      { face: '(º﹃º)', body: '/|\\' },
    ],
  },
  7: {
    id: 7,
    label: 'just chilling',
    frames: [
      { face: ' (ˊᵕˋ)⊹', body: '/ \\' },
      { face: '⊹(ˊᵕˋ)', body: '/ \\' },
    ],
  },
};
