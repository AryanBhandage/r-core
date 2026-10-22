"""Modular NLP utilities: hashed embeddings, cosine similarity, text cleaning."""
from __future__ import annotations
import re
import math
from typing import List

DIM = 300


def tokenize(text: str) -> List[str]:
    text = text.lower().replace(".", " ")
    words = re.findall(r"[a-z0-9+#./-]+", text)
    return [w for w in words if len(w) > 1]


def fnv1a(s: str) -> float:
    h = 0x811C9DC5
    for ch in s:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return (h & 0xFFFFFFFF) / 0x100000000


def char_ngrams(text: str, n: int = 3) -> List[str]:
    clean = re.sub(r"[^a-z0-9]", "", text.lower())
    if len(clean) < n:
        return [clean]
    return [clean[i : i + n] for i in range(len(clean) - n + 1)]


def embed_text(text: str) -> List[float]:
    vec = [0.0] * DIM
    terms = tokenize(text)
    tf: dict = {}
    for t in terms:
        tf[t] = tf.get(t, 0) + 1
    for i in range(len(terms) - 1):
        bg = terms[i] + " " + terms[i + 1]
        tf[bg] = tf.get(bg, 0) + 1
    for g in char_ngrams(text):
        if len(g) == 3:
            k = "¤" + g
            tf[k] = tf.get(k, 0) + 1
    for term, count in tf.items():
        h = fnv1a(term)
        idx = int(h * DIM) % DIM
        sign = 1 if h > 0.5 else -1
        vec[idx] += sign * (1 + math.log(count))
    norm = math.sqrt(sum(v * v for v in vec))
    if norm == 0:
        return [0.0] * DIM
    return [v / norm for v in vec]


def cosine(a: List[float], b: List[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)
