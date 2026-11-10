/**
 * Дочерний синтез Edge TTS: запускается отдельным процессом из lib/index.js,
 * когда синтез внутри процесса DSH отдаёт «no audio» (в main-процессе Electron
 * WebSocket-сессия Edge закрывается без аудио, хотя тот же код под Node работает).
 *
 * Аргументы: <text> <voice> <rate> <target>
 * rate "+0%" означает «без изменения скорости» — в этом случае параметр не передаём.
 */
import { writeFile, rename, rm } from "node:fs/promises";
import { EdgeTTS } from "@andresaya/edge-tts";

const [text, voice, rateArg, target] = process.argv.slice(2);
if (!text || !voice || !target) {
  console.error("edge-synth: нужны text, voice, target");
  process.exit(2);
}

const staging = `${target}.part`;
try {
  const tts = new EdgeTTS();
  const rate = !rateArg || rateArg === "+0%" ? undefined : rateArg;
  const result = await tts.generate(text, voice, {
    ...(rate ? { rate } : {}),
    timeout: 20000,
  });
  const audio = result?.audio;
  if (!audio || (audio.byteLength ?? audio.length ?? 0) === 0) {
    throw new Error("edge-synth: пустой ответ");
  }
  await writeFile(staging, audio);
  await rename(staging, target);
} catch (error) {
  await rm(staging, { force: true }).catch(() => void 0);
  console.error("edge-synth:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}