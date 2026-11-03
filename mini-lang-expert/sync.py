"""從 mini-lm 專案同步 Mini-Lang 的前端與資料（可選工具）。

這個應用是自包含的：public/ 與 src/generated.js 都是 commit 進 git 的原始檔，
正常開發與部署完全不需要這支程式。

只有當上游 mini-lm 專案（web/ 前端、mini-lang/ 的字表、詞典、提示詞）有更新，
想把最新版同步過來時才執行：
    MINILM_REPO=/path/to/mini-lm python3 sync.py

同步會覆蓋 public/ 下已經在這裡改過的檔案，執行前先確認沒有本地的修改。
"""
import csv
import glob
import json
import os
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get('MINILM_REPO') or HERE.parents[2] / 'mini-lm')
WEB = ROOT / 'web'
MINILANG = ROOT / 'mini-lang'
PROMPTS = MINILANG / 'prompts'
LEXICON = MINILANG / 'lexicon'
PUBLIC = HERE / 'public'
SRC = HERE / 'src'
GITHUB = 'https://github.com/ccc-claude-opus/mini-lm/blob/main/mini-lang'

sys.path.insert(0, str(MINILANG))
from check import DOC, load_charset  # noqa: E402

# mini-lm/web 中要複製到 public/ 的檔案（同步後這裡的檔案就是原始檔）
COPY = ['minilang.js', 'mt.js', 'style.css', 'app.js', 'index.html', 'mini-lang-expert.html']


def section(path):
    """提示詞檔案中兩條「---」之間的內容。"""
    return path.read_text(encoding='utf-8').split('\n---\n')[1].strip()


def lexicon_rows():
    rows = []
    for path in sorted(glob.glob(str(LEXICON / '*.tsv'))):
        with open(path, encoding='utf-8') as f:
            rows.extend(csv.DictReader(f, delimiter='\t'))
    return rows


def lexicon_appendix():
    """整份詞典，一行一個：一般中文 → Mini-Lang（外來語附上第一次出現時的說明）。"""
    lines = []
    for r in lexicon_rows():
        if r['中文'] == r['Mini-Lang']:
            continue  # 本詞不用查
        note = f"（{r['說明']}）" if r['說明'] else ''
        lines.append(f"{r['中文']} → {r['Mini-Lang']}{note}")
    return '## 附錄：詞典（一般中文 → Mini-Lang）\n\n' + '\n'.join(lines)


def system_prompt():
    return '\n\n'.join([section(PROMPTS / 'system.md'), section(PROMPTS / 'expert.md'), lexicon_appendix()])


def pinyin():
    with open(MINILANG / 'pinyin.tsv', encoding='utf-8') as f:
        return {r['詞']: r['拼音'] for r in csv.DictReader(f, delimiter='\t')}


def examples():
    """examples.md 的範例：中文 → Mini-Lang 取「原文」，Mini-Lang → 中文 取「Mini-Lang 原文」。"""
    text = (MINILANG / 'examples.md').read_text(encoding='utf-8')
    out = []
    for m in re.finditer(r'### 範例 \d+：(.+?)\n(.*?)(?=\n### |\n## |\Z)', text, re.S):
        title, body = m.group(1), m.group(2)
        zh = re.search(r'^原文：\n\n```text\n(.*?)\n```', body, re.S | re.M)
        mini = re.search(r'^Mini-Lang 原文：\n\n```zh\n(.*?)\n```', body, re.S | re.M)
        if zh:
            out.append({'title': title, 'dir': 'to-mini', 'text': zh.group(1)})
        elif mini:
            out.append({'title': title, 'dir': 'to-zh', 'text': mini.group(1)})
    return out


def charset_groups():
    """附錄字表的分類：[[類別, 字…]]。"""
    m = re.search(r'## 附錄：完整字表.*?```text\n(.*?)```', DOC.read_text(encoding='utf-8'), re.S)
    groups = []
    for line in m.group(1).splitlines():
        if line.startswith('#'):
            groups.append([line.lstrip('# ').strip(), ''])
        elif line.strip():
            groups[-1][1] += line.strip()
    return groups


def copy_frontend():
    PUBLIC.mkdir(exist_ok=True)
    for name in COPY:
        src, dst = WEB / name, PUBLIC / name
        if not src.exists():
            sys.exit(f'❌ 找不到 {src}')
        text = src.read_text(encoding='utf-8')
        # 部署後 ../mini-lang/ 這種相對路徑不存在，改成 GitHub 上的連結
        text = re.sub(r'href="\.\./mini-lang/([\w.-]+)"', rf'href="{GITHUB}/\1"', text)
        # 本機伺服器專用的訊息，改成 Worker 版的說法
        text = text.replace('連不上本機伺服器。請先執行：python web/expert_server.py',
                            '連不上 Worker。請確認已部署，並用 wrangler secret put NVIDIA_API_KEY 設定金鑰。')
        text = text.replace('伺服器找不到 NVIDIA_API_KEY，請在啟動伺服器的終端機設定這個環境變數。',
                            'Worker 找不到 NVIDIA_API_KEY。請執行：npx wrangler secret put NVIDIA_API_KEY')
        dst.write_text(text, encoding='utf-8')
    return len(COPY)


def write_data_js(charset):
    data = {
        'charset': charset,
        'groups': charset_groups(),
        'lexicon': [[r['中文'], r['Mini-Lang'], r['說明'], r['方式']] for r in lexicon_rows()],
        'pinyin': pinyin(),
        'examples': examples(),
    }
    (PUBLIC / 'data.js').write_text('// 從 mini-lm 專案同步（sync.py）；同步之後這裡就是原始檔，可以手改\nconst DATA = '
                                    + json.dumps(data, ensure_ascii=False) + ';\n', encoding='utf-8')
    return data


def write_generated(charset, rows, prompt):
    SRC.mkdir(exist_ok=True)
    out = ['// 從 mini-lm 專案同步（sync.py）；同步之後這裡就是原始檔，可以手改']
    for name, value in [('CHARSET', charset), ('SYSTEM_PROMPT', prompt)]:
        out.append(f'export const {name} = {json.dumps(value, ensure_ascii=False)};')
    out.append(f'export const LEXICON = {json.dumps([[r["中文"], r["Mini-Lang"]] for r in rows], ensure_ascii=False)};')
    (SRC / 'generated.js').write_text('\n'.join(out) + '\n', encoding='utf-8')


def main():
    charset = load_charset(DOC.read_text(encoding='utf-8'))
    n_copy = copy_frontend()
    data = write_data_js(charset)
    rows = lexicon_rows()
    prompt = system_prompt()
    write_generated(charset, rows, prompt)
    print(f'✅ public/：複製 {n_copy} 個檔案、data.js（字表 {len(charset)} 字、詞典 {len(data["lexicon"])} 條、'
          f'讀音 {len(data["pinyin"])} 條、範例 {len(data["examples"])} 段）')
    print(f'✅ src/generated.js：系統提示詞 {len(prompt)} 字元')


if __name__ == '__main__':
    main()
