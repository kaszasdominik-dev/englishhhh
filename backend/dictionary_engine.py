import random, re
from typing import Iterable

LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

TOPIC_KEYWORDS = {
    'business': {
        'company','business','client','customer','supplier','invoice','contract','meeting','project','revenue','profit','expense','budget',
        'negotiate','negotiation','proposal','deadline','colleague','manager','employee','employer','factory','production','quality','logistics',
        'warehouse','shift','salary','payment','order','delivery','stock','sales','market','price','cost','report','email','presentation','strategy',
        'target','task','team','office','department','career','finance','financial','account','accounting','purchase','sell','service'
    },
    'travel': {
        'travel','trip','hotel','booking','reservation','airport','flight','plane','airplane','passport','luggage','suitcase','ticket','train','bus',
        'station','taxi','map','journey','destination','beach','holiday','vacation','tour','tourist','hostel','room','check-in','departure','arrival',
        'border','country','city','abroad','guide','museum','currency','exchange'
    },
    'airport': {
        'airport','flight','plane','airplane','passport','luggage','suitcase','ticket','boarding','gate','terminal','departure','arrival','delay',
        'security','customs','baggage','check-in','seat','aisle','window','pilot','crew','land','landing','takeoff'
    },
    'restaurant': {
        'restaurant','food','meal','menu','order','waiter','waitress','bill','tip','breakfast','lunch','dinner','drink','water','coffee','tea','meat',
        'chicken','beef','fish','vegetable','fruit','bread','soup','dessert','hungry','delicious','table','plate','fork','knife','spoon','glass',
        'cook','chef','kitchen','taste','salt','pepper'
    },
    'interview': {
        'interview','job','career','experience','skill','strength','weakness','salary','employer','employee','position','role','responsibility',
        'achievement','team','manage','manager','leadership','resume','cv','candidate','hire','hiring','qualification','professional','workplace'
    },
    'everyday': {
        'home','family','friend','work','school','shop','buy','cook','clean','sleep','wake','walk','drive','eat','drink','day','week','time','weather',
        'morning','evening','today','tomorrow','yesterday','house','room','street','phone','money','help','need','want','like','love','go','come'
    },
    'car': {
        'car','vehicle','drive','driver','road','traffic','engine','wheel','tire','tyre','brake','fuel','petrol','gasoline','diesel','parking','garage',
        'seat','belt','speed','highway','motorway','gear','automatic','manual','repair','service','oil','battery','accident'
    },
    'it': {
        'computer','software','hardware','code','program','developer','database','server','network','file','folder','login','password','website','app',
        'application','update','bug','test','user','data','cloud','internet','email','screen','keyboard','mouse','download','upload','install','system',
        'security','api','frontend','backend'
    },
    'home': {
        'house','home','apartment','flat','room','kitchen','bathroom','bedroom','living','garden','door','window','table','chair','bed','lamp','floor',
        'wall','roof','garage','rent','property','building','stairs','balcony','furniture','sofa','desk'
    },
    'shopping': {
        'shop','store','shopping','buy','sell','price','discount','cash','card','receipt','size','clothes','shirt','shoe','jacket','dress','cheap',
        'expensive','cost','pay','payment','customer','basket','bag','return','refund','sale','market'
    },
}

TOPIC_ALIASES = {
    'uzlet':'business','üzlet':'business','munka':'business','business':'business','office':'business','iroda':'business',
    'utazas':'travel','utazás':'travel','nyaralas':'travel','nyaralás':'travel','travel':'travel',
    'repuloter':'airport','repülőtér':'airport','airport':'airport',
    'etterem':'restaurant','étterem':'restaurant','etel':'restaurant','étel':'restaurant','food':'restaurant','restaurant':'restaurant',
    'interju':'interview','interjú':'interview','allasinterju':'interview','állásinterjú':'interview','interview':'interview',
    'hetkoznapok':'everyday','hétköznapok':'everyday','mindennapok':'everyday','everyday':'everyday',
    'auto':'car','autó':'car','autozas':'car','autózás':'car','car':'car',
    'it':'it','informatika':'it','programozas':'it','programozás':'it','software':'it',
    'otthon':'home','lakas':'home','lakás':'home','ingatlan':'home','home':'home',
    'vasarlas':'shopping','vásárlás':'shopping','shopping':'shopping','bolt':'shopping',
}

HU_TOPIC_HINTS = {
    'business': ('cég','vállalat','üzlet','munka','számla','szerződés','fizetés','bevétel','költség','ügyfél','szállító','raktár','termelés'),
    'travel': ('utaz','szálloda','repül','útlevél','poggyász','jegy','nyaral','turista','úticél'),
    'airport': ('repül','járat','beszáll','kapu','terminál','poggyász','útlevél'),
    'restaurant': ('étel','étterem','ebéd','vacsora','reggeli','pincér','számla','ital','konyha'),
    'interview': ('állás','interjú','tapasztalat','készség','fizetés','munkáltató','pozíció','önéletrajz'),
    'car': ('autó','jármű','vezet','út','forgalom','motor','kerék','fék','üzemanyag','parkol'),
    'it': ('számítógép','szoftver','program','adatbázis','szerver','hálózat','fájl','jelszó','weboldal','alkalmazás'),
    'home': ('ház','lakás','szoba','konyha','fürdő','kert','ajtó','ablak','ágy','bútor'),
    'shopping': ('bolt','vásárl','ár','kedvezmény','készpénz','kártya','nyugta','méret','ruha'),
}

def normalize_topic(value=''):
    v = re.sub(r'\s+', ' ', str(value or '').strip().lower())
    return TOPIC_ALIASES.get(v, v)

def estimate_level(zipf_score):
    z = float(zipf_score or 0)
    if z >= 5.25: return 'A1'
    if z >= 4.75: return 'A2'
    if z >= 4.20: return 'B1'
    if z >= 3.65: return 'B2'
    if z >= 3.10: return 'C1'
    return 'C2'

def topic_tags(term='', meanings: Iterable[str] = ()):
    t = str(term or '').lower()
    tokens = set(re.findall(r"[a-z][a-z'-]*", t))
    tags = []
    blob = ' '.join(str(x).lower() for x in meanings)
    for topic, words in TOPIC_KEYWORDS.items():
        if t in words or tokens.intersection(words):
            tags.append(topic)
            continue
        if any(h in blob for h in HU_TOPIC_HINTS.get(topic, ())):
            tags.append(topic)
    return sorted(set(tags))

def choose_meaning(meanings, tags=()):
    values = [re.sub(r'\s+', ' ', str(x or '')).strip() for x in meanings]
    values = [x for x in values if x]
    if not values:
        return ''
    hints = []
    for tag in tags:
        hints.extend(HU_TOPIC_HINTS.get(tag, ()))
    if hints:
        ranked = sorted(values, key=lambda x: (0 if any(h in x.lower() for h in hints) else 1, len(x)))
        return ranked[0]
    return min(values, key=len)

def public_dictionary_word(doc):
    return {
        'dictionaryId': doc.get('key'),
        'term': doc.get('term', ''),
        'meaning': doc.get('meaning', ''),
        'meanings': doc.get('meanings', [])[:8],
        'partOfSpeech': doc.get('partOfSpeech') or ('phrase' if ' ' in doc.get('term','') else 'other'),
        'example': doc.get('example', ''),
        'level': doc.get('level', 'B1'),
        'frequency': doc.get('frequency', 0),
        'topics': doc.get('topics', []),
        'imageable': bool(doc.get('imageable', False)),
        'imageQuery': doc.get('imageQuery', ''),
        'imageTerms': doc.get('imageTerms', []),
        'visualGroup': doc.get('visualGroup', ''),
        'source': 'dictionary',
    }

async def recommend_dictionary_words(db, topic='', level='B1', count=10, exclude=()):
    count = max(5, min(30, int(count or 10)))
    level = str(level or 'B1').upper()
    if level not in LEVEL_ORDER:
        level = 'B1'
    canonical_topic = normalize_topic(topic)
    excluded = [str(x).lower() for x in exclude if x][:500]

    async def fetch(match, limit=800):
        cur = db.dictionary.find(match).sort([('frequency', -1), ('quality', -1)]).limit(limit)
        return [x async for x in cur]

    # Raw FreeDict contains many historical/idiomatic multi-word entries whose
    # literal English surface form is misleading for a modern learner
    # (e.g. "to cross the river" as an old euphemism for dying).
    # Keep them searchable in the catalog, but never surface them in automatic
    # recommendation packs. Curated phrase packs can be added separately later.
    base = {'practiceEligible': True, 'partOfSpeech': {'$ne': 'phrase'}}
    if excluded:
        base['termLower'] = {'$nin': excluded}

    exact = dict(base)
    exact['level'] = level
    if canonical_topic in TOPIC_KEYWORDS:
        exact['topics'] = canonical_topic
    elif canonical_topic:
        safe = re.escape(canonical_topic[:60])
        exact['$or'] = [
            {'termLower': {'$regex': safe, '$options': 'i'}},
            {'meanings': {'$regex': safe, '$options': 'i'}},
        ]

    pool = await fetch(exact)
    if len(pool) < count:
        relaxed = dict(base)
        idx = LEVEL_ORDER.index(level)
        nearby = LEVEL_ORDER[max(0, idx-1):min(len(LEVEL_ORDER), idx+2)]
        relaxed['level'] = {'$in': nearby}
        if canonical_topic in TOPIC_KEYWORDS:
            relaxed['topics'] = canonical_topic
        pool += await fetch(relaxed)

    seen = set()
    unique = []
    for x in pool:
        k = x.get('termLower')
        if k and k not in seen:
            seen.add(k); unique.append(x)
    pool = unique

    if len(pool) < count:
        fallback = dict(base)
        if canonical_topic in TOPIC_KEYWORDS:
            # Keep topic fidelity; only relax the learner level.
            fallback['topics'] = canonical_topic
        elif canonical_topic:
            # Free-text lookup stays a lookup; never silently become Random.
            safe = re.escape(canonical_topic[:60])
            fallback['$or'] = [
                {'termLower': {'$regex': safe, '$options': 'i'}},
                {'meanings': {'$regex': safe, '$options': 'i'}},
            ]
        else:
            idx = LEVEL_ORDER.index(level)
            fallback['level'] = {'$in': LEVEL_ORDER[max(0, idx-1):min(6, idx+2)]}
        for x in await fetch(fallback, 1200):
            k = x.get('termLower')
            if k and k not in seen:
                seen.add(k); pool.append(x)

    if not pool:
        return []

    weights = [max(.1, float(x.get('quality', .5))) ** 2 for x in pool]
    chosen = []
    while pool and len(chosen) < count:
        idx = random.choices(range(len(pool)), weights=weights, k=1)[0]
        chosen.append(pool.pop(idx)); weights.pop(idx)
    return [public_dictionary_word(x) for x in chosen]
