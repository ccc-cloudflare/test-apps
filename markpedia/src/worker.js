// markpedia 的 Cloudflare Worker：
//   /api/*  百科條目的新增、修改、刪除、查詢（D1；每個條目有 zh 繁中版與 en 英文版）
//   其他    靜態檔案（public/，由 Assets 提供）
//   資料表第一次使用時，會自動把 public/seed/ 的範例條目灌進去（見 ensureSeed）

const SEED = [
  { slug: 'markpedia', lang: 'zh', title: 'Markpedia' },
  { slug: 'markpedia', lang: 'en', title: 'Markpedia' },
  { slug: 'markdown', lang: 'zh', title: 'Markdown 記法' },
  { slug: 'markdown', lang: 'en', title: 'Markdown syntax' },
  { slug: 'cloudflare-workers', lang: 'zh', title: 'Cloudflare Workers' },
  { slug: 'cloudflare-workers', lang: 'en', title: 'Cloudflare Workers' },
  { slug: 'mass-energy-equivalence', lang: 'zh', title: '質能等價' },
  { slug: 'mass-energy-equivalence', lang: 'en', title: 'Mass–energy equivalence' },
  { slug: 'mermaid', lang: 'zh', title: 'Mermaid 圖表' },
  { slug: 'mermaid', lang: 'en', title: 'Mermaid diagrams' },
  { slug: 'home', lang: 'zh', title: '入口' },
  { slug: 'home', lang: 'en', title: 'Home portal' },
  { slug: 'cat-tian', lang: 'zh', title: '天學門' },
  { slug: 'cat-tian', lang: 'en', title: '天 & Astronomy and Space' },
  { slug: 'cat-astronomy', lang: 'zh', title: '天文' },
  { slug: 'cat-astronomy', lang: 'en', title: 'Observational astronomy' },
  { slug: 'cat-space', lang: 'zh', title: '太空科技' },
  { slug: 'cat-space', lang: 'en', title: 'Space technology' },
  { slug: 'cat-di', lang: 'zh', title: '地學門' },
  { slug: 'cat-di', lang: 'en', title: '地 & Earth and Ocean' },
  { slug: 'cat-geology', lang: 'zh', title: '地質' },
  { slug: 'cat-geology', lang: 'en', title: 'Geology' },
  { slug: 'cat-ocean', lang: 'zh', title: '海洋' },
  { slug: 'cat-ocean', lang: 'en', title: 'Oceanography' },
  { slug: 'cat-wen', lang: 'zh', title: '文學門' },
  { slug: 'cat-wen', lang: 'en', title: '文 & Humanities and Languages' },
  { slug: 'cat-literature', lang: 'zh', title: '文學' },
  { slug: 'cat-literature', lang: 'en', title: 'Literature' },
  { slug: 'cat-languages', lang: 'zh', title: '語言' },
  { slug: 'cat-languages', lang: 'en', title: 'Languages' },
  { slug: 'cat-fa', lang: 'zh', title: '法學門' },
  { slug: 'cat-fa', lang: 'en', title: '法 & Law and Politics' },
  { slug: 'cat-law', lang: 'zh', title: '法律' },
  { slug: 'cat-law', lang: 'en', title: 'Law' },
  { slug: 'cat-politics', lang: 'zh', title: '政治' },
  { slug: 'cat-politics', lang: 'en', title: 'Politics' },
  { slug: 'cat-shang', lang: 'zh', title: '商學門' },
  { slug: 'cat-shang', lang: 'en', title: '商 & Business and Economics' },
  { slug: 'cat-economics', lang: 'zh', title: '經濟' },
  { slug: 'cat-economics', lang: 'en', title: 'Economics' },
  { slug: 'cat-management', lang: 'zh', title: '經營管理' },
  { slug: 'cat-management', lang: 'en', title: 'Management' },
  { slug: 'cat-li', lang: 'zh', title: '理學門' },
  { slug: 'cat-li', lang: 'en', title: '理 & Natural Sciences' },
  { slug: 'cat-math', lang: 'zh', title: '數學' },
  { slug: 'cat-math', lang: 'en', title: 'Mathematics' },
  { slug: 'cat-physics', lang: 'zh', title: '物理學' },
  { slug: 'cat-physics', lang: 'en', title: 'Physics' },
  { slug: 'cat-gong', lang: 'zh', title: '工學門' },
  { slug: 'cat-gong', lang: 'en', title: '工 & Engineering and Technology' },
  { slug: 'cat-info-tech', lang: 'zh', title: '資訊技術' },
  { slug: 'cat-info-tech', lang: 'en', title: 'Information technology' },
  { slug: 'cat-mechanic', lang: 'zh', title: '機械製造' },
  { slug: 'cat-mechanic', lang: 'en', title: 'Mechanical engineering' },
  { slug: 'cat-yi', lang: 'zh', title: '醫學門' },
  { slug: 'cat-yi', lang: 'en', title: '醫 & Medicine and Health' },
  { slug: 'cat-medicine', lang: 'zh', title: '醫學' },
  { slug: 'cat-medicine', lang: 'en', title: 'Medicine' },
  { slug: 'cat-public-health', lang: 'zh', title: '公共衛生' },
  { slug: 'cat-public-health', lang: 'en', title: 'Public health' },
  { slug: 'cat-nong', lang: 'zh', title: '農學門' },
  { slug: 'cat-nong', lang: 'en', title: '農 & Agriculture and Biology' },
  { slug: 'cat-farming', lang: 'zh', title: '農業' },
  { slug: 'cat-farming', lang: 'en', title: 'Farming' },
  { slug: 'cat-biology', lang: 'zh', title: '生物' },
  { slug: 'cat-biology', lang: 'en', title: 'Biology' },
];

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const LANGS = ['zh', 'en'];

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function readJson(request) {
  try { return await request.json(); } catch (e) { throw new HttpError(400, 'JSON 格式不正確'); }
}

async function handle(fn) {
  try { return await fn(); } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: `伺服器錯誤：${e.message}` }, 500);
  }
}

function failIfInvalid(slug, lang, title, body) {
  if (!SLUG_RE.test(slug)) throw new HttpError(400, 'slug 只能用小寫英文、數字與 -，長度 1～80');
  if (!LANGS.includes(lang)) throw new HttpError(400, 'lang 必須是 zh 或 en');
  if (!title || title.length > 200) throw new HttpError(400, 'title 需要 1～200 字');
  if (typeof body !== 'string' || !body.trim()) throw new HttpError(400, '內容不能是空的');
  if (body.length > 100_000) throw new HttpError(400, '內容最長 100000 字');
}

// 資料表是空的才灌範例條目；內容從 public/seed/ 的原始檔讀來
async function ensureSeed(db, assets) {
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM entries').first();
  if (n > 0) return;
  for (const doc of SEED) {
    const res = await assets.fetch(new Request(`https://self/seed/${doc.slug}.${doc.lang}.md`));
    const body = await res.text();
    await db.prepare('INSERT INTO entries (slug, lang, title, body) VALUES (?, ?, ?, ?)')
      .bind(doc.slug, doc.lang, doc.title, body).run();
  }
}

const entryOut = (row) => ({
  slug: row.slug,
  lang: row.lang,
  title: row.title,
  body: row.body,
  updatedAt: row.updated_at,
});

async function listEntries(db, params) {
  const conds = [];
  const binds = [];
  const lang = params.get('lang');
  if (lang) {
    if (!LANGS.includes(lang)) throw new HttpError(400, 'lang 必須是 zh 或 en');
    conds.push('lang = ?');
    binds.push(lang);
  }
  const q = (params.get('q') || '').trim();
  if (q) {
    conds.push('(title LIKE ? OR body LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`);
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const { results } = await db.prepare(
    `SELECT slug, lang, title, updated_at FROM entries${where} ORDER BY slug, lang`,
  ).bind(...binds).all();
  return json({
    entries: results.map((r) => ({
      slug: r.slug,
      lang: r.lang,
      title: r.title,
      updatedAt: r.updated_at,
    })),
  });
}

async function getEntry(db, slug, params) {
  let row = await db.prepare(
    'SELECT slug, lang, title, body, updated_at FROM entries WHERE slug = ? AND lang = ?',
  ).bind(slug, params.get('lang') || 'zh').first();
  if (!row) {
    // 指定的語言版本不存在時，退回這個條目現存的任一語言版本
    row = await db.prepare(
      'SELECT slug, lang, title, body, updated_at FROM entries WHERE slug = ? ORDER BY lang LIMIT 1',
    ).bind(slug).first();
  }
  if (!row) throw new HttpError(404, '找不到條目');
  const { results: langRows } = await db.prepare('SELECT lang, title FROM entries WHERE slug = ?')
    .bind(slug).all();
  return json({
    entry: entryOut(row),
    langs: Object.fromEntries(langRows.map((r) => [r.lang, r.title])),
  });
}

async function createEntry(request, db) {
  const data = await readJson(request);
  failIfInvalid(data.slug, data.lang, data.title, data.body);
  const exists = await db.prepare('SELECT 1 AS x FROM entries WHERE slug = ? AND lang = ?')
    .bind(data.slug, data.lang).first();
  if (exists) throw new HttpError(409, `條目已存在：${data.slug}（${data.lang} 版）`);
  const row = await db.prepare(
    'INSERT INTO entries (slug, lang, title, body) VALUES (?, ?, ?, ?) RETURNING slug, lang, title, body, updated_at',
  ).bind(data.slug, data.lang, data.title, data.body).first();
  return json(entryOut(row), 201);
}

async function updateEntry(request, db, slug) {
  const data = await readJson(request);
  failIfInvalid(slug, data.lang, data.title, data.body);
  const row = await db.prepare(
    "UPDATE entries SET title = ?, body = ?, updated_at = datetime('now') WHERE slug = ? AND lang = ? RETURNING slug, lang, title, body, updated_at",
  ).bind(data.title, data.body, slug, data.lang).first();
  if (!row) throw new HttpError(404, '找不到要修改的條目');
  return json(entryOut(row));
}

async function deleteEntry(db, slug, params) {
  const lang = params.get('lang');
  if (lang && LANGS.includes(lang)) {
    const r = await db.prepare('DELETE FROM entries WHERE slug = ? AND lang = ?').bind(slug, lang).run();
    return json({ deleted: r.meta.changes });
  }
  // 沒指定 lang 就刪掉整個條目（所有語言版本）
  const r = await db.prepare('DELETE FROM entries WHERE slug = ?').bind(slug).run();
  return json({ deleted: r.meta.changes });
}

async function randomEntry(db) {
  let row = await db.prepare("SELECT slug FROM entries WHERE lang = 'zh' ORDER BY RANDOM() LIMIT 1").first();
  if (!row) row = await db.prepare('SELECT slug FROM entries ORDER BY RANDOM() LIMIT 1').first();
  if (!row) throw new HttpError(404, '還沒有任何條目');
  return json(row);
}

export default {
  async fetch(request, env) {
    return handle(async () => {
      const url = new URL(request.url);
      const path = url.pathname;
      if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

      await ensureSeed(env.DB, env.ASSETS);

      switch (`${request.method} ${path}`) {
        case 'GET /api/entries': return listEntries(env.DB, url.searchParams);
        case 'POST /api/entries': return createEntry(request, env.DB);
        case 'GET /api/random': return randomEntry(env.DB);
      }
      const segs = path.split('/').filter(Boolean);
      if (segs.length === 3 && segs[1] === 'entry') {
        const slug = segs[2];
        if (!SLUG_RE.test(slug)) throw new HttpError(404, '找不到這個 API');
        switch (request.method) {
          case 'GET': return getEntry(env.DB, slug, url.searchParams);
          case 'PUT': return updateEntry(request, env.DB, slug);
          case 'DELETE': return deleteEntry(env.DB, slug, url.searchParams);
        }
      }
      throw new HttpError(404, '找不到這個 API');
    });
  },
};
