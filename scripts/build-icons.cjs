// The vector mark fits Android's 66dp safe circle inside a 108dp canvas.
const sharp = require('sharp');
(async () => {
  for (const name of ['icon_white.png', 'adaptive-icon.png']) {
    await sharp('./assets/icon-source.svg').resize(1024,1024).flatten({background:'#FFFFFF'}).png().toFile(`assets/${name}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
