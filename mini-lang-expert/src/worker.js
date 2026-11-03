// Mini-Lang 專家的 Cloudflare Worker：
//   /api/chat    串流對話（SSE），並在本機執行 check_minilang 工具的循環
//   /api/status  模型與金鑰狀態
//   其他路徑     靜態檔案（public/，由 Assets 提供）
// 金鑰存在 Worker 的密鑰 NVIDIA_API_KEY 裡，不會送到瀏覽器。

import { CHARSET, LEXICON, SYSTEM_PROMPT } from './generated.js';

const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'z-ai/glm-5.3-flash';
const REASONING_EFFORT = 'low';
const MAX_TOKENS = 8192;
const MAX_BODY = 200_000;  // 一次對話最多約 20 萬字元
const MAX_TOOL_ROUNDS = 5;  // 一次回答最多呼叫幾次檢查工具

const HAN = /[\u4e00-\u9fff]/;
const CHARSET_SET = new Set([...CHARSET]);

// 給模型用的工具：檢查 Mini-Lang 的文字，和 mini-lang/check.py 相同
const TOOLS = [{
  type: 'function',
  function: {
    name: 'check_minilang',
    description: '檢查一段 Mini-Lang 文字是否只用 247 字字表內的漢字（數字、標點、英文外來語不算）。'
                 + '回傳是否通過、字表外的字出現在哪裡，以及詞典中相關的換法。輸出任何 Mini-Lang 之前都要先用它檢查。',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: '要檢查的 Mini-Lang 文字（不含 minilang 區塊的標記）' } },
      required: ['text'],
    },
  },
}];

// ---------- 檢查工具 ----------

function unknownChars(text) {
  return [...new Set([...text].filter((c) => HAN.test(c) && !CHARSET_SET.has(c)))].sort();
}

function checkMinilang(text) {
  const bad = unknownChars(text);
  if (!bad.length) return { ok: true, message: '全部只用字表內的字，可以輸出。' };
  const chars = [...text];
  const out = bad.map((c) => {
    const where = [];
    for (let k = 0; k < chars.length && where.length < 3; k++)
      if (chars[k] === c) where.push(chars.slice(Math.max(0, k - 6), k + 7).join(''));
    return { char: c, where };
  });
  // 詞典裡含有這些字、而且出現在文字中的詞，附上標準換法
  const suggestions = [];
  for (const [zh, mini] of LEXICON) {
    if (zh !== mini && text.includes(zh) && bad.some((c) => zh.includes(c))) suggestions.push({ word: zh, mini_lang: mini });
    if (suggestions.length >= 20) break;
  }
  return { ok: false, out_of_set: out, suggestions,
           message: '請只改寫含有這些字的句子，改完再檢查一次。' };
}

// ---------- 系統提示詞 ----------

// 有設定 PROMPTS KV 時先讀 KV，可以用 wrangler kv key put 更新提示詞而不用重新部署
let cachedPrompt = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

async function systemPrompt(env) {
  if (env.PROMPTS) {
    const now = Date.now();
    if (cachedPrompt && now - cachedAt < CACHE_MS) return cachedPrompt;
    try {
      const v = await env.PROMPTS.get('system_prompt');
      if (v) { cachedPrompt = v; cachedAt = now; return v; }
    } catch (e) { /* KV 不能用時用打包的版本 */ }
  }
  return SYSTEM_PROMPT;
}

// ---------- NVIDIA API ----------

// 呼叫模型一次，把思考與回答轉送給網頁；回傳模型要呼叫的工具（沒有就是空的）
async function streamRound(key, convo, send) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      model: MODEL,
      messages: convo,
      stream: true,
      max_tokens: MAX_TOKENS,
      temperature: 0.6,
      reasoning_effort: REASONING_EFFORT,
      tools: TOOLS,
    }),
  });
  if (!res.ok || !res.body) {
    const t = res.body ? await res.text() : '';
    throw new Error(`NVIDIA API 錯誤 ${res.status}：${t.slice(0, 300)}`);
  }
  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  const calls = new Map();  // 工具呼叫是分段送來的，依 index 拼起來
  let buffer = '';
  let done = false;
  while (!done) {
    const { value, done: fin } = await reader.read();
    if (fin) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') { done = true; break; }
      let chunk;
      try { chunk = JSON.parse(data); } catch (e) { continue; }
      if (!chunk.choices || !chunk.choices.length) continue;
      const delta = chunk.choices[0].delta || {};
      for (const [field, kind] of [['reasoning_content', 'reasoning'], ['reasoning', 'reasoning'], ['content', 'content']])
        if (delta[field]) send({ type: kind, text: delta[field] });
      for (const tc of delta.tool_calls || []) {
        const i = tc.index ?? 0;
        let c = calls.get(i);
        if (!c) { c = { id: '', type: 'function', function: { name: '', arguments: '' } }; calls.set(i, c); }
        if (tc.id) c.id = tc.id;
        const fn = tc.function || {};
        if (fn.name) c.function.name += fn.name;
        if (fn.arguments) c.function.arguments += fn.arguments;
      }
    }
  }
  return [...calls.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c);
}

// ---------- 路由 ----------

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors() },
});

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function handleChat(request, env) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        const key = env.NVIDIA_API_KEY;
        if (!key) throw new Error('Worker 找不到密鑰 NVIDIA_API_KEY。請執行：npx wrangler secret put NVIDIA_API_KEY');
        const body = await request.json();
        const messages = (body.messages || [])
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
          .map((m) => ({ role: m.role, content: String(m.content) }));
        if (!messages.length) throw new Error('格式不對：沒有對話內容');
        if (JSON.stringify(messages).length > MAX_BODY) throw new Error('對話太長了，請開新的對話');

        const convo = [{ role: 'system', content: await systemPrompt(env) }, ...messages];
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const calls = await streamRound(key, convo, send);
          if (!calls.length) break;
          // 模型要檢查：在 Worker 執行，把結果交回給模型，再讓它繼續
          convo.push({ role: 'assistant', content: '', tool_calls: calls });
          for (const call of calls) {
            let text = '';
            try { text = JSON.parse(call.function.arguments || '{}').text || ''; } catch (e) { /* 空的檢查結果 */ }
            const result = checkMinilang(text);
            send({ type: 'tool', ok: result.ok, chars: (result.out_of_set || []).map((x) => x.char) });
            convo.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
          }
        }
        send({ type: 'done' });
      } catch (e) {
        try { send({ type: 'error', text: e.message || String(e) }); } catch (f) { /* 使用者已關掉頁面 */ }
      } finally {
        try { controller.close(); } catch (e) { /* 已經關了 */ }
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', ...cors() },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });
    if (pathname === '/api/status') return json({ model: MODEL, reasoning_effort: REASONING_EFFORT, key: !!env.NVIDIA_API_KEY });
    if (pathname === '/api/chat') {
      if (request.method !== 'POST') return json({ error: '請用 POST' }, 405);
      const length = Number(request.headers.get('Content-Length') || 0);
      if (length > MAX_BODY) return json({ error: '對話太長了，請開新的對話' }, 413);
      return handleChat(request, env);
    }
    // 首頁轉到專家頁面；其他交給靜態資產
    if (pathname === '/') return Response.redirect(new URL('/mini-lang-expert.html', request.url), 302);
    return env.ASSETS.fetch(request);
  },
};
