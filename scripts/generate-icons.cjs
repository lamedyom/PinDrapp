/**
 * Generate the PWA icons (192 + 512) from the canonical pindrapp-logo.png.
 *
 * Why a script and not a CLI resize tool? sharp / ImageMagick aren't in the
 * sandbox, but Playwright + headless Chromium are. We open a page with the
 * logo image filling the viewport, screenshot at exact dimensions, save.
 *
 * Re-run after replacing public/pindrapp-logo.png:
 *   node scripts/generate-icons.cjs
 */
const path = require('path');
const fs = require('fs');

async function main() {
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });

  const sourceUrl = `file://${path.resolve(__dirname, '..', 'public', 'pindrapp-logo.png')}`;
  const outDir = path.resolve(__dirname, '..', 'public');

  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  for (const { size, name } of sizes) {
    const ctx = await browser.newContext({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.setContent(
      `<!doctype html><html><head><style>
        html,body { margin: 0; padding: 0; background: transparent; }
        body { width: ${size}px; height: ${size}px; }
        img { width: ${size}px; height: ${size}px; display: block; }
       </style></head><body>
       <img src="${sourceUrl}" />
       </body></html>`,
    );
    await page.waitForLoadState('networkidle');
    const out = path.join(outDir, name);
    await page.screenshot({
      path: out,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    console.log(`wrote ${out}`);
    await ctx.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
