// AI Chat（BYOK）：金鑰存在瀏覽器的 localStorage，對話經 Worker 的 /api/proxy
// 轉發給 OpenAI 相容的 LLM 端點。Worker 不儲存任何東西。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c]));

  const DEFAULTS = { url: 'https://integrate.api.nvidia.com/v1', model: 'z-ai/glm-5.3-flash', key: '', temperature: 0.6 };
  let settings = { ...DEFAULTS };
  let history = [];
  let controller = null;
  try {
    settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('aichat-settings') || '{}') };
    history = JSON.parse(localStorage.getItem('aichat-history') || '[]');
  } catch (e) { /* 沒有儲存空間也能用 */ }
  const save = () => {
    try {
      localStorage.setItem('aichat-settings', JSON.stringify(settings));
      localStorage.setItem('aichat-history', JSON.stringify(history.slice(-60)));
    } catch (e) { /* 忽略 */ }
  };

  // ---------- Markdown（只支援模型常用的幾種，同 mini-lang-expert）----------
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  }
  function markdown(text) {
    const out = [];
    const lines = text.split('\n').filter((l) => !/^\s*````+\s*[\w-]*\s*$/.test(l));
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const fence = /^\s*```+\s*([\w-]*)\s*$/.exec(line);
      if (fence) {
        const body = [];
        i++;
        while (i < lines.length && !/^\s*```+\s*$/.test(lines[i])) body.push(lines[i++]);
        i++;
        out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
        continue;
      }
      if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
        const row = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
        const head = row(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(row(lines[i++]));
        out.push(`<table><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`);
        continue;
      }
      const h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) { out.push(`<h3>${inline(h[2])}</h3>`); i++; continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
        const tag = ordered ? 'ol' : 'ul';
        out.push(`<${tag}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${tag}>`);
        continue;
      }
      if (!line.trim()) { i++; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^\s*(```|#{1,4}\s|[-*]\s|\d+\.\s|\|)/.test(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      out.push(`<p>${para.map(inline).join('<br>')}</p>`);
    }
    return out.join('');
  }

  // ---------- 畫出對話 ----------
  function renderMessage(m) {
    const div = document.createElement('div');
    div.className = `msg ${m.role}`;
    if (m.role === 'note') { div.textContent = m.content; return div; }
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (m.role === 'user') {
      bubble.textContent = m.content;
    } else {
      const thinking = m.reasoning ? `<details class="thinking"><summary>模型的思考過程</summary><div>${esc(m.reasoning)}</div></details>` : '';
      bubble.innerHTML = thinking + markdown(m.content || '') + (m.error ? `<p class="error">${esc(m.error)}</p>` : '');
    }
    div.appendChild(bubble);
    return div;
  }

  function renderAll() {
    const box = $('messages');
    box.innerHTML = '';
    if (!history.length) {
      box.appendChild(renderMessage({ role: 'assistant', content:
        '你好！這是一個自帶金鑰的聊天室。開始之前：\n\n1. 按「設定」，填入 API 端點、模型與你的金鑰\n2. 金鑰只存在這個瀏覽器，不會被這個網站保存\n3. 之後直接輸入訊息就能聊' }));
    }
    history.forEach((m) => box.appendChild(renderMessage(m)));
    $('chat').scrollTop = $('chat').scrollHeight;
  }

  // ---------- 呼叫模型（經 Worker 的代理轉發）----------
  async function ask() {
    const reply = { role: 'assistant', content: '', reasoning: '' };
    history.push(reply);
    const box = $('messages');
    let node = renderMessage(reply);
    box.appendChild(node);
    const atBottom = () => $('chat').scrollHeight - $('chat').scrollTop - $('chat').clientHeight < 80;

    controller = new AbortController();
    setBusy(true);
    $('status').textContent = '思考中…';
    try {
      const messages = history.filter((m) => m !== reply && (m.role === 'user' || m.role === 'assistant'))
        .map(({ role, content }) => ({ role, content }));
      const target = settings.url.replace(/\/+$/, '') + '/chat/completions';
      const resp = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: target,
          key: settings.key,
          body: { model: settings.model, messages, stream: true, temperature: Number(settings.temperature) || 0.6, max_tokens: 4096 },
        }),
        signal: controller.signal,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`${resp.status}：${text.slice(0, 300)}`);
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let last = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop();
        for (const ev of events) {
          for (const line of ev.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            let chunk;
            try { chunk = JSON.parse(data); } catch (e) { continue; }
            const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta || {};
            if (delta.reasoning_content || delta.reasoning) { reply.reasoning += delta.reasoning_content || delta.reasoning; $('status').textContent = '思考中…'; }
            if (delta.content) { reply.content += delta.content; $('status').textContent = '回答中…'; }
          }
        }
        // 每 150ms 重畫一次，避免太頻繁
        if (Date.now() - last > 150) {
          const stick = atBottom();
          const fresh = renderMessage(reply);
          box.replaceChild(fresh, node);
          node = fresh;
          if (stick) $('chat').scrollTop = $('chat').scrollHeight;
          last = Date.now();
        }
      }
      if (!reply.content && !reply.reasoning) reply.error = '模型沒有回傳內容，請確認模型名稱與金鑰。';
    } catch (e) {
      reply.error = e.name === 'AbortError' ? '（已停止）' : e.message.includes('Failed to fetch') ? '連不上伺服器。' : e.message;
    }
    const fresh = renderMessage(reply);
    box.replaceChild(fresh, node);
    $('chat').scrollTop = $('chat').scrollHeight;
    setBusy(false);
    $('status').textContent = '';
    save();
  }

  function setBusy(busy) {
    $('send').textContent = busy ? '停止' : '送出';
    $('send').classList.toggle('stop', busy);
  }

  function send() {
    if (controller && $('send').classList.contains('stop')) { controller.abort(); return; }
    if (!settings.key) {
      history.push({ role: 'note', content: '還沒有設定金鑰，請先按「設定」填入 API 金鑰。' });
      $('settings').open = true;
      renderAll();
      return;
    }
    const text = $('input').value.trim();
    if (!text) return;
    history.push({ role: 'user', content: text });
    $('input').value = '';
    autosize();
    renderAll();
    ask();
  }

  // ---------- 設定 ----------
  function loadSettingsForm() {
    $('s-url').value = settings.url;
    $('s-model').value = settings.model;
    $('s-key').value = settings.key;
  }
  $('save').addEventListener('click', () => {
    settings.url = $('s-url').value.trim() || DEFAULTS.url;
    settings.model = $('s-model').value.trim() || DEFAULTS.model;
    settings.key = $('s-key').value.trim();
    save();
    $('s-msg').textContent = '已儲存';
    renderHeader();
    setTimeout(() => { $('s-msg').textContent = ''; }, 1500);
  });
  function renderHeader() {
    $('model-tag').textContent = settings.model;
  }

  // ---------- 事件 ----------
  $('send').addEventListener('click', send);
  $('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  const autosize = () => { const t = $('input'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, window.innerHeight * 0.4) + 'px'; };
  $('input').addEventListener('input', autosize);
  $('settings-btn').addEventListener('click', () => {
    loadSettingsForm();
    const d = $('settings');
    d.open = !d.open;
    if (d.open) $('s-key').focus();
  });
  $('new').addEventListener('click', () => {
    if (controller) controller.abort();
    history = [];
    save();
    renderAll();
  });

  renderHeader();
  renderAll();
})();
