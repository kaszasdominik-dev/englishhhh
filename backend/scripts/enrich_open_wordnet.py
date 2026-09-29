#!/usr/bin/env python
"""Enrich the local FreeDict EN->HU catalog with Open English WordNet.

This is an OFFLINE/ONE-TIME import step. Runtime practice still uses zero LLM tokens.

Run from backend:
    python scripts/enrich_open_wordnet.py

Sources:
- Existing MongoDB dictionary collection: FreeDict English-Hungarian
- Open English WordNet 2025 WN-LMF XML: CC BY 4.0

The script only enriches terms already present in the local dictionary collection.
It does not ship or commit either upstream dataset into this repository.
"""
import gzip
import os
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / '.env')

SOURCE_URL = os.environ.get(
    'OEWN_XML_URL',
    'https://en-word.net/downloads/english-wordnet-2025.xml.gz',
)

POS_MAP = {
    'n': 'noun',
    'v': 'verb',
    'a': 'adjective',
    's': 'adjective',
    'r': 'adverb',
}

def local_name(tag):
    return str(tag or '').rsplit('}', 1)[-1]

def descendants(elem, name):
    return [x for x in elem.iter() if local_name(x.tag) == name]

def clean(value=''):
    return re.sub(r'\s+', ' ', str(value or '')).strip()

def download():
    print('Open English WordNet letöltése…')
    with requests.get(SOURCE_URL, timeout=180, stream=True) as r:
        r.raise_for_status()
        fd, path = tempfile.mkstemp(suffix='.xml.gz')
        os.close(fd)
        with open(path, 'wb') as out:
            for chunk in r.iter_content(1024 * 1024):
                if chunk:
                    out.write(chunk)
    print(f'Letöltve: {Path(path).stat().st_size/1024/1024:.1f} MB')
    return path

def main():
    mongo_url, db_name = os.environ.get('MONGO_URL'), os.environ.get('DB_NAME')
    if not mongo_url or not db_name:
        raise SystemExit('Hiányzik a MONGO_URL vagy DB_NAME a backend/.env fájlból.')

    db = MongoClient(mongo_url)[db_name]
    col = db.dictionary

    target_terms = set(
        x['termLower']
        for x in col.find({'termLower': {'$type': 'string'}}, {'termLower': 1, '_id': 0})
        if x.get('termLower')
    )
    if not target_terms:
        raise SystemExit('A dictionary collection üres. Előbb futtasd: python scripts/import_freedict_dictionary.py')

    print(f'{len(target_terms):,} helyi címszó gazdagítása…')
    path = download()

    entry_to_lemma = {}
    wanted_synsets = defaultdict(list)  # synset -> [(termLower, pos)]
    aggregate = {}

    try:
        # The WN-LMF file lists LexicalEntry records before Synset records, so one streaming
        # pass is enough: remember entry ids/lemmas, then enrich matching terms as synsets arrive.
        with gzip.open(path, 'rb') as xml:
            for _, elem in ET.iterparse(xml, events=('end',)):
                name = local_name(elem.tag)

                if name == 'LexicalEntry':
                    entry_id = elem.attrib.get('id', '')
                    lemmas = descendants(elem, 'Lemma')
                    if not lemmas:
                        elem.clear()
                        continue
                    lemma = clean(lemmas[0].attrib.get('writtenForm', ''))
                    pos_code = lemmas[0].attrib.get('partOfSpeech', '')
                    if entry_id and lemma:
                        entry_to_lemma[entry_id] = lemma
                    lower = lemma.lower()
                    if lower in target_terms:
                        for sense in descendants(elem, 'Sense'):
                            synset = sense.attrib.get('synset')
                            if synset:
                                wanted_synsets[synset].append((lower, pos_code))
                    elem.clear()
                    continue

                if name == 'Synset':
                    synset_id = elem.attrib.get('id', '')
                    targets = wanted_synsets.get(synset_id)
                    if not targets:
                        elem.clear()
                        continue

                    definitions = [clean(x.text) for x in descendants(elem, 'Definition') if clean(x.text)]
                    examples = [clean(x.text) for x in descendants(elem, 'Example') if clean(x.text)]
                    member_ids = clean(elem.attrib.get('members', '')).split()
                    synonyms = [entry_to_lemma.get(mid, '') for mid in member_ids]
                    synonyms = [x for x in synonyms if x]

                    for term_lower, pos_code in targets:
                        item = aggregate.setdefault(term_lower, {
                            'definitions': [],
                            'examples': [],
                            'synonyms': [],
                            'partOfSpeech': POS_MAP.get(pos_code, 'other'),
                        })
                        if item['partOfSpeech'] == 'other' and POS_MAP.get(pos_code):
                            item['partOfSpeech'] = POS_MAP[pos_code]
                        for value in definitions:
                            if value not in item['definitions'] and len(item['definitions']) < 5:
                                item['definitions'].append(value)
                        for value in examples:
                            if value not in item['examples'] and len(item['examples']) < 5:
                                item['examples'].append(value)
                        for value in synonyms:
                            if value.lower() != term_lower and value not in item['synonyms'] and len(item['synonyms']) < 12:
                                item['synonyms'].append(value)

                    elem.clear()

        ops = []
        updated = 0
        for term_lower, item in aggregate.items():
            patch = {
                'oewnEnriched': True,
                'oewnSource': 'Open English WordNet 2025',
                'oewnLicense': 'CC BY 4.0',
                'definitionsEn': item['definitions'],
                'examplesEn': item['examples'],
                'synonyms': item['synonyms'],
            }
            if item['definitions']:
                patch['definitionEn'] = item['definitions'][0]
            if item['examples']:
                patch['exampleEn'] = item['examples'][0]
            if item['partOfSpeech'] != 'other':
                patch['partOfSpeech'] = item['partOfSpeech']
            ops.append(UpdateOne({'termLower': term_lower}, {'$set': patch}))
            if len(ops) >= 1000:
                result = col.bulk_write(ops, ordered=False)
                updated += result.modified_count
                ops.clear()
                print(f'  {updated:,} frissítve…', end='\r')

        if ops:
            result = col.bulk_write(ops, ordered=False)
            updated += result.modified_count

        col.create_index([('oewnEnriched', 1)])
        print(f'\nKész: {updated:,} helyi szó kapott WordNet-metaadatot.')
        print('Runtime AI-token felhasználás: 0.')
    finally:
        try:
            os.remove(path)
        except OSError:
            pass

if __name__ == '__main__':
    main()
