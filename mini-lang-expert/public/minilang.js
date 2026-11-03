// Mini-Lang 翻譯引擎：一般中文 ⇄ Mini-Lang（247 字），以及拼音標注。
// 規則來自 mini-lang/universal.md，資料來自 data.js（由 build.py 產生）。
// 網頁和 Node 測試共用這個檔案。

(function (root) {
  'use strict';

  const HAN = /[一-鿿]/;
  const LATIN = /[A-Za-z]/;

  function create(DATA) {
    const charset = new Set(DATA.charset);
    const inSet = (c) => !HAN.test(c) || charset.has(c);
    const allInSet = (s) => [...s].every(inSet);

    // ==========================================
    // 1. 中文數字 → 阿拉伯數字（同 mini-lang/to_digits.py）
    // ==========================================
    const DELETED = new Set('二三四五六七八九十');
    const DIGIT = { 零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const UNIT = { 十: 10, 百: 100, 千: 1000 };
    const IDIOMS = { 十分好: '很好', 十字路口: '路口', 十幾: '10多', 幾十: '很多' };

    function numberValue(s) {
      let total = 0, section = 0, num = 0;
      for (const c of s) {
        if (c in DIGIT) num = DIGIT[c];
        else if (c in UNIT) { section += (num || 1) * UNIT[c]; num = 0; }
        else if (c === '萬') { total += (section + num) * 10000; section = 0; num = 0; }
      }
      return total + section + num;
    }

    function toDigits(text) {
      for (const [a, b] of Object.entries(IDIOMS)) text = text.split(a).join(b);
      text = text.replace(/(星期|禮拜)(?=[一二三四五六日天])/g, '週');
      text = text.replace(/週([一二三四五六])/g, (_, d) => '週' + DIGIT[d]);
      text = text.replace(/第([一兩])(?![百千萬])/g, (_, d) => '第' + DIGIT[d]);
      return text.replace(/[零一二兩三四五六七八九十百千萬]+/g, (s) => {
        const chars = [...s];
        if (chars.length === 2 && chars.every((c) => c in DIGIT) && DIGIT[chars[1]] === DIGIT[chars[0]] + 1)
          return `${DIGIT[chars[0]]}到${DIGIT[chars[1]]}`;  // 兩三天 → 2到3天
        const hasDeleted = chars.some((c) => DELETED.has(c));
        const multi = chars.length > 1 && chars.some((c) => '百千萬'.includes(c));
        if (!hasDeleted && !multi) return s;  // 一個、兩點：冠詞或固定說法
        const v = numberValue(s);
        return v >= 10000 && v % 10000 === 0 ? `${v / 10000}萬` : String(v);
      });
    }

    // ==========================================
    // 2. 一般中文 → Mini-Lang
    // ==========================================
    // 數字或指示詞後面的量詞，一律換成「個」（Mini-Lang 只用六個量詞）
    const MEASURE = /([一兩幾這那每哪0-9])(隻|本|張|條|件|位|顆|片|杯|碗|雙|輛|座|棵|朵|匹|篇|首|台|間|場|架|頂|封)/g;

    // 正向只用「含字表外的字」的詞條；字表內的詞本來就能用
    const forwardEntries = new Map();
    for (const [zh, mini, note, how] of DATA.lexicon) {
      if (zh.includes('…') || allInSet(zh) || forwardEntries.has(zh)) continue;
      forwardEntries.set(zh, { mini, note, how });
    }
    const forwardMax = Math.max(...[...forwardEntries.keys()].map((k) => [...k].length));

    // 回傳 tokens：{type, text, from?, info?}
    //   plain：原文照抄；sub：詞典換掉的詞；alt：有幾種說法，取了第一種；
    //   hint：要依句子改寫，只給建議；bad：字表外、詞典沒有的字
    // 外來語的 token 帶著 note（說明）：畫面上滑鼠移上去才顯示，複製的文字由 plainText() 放回第一次出現的地方
    function toMini(input) {
      const text = toDigits(input).replace(MEASURE, '$1個');
      const chars = [...text];
      const tokens = [];
      const seenLoan = new Set();
      let i = 0;
      while (i < chars.length) {
        let matched = false;
        for (let n = Math.min(forwardMax, chars.length - i); n > 0; n--) {
          const w = chars.slice(i, i + n).join('');
          const e = forwardEntries.get(w);
          if (!e) continue;
          if (e.mini.includes('…')) {
            tokens.push({ type: 'hint', text: w, info: `要依句子改寫，建議：${e.mini}` });
          } else if (e.mini.includes('／')) {
            const options = e.mini.split('／');
            tokens.push({ type: 'alt', text: options[0], from: w, info: `也可以說：${options.slice(1).join('、')}` });
          } else if (e.how === '外來語') {
            const first = !seenLoan.has(e.mini);
            seenLoan.add(e.mini);
            tokens.push({ type: 'sub', text: e.mini, from: w, loan: true, note: e.note, first });
          } else {
            tokens.push({ type: 'sub', text: e.mini, from: w });
          }
          i += n;
          matched = true;
          break;
        }
        if (matched) continue;
        const c = chars[i];
        tokens.push(inSet(c) ? { type: 'plain', text: c }
          : { type: 'bad', text: c, info: '字表外的字，詞典沒有，要換個說法' });
        i++;
      }
      return spaceTokens(mergePlain(tokens));
    }

    // Mini-Lang 的標準寫法：外來語第一次出現時，後面用括號加上說明
    function plainText(tokens) {
      return tokens.map((t) => (t.loan && t.first && t.note ? `${t.text}（${t.note}）` : t.text)).join('');
    }

    // 把 Mini-Lang 文章中的外來語（和它第一次出現時的說明）找出來，說明改放在 note 裡
    function loanTokens(text) {
      const tokens = [];
      let last = 0;
      for (const m of text.matchAll(loanRe)) {
        if (m.index > last) tokens.push({ type: 'plain', text: text.slice(last, m.index) });
        const word = m[1] || m[3];
        const e = loans.get(word);
        tokens.push({ type: 'loan', text: word, from: e.zh, loan: true, note: m[2] || e.note });
        last = m.index + m[0].length;
      }
      if (last < text.length) tokens.push({ type: 'plain', text: text.slice(last) });
      return tokens;
    }

    // ==========================================
    // 3. Mini-Lang → 一般中文（同 translate.py --to-zh）
    // ==========================================
    const notes = [];
    const phrases = new Map();
    for (const [zh, mini, note, how] of DATA.lexicon) {
      if (how === '外來語' && note) notes.push([`${mini}（${note}）`, mini]);
      // 兩個字以下的描述太常見，還原會改錯，只還原外來語和較長的描述
      const longEnough = how === '外來語' || [...mini].length >= 3;
      if ((how === '描述' || how === '外來語') && longEnough && !mini.includes('…') && !mini.includes('／')
          && !phrases.has(mini)) phrases.set(mini, zh);
    }
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const loans = new Map();
    for (const [zh, mini, note, how] of DATA.lexicon)
      if (how === '外來語' && !loans.has(mini)) loans.set(mini, { zh, note });
    const loanWords = [...loans.keys()].sort((a, b) => b.length - a.length).map(escape).join('|');
    // 「egg（說明）」或單獨的「egg」（整個英文詞相符）
    const loanRe = new RegExp(`(?<![A-Za-z])(${loanWords})（([^）]*)）|(?<![A-Za-z])(${loanWords})(?![A-Za-z])`, 'g');
    const phraseRe = new RegExp([...phrases.keys()].sort((a, b) => b.length - a.length)
      .map((k) => (LATIN.test(k[0]) ? `(?<![A-Za-z])${escape(k)}(?![A-Za-z])` : escape(k))).join('|'), 'g');

    function toZh(input) {
      let text = input;
      for (const [full, short] of notes) text = text.split(full).join(short);
      text = spaced(text);
      const tokens = [];
      let last = 0;
      for (const m of text.matchAll(phraseRe)) {
        if (m.index > last) tokens.push({ type: 'plain', text: text.slice(last, m.index) });
        tokens.push({ type: 'sub', text: phrases.get(m[0]), from: m[0] });
        last = m.index + m[0].length;
      }
      if (last < text.length) tokens.push({ type: 'plain', text: text.slice(last) });
      // 換回中文後，中文字之間不留空格
      return tokens.map((t, k) => {
        if (t.type !== 'plain') return t;
        let s = t.text;
        const prev = tokens[k - 1], next = tokens[k + 1];
        if (prev && HAN.test(prev.text.slice(-1))) s = s.replace(/^ (?=[^\x00-\x7f])/, '');
        if (next && HAN.test(next.text[0])) s = s.replace(/(?<=[^\x00-\x7f]) $/, '');
        if (prev && HAN.test(prev.text.slice(-1)) && s === ' ' && next && HAN.test(next.text[0])) s = '';
        return { ...t, text: s.replace(/(?<=[^\x00-\x7f]) (?=[^\x00-\x7f])/g, '') };
      }).filter((t) => t.text);
    }

    // ==========================================
    // 4. 格式：英文和中文之間空一格，中文標點旁不空
    // ==========================================
    function spaced(t) {
      return t.replace(/([A-Za-z])([^\x00-\x7f])/g, '$1 $2')
        .replace(/([^\x00-\x7f])([A-Za-z])/g, '$1 $2')
        .replace(/ ?([，。、；：？！（）「」《》]) ?/g, '$1');
    }

    function mergePlain(tokens) {
      const out = [];
      for (const t of tokens) {
        const prev = out[out.length - 1];
        if (t.type === 'plain' && prev && prev.type === 'plain') prev.text += t.text;
        else out.push({ ...t });
      }
      return out;
    }

    function spaceTokens(tokens) {
      // 只在 token 交界處加空格，token 內部（例如外來語的說明）已經寫好
      for (let k = 1; k < tokens.length; k++) {
        const a = tokens[k - 1], b = tokens[k];
        const end = a.text.slice(-1), start = b.text[0];
        if ((LATIN.test(end) && HAN.test(start)) || (HAN.test(end) && LATIN.test(start))) b.text = ' ' + b.text;
      }
      return tokens;
    }

    // ==========================================
    // 5. 拼音
    // ==========================================
    const pinyinWords = Object.entries(DATA.pinyin).filter(([w]) => [...w].length > 1);
    const pinyinMax = Math.max(...pinyinWords.map(([w]) => [...w].length));
    const wordReading = new Map(pinyinWords);

    // 回傳和 text 等長的陣列，漢字是「拼音+聲調數字」，其他是 null
    function readings(text) {
      const chars = [...text];
      const out = chars.map((c) => DATA.pinyin[c] || null);
      const fixed = new Array(chars.length).fill(false);
      for (let i = 0; i < chars.length; i++) {
        for (let n = Math.min(pinyinMax, chars.length - i); n > 1; n--) {
          const r = wordReading.get(chars.slice(i, i + n).join(''));
          if (!r) continue;
          r.split(' ').forEach((p, k) => { out[i + k] = p; fixed[i + k] = true; });
          i += n - 1;
          break;
        }
      }
      // 「很快地」的「地」讀 de
      for (let i = 1; i < chars.length; i++)
        if (chars[i] === '地' && !fixed[i] && '快慢好心氣樂真'.includes(chars[i - 1]) && !'方上下裡'.includes(chars[i + 1] || ''))
          out[i] = 'de5';
      // 變調：「不」在第四聲前讀第二聲；「一」在第四聲前讀第二聲、其他聲調前讀第四聲
      for (let i = 0; i < chars.length; i++) {
        if (fixed[i] || (chars[i] !== '一' && chars[i] !== '不')) continue;
        const next = out[i + 1];
        const tone = next ? Number(next.slice(-1)) : 0;
        if (chars[i] === '不') out[i] = tone === 4 ? 'bu2' : 'bu4';
        else out[i] = tone === 4 || tone === 5 ? 'yi2' : tone ? 'yi4' : 'yi1';
      }
      return out;
    }

    const MARKS = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
    function toneMark(p) {
      const m = /^([a-zv]+)([1-5])$/.exec(p);
      if (!m) return p;
      const s = m[1].replace('v', 'ü'), tone = Number(m[2]);
      if (tone === 5) return s;
      let at = s.indexOf('a');
      if (at < 0) at = s.indexOf('e');
      if (at < 0) at = s.indexOf('ou');
      if (at < 0) for (let k = s.length - 1; k >= 0; k--) if ('iuoü'.includes(s[k])) { at = k; break; }
      return s.slice(0, at) + MARKS[s[at]][tone - 1] + s.slice(at + 1);
    }

    function unknownChars(text) {
      return [...new Set([...text].filter((c) => !inSet(c)))];
    }

    return { toDigits, toMini, toZh, plainText, loanTokens, readings, toneMark, unknownChars, inSet, charset: DATA.charset };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { create };
  else root.MiniLang = { create };
})(this);
