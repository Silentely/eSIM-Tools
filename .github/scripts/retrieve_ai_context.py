#!/usr/bin/env python3
import argparse
import json
import math
import os
import pathlib
import re
from collections import Counter

def tokenize(text: str):
    return re.findall(r"[A-Za-z0-9_./:#-]{3,}", text.lower())

def load_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))

def score_keywords(query_tokens, keywords, weight=1):
    if not query_tokens:
        return 0.0
    kw = set([k.lower() for k in keywords or []])
    inter = len(query_tokens & kw)
    union = max(len(query_tokens | kw), 1)
    return inter * 4 + (inter / union) * 100 + weight * 3

def emit_rows(rows, max_chars):
    parts = []
    cur = 0
    for row in rows:
        block = f"--- FILE: {row['path']} (lines {row['start_line']}-{row['end_line']}) ---\n{row['text']}\n"
        if cur + len(block) > max_chars:
            break
        parts.append(block)
        cur += len(block)
    print("\n".join(parts))

def retrieve_from_index(index_path, rewrite, issue, max_chars):
    queries = " ".join(rewrite.get("search_queries", []) + rewrite.get("keywords", []) + rewrite.get("components", []) + rewrite.get("likely_paths", []))
    q = set(tokenize(queries + "\n" + issue.get("title", "") + "\n" + issue.get("body", "")))

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

def retrieve_from_repo(repo_root, rewrite, issue, max_chars):
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
        if path.suffix.lower() not in {".md",".mdx",".rst",".txt",".js",".jsx",".ts",".tsx",".py",".go",".java",".rs",".php",".rb",".yml",".yaml",".json",".toml",".sh",".vue"} and not path.name.startswith("README"):
            continue

        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        lower = text.lower()
        score = 0
        for t in query_terms:
            if t.lower() in lower:
                score += 2
            if t.lower() in rel.lower():
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
    ap.add_argument("--repo-root", default="")
    ap.add_argument("--rewrite", required=True)
    ap.add_argument("--issue", required=True)
    ap.add_argument("--max-chars", type=int, default=50000)
    args = ap.parse_args()

    rewrite = load_json(args.rewrite)
    issue = load_json(args.issue)

    if args.index:
        retrieve_from_index(args.index, rewrite, issue, args.max_chars)
    else:
        retrieve_from_repo(args.repo_root, rewrite, issue, args.max_chars)

if __name__ == "__main__":
    main()