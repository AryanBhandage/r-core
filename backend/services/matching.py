"""ML matching: KNN baseline (scikit-learn) + XGBoost proposed model.

RESEARCH INTEGRITY: the models are trained on a small DEVELOPMENT CALIBRATION
set because no real labelled candidate/job dataset is available. Results run in
development mode and must NOT be presented as validated scientific accuracy.
A real dataset can be supplied later by replacing `_CALIBRATION`.
"""
from __future__ import annotations
from services.features import compute_features, to_array, FEATURE_ORDER

# Development calibration set: [features..., score]
_CALIBRATION = [
    [0.9, 0.9, 0.95, 0.8, 1.0, 1.0, 0.8, 0.5, 92],
    [0.85, 0.85, 1.0, 0.7, 1.0, 1.0, 0.6, 0.4, 90],
    [0.78, 0.78, 0.85, 0.65, 0.9, 1.0, 0.7, 0.35, 84],
    [0.75, 0.75, 0.8, 0.6, 0.9, 1.0, 0.7, 0.3, 82],
    [0.7, 0.7, 0.75, 0.5, 0.8, 1.0, 0.5, 0.3, 78],
    [0.6, 0.6, 0.6, 0.4, 0.7, 0.8, 0.5, 0.2, 70],
    [0.55, 0.55, 0.5, 0.3, 0.6, 0.8, 0.4, 0.1, 64],
    [0.45, 0.45, 0.4, 0.3, 0.5, 0.7, 0.3, 0.1, 55],
    [0.4, 0.4, 0.35, 0.2, 0.4, 0.6, 0.2, 0, 48],
    [0.3, 0.3, 0.25, 0.2, 0.3, 0.5, 0.2, 0, 40],
    [0.2, 0.2, 0.15, 0.1, 0.2, 0.4, 0.1, 0, 32],
    [0.95, 0.95, 1.0, 0.9, 1.0, 1.0, 0.9, 0.7, 96],
]

_knn = None
_xgb = None


def _models():
    global _knn, _xgb
    if _knn is None:
        from sklearn.neighbors import KNeighborsRegressor
        import numpy as np

        X = np.array([r[:-1] for r in _CALIBRATION])
        y = np.array([r[-1] for r in _CALIBRATION])
        _knn = KNeighborsRegressor(n_neighbors=5, weights="distance", metric="cosine")
        _knn.fit(X, y)

        try:
            from xgboost import XGBRegressor
            _xgb = XGBRegressor(
                n_estimators=80, max_depth=3, learning_rate=0.08,
                subsample=0.9, random_state=42,
            )
            _xgb.fit(X, y)
        except Exception:  # pragma: no cover
            _xgb = None
    return _knn, _xgb


def run_knn(candidate: dict, job: dict, match: dict) -> dict:
    knn, _ = _models()
    x = [match["candidate_vector"]]
    pred = float(knn.predict([to_array(match["features"])])[0])
    return {
        "score": round(max(0, min(100, pred)), 1),
        "model": "knn",
        "mode": "development",
        "k": knn.n_neighbors,
    }


def run_xgboost(candidate: dict, job: dict, match: dict) -> dict:
    _, xgb = _models()
    if xgb is None:
        raise RuntimeError("XGBoost is not available. Install xgboost or supply a model.")
    import numpy as np

    x = np.array([to_array(match["features"])])
    pred = float(xgb.predict(x)[0])
    importance = {}
    for name, imp in zip(FEATURE_ORDER, xgb.feature_importances_):
        importance[name] = round(float(imp), 4)
    return {
        "score": round(max(0, min(100, pred)), 1),
        "probability": round(max(0.0, min(1.0, pred / 100.0)), 4),
        "model": "xgboost",
        "mode": "development",
        "n_trees": len(xgb.get_booster().get_dump()),
        "feature_importance": importance,
    }


def build_match(candidate: dict, job: dict) -> dict:
    from utils.nlp import cosine

    fe = compute_features(candidate, job)
    f = fe["features"]
    overall = round(
        f["semantic_similarity"] * 30
        + f["skill_similarity"] * 25
        + f["experience_match"] * 15
        + f["project_relevance"] * 10
        + f["education_match"] * 10
        + (f["required_skill_match"] * 50 + f["preferred_skill_match"] * 50) * 0.1,
        1,
    )
    return {
        "overall_score": overall,
        "cosine_similarity": round(cosine(fe["candidate_vector"], fe["job_vector"]), 4),
        "features": f,
        "candidate_vector": fe["candidate_vector"],
        "job_vector": fe["job_vector"],
    }


def compare(candidate: dict, job: dict) -> dict:
    match = build_match(candidate, job)
    knn = run_knn(candidate, job, match)
    xgb = run_xgboost(candidate, job, match)
    return {
        "knn": knn,
        "xgboost": xgb,
        "cosine_similarity": match["cosine_similarity"],
        "features": match["features"],
        "overall_score": match["overall_score"],
        "model_evaluation": "pending",
        "methods": {
            "generative_ai": ["structured extraction", "explanation", "roadmap"],
            "machine_learning": ["KNN baseline", "XGBoost proposed"],
            "semantic_nlp": ["embeddings", "cosine similarity"],
            "deterministic_logic": ["skill coverage", "feature engineering", "skill gaps"],
        },
    }
