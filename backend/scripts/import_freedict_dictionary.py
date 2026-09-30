#!/usr/bin/env python
"""Build LIVO's zero-token English→Hungarian practice dictionary.

Source: FreeDict English-Hungarian dictionary (GPL-2.0-or-later).
Run from backend:
    python scripts/import_freedict_dictionary.py
"""
import os, re, sys, tempfile, xml.etree.ElementTree as ET
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / '.env')
from dictionary_engine import estimate_level, topic_tags, choose_meaning

SOURCE_URL = os.environ.get(
    'FREEDICT_ENG_HUN_URL',
    'https://raw.githubusercontent.com/freedict/fd-dictionaries/master/eng-hun/eng-hun.tei'
)
try:
    from wordfreq import zipf_frequency
except Exception:
    zipf_frequency = None

NS = {'tei': 'http://www.tei-c.org/ns/1.0'}
FUNCTION_WORDS = set("a an the and or but to of for in on at with from this that these those it its i you he she we they my your our their am is are was were be been being do does did have has had".split())
LEGACY_HU = str.maketrans({'ô':'ő','û':'ű','Ô':'Ő','Û':'Ű'})

def clean_text(v=''):
    return re.sub(r'\s+', ' ', str(v or '').translate(LEGACY_HU)).strip()

def valid_term(term):
    if not term or len(term) > 55 or term.startswith(('-', "'", '.')):
        return False
    if len(term.split()) > 5 or not re.fullmatch(r"[A-Za-z][A-Za-z' -]*", term):
        return False
    return term.lower() not in FUNCTION_WORDS

def quality_score(term, freq, meanings):
    score = .35 + max(0, min(.5, (float(freq or 0) - 2.5) / 5))
    if len(term.split()) == 1: score += .08
    if 3 <= len(term) <= 16: score += .05
    if meanings and len(min(meanings, key=len)) <= 30: score += .05
    return round(min(1.0, score), 4)

def download_source():
    print('FreeDict letöltése…')
    r = requests.get(SOURCE_URL, timeout=120)
    r.raise_for_status()
    fd, path = tempfile.mkstemp(suffix='.tei')
    os.close(fd)
    Path(path).write_bytes(r.content)
    print(f'Letöltve: {len(r.content)/1024/1024:.1f} MB')
    return path

def main():
    mongo_url, db_name = os.environ.get('MONGO_URL'), os.environ.get('DB_NAME')
    if not mongo_url or not db_name:
        raise SystemExit('Hiányzik a MONGO_URL vagy DB_NAME a backend/.env fájlból.')
    if zipf_frequency is None:
        print('FIGYELEM: wordfreq nincs telepítve. Telepítés: pip install wordfreq')

    path = download_source()
    db = MongoClient(mongo_url)[db_name]
    col = db.dictionary
    col.delete_many({'source': 'freedict-eng-hun'})
    batch, seen, total, eligible = [], set(), 0, 0

    try:
        for _, elem in ET.iterparse(path, events=('end',)):
            if not elem.tag.endswith('entry'):
                continue
            orth = elem.find('.//tei:orth', NS)
            term = clean_text(orth.text if orth is not None else '').replace('`', "'")
            if not valid_term(term) or term.lower() in seen:
                elem.clear(); continue

            meanings = []
            for q in elem.findall('.//tei:quote', NS):
                value = clean_text(q.text)
                if value and value not in meanings and len(value) <= 100:
                    meanings.append(value)
            if not meanings:
                elem.clear(); continue

            freq = float(zipf_frequency(term, 'en')) if zipf_frequency else 3.5
            tags = topic_tags(term, meanings)
            level = estimate_level(freq)
            primary_category = tags[0] if tags else 'general'
            learning_band = 'foundation' if freq >= 5.25 else ('core' if freq >= 4.75 else ('intermediate' if freq >= 4.20 else ('advanced' if freq >= 3.40 else 'extended')))
            word_tags = []
            if not tags: word_tags.append('general_word')
            if freq < 3.4: word_tags.append('difficult_word')
            if freq < 3.0: word_tags.append('less_common')
            # Keep raw phrases in the searchable catalog, but do not auto-recommend
            # them. FreeDict contains many historical/idiomatic multi-word entries
            # that are poor default material without curation.
            practice_eligible = len(term) <= 36 and len(term.split()) == 1
            eligible += int(practice_eligible)

            batch.append({
                'key': f'freedict:{term.lower()}',
                'term': term,
                'termLower': term.lower(),
                'meaning': choose_meaning(meanings, tags),
                'meanings': meanings[:10],
                'partOfSpeech': 'phrase' if ' ' in term else 'other',
                'example': '',
                'frequency': round(freq, 4),
                'level': level,
                'topics': tags,
                'primaryCategory': primary_category,
                'learningBand': learning_band,
                'wordTags': word_tags,
                'quality': quality_score(term, freq, meanings),
                'practiceEligible': practice_eligible,
                'source': 'freedict-eng-hun',
                'sourceVersion': '0.2.1',
                'license': 'GPL-2.0-or-later',
                'imageable': False,
                'imageQuery': '',
                'imageTerms': [],
                'visualGroup': '',
            })
            seen.add(term.lower()); total += 1
            if len(batch) >= 1000:
                col.insert_many(batch, ordered=False); batch.clear()
                print(f'  {total:,} szó…', end='\r')
            elem.clear()

        if batch: col.insert_many(batch, ordered=False)
        col.create_index([('key', ASCENDING)], unique=True)
        col.create_index([('termLower', ASCENDING)])
        col.create_index([('practiceEligible', ASCENDING), ('level', ASCENDING), ('frequency', DESCENDING)])
        col.create_index([('topics', ASCENDING), ('level', ASCENDING), ('frequency', DESCENDING)])
        col.create_index([('primaryCategory', ASCENDING), ('learningBand', ASCENDING), ('frequency', DESCENDING)])
        col.create_index([('wordTags', ASCENDING), ('practiceEligible', ASCENDING)])
        col.create_index([('term', 'text'), ('meanings', 'text')])
        print(f'\nKész: {total:,} bejegyzés, ebből {eligible:,} gyakorlásra ajánlott.')
        if eligible < 50000:
            print('FIGYELEM: a forrás aktuális verziójából 50 000-nél kevesebb practiceEligible szó lett. A teljes katalógus ettől még elérhető.')
        else:
            print('50 000+ kategorizált szó elérhető a gyakorlómotor számára.')
        print('A LIVO Word Lab / Ajánlott mostantól ebből dolgozik, LLM token nélkül.')
    finally:
        try: os.remove(path)
        except OSError: pass

if __name__ == '__main__':
    main()
