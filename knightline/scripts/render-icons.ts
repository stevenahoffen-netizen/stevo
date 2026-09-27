// Rasterises public/icon.svg into the PNG sizes iOS and Android expect.
//   npx tsx scripts/render-icons.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const publicDir = resolve(import.meta.dirname, '../public')
const svg = readFileSync(resolve(publicDir, 'icon.svg'), 'utf8')
const browser = await chromium.launch()
for (const size of [180, 192, 512, 1024]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  // iOS masks the corners itself, so the 1024 App Store master is square.
  const art = size === 1024 ? svg.replace('rx="112"', 'rx="0"') : svg
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${art.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
  )
  await page.screenshot({ path: resolve(publicDir, `icon-${size}.png`), omitBackground: size !== 1024 })
  await page.close()
}
await browser.close()
console.log('icons rendered')
