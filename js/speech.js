// Web Speech API による音声読み上げ（TOEIC同様に米・英・豪・加の発音をローテーション）
import { getState } from './storage.js';

const ACCENTS = ['en-US', 'en-GB', 'en-AU', 'en-CA'];
const FEMALE_HINT = /female|samantha|victoria|karen|moira|tessa|serena|zira|susan|hazel|libby|sonia|natasha|jenny|aria|ava|allison|kate|fiona|google us english|google uk english female/i;
const MALE_HINT = /male|daniel|alex|fred|david|mark|george|ryan|guy|thomas|oliver|lee|google uk english male/i;

let voices = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices().filter(v => /^en[-_]/i.test(v.lang));
}
if ('speechSynthesis' in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

export const ttsAvailable = () => 'speechSynthesis' in window;

function pickVoice(gender, accentIdx) {
  if (!voices.length) loadVoices();
  if (!voices.length) return null;
  const want = ACCENTS[accentIdx % ACCENTS.length];
  const byLang = voices.filter(v => v.lang.replace('_', '-').startsWith(want));
  const pool = byLang.length ? byLang : voices;
  const hint = gender === 'W' ? FEMALE_HINT : MALE_HINT;
  return pool.find(v => hint.test(v.name)) || pool[gender === 'W' ? 0 : pool.length - 1] || pool[0];
}

let cancelled = false;
export function stop() {
  cancelled = true;
  if (ttsAvailable()) speechSynthesis.cancel();
}

export function speak(text, { gender = 'W', accent = 0, rate } = {}) {
  return new Promise(resolve => {
    if (!ttsAvailable()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(gender, accent);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = ACCENTS[accent % 4];
    u.rate = rate || getState().settings.speechRate || 0.95;
    // 声の区別がつくようにピッチで男女差をつける
    u.pitch = gender.startsWith('W') ? 1.1 : 0.85;
    if (gender === 'W2') u.pitch = 1.3;
    if (gender === 'M2') u.pitch = 0.7;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

const wait = ms => new Promise(r => setTimeout(r, ms));

// 複数行を順に再生。lines: [{text, gender}]
export async function speakSequence(lines, accentBase = 0, gap = 450) {
  cancelled = false;
  if (ttsAvailable()) speechSynthesis.cancel();
  const accentOf = {};
  let n = 0;
  for (const line of lines) {
    if (cancelled) return;
    if (!(line.gender in accentOf)) accentOf[line.gender] = accentBase + n++;
    await speak(line.text, { gender: line.gender, accent: accentOf[line.gender] });
    await wait(gap);
  }
}
