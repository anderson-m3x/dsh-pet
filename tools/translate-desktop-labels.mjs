/**
 * Перевод подписей настольного оверлея dsh-pet (Electron helper).
 * Здесь строки в одинарных кавычках: меню питомца на рабочем столе, трей, ошибки окна.
 *
 * node translate-desktop-labels.mjs [--root <путь>] [--dry]
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const rootArg = args.indexOf('--root')
const ROOT = rootArg >= 0 ? args[rootArg + 1] : (process.env.DSH_PET_ROOT ?? 'C:\\Users\\New\\.dsh\\profiles\\desktop\\node_modules\\dsh-pet')

const rules = {
  'runtime/electron-helper/sprite/menu.js': [
    ["desktop: '打开软件', standalone: '打开 AI 设置', web: '打开网站'",
      "desktop: 'Открыть приложение', standalone: 'Открыть настройки ИИ', web: 'Открыть сайт'"],
    ["label: '查看余额'", "label: 'Показать баланс'"],
    ["label: '待办事项'", "label: 'Задачи'"],
    ["label: '碎碎念'", "label: 'Бормотание'"],
    ["label: '对话'", "label: 'Чат'"],
    ["label: '起来'", "label: 'Встать'"],
    ["label: '睡觉'", "label: 'Спать'"],
    ["label: '重载配置'", "label: 'Перезагрузить конфиг'"],
    ["label: '回到初始位置'", "label: 'Вернуться на место'"],
    ['当前环境不支持截屏', 'Снимок экрана здесь недоступен'],
    ['没有取到屏幕画面', 'Не удалось получить изображение экрана'],
    ['截屏失败：', 'Ошибка снимка экрана: '],
    ["'[dsh-pet] 菜单查看余额：刷新动作未成功'", "'[dsh-pet] меню баланса: действие обновления не удалось'"],
    ["'[dsh-pet] 菜单查看余额异常'", "'[dsh-pet] сбой меню баланса'"],
    ["'[dsh-pet] 菜单碎碎念：生成动作未成功 pet='", "'[dsh-pet] меню бормотания: действие не удалось pet='"],
    ["'[dsh-pet] 菜单碎碎念异常'", "'[dsh-pet] сбой меню бормотания'"],
    ["'[dsh-pet] 对话已发送 pet='", "'[dsh-pet] сообщение отправлено pet='"],
    ['重载配置请求失败（宿主不可达？）', 'не удалось перезагрузить конфиг (хост недоступен?)'],
    ['显示位置请求失败（宿主不可达？）', 'не удалось сменить показ (хост недоступен?)'],
  ],
  'runtime/electron-helper/main/tray.js': [
    ["label: '退出'", "label: 'Выход'"],
    ["'dsh-pet 桌面宠物'", "'dsh-pet — настольный питомец'"],
  ],
  'runtime/electron-helper/renderer.js': [
    ["'dsh-pet 配置错误：'", "'dsh-pet: ошибка конфигурации: '"],
    ["' 超出桌面宠物列表（共 '", "' вне списка настольных питомцев (всего '"],
    ["' 只），本窗口不创建宠物'", "'), это окно не создаёт питомца'"],
    ["'配置加载失败：'", "'Не удалось загрузить конфигурацию: '"],
  ],
  'runtime/electron-helper/sprite.js': [
    ["'Cmd+左键'", "'Cmd+ЛКМ'"],
    ["'Ctrl+左键'", "'Ctrl+ЛКМ'"],
    ["'[dsh-pet] 实况上报未送达 pet='", "'[dsh-pet] отчёт о позе не доставлен pet='"],
    ["'[dsh-pet] 播放回执未送达 pet='", "'[dsh-pet] квитанция воспроизведения не доставлена pet='"],
  ],
  'runtime/electron-helper/index.html': [
    ['<title>dsh-pet 桌宠（桌面模式）</title>', '<title>dsh-pet — настольный питомец</title>'],
  ],
  'README.md': [
    ['一只住在 DeepSeek Harness 里的桌面宠物，一百余个透明动画，可多开、能上桌面。',
      'Настольный питомец, живущий внутри DeepSeek Harness: больше сотни прозрачных анимаций, несколько питомцев сразу и режим рабочего стола.'],
    ['安装与完整文档：', 'Установка и полная документация: '],
    ['许可：代码 MIT；素材禁止商用；二创在公开渠道须署名（同上链接）。',
      'Лицензия: код — MIT; ассеты нельзя использовать в коммерческих целях; при публикации переделок указывайте автора (ссылка выше).'],
  ],
}

let total = 0
for (const [rel, list] of Object.entries(rules)) {
  const file = join(ROOT, rel)
  if (!existsSync(file)) {
    console.log('нет файла: ' + rel)
    continue
  }
  let text = readFileSync(file, 'utf8')
  let changed = 0
  for (const [from, to] of list) {
    const n = text.split(from).length - 1
    if (n > 0) {
      text = text.split(from).join(to)
      changed += n
    }
  }
  console.log(`${rel}: заменено ${changed}`)
  total += changed
  if (dry || changed === 0) continue
  const bak = join(HERE, 'backup', rel.replace(/[\\/]/g, '__') + '.zh.bak')
  mkdirSync(join(HERE, 'backup'), { recursive: true })
  if (!existsSync(bak)) copyFileSync(file, bak)
  writeFileSync(file, text, 'utf8')
}
console.log(dry ? '[dry] всего ' + total : 'всего замен: ' + total)
