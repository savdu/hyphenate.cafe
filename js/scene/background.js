// Builds the full scene HTML string from current figure states.
// Figures are wrapped in clickable spans; everything else is static per-tick background.
export function composeScene(figures, tick) {
  const t = tick % 2;

  const headers = [
    `        *  .  *  .  *  .  *  .  ✿  .  *  .  *
      .     -  h  y  p  h  e  n  a  t  e      .
        *  .  ✿  .  *  .  *  .  *  .  *  .  *`,
    `        .  *  .  *  .  *  .  ✿  .  *  .  *  .
      *     -  h  y  p  h  e  n  a  t  e      *
        *  *  .  ✿  .  *  .  *  .  *  .  *  .`,
  ];

  const floaters = [
    '                                         ⊹',
    '                                              ⊹',
  ];

  const s = (id, part) => {
    const frame = figures[id].frames[t];
    return `<span class="figure" data-figure="${id}" title="click me">${frame[part]}</span>`;
  };

  return `${headers[t]}

      /\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\/\\

       .---------.  .-----------.  .---------.
       | ${s(1,'face')}  |  | ${s(2,'face')} |  |   ${s(3,'face')}   |
       |   ${s(1,'body')}   |  |  ${s(2,'body')}  |  |   ${s(3,'body')}   |
       |  [___]  |  |  [=] [=]  |  |  [___]  |
       |   | |   |  |   |   |   |  |   | |   |
       \`---------'  \`-----------'  \`---------'
${floaters[t]}
        ${s(4,'face')}      ${s(5,'face')}   ${s(6,'face')}    ${s(7,'face')}
          ${s(4,'body')}      ${s(5,'body')}      ${s(6,'body')}        ${s(7,'body')}
    |==+===+=+=+==+=+==+=+=+=+==+=+=+==+=+=+==+==|
    | --- ---- --- ---- --- ---- --- ---- --- ---|
    |_|_|_|__|_|_|_|__|_|_|_|__|_|_|_|__|_|_|_|__|
    ||||||||||||||||||||||||||||||||||||||||||||||
      ✿     ✿ ♥       ✿  ✿ ✿    ♥   ✿ ✿    ✿ ✿ ✿`;
}
