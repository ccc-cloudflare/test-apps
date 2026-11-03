// aichat 的 Cloudflare Worker：
//   POST /api/proxy  把瀏覽器的 OpenAI 相容請求（含使用者自己的金鑰）轉發給 LLM 供應商，
//                    回應原樣穿透轉發，不解析、不儲存
//   其他路徑         靜態檔案（public/，由 Assets 提供）
//
// BYOK（Bring Your Own Key）：金鑰由使用者在網頁上輸入、存在瀏覽器的 localStorage，
// 每次請求隨訊息送到這個 Worker、直接放進轉發的標頭，Worker 不儲存、不記錄金鑰。
// 因此這個 Worker 沒有任何 secret，部署後任何人都能用（用的人自己帶金鑰）。

// 允許轉發的目的地主機：OpenAI 相容的 chat/completions 端點。
// 不做白名單的話，這個 Worker 會變成任人使用的公開代理（SSRF / 濫用風險）。
const DEFAULT_HOSTS = [
  'integrate.api.nvidia.com',
  'api.openai.com',
  'api.deepseek.com',
  'openrouter.ai',
  'generativelanguage.googleapis.com',
  'open.bigmodel.cn',
  'api.moonshot.cn',
];

const MAX_BODY = 200_000;  // 一次請求的訊息最多約 20 萬字元

function allowedHosts(env) {
  if (env.ALLOWED_HOSTS) return env.ALLOWED_HOSTS.split(',').map((s) => s.trim()).filter(Boolean);
  return DEFAULT_HOSTS;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

async function handleProxy(request, env) {
  if (request.method !== 'POST') return json({ error: '請用 POST' }, 405);
  let req;
  try {
    req = await request.json();
  } catch (e) {
    return json({ error: '格式不對' }, 400);
  }
  const { url: target, key, body } = req;
  if (typeof target !== 'string' || typeof body !== 'object' || !body) return json({ error: '缺少 url 或 body' }, 400);

  // 只允許白名單主機的 https 端點
  let parsed;
  try {
    parsed = new URL(target);
  } catch (e) {
    return json({ error: 'url 不對' }, 400);
  }
  if (parsed.protocol !== 'https:') return json({ error: '只允許 https' }, 400);
  if (!allowedHosts(env).includes(parsed.hostname)) {
    return json({ error: `不允許的主機 ${parsed.hostname}。這個代理只轉發到指定的 LLM 供應商。` }, 403);
  }
  const payload = JSON.stringify(req).length > MAX_BODY;
  if (payload) return json({ error: '對話太長了，請開新的對話' }, 413);

  const headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
  if (key) headers.Authorization = `Bearer ${key}`;  // 金鑰只放進轉發的標頭

  const upstream = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  // 回應原樣穿透：瀏覽器自己解析 SSE，Worker 不碰內容（CPU 幾乎為零）
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/proxy') return handleProxy(request, env);
    if (pathname === '/') return Response.redirect(new URL('/index.html', request.url), 302);
    return env.ASSETS.fetch(request);
  },
};
