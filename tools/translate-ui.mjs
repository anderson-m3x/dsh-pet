#!/usr/bin/env node
// Переводит служебные строки (ошибки/логи) в собранных бандлах плагина на русский.
// Идемпотентен: уже переведённые строки не трогает. Запуск: node tools/translate-ui.mjs
// НЕ трогает: имена шрифтов (幼圆, 上首软糖体), словари локализации (src/client/**/locales/*)
// и протокольные маркеры [动作:...]/[图:...] — иначе сломается парсинг ответов модели.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MAP = [
["dsh-pet: commandcode 响应缺少 credits","dsh-pet: ответ commandcode не содержит credits"],
["dsh-pet: commandcode credits 响应缺少额度字段","dsh-pet: ответ commandcode credits не содержит поля лимита"],
["dsh-pet: commandcode usage 响应缺少 totalCost","dsh-pet: ответ commandcode usage не содержит totalCost"],
["dsh-pet: 账号未登录（deepseek-account）","dsh-pet: аккаунт не авторизован (deepseek-account)"],
["dsh-pet: 账号余额查询失败","dsh-pet: не удалось получить баланс аккаунта"],
["dsh-pet: 账号没有充值钱包余额","dsh-pet: у аккаунта нет баланса пополняемого кошелька"],
["dsh-pet: 账号钱包结构非法","dsh-pet: неверная структура кошелька аккаунта"],
["dsh-pet: 缺少账号服务（","dsh-pet: нет сервиса аккаунта ("],
["dsh-pet: deepseek balance 响应缺少 balance_infos","dsh-pet: ответ deepseek balance не содержит balance_infos"],
["dsh-pet: opencode usage 响应缺少 usage","dsh-pet: ответ opencode usage не содержит usage"],
["dsh-pet: opencode usage 响应缺少窗口","dsh-pet: ответ opencode usage не содержит окна"],
["pet/<素材根>-memes/","pet/<корень>-memes/"],
["<素材根>-character.<ext>","<корень>-character.<ext>"],
["dsh-pet: expected /dsh-pet-7340/character?root=<素材根>","dsh-pet: expected /dsh-pet-7340/character?root=<корень>"],
["[dsh-pet] 记忆结构异常（messages 不是数组）pet=${petId}，按空历史处理：${memoryPath}","[dsh-pet] неверная структура памяти (messages не массив) pet=${petId}, обрабатываю как пустую историю: ${memoryPath}"],
["Electron 缓存无效，准备重新下载","Кэш Electron недействителен, готовлю повторную загрузку"],
["正在下载 Electron ${version}","Загружаю Electron ${version}"],
["Electron 下载 ${percent}% · ${doneMb}/${totalMb}MB","Загрузка Electron ${percent}% · ${doneMb}/${totalMb}MB"],
["下载完成（${seconds}s），正在解压","Загрузка завершена (${seconds}s), распаковываю"],
["Electron 就绪（${readySeconds}s），正在启动桌宠","Electron готов (${readySeconds}s), запускаю питомца"],
["Electron 下载失败：${reason}","Загрузка Electron не удалась: ${reason}"],
["换一个 Electron 版本（删掉日志里 electron= 指向的目录，用 DSH_PET_ELECTRON_VERSION 指定可用版本后重启），或用 DSH_PET_ELECTRON_PATH 指向本机能开窗的 electron.exe；${raise}","Смени версию Electron (удали каталог, на который указывает electron= в логе, задай рабочую версию через DSH_PET_ELECTRON_VERSION и перезапусти) или укажи в DSH_PET_ELECTRON_PATH локальный electron.exe, который может открыть окно; ${raise}"],
["确认有可用显示环境（DISPLAY / WAYLAND_DISPLAY，无显示时用 Xvfb 并设 DSH_PET_DESKTOP_FORCE=1）；${raise}","Убедись, что есть рабочее графическое окружение (DISPLAY / WAYLAND_DISPLAY; без дисплея используй Xvfb с DSH_PET_DESKTOP_FORCE=1); ${raise}"],
["用 DSH_PET_ELECTRON_PATH 指向本机能开窗的 Electron；${raise}","Укажи в DSH_PET_ELECTRON_PATH локальный Electron, который может открыть окно; ${raise}"],
[" · electron=<路径> (<版本>)"," · electron=<путь> (<версия>)"],
["dsh-pet desktop helper: Wayland 会话，强制 XWayland（--ozone-platform=x11）","dsh-pet desktop helper: сессия Wayland, принудительный XWayland (--ozone-platform=x11)"],
["dsh-pet desktop helper: 纯 Wayland 无 XWayland，桌面模式的定位/置顶/穿透不可用；请改用 X11 会话","dsh-pet desktop helper: чистый Wayland без XWayland — позиционирование, поверх всех окон и прозрачность в настольном режиме недоступны; переключись на сессию X11"],
["[dsh-pet desktop helper] bridge 协议行非法，已忽略","[dsh-pet desktop helper] неверная строка протокола bridge, пропускаю"],
["dsh-pet desktop helper 未在 ${timeoutMs}ms 内退出，升级 SIGKILL（${reason}）","dsh-pet desktop helper не завершился за ${timeoutMs} мс, повышаю до SIGKILL (${reason})"],
["dsh-pet desktop helper 因 Chromium 沙箱初始化失败而秒退（${describeExit(code, null)}），改用 --no-sandbox 重试一次${this.launchIdentity}","dsh-pet desktop helper мгновенно завершился из-за сбоя инициализации песочницы Chromium (${describeExit(code, null)}), повторяю с --no-sandbox${this.launchIdentity}"],
["dsh-pet desktop helper crashed ${this.restartFailures} consecutive times; circuit breaker tripped, no more restarts${this.launchIdentity} · 建议：${crashLoopAdvice(process.platform)}","dsh-pet desktop helper crashed ${this.restartFailures} consecutive times; circuit breaker tripped, no more restarts${this.launchIdentity} · рекомендация: ${crashLoopAdvice(process.platform)}"],
["没有这个种类：${entry}","Нет такого вида: ${entry}"],
["[dsh-pet] 托盘退出失败：${e instanceof Error ? e.message : String(e)}","[dsh-pet] не удалось выйти из трея: ${e instanceof Error ? e.message : String(e)}"],
["sessionId 超过 ${MAX_SESSION_ID_CHARS} 字符","sessionId длиннее ${MAX_SESSION_ID_CHARS} символов"],
["state 必须是 ${HOST_WORK_STATUS_STATES.join(\" / \")} 之一","state должен быть одним из ${HOST_WORK_STATUS_STATES.join(\" / \")}"],
["text 必须是非空字符串，最多 ${TODO_TEXT_MAX} 个字符","text должен быть непустой строкой не длиннее ${TODO_TEXT_MAX} символов"],
["[dsh-pet] 待办读写失败：${error instanceof Error ? error.message : String(error)}","[dsh-pet] ошибка чтения/записи задач: ${error instanceof Error ? error.message : String(error)}"],
["[dsh-pet] 碎碎念异常：","[dsh-pet] ошибка бормотания: "],
["[dsh-pet] 对话失败 reason=","[dsh-pet] сбой диалога reason="],
["[dsh-pet] 对话异常：","[dsh-pet] ошибка диалога: "],
["[dsh-pet] webServer 端口尚未就绪（port=${String(port)}），每 500ms 重试拉起桌面 Helper","[dsh-pet] порт webServer ещё не готов (port=${String(port)}), каждые 500 мс пробую поднять desktop Helper"],
["[dsh-pet] 已等待 webServer 端口 ${portWaitAttempts * 500 / 1e3}s 仍未就绪（port=${String(port)}），桌面 Helper 尚未拉起","[dsh-pet] жду порт webServer уже ${portWaitAttempts * 500 / 1e3} с, он всё ещё не готов (port=${String(port)}), desktop Helper не запущен"],
["[dsh-pet] 未检测到图形显示环境（DISPLAY/WAYLAND_DISPLAY 均为空），已跳过桌面宠物。浏览器内宠物不受影响；如需在服务器上启用桌面模式，请配置 Xvfb 后设置 DSH_PET_DESKTOP_FORCE=1。","[dsh-pet] не обнаружено графическое окружение (DISPLAY/WAYLAND_DISPLAY пусты), настольный питомец пропущен. Питомец в браузере не затронут; чтобы включить настольный режим на сервере, настрой Xvfb и задай DSH_PET_DESKTOP_FORCE=1."],
["[dsh-pet] 未找到 Electron 可执行文件：DSH_HOME=${dshHomeDir()}，查找路径=${defaultElectronExe()}，DSH_PET_ELECTRON_PATH=${process.env.DSH_PET_ELECTRON_PATH ?? \"(не задан)\"}","[dsh-pet] не найден исполняемый файл Electron: DSH_HOME=${dshHomeDir()}, путь поиска=${defaultElectronExe()}, DSH_PET_ELECTRON_PATH=${process.env.DSH_PET_ELECTRON_PATH ?? \"(не задан)\"}"],
["[dsh-pet] 开始下载 Electron 到 ${defaultElectronExe()} ...","[dsh-pet] начинаю загрузку Electron в ${defaultElectronExe()} ..."],
["[dsh-pet] 重启桌面 Helper 失败：${e instanceof Error ? e.message : String(e)}","[dsh-pet] не удалось перезапустить desktop Helper: ${e instanceof Error ? e.message : String(e)}"],
["dsh-pet: 对话用 ${modelLabel(sel)} 生成失败（${result.message ?? result.reason}），回落到 ${modelLabel(candidates[i + 1])}","dsh-pet: генерация диалога на ${modelLabel(sel)} не удалась (${result.message ?? result.reason}), откатываюсь к ${modelLabel(candidates[i + 1])}"],
["dsh-pet: 碎碎念用 ${modelLabel(sel)} 生成失败（${result.message ?? result.reason}），回落到 ${modelLabel(candidates[i + 1])}","dsh-pet: генерация бормотания на ${modelLabel(sel)} не удалась (${result.message ?? result.reason}), откатываюсь к ${modelLabel(candidates[i + 1])}"],
["[dsh-pet] 清理已删宠物的历史 pets=${pets}，messages=${messages}","[dsh-pet] очищаю историю удалённых питомцев pets=${pets}, messages=${messages}"],
["dsh-pet: 记忆文件无法解析（对话将从头开始）：${memoryPath}（${e instanceof Error ? e.message : String(e)}）","dsh-pet: не удалось разобрать файл памяти (диалог начнётся заново): ${memoryPath} (${e instanceof Error ? e.message : String(e)})"],
["[dsh-pet] 梦话生成成功 pet=${petId}，${result.text.length} 字","[dsh-pet] сонный лепет сгенерирован pet=${petId}, ${result.text.length} симв."],
["[dsh-pet] 记忆结构异常（messages 不是数组）pet=${petId}，按新会话处理：${memoryPath}","[dsh-pet] неверная структура памяти (messages не массив) pet=${petId}, обрабатываю как новую сессию: ${memoryPath}"],
["[dsh-pet] 对话附带图片 pet=${petId}，${image.width}x${image.height}，${image.bytes} 字节（模型不支持读图时内核会以占位文本代替）","[dsh-pet] к диалогу приложено изображение pet=${petId}, ${image.width}x${image.height}, ${image.bytes} байт (если модель не умеет читать картинки, ядро подставит текст-заглушку)"],
["ttl 必须是 ${LOCK_MIN_TTL_MS}~${LOCK_MAX_TTL_MS} 之间的有限数字（毫秒）","ttl должен быть конечным числом от ${LOCK_MIN_TTL_MS} до ${LOCK_MAX_TTL_MS} (мс)"],
["[dsh-pet] 待办提醒 todo=${due.todo.id} pet=${speaker} 剩余=${remainingSec}s","[dsh-pet] напоминание о задаче todo=${due.todo.id} pet=${speaker} осталось=${remainingSec}s"],
["${minutes}分钟","${minutes} мин"],
["${hours}小时","${hours} ч"],
["${Math.max(1, Math.round(hours / 24))}天","${Math.max(1, Math.round(hours / 24))} дн"],
["「${label}」到点啦，记得处理","«${label}» — подошёл срок, не забудь"],
["「${label}」已经逾期${spanText(now - dueAt)}啦，记得处理","«${label}» просрочено на ${spanText(now - dueAt)} — не забудь"],
["「${label}」还有${spanText(dueAt - now)}就到点啦","«${label}» — через ${spanText(dueAt - now)} срок"],
["[10月31日 22:53]","[31 октября 22:53]"],
["[时:分] 原文","[чч:мм] оригинал"],
["[月日 时:分]","[день-месяц чч:мм]"],
["[至少还剩多少毫秒, 提醒间隔]","[минимальный остаток в мс, интервал напоминания]"],
["[图:名称]","[图:<имя>]"],
["[动作:名称]","[动作:<имя>]"],
["lk-<时间36>-<自增36>","lk-<время36>-<счётчик36>"],
["[dsh-pet] 配置缺少 animations.events.workStatus，无法播放工作状态动画","[dsh-pet] в конфиге нет animations.events.workStatus, не могу проиграть анимацию рабочего состояния"],
["[dsh-pet] work-status 档位索引越界：state=","[dsh-pet] индекс ступени work-status вне диапазона: state="],
["[dsh-pet] 跳会话：宿主未接受 pet=","[dsh-pet] пропуск сеанса: хост не принял pet="],
["[dsh-pet] 配置缺少 animations.events.whisper，无法播放碎碎念动画","[dsh-pet] в конфиге нет animations.events.whisper, не могу проиграть анимацию бормотания"],
[" （不联动动画）"," (без привязки к анимации)"],
["[dsh-pet] 配置缺少 animations.events.balance，无法播放余额事件动画","[dsh-pet] в конфиге нет animations.events.balance, не могу проиграть анимацию события баланса"],
["[dsh-pet] balance 档位索引越界：p=","[dsh-pet] индекс ступени balance вне диапазона: p="],
["[dsh-pet] 余额查询失败 reason=","[dsh-pet] не удалось получить баланс reason="],
["不补偿","без компенсации"],
["[dsh-pet-desktop-helper] dpi 探测失败，按不补偿继续:","[dsh-pet-desktop-helper] сбой определения dpi, продолжаю без компенсации:"],
["点了没反应","нажал, а реакции нет"],
["释放瞬间是否位移","есть ли смещение в момент отпускания"],
["[dsh-pet helper] 启动失败：本进程被以「纯 Node 模式」拉起（ELECTRON_RUN_AS_NODE=","[dsh-pet helper] сбой запуска: процесс запущен в «режиме чистого Node» (ELECTRON_RUN_AS_NODE="],
["）。该变量必须在 spawn 前删除（见 src/host/helper-process.ts 的 helperSpawnEnv），","). Эту переменную нужно удалить до spawn (см. helperSpawnEnv в src/host/helper-process.ts),"],
["运行期再删无效，设成空串会让 Electron 直接 abort。原始错误：","удаление во время работы не помогает, пустая строка заставит Electron сразу abort. Исходная ошибка: "],
["环境要求我退","окружение требует выйти"],
["[dsh-pet-desktop-helper] userData 不可写，回退到","[dsh-pet-desktop-helper] userData недоступен для записи, откатываюсь к"],
["[dsh-pet-desktop-helper] userData 回退失败:","[dsh-pet-desktop-helper] откат userData не удался:"],
["已重置","сброшено"],
["待办事项","Задачи"],
["宠物缺少 animations 段：","у питомца нет раздела animations: "],
["正在用输入","использую ввод"],
["位置","позиция"],
["[dsh-pet] 用户接管上报未送达 pet=","[dsh-pet] отчёт о перехвате пользователем не доставлен pet="],
["光标在身体上","курсор на теле"],
["[dsh-pet] 素材加载失败 pet=","[dsh-pet] не удалось загрузить материал pet="],
["（已释放本次切换）"," (этот переключатель освобождён)"],
["10s 超时","таймаут 10 с"],
[" 占用锁生效：冻结（随机链停 + 当前动画暂停 + 任务状态气泡收起）"," блокировка занятости активна: заморозка (случайная цепочка остановлена + текущая анимация на паузе + пузырь статуса задачи скрыт)"],
[" 占用锁解除：恢复"," блокировка занятости снята: восстановление"],
[" 入睡被打断：不播起来"," засыпание прервано: не проигрываю подъём"],
[" 醒来：播 "," пробуждение: проигрываю "],
[" 一遍"," один раз"],
[" 进睡："," сон: "],
["进睡","сон"],
["叫醒","разбудить"],
["请求未成功 pet=","запрос не удался pet="],
[" workStatus 档内轮换: "," ротация в ступени workStatus: "],
[" 恢复工作状态动画: "," восстановление анимации рабочего состояния: "],
["已重置","сброшено"],
["[dsh-pet] 【弹窗】","[dsh-pet] [окно]"],
["[dsh-pet] 快捷键服务不可用，「","[dsh-pet] сервис горячих клавиш недоступен, «"],
["」未注册","» не зарегистрирована"],
["[dsh-pet] 快捷键注册失败：","[dsh-pet] не удалось зарегистрировать горячую клавишу: "],
["[dsh-pet] 显示位置切换失败 ","[dsh-pet] не удалось переключить место показа "],
["失败 pet=","не удалось pet="],
["异常 pet=","ошибка pet="],
["[dsh-pet] 第三方菜单点击上报失败 ","[dsh-pet] не удалось отправить клик стороннего меню "],
["[dsh-pet] 菜单查看余额 pet=","[dsh-pet] меню: проверка баланса pet="],
["[dsh-pet] 菜单触发碎碎念 pet=","[dsh-pet] меню: запуск бормотания pet="],
["[dsh-pet] 菜单切换显示位置 pet=","[dsh-pet] меню: переключение места показа pet="],
["[dsh-pet] 菜单","[dsh-pet] меню"],
["[dsh-pet] 播放回执未送达 pet=","[dsh-pet] квитанция воспроизведения не доставлена pet="],
["睡觉 -> [","сон -> ["],
["入睡被打断：不播起来","засыпание прервано: не проигрываю подъём"],
["醒来 -> [","пробуждение -> ["],
["互动结束恢复状态动画: ","взаимодействие завершено, восстанавливаю анимацию состояния: "],
["移动进行中(不重播)","идёт перемещение (не повторяю)"],
["[dsh-pet] 配置缺少 animations.events.whisper，无法播放碎碎念动画","[dsh-pet] в конфиге нет animations.events.whisper, не могу проиграть анимацию бормотания"],
[" （不联动动画）"," (без привязки к анимации)"],
["[dsh-pet] 素材加载失败 pet=","[dsh-pet] не удалось загрузить материал pet="],
["（已释放本次切换）"," (этот переключатель освобождён)"],
[" workStatus 档内轮换: "," ротация в ступени workStatus: "],
[" workStatus 循环续播: "," workStatus продолжение цикла: "],
["  事件动画播完 ended anim=","  анимация события доиграла ended anim="],
["[dsh-pet] 对话已发送 pet=","[dsh-pet] диалог отправлен pet="],
["[dsh-pet] 配置缺少 animations.events.balance，无法播放余额事件动画","[dsh-pet] в конфиге нет animations.events.balance, не могу проиграть анимацию события баланса"],
["[dsh-pet] balance 档位索引越界：p=","[dsh-pet] индекс ступени balance вне диапазона: p="],
["% -> [档","% -> [ступень"],
["->null    播完即停（回待机，收起气泡）","->null    останавливается после проигрывания (возврат в ожидание, пузырь скрыт)"],
["[dsh-pet] 配置缺少 animations.events.workStatus，无法播放工作状态动画","[dsh-pet] в конфиге нет animations.events.workStatus, не могу проиграть анимацию рабочего состояния"],
["[dsh-pet] work-status 档位索引越界：state=","[dsh-pet] индекс ступени work-status вне диапазона: state="],
["[dsh-pet] 状态订阅回调出错（已忽略，不影响轮询）：","[dsh-pet] ошибка в callback подписки на состояние (игнорирую, опрос не затронут): "],
["[dsh-pet] 余额查询失败 reason=","[dsh-pet] не удалось получить баланс reason="],
["[dsh-pet] 配置加载失败","[dsh-pet] не удалось загрузить конфиг"],
["[dsh-pet] 配置重载失败，保留当前渲染列表","[dsh-pet] не удалось перезагрузить конфиг, оставляю текущий список отрисовки"],
["[dsh-pet] 吃白饭异常","[dsh-pet] ошибка мини-игры «поесть риса»"],
["[dsh-pet] 吃白饭启动失败 ","[dsh-pet] не удалось запустить «поесть риса» "],
["[dsh-pet] 吃白饭注册菜单失败 ","[dsh-pet] не удалось зарегистрировать меню «поесть риса» "],
["[dsh-pet] 命令图标不可用：commandUi.candidates 缺失（命令本身仍可用，只是没有图标）","[dsh-pet] иконка команды недоступна: нет commandUi.candidates (сама команда работает, только без иконки)"],
["[dsh-pet] 命令图标补丁异常，本次退回原始菜单行：","[dsh-pet] ошибка патча иконки команды, возвращаю исходную строку меню: "],
["「桌宠配置」行的导航图标：盖住齿轮，换成本模块的图形","иконка навигации для строки «Конфиг питомца»: закрывает шестерёнку и подставляет графику этого модуля"],
["[dsh-pet] 设置页导航图标不可用：缺少 document / body / MutationObserver（齿轮照旧）","[dsh-pet] иконка навигации в настройках недоступна: нет document / body / MutationObserver (шестерёнка остаётся)"],
["[dsh-pet] 设置页导航图标不可用：","[dsh-pet] иконка навигации в настройках недоступна: "],
["（齿轮照旧）"," (шестерёнка остаётся)"],
["sprite 里找不到引用的 <symbol>","в sprite не найден referenced <symbol>"],
["图标渲染失败：","не удалось отрисовать иконку: "],
["图标渲成了空 SVG","иконка отрисовалась как пустой SVG"],
["[dsh-pet] 设置页导航图标补丁异常，本次跳过（齿轮照旧）：","[dsh-pet] ошибка патча иконки навигации в настройках, пропускаю (шестерёнка остаётся): "],
["[dsh-pet] 右侧栏不可用：没有 sidebarRightTabs 服务，桌宠对话标签未注册","[dsh-pet] правая панель недоступна: нет сервиса sidebarRightTabs, вкладка диалога питомца не зарегистрирована"],
["[dsh-pet] 图标模块不可用：","[dsh-pet] модуль иконок недоступен: "],
["[dsh-pet] 图标渲染器不可用（react-dom 缺失）：","[dsh-pet] рендерер иконок недоступен (нет react-dom): "],
["[dsh-pet] 命令选择框不可用：commandUi 服务缺失（/pet 仍可手输 id 或名字）","[dsh-pet] выбор команд недоступен: нет сервиса commandUi (/pet по-прежнему принимает id или имя вручную)"],
["[dsh-pet] 命令图标不可用（命令本身仍可用，只是没有图标）","[dsh-pet] иконка команды недоступна (сама команда работает, только без иконки)"],
["[dsh-pet] 设置页导航图标不可用（那一行仍是齿轮）","[dsh-pet] иконка навигации в настройках недоступна (строка остаётся с шестерёнкой)"],
["[dsh-pet] 右侧栏对话面板注册失败（已忽略，不影响启动）：","[dsh-pet] не удалось зарегистрировать панель диалога в правой панели (игнорирую, запуск не затронут): "],
["dsh-pet: 对话响应非法","dsh-pet: неверный ответ диалога"],
["这个文件读不出来","не удалось прочитать этот файл"],
["这个文件解不出图片","не удалось декодировать это изображение"],
["无法压到预算内","не удаётся уложиться в бюджет"],
["不是可发送的图片","это изображение нельзя отправить"],
["宠","питомец"]
];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LIB = ["lib/index.js", "lib/app.js", "lib/standalone.js", "lib/client.js", "lib/chat-panel.js"];

function runtimeFiles(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) runtimeFiles(p, out);
    else if (p.endsWith(".js")) out.push(p);
  }
  return out;
}

const files = [...LIB.map((f) => join(ROOT, f)), ...runtimeFiles(join(ROOT, "runtime/electron-helper"))];
let grand = 0;
for (const p of files) {
  const lines = readFileSync(p, "utf8").split("\n");
  let applied = 0;
  let inLocale = false;
  const outLines = lines.map((line) => {
    if (/^\/\/#region .*locales\//.test(line)) { inLocale = true; return line; }
    if (/^\/\/#endregion/.test(line)) { inLocale = false; return line; }
    if (inLocale) return line;
    let next = line;
    for (const [a, b] of MAP) {
      const re = new RegExp("([\"'\`])" + esc(a) + "\\1", "g");
      const before = next;
      next = next.replace(re, (m, q) => q + b + q);
      if (next === before && a.length >= 10 && next.includes(a)) next = next.split(a).join(b);
      if (next !== before) applied++;
    }
    return next;
  });
  if (applied) { writeFileSync(p, outLines.join("\n")); console.log(p.slice(ROOT.length + 1), "→", applied); grand += applied; }
}
console.log("Готово. Заменено шаблонов:", grand);
