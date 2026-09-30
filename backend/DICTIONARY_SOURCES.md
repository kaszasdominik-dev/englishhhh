# LIVO local dictionary

The Word Practice and Word Lab paths are designed to work with **0 runtime LLM tokens**.

## Data flow

1. **FreeDict English–Hungarian** supplies the bilingual headword/translation layer.
2. **Open English WordNet (OEWN)** optionally enriches those existing entries with English definitions, examples, synonyms and part of speech.
3. MongoDB stores the resulting shared `dictionary` collection.
4. Per-user learning state is stored separately (`vocabulary` + `dictionaryProgress`), so the full dictionary is not duplicated per learner.

## Install

From `backend`:

```powershell
pip install -r requirements.txt
python scripts/import_freedict_dictionary.py
python scripts/enrich_open_wordnet.py
```

The second command is optional but recommended.

Check the result after starting the backend:

```text
GET http://localhost:8000/api/dictionary/status
```

Expected shape:

```json
{
  "ready": true,
  "total": 80000,
  "practiceEligible": 40000,
  "oewnEnriched": 30000,
  "runtimeLlmTokens": 0
}
```

Counts vary as the upstream datasets change and because the importer filters non-practice items.

## Runtime recommendation logic

`POST /api/dictionary/recommend` selects a local word pack using:

- learner level (frequency-based estimate, not an official CEFR classification),
- topic tags,
- existing saved vocabulary,
- previous local-dictionary practice,
- due review state,
- per-skill mastery.

The mixed practice mode tracks four independent skills:

- `meaning` — EN → HU meaning recognition,
- `translation` — HU → EN active recall,
- `spelling` — dictation / missing letters,
- `pronunciation` — pronunciation / sound discrimination.

When progress exists, **Vegyes / 🔥 Ajánlott** chooses the weakest skill for that word instead of blindly rotating task types.

## Audio

Word Practice uses only the browser/OS **Web Speech API**. It never calls OpenAI/TTS, so the Word Practice audio path stays at 0 OpenAI runtime tokens/cost. On a browser without speech synthesis the UI asks the learner to use a supported browser instead. The server `/api/pronounce` route remains available for other LIVO features, but Word Practice does not call it.

## Source / license notes

### FreeDict English–Hungarian

- Project: https://freedict.org/
- Current download listing: https://freedict.org/downloads/
- The eng-hun dataset identifies itself as GPL-2.0-or-later.
- LIVO does not commit the upstream dataset into this repository; the import script downloads it into the operator's MongoDB.

### Open English WordNet

- Project/downloads: https://en-word.net/downloads
- License: Creative Commons Attribution 4.0 (CC BY 4.0).
- LIVO stores source/license metadata on enriched dictionary entries.

If a built dictionary database is redistributed with an app/service, preserve the required upstream notices and comply with the corresponding dataset licenses.


## 50,000+ categorized practice words

The FreeDict importer now keeps the full clean, single-word English-Hungarian catalog practice-eligible and adds:
- `primaryCategory`
- `learningBand` (foundation / core / intermediate / advanced / extended)
- `wordTags`
- expanded practical themes such as work, business, airport, hotel, shopping, finance, manufacturing, logistics, customer service, meetings and email/phone.

The exact eligible count depends on the upstream FreeDict release. The importer prints a warning if it is below 50,000.

## LIVO 10,000-question bank

The application also contains a deterministic question-bank generator in `backend/question_bank.py`.
It creates exactly **10,000** categorized items across 25 themes and stores them in MongoDB collection `question_bank`.

The bank is created lazily on the first:
- `GET /api/questions/status`, or
- `POST /api/questions/recommend`.

Runtime question generation uses **0 LLM tokens**. Items include drag-to-blank grammar tasks and multiple-choice vocabulary tasks with relevant distractors.

The frontend exposes this bank under **Tanulás → Mondatok**.


## One-command local content bootstrap

From the `backend/` directory:

```bash
python scripts/bootstrap_learning_content.py
```

This imports/rebuilds both the categorized FreeDict word bank and the deterministic 10,000-question bank, then prints the final MongoDB counts.
