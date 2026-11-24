"""Baseline kategorisasi transaksi: keterangan -> kategori.

Model: TF-IDF (kata 1-2 gram + karakter 2-5 gram) + Logistic Regression.
Pembanding: DummyClassifier (selalu kategori terbanyak).

Dua skema evaluasi:
  - random   : split acak terstratifikasi 80/20. Pola kalimat uji sudah pernah dilihat (optimistis).
  - template : ~25% template per kategori disembunyikan dari data latih. Mengukur generalisasi
               ke cara menulis yang belum pernah dilihat (lebih jujur).
Model dilatih dengan `category` (mengandung 2% label salah, seperti input manual) dan dinilai
terhadap `true_category`.

Pemakaian:
    python ml/src/train_categorizer.py --data ml/data/transactions.csv
Hasil: ml/reports/categorizer_metrics.json, ml/reports/categorizer_confusion.png, ml/models/categorizer.joblib
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import GroupKFold, GridSearchCV, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline

SEED = 42


def model_input(df: pd.DataFrame) -> pd.Series:
    # Di aplikasi, jenis transaksi (pemasukan/pengeluaran) dipilih sebelum kategori, jadi boleh dipakai sebagai fitur.
    return "tipe_" + df["type"].str.lower() + " " + df["note"].astype(str)


PARAM_GRID = {"clf__class_weight": [None, "balanced"], "clf__C": [0.5, 1.0, 5.0]}


def build_model() -> Pipeline:
    features = FeatureUnion([
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), lowercase=True, sublinear_tf=True, min_df=1)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True, sublinear_tf=True, min_df=2)),
    ])
    clf = LogisticRegression(C=1.0, max_iter=3000)
    return Pipeline([("features", features), ("clf", clf)])


def template_split(df: pd.DataFrame, frac: float = 0.25, seed: int = SEED):
    rng = random.Random(seed)
    held: set[str] = set()
    # Kelompokkan template menurut kategori asalnya (prefix template_id), bukan label yang mungkin sudah diberi noise.
    origin = df["template_id"].str.split("#").str[0]
    for cat, group in df.groupby(origin):
        templates = sorted(group["template_id"].unique())
        n = max(2, round(len(templates) * frac))
        held.update(rng.sample(templates, n))
    test_mask = df["template_id"].isin(held)
    return df[~test_mask], df[test_mask], sorted(held)


def evaluate(name: str, train: pd.DataFrame, test: pd.DataFrame) -> dict:
    labels = sorted(train["category"].unique())
    y_true = test["true_category"]
    out: dict = {"n_train": len(train), "n_test": len(test)}
    dummy = DummyClassifier(strategy="most_frequent").fit(model_input(train), train["category"])
    pred_d = dummy.predict(model_input(test))
    out["dummy"] = {"accuracy": accuracy_score(y_true, pred_d),
                    "macro_f1": f1_score(y_true, pred_d, average="macro", zero_division=0)}
    # Pilih hiperparameter hanya dari data latih: validasi silang per template (GroupKFold),
    # supaya pemilihan juga mengutamakan generalisasi ke pola kalimat baru. Data uji dipakai sekali.
    search = GridSearchCV(build_model(), PARAM_GRID, scoring="f1_macro", cv=GroupKFold(n_splits=4), n_jobs=-1)
    search.fit(model_input(train), train["category"], groups=train["template_id"])
    out["chosen_params"] = search.best_params_
    out["cv_macro_f1"] = search.best_score_
    model = search.best_estimator_
    pred = model.predict(model_input(test))
    out["tfidf_logreg"] = {
        "accuracy": accuracy_score(y_true, pred),
        "macro_f1": f1_score(y_true, pred, average="macro"),
        "per_class": classification_report(y_true, pred, labels=labels, output_dict=True, zero_division=0),
    }
    out["_confusion"] = (labels, confusion_matrix(y_true, pred, labels=labels))
    errors = test.assign(pred=pred)[lambda x: x["pred"] != x["true_category"]]
    out["sample_errors"] = errors.sample(min(8, len(errors)), random_state=SEED)[["note", "true_category", "pred"]].to_dict("records")
    print(f"[{name}] latih={len(train):,} uji={len(test):,} | dummy macro-F1={out['dummy']['macro_f1']:.3f} "
          f"| TF-IDF+LogReg acc={out['tfidf_logreg']['accuracy']:.3f} macro-F1={out['tfidf_logreg']['macro_f1']:.3f} "
          f"| dipilih {search.best_params_} (CV macro-F1 {search.best_score_:.3f})")
    return out


def plot_confusion(labels, cm, path: Path, title: str) -> None:
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(labels)), labels, rotation=35, ha="right")
    ax.set_yticks(range(len(labels)), labels)
    for i in range(len(labels)):
        for j in range(len(labels)):
            ax.text(j, i, cm[i, j], ha="center", va="center", color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=9)
    ax.set_xlabel("Prediksi")
    ax.set_ylabel("Label sebenarnya")
    ax.set_title(title)
    fig.tight_layout()
    fig.savefig(path, dpi=120)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="ml/data/transactions.csv")
    ap.add_argument("--reports", default="ml/reports")
    ap.add_argument("--models", default="ml/models")
    args = ap.parse_args()
    df = pd.read_csv(args.data)
    reports, models = Path(args.reports), Path(args.models)
    reports.mkdir(parents=True, exist_ok=True)
    models.mkdir(parents=True, exist_ok=True)

    tr, te = train_test_split(df, test_size=0.2, stratify=df["true_category"], random_state=SEED)
    res_random = evaluate("random", tr, te)
    tr2, te2, held = template_split(df)
    res_template = evaluate("template", tr2, te2)
    res_template["held_out_templates"] = held

    labels, cm = res_template.pop("_confusion")
    plot_confusion(labels, cm, reports / "categorizer_confusion.png", "Confusion matrix (split per template)")
    res_random.pop("_confusion")

    metrics = {"dataset": {"rows": len(df), "class_counts": df["category"].value_counts().to_dict()},
               "random_split": res_random, "template_split": res_template}
    (reports / "categorizer_metrics.json").write_text(json.dumps(metrics, indent=2, ensure_ascii=False, default=float), encoding="utf8")

    final = build_model().set_params(**res_template["chosen_params"]).fit(model_input(df), df["category"])
    joblib.dump(final, models / "categorizer.joblib")
    print(f"Model final (semua data) -> {models / 'categorizer.joblib'}")


if __name__ == "__main__":
    main()
