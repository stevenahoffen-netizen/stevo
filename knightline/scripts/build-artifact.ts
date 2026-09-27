// Packs the production build into one self-contained HTML body for hosts that
// wrap pages in their own <html>/<head>/<body> (e.g. a Claude artifact):
// inline CSS + JS (fonts arrive as data URIs), no external files.
//   KL_INLINE=1 npx vite build && npx tsx scripts/build-artifact.ts [out.html]
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const out = resolve(root, process.argv[2] ?? 'dist-artifact/knightline.html')
const html = readFileSync(resolve(dist, 'index.html'), 'utf8')
const assets = readdirSync(resolve(dist, 'assets'))
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(resolve(dist, 'assets', f), 'utf8')).join('\n')
const jsFiles = assets.filter((f) => f.endsWith('.js'))
if (jsFiles.length !== 1) throw new Error(`expected one JS chunk, found ${jsFiles.length}`)
const js = readFileSync(resolve(dist, 'assets', jsFiles[0]), 'utf8')
  // never let the bundle close the inline script tag early
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<!--/g, '<\\!--')

// Anything the page would still fetch from dist/ breaks once it's a single file.
const external = /url\((?!['"]?data:)[^)]*\.(woff2?|ttf|png|svg)/.exec(css)
if (external) throw new Error(`CSS still references a file (${external[0]}); build with KL_INLINE=1`)
const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1]

const page = [
  '<title>Knightline</title>',
  desc ? `<meta name="description" content="${desc}" />` : '',
  `<style>\n${css}\n</style>`,
  '<div id="root"></div>',
  `<script type="module">\n${js}\n</script>`,
  '',
]
  .filter(Boolean)
  .join('\n')

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, page)
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`)
