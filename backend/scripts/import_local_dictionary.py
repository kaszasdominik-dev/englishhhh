#!/usr/bin/env python
"""One-command local dictionary bootstrap for LIVO.

Run from backend:
    python scripts/import_local_dictionary.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'scripts'

def run(name):
    path = SCRIPTS / name
    print(f'\n=== {name} ===')
    result = subprocess.run([sys.executable, str(path)], cwd=str(ROOT))
    if result.returncode != 0:
        raise SystemExit(result.returncode)

def main():
    run('import_freedict_dictionary.py')
    run('enrich_open_wordnet.py')
    print('\nLIVO helyi szótár kész.')
    print('Indítsd a backendet, majd ellenőrizd: http://localhost:8000/api/dictionary/status')

if __name__ == '__main__':
    main()
