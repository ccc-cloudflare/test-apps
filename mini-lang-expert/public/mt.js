// 中文 ⇄ 英文：用瀏覽器內建的翻譯模型（Chrome 138 以上的 Translator API）。
// 模型下載到瀏覽器裡，在本機執行，文章不會送到任何伺服器。
const MT = (function () {
  'use strict';
  // 字表是繁體字，中文優先用 zh-Hant；不支援時才用 zh
  const TAGS = { zh: ['zh-Hant', 'zh'], en: ['en'] };
  const translators = new Map();
  const known = new Map();

  const supported = () => typeof self !== 'undefined' && 'Translator' in self;
  const timeout = (p, ms) => Promise.race([p, new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms))]);

  // 回傳 {state, source, target}；state 是 available、downloadable、downloading、unavailable、unsupported 或 timeout
  async function status(from, to) {
    const key = `${from}>${to}`;
    if (known.has(key)) return known.get(key);
    if (!supported()) return { state: 'unsupported' };
    let result = { state: 'unavailable' };
    try {
      for (const source of TAGS[from]) {
        for (const target of TAGS[to]) {
          const state = await timeout(Translator.availability({ sourceLanguage: source, targetLanguage: target }), 5000);
          if (state !== 'unavailable') { result = { state, source, target }; break; }
        }
        if (result.state !== 'unavailable') break;
      }
    } catch (e) {
      result = { state: 'timeout' };
    }
    if (result.state === 'available' || result.state === 'unavailable') known.set(key, result);
    return result;
  }

  // 建立翻譯器；模型還沒下載時，Chrome 規定要在使用者點擊時呼叫
  async function prepare(from, to, onProgress) {
    const key = `${from}>${to}`;
    if (translators.has(key)) return translators.get(key);
    const s = await status(from, to);
    if (!s.source) throw new Error(s.state);
    const translator = await Translator.create({
      sourceLanguage: s.source,
      targetLanguage: s.target,
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => onProgress && onProgress(e.loaded));
      },
    });
    translators.set(key, translator);
    known.set(key, { ...s, state: 'available' });
    return translator;
  }

  // 一行一行翻，保留換行
  async function translate(text, from, to) {
    const translator = await prepare(from, to);
    const lines = text.split('\n');
    const out = [];
    for (const line of lines) out.push(line.trim() ? await translator.translate(line) : line);
    return out.join('\n');
  }

  return { supported, status, prepare, translate };
})();
