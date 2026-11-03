// Mini-Lang 翻譯器的介面。中文 ⇄ Mini-Lang 的規則在 minilang.js，英文用 mt.js（瀏覽器內建翻譯）。
(function () {
  'use strict';
  const ML = MiniLang.create(DATA);
  const $ = (id) => document.getElementById(id);
  const HAN = /[一-鿿]/;
  const LANGS = { zh: '中文', en: 'English', mini: 'Mini-Lang' };
  const PLACEHOLDER = {
    zh: '在這裡輸入或貼上一般中文的文章',
    en: 'Type or paste English text here',
    mini: '在這裡輸入或貼上 Mini-Lang 的文章',
  };

  const state = { src: 'zh', dst: 'mini', pinyin: false, text: '' };
  try {
    const saved = JSON.parse(localStorage.getItem('minilang') || '{}');
    if (saved.dir) Object.assign(saved, saved.dir === 'to-zh' ? { src: 'mini', dst: 'zh' } : { src: 'zh', dst: 'mini' });
    delete saved.dir;
    Object.assign(state, saved);
  } catch (e) { /* 沒有儲存空間也能用 */ }
  const save = () => {
    try { localStorage.setItem('minilang', JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  };

  // ---------- 畫出結果：tokens → HTML，需要時加上拼音 ----------
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render(tokens, withPinyin) {
    const full = tokens.map((t) => t.text).join('');
    const py = withPinyin ? ML.readings(full) : null;
    let pos = 0;
    return tokens.map((t) => {
      const chars = [...t.text];
      const body = chars.map((c, k) => {
        const r = py && py[pos + k];
        return r && HAN.test(c) ? `<ruby>${esc(c)}<rt>${ML.toneMark(r)}</rt></ruby>` : esc(c);
      }).join('');
      pos += chars.length;
      if (t.type === 'plain') return body;
      // 英文旁的空格放在標記外面，標記（和浮現的說明）才不會從上一行的行尾開始
      const [, lead, inner, trail] = /^( *)(.*?)( *)$/s.exec(body);
      if (t.loan) {
        // 外來語：說明不放在文字裡，滑鼠移上去（或點一下）才浮現
        const tip = [t.note ? `（${t.note}）` : '', t.from ? `原文：${t.from}` : ''].filter(Boolean).join('\n');
        return `${lead}<span class="sub loan" tabindex="0" data-note="${esc(tip)}">${inner}</span>${trail}`;
      }
      const tip = [t.from ? `原文：${t.from}` : '', t.info || ''].filter(Boolean).join('\n');
      return `${lead}<span class="${t.type}" title="${esc(tip)}">${inner}</span>${trail}`;
    }).join('');
  }

  // Mini-Lang 文章：外來語收進浮現的說明，字表外的字標出來
  function miniTokens(text) {
    const unknown = new Set(ML.unknownChars(text));
    return ML.loanTokens(text).flatMap((t) => (t.type !== 'plain' ? [t]
      : [...t.text].map((c) => (unknown.has(c) ? { type: 'bad', text: c, info: '字表外的字' } : { type: 'plain', text: c }))));
  }

  // ---------- 翻譯：依來源與目標語言選路線 ----------
  // 英文一律經過中文：Mini-Lang → 中文 → English、English → 中文 → Mini-Lang
  async function translate(text, src, dst) {
    const plain = (s) => [{ type: 'plain', text: s }];
    if (src === dst) return { tokens: src === 'mini' ? miniTokens(text) : plain(text), machine: false };
    if (src === 'zh' && dst === 'mini') return { tokens: ML.toMini(text), machine: false };
    if (src === 'mini' && dst === 'zh') return { tokens: ML.toZh(text), machine: false };
    if (src === 'zh' && dst === 'en') return { tokens: plain(await MT.translate(text, 'zh', 'en')), machine: true };
    if (src === 'en' && dst === 'zh') return { tokens: plain(await MT.translate(text, 'en', 'zh')), machine: true };
    if (src === 'mini' && dst === 'en') {
      const zh = ML.toZh(text).map((t) => t.text).join('');
      return { tokens: plain(await MT.translate(zh, 'zh', 'en')), machine: true, via: zh };
    }
    // English → Mini-Lang
    const zh = await MT.translate(text, 'en', 'zh');
    return { tokens: ML.toMini(zh), machine: true, via: zh };
  }

  // 需要英文翻譯時，先確認瀏覽器能不能用
  const needsMT = (src, dst) => src !== dst && (src === 'en' || dst === 'en');
  const pair = (src, dst) => (src === 'en' ? ['en', 'zh'] : ['zh', 'en']);

  async function checkMT() {
    const [from, to] = pair(state.src, state.dst);
    const s = await MT.status(from, to);
    if (s.state === 'available') return true;
    const box = $('mt-box');
    box.hidden = false;
    $('mt-download').hidden = !(s.state === 'downloadable' || s.state === 'downloading');
    $('mt-msg').textContent = {
      unsupported: '這個瀏覽器沒有內建翻譯功能，英文翻譯不能用。請改用桌面版 Chrome 138 以上的版本；中文 ⇄ Mini-Lang 不受影響。',
      unavailable: '這個瀏覽器不支援中文和英文之間的翻譯。',
      timeout: '這個瀏覽器的內建翻譯沒有回應，英文翻譯不能用。請改用桌面版 Chrome 138 以上的版本。',
      downloadable: '第一次使用英文翻譯，要先下載翻譯模型（只下載一次，之後在本機執行）。',
      downloading: '翻譯模型下載中，按下按鈕繼續。',
    }[s.state] || '英文翻譯不能用。';
    return false;
  }

  // ---------- 更新畫面 ----------
  let requestId = 0;
  let lastOutput = '';

  async function update() {
    const id = ++requestId;
    const { src, dst, text } = state;
    $('src').value = src;
    $('dst').value = dst;
    $('in-label').textContent = LANGS[src];
    $('out-label').textContent = LANGS[dst];
    $('input').placeholder = PLACEHOLDER[src];
    $('input').lang = src === 'en' ? 'en' : 'zh-Hant';
    $('in-count').textContent = !text ? '' : src === 'en'
      ? `${(text.match(/[A-Za-z']+/g) || []).length} words` : `${[...text].filter((c) => HAN.test(c)).length} 字`;
    $('pinyin').checked = state.pinyin;
    $('mt-box').hidden = true;
    $('busy').hidden = true;

    // 輸入是 Mini-Lang 時，拼音標在輸入的文章上
    const showPreview = src === 'mini' && dst !== 'mini' && state.pinyin && text.trim() !== '';
    $('preview-wrap').hidden = !showPreview;
    if (showPreview) {
      $('preview').innerHTML = render(miniTokens(text), true);
      $('preview').classList.add('pinyin');
    }

    const out = $('output');
    if (!text.trim()) {
      out.innerHTML = '';
      $('stats').innerHTML = '';
      $('notes').innerHTML = '';
      lastOutput = '';
      return;
    }
    if (needsMT(src, dst)) {
      if (!(await checkMT())) {
        if (id !== requestId) return;
        out.innerHTML = '';
        $('stats').innerHTML = '';
        $('notes').innerHTML = '';
        lastOutput = '';
        return;
      }
      $('busy').hidden = false;
    }

    let result;
    try {
      result = await translate(text, src, dst);
    } catch (e) {
      if (id !== requestId) return;
      $('busy').hidden = true;
      out.textContent = '';
      $('mt-box').hidden = false;
      $('mt-download').hidden = true;
      $('mt-msg').textContent = `翻譯失敗：${e.message}`;
      return;
    }
    if (id !== requestId) return;  // 已經有更新的輸入
    $('busy').hidden = true;

    const { tokens } = result;
    const withPinyin = dst === 'mini' && state.pinyin;
    // 複製與交換用的純文字：外來語第一次出現時的說明要放回去
    lastOutput = dst === 'mini' && src !== 'mini' ? ML.plainText(tokens) : tokens.map((t) => t.text).join('');
    out.lang = dst === 'en' ? 'en' : 'zh-Hant';
    out.innerHTML = render(tokens, withPinyin);
    out.classList.toggle('pinyin', withPinyin);
    showStats(tokens, result);
  }

  function showStats(tokens, result) {
    const { src, dst, text } = state;
    const count = (type) => tokens.filter((t) => t.type === type).length;
    const stats = [];
    const notes = [];
    if (dst === 'mini' && src !== 'mini') {
      const left = ML.unknownChars(lastOutput);
      stats.push(`詞典換了 <b>${count('sub') + count('alt')}</b> 個詞`);
      stats.push(left.length ? `還有 <b>${left.length}</b> 個字表外的字要改寫`
        : '<span class="ok">✓ 全部只用字表內的字</span>');
      for (const t of tokens) {
        if (t.type === 'hint') notes.push(`「${t.text}」${t.info}`);
        if (t.type === 'alt') notes.push(`「${t.from}」換成「${t.text}」，${t.info}`);
      }
      const bad = [...new Set(tokens.filter((t) => t.type === 'bad').map((t) => t.text))];
      if (bad.length) notes.push(`這些字詞典沒有，要換個說法：${bad.join('、')}`);
    }
    if (src === 'mini') {
      const unknown = ML.unknownChars(text);
      if (dst === 'zh') stats.push(`還原了 <b>${count('sub')}</b> 個詞`);
      stats.push(unknown.length ? `輸入有 <b>${unknown.length}</b> 個字表外的字：${unknown.join('')}`
        : '<span class="ok">✓ 輸入只用字表內的字</span>');
      if (dst === 'zh') notes.push('還原只查詞典：量詞（一個大衣 → 一件大衣）和語氣要自己改。');
    }
    if (result.machine) {
      notes.push('英文的部分由瀏覽器內建的翻譯模型產生（在本機執行），可能有錯。');
      if (result.via) notes.push(`中間經過的中文：${result.via}`);
    }
    $('stats').innerHTML = stats.join('　·　');
    $('notes').innerHTML = [...new Set(notes)].map((n) => `<li>${esc(n)}</li>`).join('');
  }

  // ---------- 事件 ----------
  for (const id of ['src', 'dst']) {
    const sel = $(id);
    for (const [value, name] of Object.entries(LANGS)) sel.add(new Option(name, value));
    sel.addEventListener('change', () => { state[id] = sel.value; update(); save(); });
  }

  let timer;
  $('input').addEventListener('input', (e) => {
    state.text = e.target.value;
    clearTimeout(timer);
    // 英文翻譯比較慢，等打字停久一點再翻
    timer = setTimeout(() => { update(); save(); }, needsMT(state.src, state.dst) ? 500 : 120);
  });
  $('swap').addEventListener('click', () => {
    if (lastOutput) state.text = lastOutput;
    [state.src, state.dst] = [state.dst, state.src];
    $('input').value = state.text;
    update(); save();
  });
  $('pinyin').addEventListener('change', (e) => { state.pinyin = e.target.checked; update(); save(); });
  $('copy').addEventListener('click', async () => {
    // 複製純文字：不含拼音，外來語第一次出現時附上說明
    try {
      await navigator.clipboard.writeText(lastOutput);
      $('copy').textContent = '已複製';
      setTimeout(() => { $('copy').textContent = '複製'; }, 1200);
    } catch (e) {
      $('copy').textContent = '無法複製';
    }
  });
  $('mt-download').addEventListener('click', async () => {
    const [from, to] = pair(state.src, state.dst);
    const button = $('mt-download');
    button.disabled = true;
    try {
      await MT.prepare(from, to, (p) => { button.textContent = `下載中 ${Math.round(p * 100)}%`; });
      button.textContent = '下載翻譯模型';
      update();
    } catch (e) {
      $('mt-msg').textContent = `下載失敗：${e.message}`;
    } finally {
      button.disabled = false;
    }
  });

  const sel = $('examples');
  DATA.examples.forEach((ex, i) => {
    sel.add(new Option(`${ex.dir === 'to-mini' ? '中文' : 'Mini-Lang'}：${ex.title}`, i));
  });
  sel.addEventListener('change', () => {
    const ex = DATA.examples[sel.value];
    if (!ex) return;
    state.text = ex.text;
    [state.src, state.dst] = ex.dir === 'to-mini' ? ['zh', 'mini'] : ['mini', 'zh'];
    $('input').value = ex.text;
    sel.value = '';
    update(); save();
  });

  // ---------- 字表 ----------
  $('charset').innerHTML = DATA.groups.map(([name, chars]) => {
    const body = [...chars].map((c) => `<ruby>${c}<rt>${ML.toneMark(DATA.pinyin[c])}</rt></ruby>`).join('');
    return `<div class="group"><h3>${esc(name)}（${[...chars].length}）</h3><div class="chars">${body}</div></div>`;
  }).join('');

  if (!state.text) state.text = DATA.examples[0] ? DATA.examples[0].text : '';
  $('input').value = state.text;
  update();
})();
