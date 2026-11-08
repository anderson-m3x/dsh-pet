/**
 * Добавляет в dsh-pet провайдера баланса для Polza.ai (id `polza`).
 *
 * Зачем: плагин умеет только 4 провайдера (deepseek-official, deepseek-account,
 * commandcode, opencode-go), а чат работает через `polza` — поэтому запрос баланса
 * всегда отвечал reason=unsupported. Здесь добавляется встроенный провайдер
 * (credential ref POLZA_API_KEY, GET https://polza.ai/api/v2/balance) и символ ₽
 * в отрисовку money-формы.
 *
 * node tools/patch-polza-balance.mjs [--root <путь>] [--dry]
 * Идемпотентен: повторный запуск ничего не дублирует.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const rootArg = args.indexOf('--root')
const ROOT = rootArg >= 0 ? args[rootArg + 1] : join(HERE, '..')

const REGION_MARK = '//#region src/host/balance/registry.ts'

const PROVIDER = `//#region src/host/balance/providers/polza.ts
/**
 * Polza.ai: баланс организации в рублях.
 *
 * GET /api/v2/balance отдаёт amount (баланс кошелька), available (доступно к трате),
 * reservedAmount и spentAmount. Показываем баланс кошелька, а базой для процента
 * израсходованного берём «баланс + потрачено за всё время».
 */
const polza = {
\tid: "polza",
\tcredential: {
\t\tmode: "ref",
\t\tref: "POLZA_API_KEY"
\t},
\tasync fetch({ key, provider }) {
\t\tconst res = await fetchWithRetry("https://polza.ai/api/v2/balance", key);
\t\tif (!res.ok) throw new Error("dsh-pet: polza balance HTTP " + res.status);
\t\tconst body = await res.json();
\t\tconst amount = str$1(body?.amount, "amount");
\t\tconst spent = str$1(body?.spentAmount, "spentAmount");
\t\tconst total = num(amount, "amount");
\t\tconst used = num(spent, "spentAmount");
\t\tconst full = total + used > 0 ? (total + used).toFixed(2) : void 0;
\t\treturn {
\t\t\tok: true,
\t\t\tprovider,
\t\t\tshape: "money",
\t\t\tdata: { wallets: [{
\t\t\t\tcurrency: "RUB",
\t\t\t\ttotal: total.toFixed(2),
\t\t\t\tgranted: "0",
\t\t\t\ttoppedUp: total.toFixed(2),
\t\t\t\t...full === void 0 ? {} : { fullBalance: full }
\t\t\t}] }
\t\t};
\t}
};

//#endregion
`

const stats = { inserted: 0, array: 0, currency: 0 }

function backup(file) {
  const rel = file.slice(ROOT.length + 1).replace(/[\\/]/g, '__')
  const bak = join(HERE, 'backup', rel + '.pre-polza.bak')
  mkdirSync(join(HERE, 'backup'), { recursive: true })
  if (!existsSync(bak)) copyFileSync(file, bak)
}

function patchHost() {
  const file = join(ROOT, 'lib', 'index.js')
  let text = readFileSync(file, 'utf8')
  let changed = false

  if (!text.includes('src/host/balance/providers/polza.ts')) {
    if (!text.includes(REGION_MARK)) throw new Error('не найден маркер реестра баланса — патч не применён')
    // Провайдер встаёт непосредственно перед регионом реестра: хелперы уже объявлены выше.
    text = text.replace(REGION_MARK, PROVIDER + REGION_MARK)
    stats.inserted++
    changed = true
  }

  if (!/const BUILTIN_PROVIDERS = \[[^\]]*\bpolza\b/.test(text)) {
    const next = text.replace(/(const BUILTIN_PROVIDERS = \[[\s\S]*?)(\n\];)/, (m, head, tail) => `${head},\n\tpolza${tail}`)
    if (next === text) throw new Error('не удалось добавить polza в BUILTIN_PROVIDERS')
    text = next
    stats.array++
    changed = true
  }

  if (changed && !dry) {
    backup(file)
    writeFileSync(file, text, 'utf8')
  }
  console.log(`lib/index.js: провайдер ${stats.inserted ? 'добавлен' : 'уже есть'}, в списке ${stats.array ? 'добавлен' : 'уже есть'}`)
}

function patchCurrency(rel) {
  const file = join(ROOT, rel)
  const text = readFileSync(file, 'utf8')
  if (text.includes('w.currency === "RUB" ? "₽"')) {
    console.log(`${rel}: символ ₽ уже есть`)
    return
  }
  const next = text.replace('(w.currency === "USD" ? "$" : "¥")', '(w.currency === "USD" ? "$" : w.currency === "RUB" ? "₽" : "¥")')
  if (next === text) {
    console.log(`${rel}: шаблон отрисовки не найден (пропущено)`)
    return
  }
  if (!dry) {
    backup(file)
    writeFileSync(file, next, 'utf8')
  }
  stats.currency++
  console.log(`${rel}: добавлен символ ₽`)
}

patchHost()
patchCurrency('lib/client.js')
patchCurrency('runtime/electron-helper/shared-core.js')
console.log(dry ? '[dry] изменения не записаны' : 'готово')
