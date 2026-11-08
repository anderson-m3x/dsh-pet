#!/usr/bin/env node
// Встраивает Marmelad (OFL, кириллица + латиница) в шрифтовой стек плагина.
//
// Зачем: встроенный «мармеладный» шрифт (上首软糖体 / ShangshouSoftCandy) — CJK-only,
// кириллицу он не содержит, и русский текст в пузыре/подсказках падал в системный шрифт.
// Marmelad ставится ПЕРВЫМ в стеке: латиница и кириллица берутся из него, а иероглифы
// (если включён zh-язык) браузер добирает из ShangshouSoftCandy, который остаётся следом.
//
// Идемпотентен: повторный запуск ничего не меняет. Запуск: node tools/embed-font.mjs
// Сам файл шрифта и лицензии лежат в assets/fonts/ и раздаются хостом по /dsh-pet-7340/font/.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "lib/index.js",
  "lib/app.js",
  "lib/standalone.js",
  "lib/client.js",
  "lib/chat-panel.js",
  "runtime/electron-helper/shared-core.js",
  "runtime/electron-helper/renderer.js",
];

// Экранированные и обычные варианты одного и того же стека.
const STACK_RULES = [
  ['ShangshouSoftCandy\\",\\"Yuanti SC', 'Marmelad\\",\\"ShangshouSoftCandy\\",\\"Yuanti SC'],
  ["ShangshouSoftCandy','Yuanti SC", "Marmelad','ShangshouSoftCandy','Yuanti SC"],
  ['"ShangshouSoftCandy","Yuanti SC"', '"Marmelad","ShangshouSoftCandy","Yuanti SC"'],
];

const CANDY_RULE = '@font-face{font-family:"ShangshouSoftCandy";src:url("${ROUTE_PATH}/font/上首软糖体.ttf") format("truetype");font-display:swap;font-weight:400}';
const MARMELAD_RULE = '@font-face{font-family:"Marmelad";src:url("${ROUTE_PATH}/font/Marmelad-Regular.ttf") format("truetype");font-display:swap;font-weight:400}';

const CANDY_RENDERER = '\'@font-face{font-family:"ShangshouSoftCandy";src:url("\' +';
const MARMELAD_RENDERER =
  '\'@font-face{font-family:"Marmelad";src:url("\' + BASE + \'/font/Marmelad-Regular.ttf") format("truetype");font-display:swap;font-weight:400}\' + \'@font-face{font-family:"ShangshouSoftCandy";src:url("\' +';

let changed = 0;
for (const rel of FILES) {
  const path = join(ROOT, rel);
  let src = readFileSync(path, "utf8");
  const before = src;
  let notes = [];

  // 1) Стек: Marmelad перед мармеладным — только если его там ещё нет.
  if (src.includes("ShangshouSoftCandy") && !src.includes("Marmelad")) {
    for (const [from, to] of STACK_RULES) {
      if (!src.includes(from)) continue;
      src = src.split(from).join(to);
      notes.push("стек");
    }
  }

  // 2) @font-face: добавить Marmelad перед правилом мармеладного шрифта.
  if (!src.includes('font-family:"Marmelad"')) {
    if (src.includes(CANDY_RULE)) {
      src = src.split(CANDY_RULE).join(MARMELAD_RULE + CANDY_RULE);
      notes.push("font-face (web)");
    } else if (src.includes(CANDY_RENDERER)) {
      src = src.split(CANDY_RENDERER).join(MARMELAD_RENDERER);
      notes.push("font-face (desktop)");
    }
  }

  if (src !== before) {
    writeFileSync(path, src);
    changed++;
    console.log(rel, "→", [...new Set(notes)].join(", "));
  }
}
console.log(changed ? "Готово." : "Уже встроено, изменений нет.");
