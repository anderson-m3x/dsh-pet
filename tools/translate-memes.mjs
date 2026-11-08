/**
 * Перевод надписей на мемах в русский через Polza.ai (Nano Banana 2).
 *
 * Что делает: берёт каждый PNG из assets/memes, отправляет в модель как
 * image-to-image с промптом «переведи все надписи на русский», ждёт результат,
 * скачивает его и ужимает в 384×384 PNG, заменяя исходник. Оригиналы уходят
 * в backup/memes-orig/.
 *
 * Цена: google/gemini-3.1-flash-image-preview — 4,80 ₽ за картинку 1K
 * (на ноябрь 2026; Nano Banana 2.5 дешевле — 2,90 ₽, но длинные надписи не тянет).
 *
 * Ключ: POLZA_API_KEY из ~/.dsh/.credentials.yaml (refs) или из окружения.
 * Запуск: node tools/translate-memes.mjs [--root <путь>] [--dry] [--only "Имя.png"]
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const rootArg = args.indexOf('--root')
const onlyArg = args.indexOf('--only')
const ROOT = rootArg >= 0 ? args[rootArg + 1] : join(HERE, '..')
const ONLY = onlyArg >= 0 ? args[onlyArg + 1] : undefined

const MODEL = 'google/gemini-3.1-flash-image-preview'
const PRICE_RUB = 4.8

function apiKey() {
  if (process.env.POLZA_API_KEY) return process.env.POLZA_API_KEY
  const require = createRequire(join(ROOT, 'package.json'))
  const yaml = require('js-yaml')
  const home = process.env.DSH_HOME ?? join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.dsh')
  const doc = yaml.load(readFileSync(join(home, '.credentials.yaml'), 'utf8'))
  const key = doc?.refs?.POLZA_API_KEY
  if (!key) throw new Error('POLZA_API_KEY не найден')
  return key
}

const PROMPT = [
  'Translate every caption in this anime meme into Russian.',
  'Replace all Chinese text with natural, funny Russian in the same places, with the same sizes, weights, colors and black outline; keep the drawing untouched.',
  'Absolutely no Chinese characters may remain. Do not add any other text, logos or watermarks.',
].join(' ')

const DIR = join(ROOT, 'assets', 'memes')
const BACKUP = join(HERE, 'backup', 'memes-orig')
mkdirSync(BACKUP, { recursive: true })

const key = apiKey()
const H = { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
const names = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.png')).sort()
const list = ONLY ? names.filter((n) => n === ONLY) : names

let spent = 0
for (const name of list) {
  const path = join(DIR, name)
  const backup = join(BACKUP, name)
  if (!existsSync(backup)) copyFileSync(path, backup)
  if (dry) { console.log('[dry]', name); continue }
  try {
    const b64 = readFileSync(backup).toString('base64')
    const r = await fetch('https://polza.ai/api/v1/media', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({
        model: MODEL,
        input: {
          prompt: PROMPT,
          images: [{ type: 'base64', data: 'data:image/png;base64,' + b64 }],
          aspect_ratio: '1:1',
          image_resolution: '1K',
        },
      }),
    })
    let s = await r.json()
    for (let i = 0; i < 20 && ['pending', 'processing'].includes(s.status); i++) {
      await new Promise((res) => setTimeout(res, 2500))
      s = await (await fetch('https://polza.ai/api/v1/media/' + s.id, { headers: H })).json()
    }
    if (s.status !== 'completed' || !s.data?.[0]?.url) {
      console.log('FAIL', name, JSON.stringify(s).slice(0, 200))
      continue
    }
    const buf = Buffer.from(await (await fetch(s.data[0].url)).arrayBuffer())
    const tmp = join(HERE, 'backup', '.tmp-' + name + '.jpg')
    writeFileSync(tmp, buf)
    // Ужимаем в 384×384 PNG штатным PowerShell (System.Drawing) — без внешних зависимостей.
    const { execFileSync } = createRequire(import.meta.url)('node:child_process')
    const ps = `Add-Type -AssemblyName System.Drawing
$g=[System.Drawing.Image]::FromFile('${tmp.replace(/\\/g, '/').replace(/'/g, "''")}')
$bmp=New-Object System.Drawing.Bitmap 384,384
$gr=[System.Drawing.Graphics]::FromImage($bmp)
$gr.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gr.DrawImage($g,0,0,384,384)
$gr.Dispose()
$bmp.Save('${path.replace(/\\/g, '/').replace(/'/g, "''")}',[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose(); $g.Dispose()`
    execFileSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'pipe' })
    spent += s.usage?.cost_rub ?? PRICE_RUB
    console.log('OK', name, s.usage?.cost_rub ?? PRICE_RUB, 'RUB')
  } catch (e) {
    console.log('ERR', name, String(e.message).slice(0, 200))
  }
}
console.log(`готово, потрачено ≈ ${spent.toFixed(2)} ₽`)
