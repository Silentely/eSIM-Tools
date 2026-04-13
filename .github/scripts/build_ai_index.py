#!/usr/bin/env python3
import argparse
import hashlib
import json
import math
import os
import pathlib
import re
import sys
import urllib.request

TEXT_EXTS = {
    ".md", ".mdx", ".rst", ".txt", ".yml", ".yaml", ".json", ".toml", ".ini", ".env",
    ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".java", ".rs", ".rb", ".php",
    ".c", ".h", ".cpp", ".hpp", ".swift", ".kt", ".vue", ".sh", ".bash", ".zsh"
}

IGNORE_DIRS = {
    ".git", "node_modules", "dist", "build", "coverage", ".next", ".nuxt", ".turbo",
    "__pycache__", ".venv", "venv", "vendor", "target", "out"
}

def sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()

def read_text(path: pathlib.Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""

def tokenize(text: str):
    return re.findall(r"[A-Za-z0-9_./:#-]{3,}", text.lower())

def file_weight(path: str) -> int:
    p = path.lower()
    score = 1
    if "readme" in p or "changelog" in p or "/docs/" in p or p.startswith("docs/"):
        score += 5
    if ".env.example" in p or "config" in p or "docker-compose" in p:
        score += 4
    if "/src/" in p or p.startswith("src/"):
        score += 3
    if "/packages/" in p or p.startswith("packages/"):
        score += 3
    if "/app/" in p or p.startswith("app/"):
        score += 2
    if "/tests/" in p or p.startswith("tests/"):
        score += 1
    return score

def iter_files(root: pathlib.Path, max_files: int):
    count = 0
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for f in files:
            path = pathlib.Path(base) / f
            rel = path.relative_to(root).as_posix()
            if path.suffix.lower() not in TEXT_EXTS and not f.startswith("README"):
                continue
            yield path, rel
            count += 1
            if count >= max_files:
                return

def chunk_lines(text: str, max_chunk_chars: int):
    lines = text.splitlines()
    chunks = []
    buf = []
    start = 1
    cur = 0
    for i, line in enumerate(lines, start=1):
        line_len = len(line) + 1
        if buf and cur + line_len > max_chunk_chars:
            chunks.append((start, i - 1, "\n".join(buf)))
            buf = [line]
            start = i
            cur = line_len
        else:
            if not buf:
                start = i
            buf.append(line)
            cur += line_len
    if buf:
        chunks.append((start, len(lines), "\n".join(buf)))
    return chunks

def summarize_chunk(rel, chunk):
    header = rel
    first_lines = "\n".join(chunk.splitlines()[:12]).strip()
    return f"{header}\n{first_lines}"[:800]

def embed_texts(base_url, api_key, model, texts):
    url = base_url.rstrip("/") + "/embeddings"
    payload = json.dumps({
        "model": model,
        "input": texts
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
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return [item["embedding"] for item in data["data"]]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo-root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--embedding-out", default="")
    ap.add_argument("--embedding-api-key", default="")
    ap.add_argument("--embedding-base-url", default="")
    ap.add_argument("--embedding-model", default="")
    ap.add_argument("--max-files", type=int, default=1200)
    ap.add_argument("--max-chunk-chars", type=int, default=1800)
    args = ap.parse_args()

    root = pathlib.Path(args.repo_root).resolve()
    out_path = pathlib.Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    embedding_rows = []

    for path, rel in iter_files(root, args.max_files):
        text = read_text(path)
        if not text.strip():
            continue

        chunks = chunk_lines(text, args.max_chunk_chars)
        weight = file_weight(rel)

        for start, end, chunk in chunks:
            tokens = tokenize(chunk)
            if len(tokens) < 3:
                continue

            row = {
                "id": sha1(f"{rel}:{start}:{end}:{sha1(chunk)}"),
                "path": rel,
                "start_line": start,
                "end_line": end,
                "weight": weight,
                "token_count": len(tokens),
                "keywords": sorted(list(set(tokens[:120]))),
                "summary": summarize_chunk(rel, chunk),
                "text": chunk[:3000]
            }
            rows.append(row)

    with out_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    manifest = {
        "version": 1,
        "chunks": len(rows),
        "max_files": args.max_files,
        "max_chunk_chars": args.max_chunk_chars
    }
    pathlib.Path(args.manifest).write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    if args.embedding_out and args.embedding_api_key and args.embedding_base_url and args.embedding_model:
        texts = []
        metas = []
        for row in rows:
            texts.append(f"{row['path']} lines {row['start_line']}-{row['end_line']}\n{row['summary']}\n{row['text'][:1200]}")
            metas.append({
                "id": row["id"],
                "path": row["path"],
                "start_line": row["start_line"],
                "end_line": row["end_line"],
                "weight": row["weight"]
            })

        emb_out = pathlib.Path(args.embedding_out)
        with emb_out.open("w", encoding="utf-8") as f:
            batch_size = 32
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i+batch_size]
                vecs = embed_texts(args.embedding_base_url, args.embedding_api_key, args.embedding_model, batch)
                for meta, vec in zip(metas[i:i+batch_size], vecs):
                    item = dict(meta)
                    item["embedding"] = vec
                    f.write(json.dumps(item, ensure_ascii=False) + "\n")

if __name__ == "__main__":
    main()