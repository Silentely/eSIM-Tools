#!/usr/bin/env python3
import argparse
import json
import math
import pathlib
import re
import urllib.request
from typing import Dict, List, Tuple


TEXT_EXTS = {
    ".md", ".mdx", ".rst", ".txt", ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".java",
    ".rs", ".php", ".rb", ".yml", ".yaml", ".json", ".toml", ".sh", ".vue"
}


def tokenize(text: str) -> List[str]:
    return re.findall(r"[A-Za-z0-9_./:#-]{3,}", text.lower())


def load_json(path: str) -> Dict:
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def score_keywords(query_tokens: set, keywords: List[str], weight: int = 1) -> float:
    if not query_tokens:
        return 0.0

    kw = set([k.lower() for k in (keywords or [])])
    inter = len(query_tokens & kw)
    union = max(len(query_tokens | kw), 1)

    return inter * 4 + (inter / union) * 100 + weight * 3


def dot(a: List[float], b: List[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def norm(a: List[float]) -> float:
    return math.sqrt(sum(x * x for x in a))


def cosine_similarity(a: List[float], b: List[float]) -> float:
    na = norm(a)
    nb = norm(b)
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot(a, b) / (na * nb)


def embed_text(base_url: str, api_key: str, model: str, text: str) -> List[float]:
    url = base_url.rstrip("/") + "/embeddings"
    payload = json.dumps({
        "model": model,
        "input": [text]
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        },
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    items = data.get("data")
    if not isinstance(items, list) or not items:
        raise RuntimeError("Invalid embedding response")

    vec = items[0].get("embedding")
    if not isinstance(vec, list):
        raise RuntimeError("Missing embedding vector")

    return vec


def build_query_text(rewrite: Dict, issue: Dict) -> str:
    parts = []
    parts.extend(rewrite.get("search_queries", []))
    parts.extend(rewrite.get("keywords", []))
    parts.extend(rewrite.get("components", []))
    parts.extend(rewrite.get("likely_paths", []))
    parts.append(issue.get("title", ""))
    parts.append(issue.get("body", ""))
    return "\n".join([p for p in parts if isinstance(p, str) and p.strip()])


def emit_rows(rows: List[Dict], max_chars: int):
    parts = []
    cur = 0
    seen = set()

    for row in rows:
        key = (row["path"], row["start_line"], row["end_line"])
        if key in seen:
            continue
        seen.add(key)

        block = f"--- FILE: {row['path']} (lines {row['start_line']}-{row['end_line']}) ---\n{row['text']}\n"
        if cur + len(block) > max_chars:
            break
        parts.append(block)
        cur += len(block)

    print("\n".join(parts))


def retrieve_from_index(index_path: str, rewrite: Dict, issue: Dict, max_chars: int):
    query_text = build_query_text(rewrite, issue)
    q = set(tokenize(query_text))

    rows = []
    with open(index_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            row["score"] = score_keywords(q, row.get("keywords"), row.get("weight", 1))
            rows.append(row)

    rows.sort(key=lambda x: (-x["score"], x["path"], x["start_line"]))
    emit_rows(rows[:20], max_chars)


def retrieve_from_index_with_embeddings(
    index_path: str,
    embedding_index_path: str,
    rewrite: Dict,
    issue: Dict,
    max_chars: int,
    embedding_api_key: str,
    embedding_base_url: str,
    embedding_model: str
):
    query_text = build_query_text(rewrite, issue)
    q_tokens = set(tokenize(query_text))
    q_vec = embed_text(embedding_base_url, embedding_api_key, embedding_model, query_text)

    base_rows: Dict[str, Dict] = {}
    with open(index_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            row = json.loads(line)
            base_rows[row["id"]] = row

    scored = []
    with open(embedding_index_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            item = json.loads(line)
            rid = item.get("id")
            if rid not in base_rows:
                continue
            base = base_rows[rid]
            emb = item.get("embedding")
            if not isinstance(emb, list):
                continue

            sim = cosine_similarity(q_vec, emb)
            kw_score = score_keywords(q_tokens, base.get("keywords"), base.get("weight", 1))
            fused = sim * 100 + kw_score

            row = dict(base)
            row["score"] = fused
            scored.append(row)

    scored.sort(key=lambda x: (-x["score"], x["path"], x["start_line"]))
    emit_rows(scored[:20], max_chars)


def retrieve_from_repo(repo_root: str, rewrite: Dict, issue: Dict, max_chars: int):
    root = pathlib.Path(repo_root)
    query_terms = rewrite.get("keywords", []) + rewrite.get("components", []) + rewrite.get("likely_paths", [])
    query_terms = [x for x in query_terms if isinstance(x, str) and x.strip()]

    rows = []

    for path in root.rglob("*"):
        if not path.is_file():
            continue

        rel = path.relative_to(root).as_posix()
        if any(part in rel for part in [".git/", "node_modules/", "dist/", "build/", "coverage/", ".next/", ".nuxt/"]):
            continue

        if path.suffix.lower() not in TEXT_EXTS and not path.name.startswith("README") and not path.name.startswith("CHANGELOG"):
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        lower = text.lower()
        score = 0
        for t in query_terms:
            tl = t.lower()
            if tl in lower:
                score += 2
            if tl in rel.lower():
                score += 4

        if score <= 0:
            continue

        lines = text.splitlines()
        for i, line in enumerate(lines):
            ls = line.lower()
            hit = 0
            for t in query_terms:
                if t.lower() in ls:
                    hit += 1
            if hit <= 0:
                continue

            start = max(0, i - 18)
            end = min(len(lines), i + 19)
            block = "\n".join(f"{j+1:>5}: {lines[j]}" for j in range(start, end))
            rows.append({
                "path": rel,
                "start_line": start + 1,
                "end_line": end,
                "text": block,
                "score": score + hit * 5
            })

    rows.sort(key=lambda x: (-x["score"], x["path"], x["start_line"]))
    emit_rows(rows[:20], max_chars)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="")
    ap.add_argument("--embedding-index", default="")
    ap.add_argument("--repo-root", default="")
    ap.add_argument("--rewrite", required=True)
    ap.add_argument("--issue", required=True)
    ap.add_argument("--max-chars", type=int, default=50000)
    ap.add_argument("--embedding-api-key", default="")
    ap.add_argument("--embedding-base-url", default="")
    ap.add_argument("--embedding-model", default="")
    args = ap.parse_args()

    rewrite = load_json(args.rewrite)
    issue = load_json(args.issue)

    if args.index and args.embedding_index and args.embedding_api_key and args.embedding_base_url and args.embedding_model:
        retrieve_from_index_with_embeddings(
            args.index,
            args.embedding_index,
            rewrite,
            issue,
            args.max_chars,
            args.embedding_api_key,
            args.embedding_base_url,
            args.embedding_model
        )
        return

    if args.index:
        retrieve_from_index(args.index, rewrite, issue, args.max_chars)
        return

    if args.repo_root:
        retrieve_from_repo(args.repo_root, rewrite, issue, args.max_chars)
        return

    print("")


if __name__ == "__main__":
    main()