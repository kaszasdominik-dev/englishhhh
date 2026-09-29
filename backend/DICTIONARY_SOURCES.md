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

Word Practice first uses the browser/OS **Web Speech API**. This has no OpenAI API call and no LLM/TTS token cost. The existing server `/api/pronounce` route remains only as a compatibility fallback when browser speech synthesis is unavailable.

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
