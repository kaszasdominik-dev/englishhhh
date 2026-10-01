"""Bootstrap LIVO's local learning-content databases in one command.

Usage from backend/:
    python scripts/bootstrap_learning_content.py

1) Imports the FreeDict English-Hungarian dictionary.
2) Seeds/replaces the deterministic 10,000-item question bank.
"""
import os
import subprocess
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")
sys.path.insert(0, str(BACKEND_DIR))

from question_bank import generate_question_bank  # noqa: E402


def main():
    print("1/2 FreeDict angol-magyar szobank import...")
    subprocess.run([sys.executable, str(BACKEND_DIR / "scripts" / "import_freedict_dictionary.py")], cwd=str(BACKEND_DIR), check=True)

    print("\n2/2 10 000 kerdeses bank import...")
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "livo")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
    except Exception as exc:
        raise SystemExit(f"Nem elérhető a MongoDB ({mongo_url}). Indítsd el a MongoDB szolgáltatást, majd próbáld újra. Részlet: {exc}")
    db = client[db_name]
    col = db.question_bank
    rows = generate_question_bank()
    col.delete_many({"sourceMethod": "deterministic_curated_template"})
    if rows:
        col.insert_many(rows, ordered=False)
    col.create_index([("id", 1)], unique=True)
    col.create_index([("theme", 1), ("cefr", 1), ("skill", 1), ("subskill", 1)])
    col.create_index([("questionType", 1), ("status", 1)])
    dictionary_total = db.dictionary.count_documents({})
    eligible = db.dictionary.count_documents({"practiceEligible": True})
    question_total = col.count_documents({"status": "active", "bankVersion": 2})
    client.close()

    print("\nKESZ")
    print(f"Dictionary: {dictionary_total:,} bejegyzes / {eligible:,} gyakorlashoz hasznalhato")
    print(f"Question bank: {question_total:,} kerdes")
    if eligible < 50000:
        print("FIGYELEM: a jelenlegi FreeDict kiadasbol 50 000-nel kevesebb egyedi egy-szavas gyakorlasi tetel jott letre.")


if __name__ == "__main__":
    main()
