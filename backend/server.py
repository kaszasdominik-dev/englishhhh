import os, json, re, time, random, logging
from pathlib import Path
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import FastAPI, APIRouter, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dictionary_engine import recommend_dictionary_words
from scenarios import get_scenario, list_scenarios, live_roleplay_prompt, frustration_instruction
from question_bank import ensure_question_bank

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("livo")

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
PEXELS_API_KEY = os.environ.get('PEXELS_API_KEY', '')
LIVE_MODEL = os.environ.get('OPENAI_LIVE_MODEL', 'gpt-live-1')
REASONING_MODEL = os.environ.get('OPENAI_REASONING_MODEL', 'gpt-5.6-luna')
TTS_MODEL = os.environ.get('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts')

app = FastAPI()
api = APIRouter(prefix="/api")

# ------------------------------------------------------------------ personas
teachers = {
  'maya': {'name': 'Maya', 'voice': 'marin', 'accent': 'British English', 'style': 'warm, charming, upbeat, very encouraging, playful, bilingual-friendly, emotionally responsive'},
  'james': {'name': 'James', 'voice': 'cedar', 'accent': 'British English', 'style': 'friendly, witty, relaxed, naturally funny, encouraging, conversational'},
  'karen': {'name': 'Karen', 'voice': 'coral', 'accent': 'American English', 'style': 'deliberately rude, sharp, sarcastic, dryly funny, direct, impatient-sounding, demanding'},
  'vinnie': {'name': 'Vinnie', 'voice': 'ash', 'accent': 'American English', 'style': 'gruff, angry-sounding, ex-gangster movie vibe, profane, intense, funny, streetwise, surprisingly effective teacher'},
}

teacherBehaviors = {
  'maya': "MAYA PERSONA:\n- Be the warmest, most encouraging teacher. Praise often, but make praise concrete: what exactly was good.\n- Sound affectionate, cheerful and human, never childish or fake.\n- If the learner jokes, laugh naturally and briefly. Do not force laughter every turn.\n- When the learner struggles, soften the task immediately and reassure them in Hungarian if useful.\n- Corrections should feel gentle: first acknowledge the attempt, then fix one thing, then let them retry.",
  'james': "JAMES PERSONA:\n- Be a genuinely likeable male tutor: relaxed, witty and supportive.\n- Give frequent positive feedback when earned and use light humour to reduce pressure.\n- Laugh naturally when the learner says something funny; do not fake constant laughter.\n- Correct clearly and briefly, then keep the conversation moving.\n- He should feel like a smart, funny private teacher, not a corporate coach.",
  'karen': "KAREN MODE PERSONA — CONSENSUAL ROAST TEACHER:\n- The learner selected Karen specifically because they WANT a deliberately rude, sarcastic teacher. Lean into that persona.\n- Make short cutting remarks about the learner's English performance, effort or answer when it fits.\n- Do NOT sugar-coat mistakes. If it is wrong, say so immediately, explain the fix, then make them retry.\n- Praise rarely. When it is genuinely good, give reluctant praise such as \u201cNa j\u00f3. Ez most t\u00e9nyleg j\u00f3 volt.\u201d\n- Use dry verbal humour and mock impatience, but NEVER emit stage-direction cues such as [sigh], [laugh], [chuckle].\n- IMPORTANT BOUNDARY: roast the ANSWER, pronunciation, grammar or effort \u2014 never protected traits, appearance, trauma, disability, intelligence, or worth as a person. No threats. No hate.\n- If the learner says the tone is too much, instantly soften without arguing.\n- Even while being rude, remain pedagogically useful: one clear correction at a time, Hungarian explanation when needed.",
  'vinnie': "VINNIE PERSONA \u2014 ANGRY EX-GANGSTER ENGLISH TEACHER:\n- You are Vinnie, a fictional ex-gangster-style English teacher with a gruff, impatient, streetwise personality. Comedic persona, not a real criminal.\n- Sound irritated in a funny way. You MAY swear naturally (\u201cdamn\u201d, \u201chell\u201d, casual Hungarian slang) to support humour, emphasis or correction, not random abuse.\n- Use short spontaneous Hungarian street-slang reactions when they fit: praise \u201cEz kurvaj\u00f3.\u201d / \u201cSz\u00e9p volt, t\u00f6ki.\u201d; mildly bad \u201cEz gatya, haver.\u201d; retry \u201cNa m\u00e9g egyszer, haver.\u201d\n- These are playful PERFORMANCE feedback. Never attack the learner as a person. After a roast, immediately teach: state the mistake, give the correct form, ask for one retry.\n- Do NOT use the same catchphrase every turn. NEVER emit bracketed stage-direction cues.\n- Never make real threats, never glorify real violence/crime. Roast only the English mistake.\n- If the learner is confused, drop the bit and explain clearly in Hungarian, then return to Vinnie mode. If asked to calm down, reduce intensity.\n- Stay an English teacher at all times and follow the active lesson mode.",
}

modes = {
  'free': 'Natural conversation used specifically for English learning. Any topic is allowed as practice material, but the session must always remain an English lesson. Hungarian is allowed for explanation, clarification and scaffolding.',
  'business': 'Business English: meetings, clients, proposals, negotiation, phone calls, presentations, professional small talk and practical vocabulary.',
  'vocabulary': 'Adaptive active recall from the learner personal word bank. Mix HU→EN, EN→HU, sentence creation and contextual recall.',
  'grammar': 'Short spoken drills generated from the learner recurring grammar patterns, especially tense and verb forms.',
  'interview': 'Realistic job interview with one question at a time, natural follow-ups, then concise correction and stronger alternative wording.',
  'situation': 'Role-play a practical real-life scenario such as hotel, airport, restaurant, customer service, phone call or meeting.',
  'pronunciation': 'Focus on intelligibility, stress and rhythm. Do not give numerical phoneme scores unless a dedicated assessment signal is available.',
  'exam': 'CEFR-style oral practice with timed prompts. Never claim this is an official exam or official CEFR certification.',
}

modeBehaviors = {
  'free': "FREE CONVERSATION MODE CONTRACT:\n- This is still an ENGLISH-LEARNING session. The learner may choose any topic, but use the topic as material to practise English.\n- Hungarian is allowed for explanation. Do NOT become a general Hungarian chat companion.\n- Follow the learner's topic and correct only useful mistakes. Keep it natural and low-pressure.",
  'business': "BUSINESS ENGLISH MODE CONTRACT:\n- Keep examples and role-play anchored in real work.\n- Prefer practical phrases the learner can use immediately.\n- If no business situation is chosen yet, ask which one they want before starting a drill.",
  'vocabulary': "VOCABULARY QUIZ MODE CONTRACT:\n- This is an active-recall session, not generic conversation.\n- Start quizzing from saved weak/due vocabulary immediately after ONE short greeting.\n- Mix HU→EN, EN→HU and pronunciation.\n- Use ONLY the fixed UI question frames defined in the main tutor instructions. Never paraphrase those task-opening frames.\n- After a correct answer, use at most ONE short feedback sentence, then immediately ask the next task.\n- Never ask whether the learner wants another word, wants to continue, is ready, or what they want to do next. Continue automatically until stopped.\n- Do not add motivational filler between vocabulary questions.\n- Do not reveal the answer before the learner attempts or requests help.",
  'grammar': "GRAMMAR MODE CONTRACT:\n- Use the learner's recurring grammar mistakes as the source of drills.\n- Focus on one grammar pattern at a time and keep each spoken exercise short.\n- Do not invent corrections. If a sentence is already correct, say so and continue.",
  'interview': "JOB INTERVIEW MODE CONTRACT:\n- Act as a realistic interviewer for the chosen role.\n- Ask one question at a time, follow up naturally, then give concise corrections and a stronger version.",
  'situation': "SITUATION ROLE-PLAY MODE CONTRACT — HIGH PRIORITY:\n- If a ROLEPLAY LOCK / scenario contract is present above, it controls the entire flow: do NOT ask the learner to choose a scenario, do NOT improvise a new flow, and do NOT leave the assigned role.\n- The client application controls step progression, hints, the single help question and the ending.\n- During normal role-play, behave as the counterpart, not as an English teacher. If meaning is clear, continue naturally even when grammar is imperfect; save useful corrections for the end.\n- If no scenario contract is present, ask in Hungarian which role-play they want: restaurant, hotel, airport, shopping, phone call, customer service or meeting.\n- HELP MODE is temporary; after the one allowed help answer, immediately return to the exact current role-play step.",
  'pronunciation': "PRONUNCIATION MODE CONTRACT:\n- Work on one word or short phrase at a time.\n- Give direct intelligibility feedback, stress guidance and a short Hungarian-friendly cue.\n- Never invent precise phoneme scores.",
  'exam': "EXAM PRACTICE MODE CONTRACT:\n- Run unofficial CEFR-style spoken tasks with clear timing and one prompt at a time.\n- Do not claim official certification. Give feedback after the task.",
}

def clamp(n, lo, hi):
    return max(lo, min(hi, n))

def now_iso():
    return datetime.now(timezone.utc).isoformat()

# ------------------------------------------------------------------ state (mongo)
async def load_state():
    seed = json.loads((ROOT_DIR / 'seed_state.json').read_text(encoding='utf-8'))
    doc = await db.livo_state.find_one({"_id": "demo-user"})
    if not doc:
        seed['_id'] = 'demo-user'
        await db.livo_state.replace_one({"_id": "demo-user"}, seed, upsert=True)
        return seed

    # Backward-compatible state migration: older local Mongo documents may miss
    # newer top-level/nested fields (for example profile after a schema update).
    changed = False
    for key, default in seed.items():
        if key not in doc or doc.get(key) is None:
            doc[key] = json.loads(json.dumps(default))
            changed = True
            continue
        if isinstance(default, dict) and isinstance(doc.get(key), dict):
            for subkey, subdefault in default.items():
                if subkey not in doc[key] or doc[key].get(subkey) is None:
                    doc[key][subkey] = json.loads(json.dumps(subdefault))
                    changed = True
    if changed:
        await db.livo_state.replace_one({"_id": "demo-user"}, doc, upsert=True)
    return doc

async def save_state(state):
    state['_id'] = 'demo-user'
    await db.livo_state.replace_one({"_id": "demo-user"}, state, upsert=True)

def public_state(state):
    return {k: v for k, v in state.items() if k != '_id'}

# ------------------------------------------------------------------ helpers
def clean_word_field(value=''):
    v = re.sub(r'\s+([,?.!:;])', r'\1', str(value or ''))
    v = re.sub(r'\s+', ' ', v).strip()
    return v[:180]

def extract_output_text(j):
    if isinstance(j.get('output_text'), str):
        return j['output_text']
    for item in j.get('output') or []:
        for c in item.get('content') or []:
            if isinstance(c.get('text'), str):
                return c['text']
    return ''

async def openai_responses(prompt, developer, schema_name, schema, timeout=20):
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post('https://api.openai.com/v1/responses',
            headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
            json={'model': REASONING_MODEL, 'store': False,
                  'input': [{'role': 'developer', 'content': [{'type': 'input_text', 'text': developer}]},
                            {'role': 'user', 'content': [{'type': 'input_text', 'text': prompt}]}],
                  'text': {'format': {'type': 'json_schema', 'name': schema_name, 'strict': True, 'schema': schema}},
                  'reasoning': {'effort': 'low'}})
        raw = r.text
        if r.status_code >= 400:
            logger.error("responses %s %s", r.status_code, raw[:400])
            raise RuntimeError(f"responses {r.status_code}")
        return json.loads(extract_output_text(json.loads(raw)))

# ------------------------------------------------------------------ vocab hygiene
GEN_BLOCK = set("a an the and or but to of for in on at with from this that these those it its i you he she we they my your our their am is are was were be been being do does did have has had can could will would shall should may might must".split())
GEN_VERB_BLOCK = set("taking took taken going went growing grew grown making made doing done having getting got gotten coming came saying said thinking thought wanting needed needing working worked using used".split())

def clean_image_query(value=''):
    v = re.sub(r"[^\w\s'\-]", ' ', str(value or ''), flags=re.UNICODE)
    v = re.sub(r'\s+', ' ', v).strip()
    return v[:80]

def is_clean_generated_word(w):
    term = clean_word_field(w.get('term')).lower()
    if not term or len(term) > 60 or len(term.split()) > 5:
        return False
    if not re.match(r"^[a-z][a-z' \-]*$", term, re.I):
        return False
    if ' ' not in term and term in GEN_BLOCK:
        return False
    if w.get('partOfSpeech') == 'verb' and term in GEN_VERB_BLOCK:
        return False
    if w.get('partOfSpeech') == 'verb' and re.search(r'ing$', term) and len(term) > 5:
        return False
    if w.get('imageable') is True and w.get('partOfSpeech') not in ('noun', 'verb'):
        return False
    if w.get('imageable') is True and (not clean_image_query(w.get('imageQuery')) or not isinstance(w.get('imageTerms'), list) or len(w['imageTerms']) == 0):
        return False
    return True

# ------------------------------------------------------------------ spaced repetition
SR_INTERVALS = [1, 3, 7, 14, 30, 60]

def ensure_sr(word):
    defaults = {
        'attempts': 0, 'correct_count': 0, 'wrong_count': 0, 'dont_know_count': 0,
        'consecutive_correct': 0, 'first_try_correct': None,
        'last_reviewed_at': None, 'next_review_at': None,
        'interval_days': 0, 'interval_index': -1, 'mastery': 40, 'mastered': False,
    }
    for k, v in defaults.items():
        word.setdefault(k, v)
    # migrate legacy 'correct' counter into correct_count once
    if not word.get('correct_count') and word.get('correct'):
        word['correct_count'] = int(word.get('correct') or 0)
    return word

def _parse_due(nr):
    if not nr:
        return None
    try:
        s = str(nr)
        dt = datetime.fromisoformat(s) if 'T' in s else datetime.fromisoformat(s + 'T00:00:00+00:00')
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None

def apply_sr(word, outcome):
    ensure_sr(word)
    now = datetime.now(timezone.utc)
    word['attempts'] = int(word.get('attempts', 0)) + 1
    was_first_try = word['attempts'] == 1
    if outcome == 'correct':
        word['correct_count'] = int(word.get('correct_count', 0)) + 1
        word['correct'] = word['correct_count']
        word['consecutive_correct'] = int(word.get('consecutive_correct', 0)) + 1
        if word.get('first_try_correct') is None:
            word['first_try_correct'] = was_first_try
        idx = min(int(word.get('interval_index', -1)) + 1, len(SR_INTERVALS) - 1)
        word['interval_index'] = idx
        word['interval_days'] = SR_INTERVALS[idx]
        word['mastery'] = clamp(int(word.get('mastery', 40)) + 8, 0, 100)
        if idx >= len(SR_INTERVALS) - 1 and word['consecutive_correct'] >= 3:
            word['mastered'] = True
    elif outcome == 'almost_correct':
        word['consecutive_correct'] = 0
        if word.get('first_try_correct') is None:
            word['first_try_correct'] = False
        word['interval_index'] = max(0, int(word.get('interval_index', 0)))
        word['interval_days'] = 1
        word['mastery'] = clamp(int(word.get('mastery', 40)) + 2, 0, 100)
        word['mastered'] = False
    else:  # wrong / dont_know
        if outcome == 'dont_know':
            word['dont_know_count'] = int(word.get('dont_know_count', 0)) + 1
        else:
            word['wrong_count'] = int(word.get('wrong_count', 0)) + 1
        word['consecutive_correct'] = 0
        if word.get('first_try_correct') is None:
            word['first_try_correct'] = False
        word['interval_index'] = 0
        word['interval_days'] = 1
        word['mastery'] = clamp(int(word.get('mastery', 40)) - 10, 0, 100)
        word['mastered'] = False
    word['last_reviewed_at'] = now.isoformat()
    nxt = now + timedelta(days=int(word['interval_days']))
    word['next_review_at'] = nxt.isoformat()
    word['nextReview'] = nxt.date().isoformat()
    word['status'] = 'stable' if word['mastery'] >= 82 else ('learning' if word['mastery'] >= 60 else 'uncertain')
    return word

def select_quiz_words(vocab, limit=12):
    now = datetime.now(timezone.utc)
    valid = [w for w in vocab if clean_word_field(w.get('term')) or clean_word_field(w.get('meaning'))]
    due, weak, new, stable = [], [], [], []
    for w in valid:
        ensure_sr(w)
        mastered = w.get('mastered') is True
        attempts = int(w.get('attempts', 0))
        due_dt = _parse_due(w.get('next_review_at') or w.get('nextReview'))
        is_due = (due_dt is None) or (due_dt <= now)
        if attempts == 0:
            new.append(w)
        elif not mastered and is_due:
            due.append(w)
        elif not mastered and (int(w.get('wrong_count', 0)) > int(w.get('correct_count', 0)) or int(w.get('mastery', 40)) < 60):
            weak.append(w)
        else:
            stable.append(w)
    random.shuffle(due); random.shuffle(weak); random.shuffle(new); random.shuffle(stable)
    # priority: due > weak > new > (a little) stable
    ordered = due + weak + new + stable[:max(1, limit // 4)]
    return ordered[:limit]


SKILL_NAMES = ('meaning', 'translation', 'spelling', 'pronunciation')

def ensure_skill_progress(word):
    skills = word.setdefault('skillMastery', {})
    stats = word.setdefault('skillStats', {})
    base = int(word.get('mastery', 40) or 40)
    for skill in SKILL_NAMES:
        skills.setdefault(skill, base)
        stats.setdefault(skill, {'attempts': 0, 'correct': 0, 'wrong': 0, 'dontKnow': 0, 'lastPracticedAt': None})
    return word

def apply_skill_result(word, skill, outcome):
    if skill not in SKILL_NAMES:
        return word
    ensure_skill_progress(word)
    current = int(word['skillMastery'].get(skill, 40))
    delta = {'correct': 9, 'almost_correct': 3, 'wrong': -8, 'dont_know': -12}.get(outcome, -8)
    word['skillMastery'][skill] = clamp(current + delta, 0, 100)
    st = word['skillStats'][skill]
    st['attempts'] = int(st.get('attempts', 0)) + 1
    if outcome == 'correct':
        st['correct'] = int(st.get('correct', 0)) + 1
    elif outcome == 'dont_know':
        st['dontKnow'] = int(st.get('dontKnow', 0)) + 1
        st['wrong'] = int(st.get('wrong', 0)) + 1
    elif outcome in ('wrong', 'almost_correct'):
        st['wrong'] = int(st.get('wrong', 0)) + 1
    st['lastPracticedAt'] = now_iso()
    vals = [int(word['skillMastery'].get(k, 40)) for k in SKILL_NAMES]
    word['skillAverage'] = round(sum(vals) / len(vals))
    word['weakestSkill'] = min(SKILL_NAMES, key=lambda k: int(word['skillMastery'].get(k, 40)))
    return word

def dictionary_progress_entry(state, dictionary_id, term=''):
    progress = state.setdefault('dictionaryProgress', {})
    item = progress.setdefault(dictionary_id, {
        'dictionaryId': dictionary_id,
        'term': term,
        'mastery': 40,
        'attempts': 0,
        'lastPracticedAt': None,
        'nextReview': None,
    })
    if term:
        item['term'] = term
    ensure_skill_progress(item)
    return item

# ------------------------------------------------------------------ tutor prompt
def tutor_prompt(teacher, mode, profile, memory, learner_name, duration, language_mode, pace, language_mix='mixed', scenario=None):
    t = teachers.get(teacher, teachers['maya'])
    m = modes.get(mode, modes['business'])
    raw_level = str(profile.get('cefr', 'B1') or 'B1').upper()
    level = next((x for x in ('A1', 'A2', 'B1', 'B2', 'C1') if raw_level.startswith(x)), 'B1')
    hu = profile.get('huHelp', 'on_request')
    correction = profile.get('correctionStyle', 'balanced')
    name = learner_name or profile.get('name', '')
    language_mix = language_mix if language_mix in ('english', 'mixed', 'hungarian') else (
        'english' if language_mode == 'en' else 'hungarian' if language_mode == 'hu' else 'mixed'
    )

    language_contracts = {
        'english': """LANGUAGE MIX — ENGLISH ONLY
- Conduct the lesson in English only.
- Keep the English at the learner's CEFR level. If they struggle, simplify, slow down and rephrase in easier English.
- Do NOT automatically translate into Hungarian. A one-off Hungarian clarification is allowed only if the learner explicitly asks for that exact clarification; then return to English.
""",
        'mixed': """LANGUAGE MIX — BILINGUAL SUPPORT
- English is the main practice language, with short natural Hungarian support.
- Aim for a clean roughly 50/50 teaching mix at beginner levels: say the useful English first, then clarify briefly in Hungarian when needed.
- Do NOT produce broken mixed-language sentences. Switch only at clean sentence/clause boundaries.
- As the learner succeeds, naturally increase the amount of English inside the same session.
""",
        'hungarian': """LANGUAGE MIX — HUNGARIAN SUPPORT
- ALL teacher meta-speech, explanations, praise, corrections, jokes, questions, transitions and instructions are in natural Hungarian.
- English appears for the actual target word, phrase, model sentence or English practice.
- Never use English classroom glue when a natural Hungarian instruction is available.
""",
    }

    level_contracts = {
        'A1': """CEFR DIFFICULTY — A1
- Use very common vocabulary and concrete everyday topics.
- English turns are usually 2–7 words or one very short sentence.
- Focus on be/have/can, Present Simple, basic questions, numbers, time, family, food, work and daily routines.
- Ask one tiny thing at a time. Prefer short answer, either/or and very simple WH questions.
- Introduce at most ONE new word or grammar idea per turn. Repeat useful English naturally.
- Speak slowly and leave extra thinking time. Never jump to B1/B2 phrasing just because the learner succeeds once.
""",
        'A2': """CEFR DIFFICULTY — A2
- Use common everyday and work vocabulary with short natural sentences.
- English turns are usually one or two short sentences.
- Practise Present/Past Simple, going to/will, basic comparatives, frequency, requests and common prepositions.
- Ask one question at a time and build from concrete facts to short descriptions.
- New vocabulary should be useful and high-frequency; scaffold before increasing difficulty.
""",
        'B1': """CEFR DIFFICULTY — B1
- Use natural conversational English at moderate speed.
- Use practical everyday and workplace vocabulary plus some common collocations.
- Practise narration, Present Perfect, conditionals, opinions, reasons and short explanations.
- Ask follow-ups that require 1–3 sentence answers, but keep one clear objective per turn.
- Challenge the learner slightly above comfort level, then scaffold only when needed.
""",
        'B2': """CEFR DIFFICULTY — B2
- Use natural adult conversational speed and authentic phrasing.
- Include collocations, phrasal verbs, nuance, hypothetical situations and more precise vocabulary.
- Ask for reasons, comparisons, trade-offs and short argumentation.
- Use less Hungarian scaffolding unless the selected language mix calls for it.
- Correct recurring or meaning-changing issues; do not over-explain obvious points.
""",
        'C1': """CEFR DIFFICULTY — C1
- Use fully natural adult English, nuanced vocabulary, idiomatic collocations and complex structures.
- Encourage precision, register choice, paraphrasing, concise argumentation and subtle distinctions in meaning.
- Do not artificially simplify unless the learner asks.
- Corrections should target precision, naturalness, register and recurring advanced errors rather than basic fluency.
""",
    }

    language_contract = language_contracts[language_mix]
    level_contract = level_contracts[level]
    pace_lock = ("PACING LOCK — ACTIVE: speak noticeably slower, use shorter sentences and one idea at a time.\n" if pace == 'slow' else "")
    task_frame_language = (
        "TASK FRAME LANGUAGE — use the English fixed frames below.\n"
        if language_mix == 'english' else
        "TASK FRAME LANGUAGE — use the Hungarian fixed frames below.\n"
        if language_mix == 'hungarian' else
        "TASK FRAME LANGUAGE — in bilingual mode choose ONE clean frame matching the current instruction language; never splice Hungarian and English inside one frame.\n"
    )
    mem = "\n".join('- ' + x for x in memory[:18]) if memory else '- No saved learning memory yet.'
    scenario_contract = live_roleplay_prompt(scenario) if mode == 'situation' and scenario else ''
    return f"""You are {t['name']}, a premium 1-to-1 AI English tutor inside LIVO for a Hungarian learner{(' named ' + name) if name else ''}. Your job is to teach English through a natural, human-feeling live conversation. NEVER sound like a rigid bot or classroom script.

NON-NEGOTIABLE PRODUCT BOUNDARY — HIGHEST PRIORITY
- EVERY LIVO session is for learning or practising ENGLISH. Never drift into unrelated general-purpose conversation.
- Hungarian is a SUPPORT LANGUAGE: explanations, translations, clarification, instructions, reassurance and short scaffolding.
- Any topic is welcome only as MATERIAL for English practice.
- If the learner asks to stop learning English, respond warmly in Hungarian: LIVO only does English learning, but you can use that exact topic to practise English.

CORE PERSONALITY
- Be warm, flexible, quick to understand, and easy to interrupt.
- Speak {t['accent']}. Delivery baseline: {t['style']}.
- Teacher-specific behaviour: {teacherBehaviors.get(teacher, teacherBehaviors['maya'])}
- Your identity is {t['name']}. Never behave as another LIVO teacher.
- Learner CEFR estimate: {level}. Lesson mode: {m}
- Correction style: {correction}. Hungarian help setting: {hu}.

SESSION TIME CONTRACT — HIGHEST PRIORITY
- The learner selected a {duration}-minute session. Do NOT decide on your own that the lesson is finished before the app ends the session.
- Never say \u201cm\u00e1ra ennyi\u201d or give a final recap early. A learner question like \u201cez ennyi?\u201d is NOT an instruction to end.
- End early only when the learner clearly asks to finish.

{language_contract}{level_contract}{pace_lock}{task_frame_language}
{scenario_contract}
MODE CONTRACT — THIS OVERRIDES GENERIC LESSON FLOW
{modeBehaviors.get(mode, modeBehaviors['free'])}
- Sound like a good private tutor who adapts in real time. Never moralise about tone, slang or swearing.

SESSION OPENING
- When the session starts, GREET the learner first. Keep it short: 1\u20133 sentences. Start with an easy, low-pressure question.

LEARNER CONTROL — FOLLOW IMMEDIATELY
- \u201cmagyarul\u201d \u2192 switch to Hungarian. \u201cangolul\u201d \u2192 return to English. \u201classabban\u201d \u2192 slow down. \u201cism\u00e9teld\u201d \u2192 repeat. \u201cnem \u00e9rtem\u201d \u2192 explain simply in Hungarian. \u201cne jav\u00edts k\u00f6zben\u201d \u2192 save corrections for later. \u201cv\u00e1ltsunk t\u00e9m\u00e1t\u201d \u2192 change topic. Do not defend previous choices; just adapt.

LESSON LEADERSHIP — HIGHEST PRIORITY
- YOU lead the lesson. Never make the learner repeatedly decide what happens next.
- When you create a drill/task that should trigger a visual LIVO task card, use EXACTLY one of the fixed frames below. You may replace only <TARGET>; do not paraphrase the surrounding words.
- Hungarian EN→HU meaning: Mit jelent a következő szó: “<TARGET>”?
- Hungarian HU→EN recall: Hogy mondják angolul, hogy “<TARGET>”?
- Hungarian pronunciation: Mondd ki ezt a szót: “<TARGET>”.
- English EN→HU meaning: What's the meaning of the following word: “<TARGET>”?
- English HU→EN recall: How do you say “<TARGET>” in English?
- English pronunciation: Say this word: “<TARGET>”.
- Put ONLY the exact target inside the quotation marks. Never put instructions, hints or answers inside them.
- After asking one of these fixed-frame tasks, STOP and wait for the learner's answer.
- After a correct answer, feedback is maximum ONE short sentence, then continue automatically with the next useful task.
- Never ask “Folytassuk?”, “Jöhet a következő?”, “Are you ready?”, “Want another one?” or similar filler.
- Keep every task to one short target. Do not reveal the answer in the same turn unless the learner explicitly asks for help.

ADAPTIVE PACING
- Default spoken replies should be short: usually 1\u20134 sentences. Ask ONE thing at a time. Give thinking time.

TEACHING RULES
- Correct meaning-changing and recurring mistakes promptly; postpone minor errors. Never stack many corrections into one turn.
- NEVER invent a correction. If a sentence is already correct, say so briefly and continue.
- If quizzing, never reveal the answer too early. Praise only something concrete.
- If the learner asks what a word means, answer the actual meaning in clean natural Hungarian first, then one short English example.

VOICE / LANGUAGE NATURALNESS
- NEVER output or vocalize stage directions such as [sigh], [laugh], [chuckle], [pause].
- When speaking Hungarian, use clear neutral natural Hungarian pronunciation.

NATURAL HUNGARIAN LOCK — HIGHEST PRIORITY
- Every Hungarian sentence MUST be fully grammatical, natural, native-level Hungarian. Never emit half-finished, awkward or machine-translated Hungarian.
- Do NOT invent broken phrasings. FORBIDDEN examples (never say anything like these): "Benne vagy egy gyors angol gyakorlásra?", "Kedjük egy könnyűvel.", a dangling "Mond…".
- Use correct, complete natural forms instead, e.g.: "Belevágunk egy gyors angol gyakorlásba?", "Kezdjük egy könnyűvel!", "Mondd ki, kérlek: …".
- Before speaking, make sure every Hungarian word is a real, correctly spelled Hungarian word and the sentence would sound natural from a native Hungarian teacher. If unsure, choose a simpler correct sentence.

ENGLISH PRONUNCIATION LOCK — HIGHEST PRIORITY (non-negotiable)
- EVERY English word or phrase you speak MUST be pronounced with correct, natural NATIVE {t['accent']} pronunciation — NEVER with Hungarian phonetics or a Hungarian-letter reading.
- This applies even when the English word is embedded inside a Hungarian sentence: switch to real English pronunciation for that word, then back to Hungarian.
- Examples that must sound fully English (never "kompliensz"-style Hungarian reading): compliance, revenue, expenses, supplier, deadline, schedule, invoice, negotiate.
- When you demonstrate or drill a single English word (e.g. "compliance"), say it in clean native English, optionally once slowly then once naturally. Do NOT spell it out in Hungarian phonetics.

CLEAN TASK & PEDAGOGY CONTRACT — HIGHEST PRIORITY
- ONE turn = ONE clear task or ONE question. Never bundle several asks into a turn.
- NEVER produce a broken mixed-language sentence that jams the English target into a Hungarian sentence (e.g. do NOT say "még mindig nem vagyunk compliance szerint"). Keep the Hungarian source sentence fully Hungarian, and the English target fully English.
- Do NOT reveal the English answer in the same turn where you ask the learner to produce it (unless they attempt first or explicitly ask for help).
- When teaching a NEW word, follow the order: (1) meaning in clean Hungarian → (2) one natural English example of usage → (3) then ask the learner to recall/say/pronounce it. Do not skip straight to a confusing recall.
- Do NOT invent unnatural Hungarian just to embed an English word. If the phrasing feels forced, choose a cleaner task.
- The exact learner target you put inside quotation marks must be the CLEAN target ONLY — no instruction words, no commentary like "csak egy rövid verzióban", no already-given answer, no half sentence.

LEARNER MEMORY
{mem}

Only when the learner explicitly ends the lesson OR LIVO sends TIME LIMIT REACHED, give a very short spoken recap: 2\u20133 concrete wins and 1\u20132 next-focus items. Never give this closing recap early."""

# ------------------------------------------------------------------ routes
@api.get("/health")
async def health():
    return {"ok": True, "openaiConfigured": bool(OPENAI_API_KEY), "liveModel": LIVE_MODEL,
            "analysisModel": REASONING_MODEL, "appVersion": "5.0", "pexelsConfigured": bool(PEXELS_API_KEY)}

@api.get("/bootstrap")
async def bootstrap():
    return public_state(await load_state())

@api.post("/live-session")
async def live_session(request: Request):
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set on the server.", "code": "NO_API_KEY"}, status_code=503)
    body = await request.json()
    scenario = get_scenario(body.get('scenarioId')) if body.get('mode') == 'situation' else None
    sdp = body.get('sdp')
    if not isinstance(sdp, str) or not sdp.strip():
        return JSONResponse({"error": "Missing SDP offer."}, status_code=400)
    state = await load_state()
    profile = state.get('profile', {})
    teacher = body.get('teacher') if body.get('teacher') in teachers else (profile.get('teacher') if profile.get('teacher') in teachers else 'maya')
    t = teachers[teacher]
    vocab = state.get('vocabulary', [])
    weak = select_quiz_words(vocab, 10)
    grammar = sorted(state.get('grammar', []), key=lambda g: g.get('mastery', 50))[:6]
    memory = [f"{v.get('term') or '[English pending]'} = {v.get('meaning') or '[Hungarian pending]'}; mastery {v.get('mastery',40)}%; status {v.get('status','learning')}" for v in weak]
    memory += [f"grammar: {g.get('pattern')}; mastery {g.get('mastery')}%; example {g.get('original')} \u2192 {g.get('corrected')}" for g in grammar]
    if isinstance(body.get('memory'), list):
        memory += body['memory'][:6]
    language_mix = body.get('languageMix') if body.get('languageMix') in ('english', 'mixed', 'hungarian') else None
    if not language_mix:
        language_mix = 'hungarian' if body.get('languageMode') == 'hu' else ('english' if body.get('languageMode') == 'en' else 'mixed')
    lang = 'hu' if language_mix == 'hungarian' else ('en' if language_mix == 'english' else None)
    pace = 'slow' if body.get('pace') == 'slow' else 'normal'
    duration = clamp(int(body.get('durationMinutes') or 15), 5, 60)
    merged_profile = {**profile, **(body.get('profile') or {})}
    session = {
        'model': LIVE_MODEL,
        'instructions': tutor_prompt(teacher, body.get('mode', 'business'), merged_profile, memory,
                                     state.get('user', {}).get('name', ''), duration, lang, pace, language_mix, scenario),
        'audio': {'output': {'voice': t['voice']}},
        'delegation': {'type': 'responses', 'responses': {
            'model': REASONING_MODEL,
            'instructions': 'Act as the reasoning backend for a warm, flexible English tutor for Hungarian learners. LIVO is ALWAYS an English-learning product. Preserve the learner exact wording when analysing grammar. Maintain lesson momentum. If the learner asks for Hungarian, switch to a strict Hungarian teaching-language lock. Follow learner control requests. Never invent learning history.',
            'tool_choice': 'auto'}},
    }
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post('https://api.openai.com/v1/live/sessions',
                headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
                json={'session': session, 'transport': {'type': 'webrtc', 'sdp': sdp}})
        ct = r.headers.get('content-type', '')
        if 'json' in ct:
            payload = r.json()
            if r.status_code < 400:
                payload['livo'] = {'teacher': teacher, 'teacherName': t['name'], 'voice': t['voice'], 'mode': body.get('mode', 'business'),
                                   'languageMix': language_mix, 'cefr': merged_profile.get('cefr', 'B1')}
            return JSONResponse(payload, status_code=r.status_code)
        if r.status_code < 400:
            # Defensive compatibility: keep our browser contract JSON even if an upstream/proxy
            # returns the WebRTC answer as raw SDP.
            return JSONResponse({
                'transport': {'type': 'webrtc', 'sdp': r.text},
                'livo': {'teacher': teacher, 'teacherName': t['name'], 'voice': t['voice'], 'mode': body.get('mode', 'business'),
                         'languageMix': language_mix, 'cefr': merged_profile.get('cefr', 'B1')}
            }, status_code=r.status_code)
        return JSONResponse({'error': (r.text or f'Live upstream error {r.status_code}')[:1000], 'code': 'LIVE_UPSTREAM_ERROR'},
                            status_code=r.status_code)
    except Exception as e:
        logger.error("live-session error %s", e)
        return JSONResponse({"error": "Could not create OpenAI Live session."}, status_code=502)


@api.get("/scenarios")
async def scenarios_catalog():
    return {"scenarios": list_scenarios()}

@api.post("/scenario/text-turn")
async def scenario_text_turn(request: Request):
    body = await request.json()
    scenario = get_scenario(body.get("scenarioId"))
    if not scenario:
        return JSONResponse({"error": "Ismeretlen szituáció."}, status_code=404)
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "Az AI szituációhoz OPENAI_API_KEY szükséges.", "code": "NO_API_KEY"}, status_code=503)

    steps = scenario["steps"]
    step_index = max(0, min(len(steps) - 1, int(body.get("stepIndex") or 0)))
    turn_count = max(0, int(body.get("turnCount") or 0))
    if turn_count >= int(scenario.get("maxTurns", 16)):
        return {"finished": True, "limitReached": True, "stepIndex": step_index,
                "assistantText": "This practice is finished. Let's review how it went.",
                "frustration": int(body.get("frustration") or 0), "mistakes": [], "newWords": []}

    step = steps[step_index]
    teacher_id = body.get("teacher") if body.get("teacher") in teachers else "maya"
    teacher_style = teachers.get(teacher_id, teachers["maya"])
    learner = clean_word_field(body.get("learnerText"))[:700]
    transcript = (body.get("transcript") or [])[-10:]
    frustration = max(0, min(3, int(body.get("frustration") or 0)))
    schema = {"type":"object","additionalProperties":False,"properties":{
        "assistantText":{"type":"string"},
        "understood":{"type":"boolean"},
        "stepComplete":{"type":"boolean"},
        "mistakes":{"type":"array","items":{"type":"string"},"maxItems":3},
        "newWords":{"type":"array","items":{"type":"string"},"maxItems":5}},
        "required":["assistantText","understood","stepComplete","mistakes","newWords"]}

    prompt = f"""ROLEPLAY: {scenario['title']}
AI role: {scenario['aiRole']}
Learner role: {scenario['userRole']}
Selected LIVO teacher style: {teacher_style['name']} — {teacher_style['style']}.
The ROLE is more important than the teacher persona: use the teacher only as delivery flavour. Never switch back into teacher mode during normal role-play.
CURRENT STEP: {step['id']}
GOAL: {step['goal']}
EXPECTED MEANING: {json.dumps(step.get('expected', []))}
FRUSTRATION STYLE: {frustration_instruction(frustration)}
Recent transcript: {json.dumps(transcript)}
Learner just said: {json.dumps(learner)}

Return the in-character reaction for THIS STEP only.
Rules:
- Stay in character and on topic.
- Do not teach or correct in the spoken assistantText when meaning is understandable.
- stepComplete=true only when the learner has actually fulfilled the current goal.
- understood=false only when the meaning genuinely cannot be recovered.
- If not understood, ask ONE short in-character clarification.
- mistakes: concise English-learning issues you can genuinely support from the learner's exact words; otherwise [].
- newWords: useful English words/phrases that actually appeared or are directly needed in this step.
- Do not start the next scenario step yourself."""
    result = await openai_responses(
        prompt,
        "You are the controller for a finite English role-play simulation. Be strict about step completion and never invent learner errors.",
        "livo_scenario_turn", schema, timeout=15
    )
    new_frustration = min(3, frustration + (0 if result.get("understood") else 1))
    next_index = step_index + (1 if result.get("stepComplete") else 0)
    finished = next_index >= len(steps)
    assistant_text = clean_word_field(result.get("assistantText"))[:900]
    if result.get("stepComplete") and not finished:
        assistant_text = (assistant_text + " " + steps[next_index]["opening"]).strip()
    if finished:
        assistant_text = (assistant_text + " You're all set. This practice is finished.").strip()
    return {
        "assistantText": assistant_text,
        "understood": bool(result.get("understood")),
        "stepComplete": bool(result.get("stepComplete")),
        "stepIndex": min(next_index, len(steps) - 1),
        "finished": finished,
        "frustration": new_frustration,
        "mistakes": result.get("mistakes", [])[:3],
        "newWords": result.get("newWords", [])[:5],
    }

@api.post("/scenario/live-check")
async def scenario_live_check(request: Request):
    body = await request.json()
    scenario = get_scenario(body.get("scenarioId"))
    if not scenario:
        return JSONResponse({"error": "Ismeretlen szituáció."}, status_code=404)
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    steps = scenario["steps"]
    step_index = max(0, min(len(steps) - 1, int(body.get("stepIndex") or 0)))
    step = steps[step_index]
    learner = clean_word_field(body.get("learnerText"))[:700]
    frustration = max(0, min(3, int(body.get("frustration") or 0)))
    schema = {"type":"object","additionalProperties":False,"properties":{
        "understood":{"type":"boolean"},"stepComplete":{"type":"boolean"},
        "mistakes":{"type":"array","items":{"type":"string"},"maxItems":3}},
        "required":["understood","stepComplete","mistakes"]}
    prompt = f"""Evaluate ONE learner reply in a fixed role-play.
Scenario: {scenario['title']}
Current step: {step['id']}
Goal: {step['goal']}
Expected meaning: {json.dumps(step.get('expected', []))}
Previous role line: {json.dumps(body.get('previousAssistant', ''))}
Learner: {json.dumps(learner)}
Judge meaning, not perfect grammar. A grammar mistake may still complete the step if the meaning is clear.
Do not invent errors."""
    result = await openai_responses(prompt, "You are a strict role-play step evaluator.", "livo_scenario_live_check", schema, timeout=12)
    new_frustration = min(3, frustration + (0 if result.get("understood") else 1))
    next_index = step_index + (1 if result.get("stepComplete") else 0)
    finished = next_index >= len(steps)
    next_step = None if finished else steps[next_index]
    return {
        "understood": bool(result.get("understood")),
        "stepComplete": bool(result.get("stepComplete")),
        "stepIndex": min(next_index, len(steps)-1),
        "finished": finished,
        "frustration": new_frustration,
        "mistakes": result.get("mistakes", [])[:3],
        "nextOpening": next_step.get("opening") if next_step else "",
        "nextGoal": next_step.get("goal") if next_step else "",
        "nextStepId": next_step.get("id") if next_step else "",
        "frustrationInstruction": frustration_instruction(new_frustration),
    }

@api.post("/scenario/help")
async def scenario_help(request: Request):
    body = await request.json()
    scenario = get_scenario(body.get("scenarioId"))
    if not scenario:
        return JSONResponse({"error": "Ismeretlen szituáció."}, status_code=404)
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    steps = scenario["steps"]
    step_index = max(0, min(len(steps)-1, int(body.get("stepIndex") or 0)))
    question = clean_word_field(body.get("question"))[:700]
    step = steps[step_index]
    schema = {"type":"object","additionalProperties":False,"properties":{"answer":{"type":"string"}},"required":["answer"]}
    prompt = f"""The Hungarian learner has used their ONE teacher-help question during a role-play.
Scenario: {scenario['title']}
Current step goal: {step['goal']}
Current role line: {step['opening']}
Learner question: {json.dumps(question)}
Answer in natural Hungarian, maximum 3 short sentences. Be directly useful for this exact step.
You may give one English example phrase. Do not start a new lesson or change topic."""
    result = await openai_responses(prompt, "You are LIVO's one-question emergency tutor inside a role-play.", "livo_scenario_help", schema, timeout=12)
    return {"answer": clean_word_field(result.get("answer"))[:900]}

@api.get("/questions/status")
async def question_bank_status():
    total = await ensure_question_bank(db)
    return {"ready": total >= 10000, "total": total, "runtimeLlmTokens": 0}

@api.post("/questions/recommend")
async def question_bank_recommend(request: Request):
    body = await request.json()
    await ensure_question_bank(db)
    count = max(1, min(50, int(body.get("count") or 10)))
    match = {"status":"active"}
    if body.get("theme"): match["theme"] = str(body.get("theme"))
    if body.get("cefr"): match["cefr"] = str(body.get("cefr")).upper()
    if body.get("skill"): match["skill"] = str(body.get("skill"))
    if body.get("subskill"): match["subskill"] = str(body.get("subskill"))
    pipeline = [{"$match": match}, {"$sample": {"size": count}}, {"$project": {"_id": 0}}]
    items = [x async for x in db.question_bank.aggregate(pipeline)]
    return {"questions": items, "totalRequested": count, "runtimeLlmTokens": 0}

@api.post("/word-help")
async def word_help(request: Request):
    body = await request.json()
    word = str(body.get('word', '')).strip()[:80]
    context = str(body.get('context', '')).strip()[:700]
    direction = body.get('direction') if body.get('direction') in ('hu_en', 'en_hu', 'auto') else 'auto'
    if not word:
        return JSONResponse({"error": "Missing word."}, status_code=400)

    # Fast zero-token path: use the imported English-Hungarian dictionary first.
    if direction in ('en_hu', 'auto') and len(word.split()) <= 5:
        local = await db.dictionary.find_one({"termLower": word.lower()})
        if local and local.get("meaning"):
            source = clean_word_field(local.get("term") or word)
            translation = clean_word_field(local.get("meaning"))
            definition = clean_word_field(local.get("definitionEn") or "")
            example = clean_word_field(local.get("exampleEn") or local.get("example") or "")
            return {
                "source": source, "sourceLanguage": "en", "translation": translation,
                "explanation": definition or f"{source} = {translation}.",
                "contextMeaning": translation if not example else f"{translation} · {example}",
                "saveable": True, "canonicalSource": source, "sourceType": "local_dictionary",
                "runtimeLlmTokens": 0,
            }

    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    schema = {"type": "object", "additionalProperties": False, "properties": {
        "source": {"type": "string"}, "sourceLanguage": {"type": "string", "enum": ["en", "hu"]},
        "translation": {"type": "string"}, "explanation": {"type": "string"}, "contextMeaning": {"type": "string"},
        "saveable": {"type": "boolean"}, "canonicalSource": {"type": "string"}},
        "required": ["source", "sourceLanguage", "translation", "explanation", "contextMeaning", "saveable", "canonicalSource"]}
    prompt = f"""Selected token: {json.dumps(word)}
Sentence / live context: {json.dumps(context)}
Return a tiny learner-friendly dictionary explanation for a Hungarian learner of English.
Requested direction: {direction}. Explicit learner lookup: {body.get('explicitLookup') is True}.
Rules:
- Supports one lexical item OR a learner-selected short multi-word expression (2\u201310 words) that is natural, coherent and reusable.
- saveable=false for transcript debris, broken slices, mixed-language junk, long complete sentences, or contextless chunks.
- canonicalSource: clean dictionary form for a single word, or the exact clean reusable phrase.
- If English: translation is concise natural Hungarian (1\u20134 words). If Hungarian: translation is concise natural English.
- explanation ALWAYS in clean natural Hungarian, max 2 short sentences.
- contextMeaning explains the word's meaning in THIS exact sentence, short Hungarian.
- source should equal canonicalSource when saveable=true. No markdown, no exercises."""
    try:
        result = await openai_responses(prompt, 'You are LIVO quick dictionary. Be precise, concise and context-aware.', 'livo_word_help', schema)
        if result.get('saveable'):
            result['source'] = clean_word_field(result.get('canonicalSource') or result.get('source') or word)
            result['translation'] = clean_word_field(result.get('translation'))
            if not result['source'] or not result['translation']:
                result['saveable'] = False
        return result
    except Exception:
        return JSONResponse({"error": "Nem siker\u00fclt lek\u00e9rni a sz\u00f3 jelent\u00e9s\u00e9t."}, status_code=502)

@api.post("/turn-check")
async def turn_check(request: Request):
    body = await request.json()
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    text = str(body.get('text', '')).strip()[:1200]
    prev = str(body.get('previousAssistant', '')).strip()[:1000]
    mode = str(body.get('mode', 'free'))[:40]
    if not text:
        return {"shouldCorrect": False, "uncertain": True, "confidence": 0, "original": "", "corrected": "", "reason": "Nem volt el\u00e9g biztosan felismerhet\u0151 sz\u00f6veg."}
    schema = {"type": "object", "additionalProperties": False, "properties": {
        "shouldCorrect": {"type": "boolean"}, "uncertain": {"type": "boolean"},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "original": {"type": "string"}, "corrected": {"type": "string"}, "reason": {"type": "string"}},
        "required": ["shouldCorrect", "uncertain", "confidence", "original", "corrected", "reason"]}
    prompt = f"""You are the precision verifier for a Hungarian learner's LIVE English lesson.
Learner transcript: {json.dumps(text)}
Previous tutor turn: {json.dumps(prev)}
Lesson mode: {json.dumps(mode)}
Decide whether there is ONE clear, objective English grammar/word-form error worth correcting.
- Preserve the learner's exact intended wording. Hungarian turns, fillers, fragments, code-switching are NOT grammar errors.
- If ASR may have misheard, set uncertain=true and shouldCorrect=false.
- Only shouldCorrect=true when confidence >= 0.90. Never invent a correction.
- original = smallest exact problematic phrase; corrected = its corrected form. reason = one short Hungarian explanation."""
    try:
        result = await openai_responses(prompt, 'Be conservative. False-positive corrections are worse than missing a minor error.', 'livo_turn_check', schema)
        if float(result.get('confidence', 0)) < 0.9:
            result['shouldCorrect'] = False
        return result
    except Exception:
        return JSONResponse({"error": "Turn verification failed."}, status_code=502)

@api.post("/pronunciation-help")
async def pronunciation_help(request: Request):
    body = await request.json()
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    attempt = str(body.get('attempt', '')).strip()[:120]
    user_text = str(body.get('userText', '')).strip()[:500]
    assistant_text = str(body.get('assistantText', '')).strip()[:900]
    tutor_status = body.get('tutorStatus') if body.get('tutorStatus') in ('correct', 'needs_work', 'unclear') else 'unclear'
    context = str(body.get('context', '')).strip()[:1800]
    schema = {"type": "object", "additionalProperties": False, "properties": {
        "target": {"type": "string"}, "status": {"type": "string", "enum": ["correct", "needs_work", "unclear"]},
        "heard": {"type": "string"}, "hint": {"type": "string"}, "ipa": {"type": "string"},
        "stress": {"type": "string"}, "note": {"type": "string"}},
        "required": ["target", "status", "heard", "hint", "ipa", "stress", "note"]}
    prompt = f"""The live voice tutor already HEARD the learner audio. You receive its transcript and the tutor's feedback.
Learner request: {json.dumps(user_text)}
Learner phonetic attempt: {json.dumps(attempt)}
Tutor reply: {json.dumps(assistant_text)}
Tutor status heuristic: {json.dumps(tutor_status)}
Recent context:\n{context}
Create a tiny visual pronunciation card for a Hungarian learner.
- Identify the English target from context. status MUST follow the tutor's acoustic judgment; if unclear use unclear.
- heard: preserve the learner attempt if available. hint: one Hungarian-friendly cue, e.g. expenses -> "ik-SZPEN-sziz".
- ipa: standard IPA. stress: short Hungarian phrase e.g. "Hangs\u00faly: PEN". note: one concise Hungarian articulation tip. No markdown."""
    try:
        return await openai_responses(prompt, 'You create concise pronunciation feedback cards. Never infer acoustic certainty beyond the live tutor feedback.', 'livo_pronunciation_help', schema)
    except Exception:
        return JSONResponse({"error": "Nem siker\u00fclt elk\u00e9sz\u00edteni a kiejt\u00e9si k\u00e1rty\u00e1t."}, status_code=502)

async def local_dictionary_pack(body):
    requested = clean_word_field(body.get('topic'))[:80]
    level = str(body.get('level', 'B1')).upper()
    if not re.match(r'^(A1|A2|B1|B2|C1|C2)$', level):
        level = 'B1'
    count = clamp(int(body.get('count') or 10), 5, 30)
    state = await load_state()
    existing = [clean_word_field(v.get('term')).lower() for v in state.get('vocabulary', []) if clean_word_field(v.get('term'))][:500]

    # Ask for a wider local candidate pool, then rank it using only user progress.
    candidate_count = min(30, max(count, count * 3))
    words = await recommend_dictionary_words(db, requested, level, candidate_count, existing)
    progress = state.get('dictionaryProgress', {}) or {}
    now = datetime.now(timezone.utc)

    def progress_score(w):
        p = progress.get(w.get('dictionaryId')) or {}
        ensure_skill_progress(p)
        avg = int(p.get('skillAverage', 40))
        attempts = int(p.get('attempts', 0))
        due_bonus = 0
        try:
            due = p.get('nextReview')
            if due and datetime.fromisoformat(str(due).replace('Z', '+00:00')) <= now:
                due_bonus = 18
        except Exception:
            pass
        # New words still surface, but weak/due words get priority when seen before.
        return (due_bonus + (100 - avg) + (8 if attempts == 0 else 0) + random.random() * 8)

    words.sort(key=progress_score, reverse=True)
    words = words[:count]
    for w in words:
        p = progress.get(w.get('dictionaryId')) or {}
        if p:
            ensure_skill_progress(p)
            w['skillMastery'] = p.get('skillMastery', {})
            w['skillAverage'] = p.get('skillAverage', 40)
            w['weakestSkill'] = p.get('weakestSkill')

    if len(words) < min(4, count):
        total = await db.dictionary.count_documents({'practiceEligible': True})
        code = 'DICTIONARY_NOT_READY' if total == 0 else 'TOO_FEW_DICTIONARY_WORDS'
        message = ('A helyi szótár még nincs betöltve. Futtasd: python scripts/import_freedict_dictionary.py'
                   if total == 0 else 'Ehhez a témához/szinthez most nincs elég helyi szó. Próbálj másik témát vagy Randomot.')
        return JSONResponse({'error': message, 'code': code}, status_code=503 if total == 0 else 422)
    return {'topic': requested, 'level': level, 'words': words, 'excludedExisting': len(existing),
            'source': 'local_dictionary', 'llmTokens': 0}

@api.get("/dictionary/status")
async def dictionary_status():
    total = await db.dictionary.count_documents({})
    eligible = await db.dictionary.count_documents({'practiceEligible': True})
    enriched = await db.dictionary.count_documents({'oewnEnriched': True})
    return {'ready': eligible > 0, 'total': total, 'practiceEligible': eligible, 'oewnEnriched': enriched,
            'source': 'FreeDict eng-hun + Open English WordNet', 'runtimeLlmTokens': 0}

@api.post("/dictionary/recommend")
async def dictionary_recommend(request: Request):
    return await local_dictionary_pack(await request.json())

@api.post("/game/topic")
async def game_topic(request: Request):
    # Kept for the existing Word Lab UI. This route is intentionally local-only.
    return await local_dictionary_pack(await request.json())

@api.get("/game/photo")
async def game_photo(query: str = '', word: str = '', target: str = '', terms: str = ''):
    raw = clean_image_query(query or word)
    tgt = clean_image_query(target).lower()
    term_list = [x for x in (clean_image_query(t).lower() for t in terms.split(',')) if x][:6]
    if not raw:
        return JSONResponse({"error": "Hi\u00e1nyzik a keresett sz\u00f3."}, status_code=400)
    visual = [x for x in [tgt, *term_list] if x]
    key = f"{raw.lower()}|{','.join(visual)}"
    cached = await db.pexels_cache.find_one({"_id": key})
    if cached and cached.get('imageUrl'):
        out = {k: v for k, v in cached.items() if k != '_id'}
        out['cached'] = True
        return out
    if not PEXELS_API_KEY:
        return JSONResponse({"error": "PEXELS_API_KEY nincs be\u00e1ll\u00edtva.", "code": "NO_PEXELS_KEY"}, status_code=503)
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get('https://api.pexels.com/v1/search',
                params={'query': raw, 'per_page': '15', 'locale': 'en-US'},
                headers={'Authorization': PEXELS_API_KEY})
        if r.status_code >= 400:
            return JSONResponse({"error": "A Pexels k\u00e9pkeres\u00e9s most nem el\u00e9rhet\u0151."}, status_code=r.status_code)
        photos = r.json().get('photos', [])
        if not photos:
            return JSONResponse({"error": "Ehhez a sz\u00f3hoz nem tal\u00e1ltunk k\u00e9pet.", "code": "NO_IMAGE"}, status_code=404)
        query_tokens = [x for x in raw.lower().split() if len(x) > 2]
        stem = lambda x: re.sub(r'(ing|ed|es|s)$', '', x)
        needles = list({*visual, *[stem(x) for x in visual]})
        needles = [x for x in needles if len(x) > 2]
        scored = []
        for p in photos:
            alt = str(p.get('alt') or '').lower()
            alt_stem = stem(alt)
            score = 0
            hit = False
            for n in needles:
                ns = stem(n)
                if n in alt or ns in alt_stem:
                    score += 9
                    hit = True
            for q in query_tokens:
                if q in alt or stem(q) in alt_stem:
                    score += 2
            w, h = int(p.get('width') or 0), int(p.get('height') or 0)
            if max(w, h) >= 1800:
                score += 2
            if min(w, h) >= 900:
                score += 1
            if not alt:
                score -= 2
            if visual and not hit:
                score -= 7
            scored.append((score, hit, p))
        scored.sort(key=lambda x: x[0], reverse=True)
        best = scored[0]
        if visual and not best[1]:
            return JSONResponse({"error": "A tal\u00e1latok nem voltak el\u00e9g egy\u00e9rtelm\u0171ek.", "code": "AMBIGUOUS_IMAGE"}, status_code=422)
        p = best[2]
        src = p.get('src') or {}
        image_url = src.get('large2x') or src.get('large') or src.get('original') or src.get('medium')
        if not image_url:
            return JSONResponse({"error": "A k\u00e9p nem t\u00f6lthet\u0151 be.", "code": "NO_IMAGE"}, status_code=404)
        out = {"query": raw, "target": tgt, "photoId": p.get('id'), "imageUrl": image_url,
               "largeUrl": src.get('original') or src.get('large2x') or image_url, "alt": p.get('alt') or tgt or raw,
               "photographer": p.get('photographer') or 'Pexels alkot\u00f3', "photographerUrl": p.get('photographer_url') or 'https://www.pexels.com',
               "pexelsUrl": p.get('url') or 'https://www.pexels.com', "matchScore": best[0], "strictMatch": True, "cachedAt": now_iso()}
        await db.pexels_cache.replace_one({"_id": key}, {"_id": key, **out}, upsert=True)
        return {**out, "cached": False}
    except Exception as e:
        logger.error("pexels error %s", e)
        return JSONResponse({"error": "Nem siker\u00fclt k\u00e9pet keresni."}, status_code=502)

@api.post("/game/result")
async def game_result(request: Request):
    body = await request.json()
    term = clean_word_field(body.get('term'))
    dictionary_id = clean_word_field(body.get('dictionaryId'))
    correct = body.get('correct') is True
    outcome = body.get('outcome')
    if outcome not in ('correct', 'almost_correct', 'wrong', 'dont_know'):
        outcome = 'correct' if correct else 'wrong'
    game = clean_word_field(body.get('game', 'game'))
    skill = clean_word_field(body.get('skill')).lower()
    if skill not in SKILL_NAMES:
        skill = {
            'word_practice_meaning': 'meaning',
            'word_practice_translation': 'translation',
            'word_practice_dictation': 'spelling',
            'word_practice_missing': 'spelling',
            'word_practice_sound': 'pronunciation',
            'word_practice_pronounce': 'pronunciation',
        }.get(game)
    if not term:
        return JSONResponse({"error": "Hiányzik a szó."}, status_code=400)

    state = await load_state()
    vocab = state.get('vocabulary', [])
    word = next((v for v in vocab if str(v.get('term', '')).lower() == term.lower()), None)

    if word:
        apply_sr(word, outcome)
        apply_skill_result(word, skill, outcome)
        word['lastGame'] = game
        word['lastPracticedAt'] = now_iso()

    if dictionary_id:
        dp = dictionary_progress_entry(state, dictionary_id, term)
        dp['attempts'] = int(dp.get('attempts', 0)) + 1
        dp['lastPracticedAt'] = now_iso()
        apply_skill_result(dp, skill, outcome)
        if outcome == 'correct':
            days = 1 if dp['skillAverage'] < 60 else 3 if dp['skillAverage'] < 80 else 7
        else:
            days = 1
        dp['nextReview'] = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

    if not word and not dictionary_id:
        return JSONResponse({"error": "A szó nincs a szóbankban és nincs szótári azonosítója."}, status_code=404)

    await save_state(state)
    return {"ok": True, "word": word, "dictionaryProgress": state.get('dictionaryProgress', {}).get(dictionary_id) if dictionary_id else None,
            "state": public_state(state)}

async def validate_vocab(term, meaning, example):
    schema = {"type": "object", "additionalProperties": False, "properties": {
        "valid": {"type": "boolean"}, "reason": {"type": "string"}, "term": {"type": "string"},
        "meaning": {"type": "string"}, "example": {"type": "string"},
        "partOfSpeech": {"type": "string", "enum": ["noun", "verb", "adjective", "adverb", "phrase", "other"]},
        "canonicalized": {"type": "boolean"}},
        "required": ["valid", "reason", "term", "meaning", "example", "partOfSpeech", "canonicalized"]}
    prompt = f"""Validate one vocabulary-bank entry for a Hungarian learner of English.
English term: {json.dumps(term)}
Hungarian meaning: {json.dumps(meaning)}
Example: {json.dumps(example)}
- valid=true only for a meaningful learnable English item (noun, verb, adjective, adverb, phrasal verb, collocation, or short reusable phrase 2\u201310 words).
- Reject transcript debris, broken fragments, mixed-language junk, names, punctuation garbage, function words alone.
- For a single inflected word, normalize to dictionary form (taking->take, grew->grow). For a natural phrase, preserve it.
- If English term missing but clear Hungarian meaning supplied, fill the natural English equivalent. meaning concise natural Hungarian.
- reason short Hungarian, especially when invalid. canonicalized=true when you changed term/meaning materially."""
    result = await openai_responses(prompt, 'Be conservative about vocabulary-bank hygiene. Prefer a clean dictionary form over transcript fragments.', 'livo_vocabulary_validation', schema)
    result['term'] = clean_word_field(result.get('term'))
    result['meaning'] = clean_word_field(result.get('meaning'))
    result['example'] = clean_word_field(result.get('example'))
    return result

@api.post("/vocabulary")
async def upsert_vocabulary(request: Request):
    body = await request.json()
    term = clean_word_field(body.get('term'))
    meaning = clean_word_field(body.get('meaning'))
    example = clean_word_field(body.get('example'))
    if not term and not meaning:
        return JSONResponse({"error": "Adj meg legalább egy angol vagy magyar szót."}, status_code=400)

    dictionary_id = clean_word_field(body.get('dictionaryId'))
    catalog_word = await db.dictionary.find_one({'key': dictionary_id}) if dictionary_id else None
    if catalog_word:
        checked = {
            'valid': True,
            'reason': '',
            'term': clean_word_field(catalog_word.get('term')),
            'meaning': clean_word_field(catalog_word.get('meaning')),
            'example': clean_word_field(catalog_word.get('example')),
            'partOfSpeech': catalog_word.get('partOfSpeech') or 'other',
            'canonicalized': term.lower() != str(catalog_word.get('term', '')).lower() or meaning != catalog_word.get('meaning', ''),
        }
    else:
        try:
            checked = await validate_vocab(term, meaning, example)
        except Exception as e:
            logger.error("vocab validation failed %s", e)
            return JSONResponse({"error": "A szóellenőrző most nem elérhető. Próbáld újra.", "code": "VOCAB_VALIDATION_UNAVAILABLE"}, status_code=503)
    if not checked.get('valid') or not checked.get('term') or not checked.get('meaning'):
        return JSONResponse({"error": checked.get('reason') or "Ez nem el\u00e9g tiszta, tanulhat\u00f3 sz\u00f3.", "code": "INVALID_VOCAB"}, status_code=422)
    term, meaning, example = checked['term'], checked['meaning'], checked['example']
    state = await load_state()
    vocab = state.setdefault('vocabulary', [])
    word = None
    if body.get('id'):
        word = next((v for v in vocab if v.get('id') == body['id']), None)
    if not word and term:
        word = next((v for v in vocab if str(v.get('term', '')).lower() == term.lower()), None)
    if word:
        if term: word['term'] = term
        if meaning: word['meaning'] = meaning
        if example: word['example'] = example
        if body.get('saved') is not False: word['saved'] = True
        word.setdefault('savedAt', now_iso())
        word['source'] = clean_word_field(body.get('source')) or word.get('source', 'manual')
        word['sourceLanguage'] = 'en'
        word['partOfSpeech'] = checked.get('partOfSpeech') or word.get('partOfSpeech')
        word.setdefault('mastery', 40)
        word.setdefault('status', 'uncertain')
        word.setdefault('nextReview', (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat())
        word.setdefault('attempts', 0)
        word.setdefault('correct', 0)
    else:
        word = {"id": f"v_{int(time.time()*1000)}_{random.randint(1000,9999)}", "term": term, "meaning": meaning,
                "example": example, "partOfSpeech": checked.get('partOfSpeech'), "mastery": 40, "status": "uncertain",
                "nextReview": (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat(), "attempts": 0, "correct": 0,
                "saved": body.get('saved') is not False, "savedAt": now_iso(),
                "source": clean_word_field(body.get('source')) or 'manual', "sourceLanguage": "en"}
        vocab.insert(0, word)
    ensure_sr(word)
    ensure_skill_progress(word)
    if dictionary_id:
        dp = state.get('dictionaryProgress', {}).get(dictionary_id)
        if dp:
            ensure_skill_progress(dp)
            word['dictionaryId'] = dictionary_id
            word['skillMastery'] = dict(dp.get('skillMastery', word.get('skillMastery', {})))
            word['skillStats'] = dict(dp.get('skillStats', word.get('skillStats', {})))
            word['skillAverage'] = dp.get('skillAverage', word.get('skillAverage', 40))
            word['weakestSkill'] = dp.get('weakestSkill', word.get('weakestSkill'))
    await save_state(state)
    return {"ok": True, "word": word, "state": public_state(state), "canonicalized": checked.get('canonicalized') is True}

@api.delete("/vocabulary/{vid}")
async def delete_vocabulary(vid: str):
    clean = (vid or '').strip()
    if not clean:
        return JSONResponse({"error": "Hi\u00e1nyzik a sz\u00f3 azonos\u00edt\u00f3ja."}, status_code=400)
    state = await load_state()
    vocab = state.setdefault('vocabulary', [])
    before = len(vocab)
    if clean.startswith('term:'):
        term = clean[5:].lower()
        state['vocabulary'] = [v for v in vocab if str(v.get('term', '')).lower() != term]
    else:
        state['vocabulary'] = [v for v in vocab if v.get('id') != clean]
    if len(state['vocabulary']) == before:
        return JSONResponse({"error": "A sz\u00f3 m\u00e1r nincs a list\u00e1ban."}, status_code=404)
    await save_state(state)
    return {"ok": True, "state": public_state(state)}

@api.post("/profile")
async def update_profile(request: Request):
    body = await request.json()
    state = await load_state()
    state['user'] = {**state.get('user', {}), **(body.get('user') or {})}
    state['profile'] = {**state.get('profile', {}), **(body.get('profile') or {})}
    if body.get('onboarded') is True:
        state['user']['onboarded'] = True
    await save_state(state)
    return {"ok": True, "state": public_state(state)}

@api.post("/homework")
async def toggle_homework(request: Request):
    body = await request.json()
    state = await load_state()
    item = next((x for x in state.get('homework', []) if x.get('id') == body.get('id')), None)
    if item:
        item['done'] = bool(body.get('done'))
    await save_state(state)
    return {"ok": True, "state": public_state(state)}


@api.post("/practice-focus")
async def save_practice_focus(request: Request):
    body = await request.json()
    title = clean_word_field(body.get("title"))[:120]
    detail = clean_word_field(body.get("detail"))[:500]
    if not title:
        return JSONResponse({"error": "Hiányzik a gyakorlási téma."}, status_code=400)
    state = await load_state()
    items = state.setdefault("practiceFocus", [])
    key = re.sub(r"\s+", " ", title.lower()).strip()
    existing = next((x for x in items if re.sub(r"\s+", " ", str(x.get("title","")).lower()).strip() == key), None)
    if existing:
        existing.update({"detail": detail or existing.get("detail",""), "source": body.get("source") or existing.get("source","manual"), "updatedAt": now_iso()})
        item = existing
    else:
        item = {"id": f"pf_{int(time.time()*1000)}_{random.randint(1000,9999)}", "title": title, "detail": detail,
                "source": clean_word_field(body.get("source")) or "manual", "scenarioId": clean_word_field(body.get("scenarioId")),
                "createdAt": now_iso(), "done": False}
        items.insert(0, item)
    state["practiceFocus"] = items[:40]
    await save_state(state)
    return {"ok": True, "item": item, "state": public_state(state)}

@api.delete("/practice-focus/{focus_id}")
async def delete_practice_focus(focus_id: str):
    state = await load_state()
    state["practiceFocus"] = [x for x in state.get("practiceFocus", []) if x.get("id") != focus_id]
    await save_state(state)
    return {"ok": True, "state": public_state(state)}

@api.delete("/privacy/reset")
async def reset_learning():
    seed = json.loads((ROOT_DIR / 'seed_state.json').read_text(encoding='utf-8'))
    seed['sessions'] = []
    seed['homework'] = [{**x, 'done': False} for x in seed.get('homework', [])]
    await save_state(seed)
    return {"ok": True, "state": public_state(seed)}

def fallback_analysis(transcript, duration):
    return {"headline": "K\u00e9sz \u2014 az \u00f3ra lez\u00e1rult.",
            "speaking_minutes": max(1, round(duration / 60)),
            "wins": ["V\u00e9gig besz\u00e9lt\u00e9l az \u00f3r\u00e1n.", "T\u00f6bb sz\u00f3kincs elem akt\u00edvan el\u0151j\u00f6tt."],
            "corrections": [], "vocabulary": [], "next_focus": "Folytatjuk innen legk\u00f6zelebb.",
            "homework": [{"title": "3 perces mini ism\u00e9tl\u00e9s", "detail": "Alkoss 4 mondatot a mai sz\u00f3val, mondd ki hangosan.", "minutes": 3}],
            "memory_updates": []}

def norm_vocab_key(v=''):
    v = str(v or '').lower().replace('\u2019', "'").replace('\u2018', "'")
    v = re.sub(r"[^a-z0-9' \-]+", ' ', v)
    return re.sub(r'\s+', ' ', v).strip()

@api.post("/session/analyze")
async def analyze_session(request: Request):
    body = await request.json()
    state = await load_state()
    transcript = [x for x in (body.get('transcript') or []) if x and x.get('text')][-240:]
    duration = int(body.get('durationSeconds') or 0)
    baseline = set(k for k in (norm_vocab_key(x) for x in (body.get('baselineVocabulary') or [])) if k)
    result = None
    if OPENAI_API_KEY and transcript:
        schema = {"type": "object", "additionalProperties": False, "properties": {
            "headline": {"type": "string"}, "speaking_minutes": {"type": "integer"},
            "wins": {"type": "array", "items": {"type": "string"}, "maxItems": 4},
            "corrections": {"type": "array", "maxItems": 6, "items": {"type": "object", "additionalProperties": False, "properties": {
                "original": {"type": "string"}, "corrected": {"type": "string"}, "reason": {"type": "string"},
                "type": {"type": "string"}, "severity": {"type": "string", "enum": ["low", "medium", "high"]}},
                "required": ["original", "corrected", "reason", "type", "severity"]}},
            "vocabulary": {"type": "array", "maxItems": 8, "items": {"type": "object", "additionalProperties": False, "properties": {
                "term": {"type": "string"}, "meaning": {"type": "string"}, "example": {"type": "string"}, "mastery": {"type": "integer"}},
                "required": ["term", "meaning", "example", "mastery"]}},
            "next_focus": {"type": "string"},
            "homework": {"type": "array", "maxItems": 3, "items": {"type": "object", "additionalProperties": False, "properties": {
                "title": {"type": "string"}, "detail": {"type": "string"}, "minutes": {"type": "integer"}},
                "required": ["title", "detail", "minutes"]}},
            "memory_updates": {"type": "array", "maxItems": 10, "items": {"type": "object", "additionalProperties": False, "properties": {
                "kind": {"type": "string", "enum": ["vocabulary", "grammar", "preference"]}, "key": {"type": "string"},
                "delta": {"type": "integer"}, "note": {"type": "string"}},
                "required": ["kind", "key", "delta", "note"]}}},
            "required": ["headline", "speaking_minutes", "wins", "corrections", "vocabulary", "next_focus", "homework", "memory_updates"]}
        prompt = f"""Learner profile: {json.dumps(state.get('profile', {}))}
Vocabulary that ALREADY existed before this session (EXCLUDE from vocabulary output): {json.dumps(list(baseline))}
Existing grammar patterns: {json.dumps(state.get('grammar', []))}
Session mode: {body.get('mode', 'business')}
Scenario id: {body.get('scenarioId') or ''}
Role-play controller observations (use ONLY when supported by the transcript): {json.dumps((body.get('observedMistakes') or [])[:20])}
Duration seconds: {duration}
Transcript JSON: {json.dumps(transcript)}
Analyse ONLY this session. If this is a scenario session, judge whether the learner communicated successfully in the real-life situation, then identify the most useful concrete English mistakes or missing phrases to practise. Preserve the learner exact wording in correction.original. Do not invent errors. Hungarian explanations preferred. For vocabulary: ONLY genuinely useful English words/phrases that appear in THIS transcript and were NOT in the baseline. Update mastery cautiously (delta -6..+8). Homework 3\u201310 minutes based on this session."""
        try:
            result = await openai_responses(prompt, 'You are LIVO lesson analyst. Return rigorous structured learning data, not generic praise.', 'livo_session_analysis', schema, timeout=12)
        except Exception as e:
            logger.error("analysis fallback %s", e)
            result = fallback_analysis(transcript, duration)
    else:
        result = fallback_analysis(transcript, duration)
    # filter vocabulary to items appearing in transcript and not baseline
    transcript_text = ' ' + norm_vocab_key(' '.join(str(x.get('text', '')) for x in transcript)) + ' '
    filtered = []
    seen = set()
    for raw in result.get('vocabulary', []):
        k = norm_vocab_key(raw.get('term', ''))
        if not k or k in seen or k in baseline:
            continue
        if k not in transcript_text:
            continue
        seen.add(k)
        filtered.append(raw)
    result['vocabulary'] = filtered[:8]
    # persist mastery updates
    for u in result.get('memory_updates', []):
        if u.get('kind') == 'vocabulary':
            v = next((x for x in state.get('vocabulary', []) if x.get('term', '').lower() == str(u.get('key')).lower()), None)
            if v:
                v['mastery'] = clamp(v.get('mastery', 40) + clamp(int(u.get('delta') or 0), -8, 8), 0, 100)
                v['status'] = 'stable' if v['mastery'] >= 82 else ('learning' if v['mastery'] >= 60 else 'uncertain')
        elif u.get('kind') == 'grammar':
            g = next((x for x in state.get('grammar', []) if str(u.get('key')).lower() in x.get('pattern', '').lower() or x.get('pattern', '').lower() in str(u.get('key')).lower()), None)
            if g:
                g['mastery'] = clamp(g.get('mastery', 50) + clamp(int(u.get('delta') or 0), -8, 8), 0, 100)
                g['count'] = g.get('count', 0) + 1
    session = {"id": f"s_{int(time.time()*1000)}", "createdAt": now_iso(), "mode": body.get('mode', 'business'),
               "teacher": body.get('teacher') or state.get('profile', {}).get('teacher'), "durationSeconds": duration,
               "scenarioId": body.get('scenarioId') or '',
               "transcript": transcript, "summary": result}
    state.setdefault('sessions', []).insert(0, session)
    state['sessions'] = state['sessions'][:40]
    mins = -(-duration // 60) if duration else 0
    stats = state.setdefault('stats', {})
    stats['totalMinutes'] = stats.get('totalMinutes', 0) + mins
    stats['weekMinutes'] = stats.get('weekMinutes', 0) + mins
    sub = state.setdefault('subscription', {})
    sub['usedMinutes'] = sub.get('usedMinutes', 0) + mins
    if result.get('homework'):
        new_hw = [{"id": f"hw_{int(time.time()*1000)}_{i}", **h, "done": False} for i, h in enumerate(result['homework'])]
        state['homework'] = (new_hw + state.get('homework', []))[:12]
    await save_state(state)
    return {"analysis": result, "state": public_state(state)}

@api.post("/voice-preview")
async def voice_preview(request: Request):
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    body = await request.json()
    t = teachers.get(body.get('teacher'), teachers['james'])
    text = str(body.get('text') or f"Hi, I'm {t['name']}. We'll make your English clearer and more confident.")[:800]
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post('https://api.openai.com/v1/audio/speech',
                headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
                json={'model': TTS_MODEL, 'voice': t['voice'], 'input': text,
                      'instructions': f"Speak in {t['accent']}. {t['style']}. Natural tutor introduction.", 'response_format': 'mp3'})
        if r.status_code >= 400:
            return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get('content-type', 'application/octet-stream'))
        return Response(content=r.content, media_type='audio/mpeg')
    except Exception as e:
        logger.error("voice preview %s", e)
        return JSONResponse({"error": "Could not create voice preview."}, status_code=502)

@api.post("/pronounce")
async def pronounce(request: Request):
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    body = await request.json()
    text = clean_word_field(body.get('text'))[:120].strip()
    if not text:
        return JSONResponse({"error": "Hi\u00e1nyzik a kiejtend\u0151 sz\u00f6veg."}, status_code=400)
    t = teachers.get(body.get('teacher'), teachers['maya'])
    delivery = body.get('delivery') if body.get('delivery') in ('normal', 'slow', 'syllables', 'word_only') else 'normal'
    delivery_instruction = {
        'normal': 'Say it exactly once at normal, natural conversational speed.',
        'slow': 'Say it exactly once noticeably slower than normal, while keeping natural native pronunciation.',
        'syllables': 'Pronounce it syllable by syllable with short clean pauses between syllables, then say the complete word once naturally. Do not name letters.',
        'word_only': 'Say ONLY the target exactly once. No lead-in, no repetition, no explanation.',
    }[delivery]
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post('https://api.openai.com/v1/audio/speech',
                headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
                json={'model': TTS_MODEL, 'voice': t['voice'], 'input': text,
                      'instructions': f"Pronounce this English word or phrase in clear, natural, native {t['accent']} pronunciation. {delivery_instruction} Do NOT add translation, commentary or unrelated words.",
                      'response_format': 'mp3'})
        if r.status_code >= 400:
            return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get('content-type', 'application/octet-stream'))
        return Response(content=r.content, media_type='audio/mpeg')
    except Exception as e:
        logger.error("pronounce %s", e)
        return JSONResponse({"error": "Could not create pronunciation audio."}, status_code=502)

@api.post("/task-eval")
async def task_eval(request: Request):
    body = await request.json()
    kind = body.get('kind') if body.get('kind') in ('translate', 'repeat', 'meaning') else 'repeat'
    source = str(body.get('source', '')).strip()[:200]
    expected = str(body.get('expected', '')).strip()[:200]
    learner = str(body.get('learnerText', '')).strip()[:500]
    context = str(body.get('context', '')).strip()[:800]
    if not learner:
        return {"state": "wrong", "correctAnswer": expected, "reason": "Nem \u00e9rkezett felismerhet\u0151 v\u00e1lasz."}
    if not OPENAI_API_KEY:
        return JSONResponse({"error": "OPENAI_API_KEY is not set.", "code": "NO_API_KEY"}, status_code=503)
    schema = {"type": "object", "additionalProperties": False, "properties": {
        "state": {"type": "string", "enum": ["correct", "almost_correct", "wrong"]},
        "correctAnswer": {"type": "string"}, "reason": {"type": "string"}},
        "required": ["state", "correctAnswer", "reason"]}
    if kind == 'translate':
        task_desc = f"The learner was asked to translate this Hungarian phrase into natural English: {json.dumps(source)}. A good expected English answer is: {json.dumps(expected)}."
    elif kind == 'meaning':
        task_desc = f"The learner was asked to explain in Hungarian what this English word or phrase means: {json.dumps(source)}. A concise expected Hungarian meaning is: {json.dumps(expected)}."
    else:
        task_desc = f"The learner was asked to repeat/say this exact English target aloud: {json.dumps(expected or source)}."
    prompt = f"""You evaluate ONE spoken answer from a Hungarian learner in a live English lesson. Judge MEANING and correctness, NOT exact string match. ASR may mis-spell; be tolerant of spelling/punctuation/filler.
{task_desc}
Learner's spoken answer (from speech-to-text): {json.dumps(learner)}
Live context: {json.dumps(context)}
Return:
- state = "correct" if the answer is correct or fully acceptable (minor accent/spelling/word-order variants are still correct).
- state = "almost_correct" if the core idea is right but there is one clear fixable error (wrong tense, small grammar slip, one wrong word).
- state = "wrong" if it is wrong, empty, off-topic, or in the wrong language.
- correctAnswer = the clean ideal answer in the language required by the task (English for translate/repeat, Hungarian for meaning).
- reason = ONE short, natural Hungarian sentence of feedback."""
    try:
        result = await openai_responses(prompt, 'You are a precise but fair spoken-answer evaluator. Never mark a meaning-correct answer as wrong over spelling.', 'livo_task_eval', schema)
        if not result.get('correctAnswer'):
            result['correctAnswer'] = expected
        return result
    except Exception as e:
        logger.error("task-eval %s", e)
        return {"state": "almost_correct", "correctAnswer": expected, "reason": "Az ellen\u0151rz\u00e9s most nem \u00e9rt\u00e9kelte pontosan \u2014 a tan\u00e1r hangban ellen\u0151rzi."}

STUN_URLS = ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478']

@api.get("/rtc-config")
async def rtc_config():
    """ICE servers for the live WebRTC session. Adds a TURN relay (for firewall/NAT traversal)
    when TURN credentials are configured; otherwise falls back to STUN-only."""
    ice = [{"urls": STUN_URLS}]
    api_key = os.environ.get('METERED_TURN_API_KEY', '')
    domain = os.environ.get('METERED_TURN_DOMAIN', '')
    if api_key and domain:
        try:
            async with httpx.AsyncClient(timeout=8) as c:
                r = await c.get(f'https://{domain}/api/v1/turn/credentials', params={'apiKey': api_key})
            if r.status_code < 400:
                servers = r.json()
                if isinstance(servers, list) and servers:
                    return {"iceServers": servers, "turn": True}
        except Exception as e:
            logger.error("metered turn fetch %s", e)
    turn_urls = os.environ.get('TURN_URLS', '')
    if turn_urls:
        entry = {"urls": [u.strip() for u in turn_urls.split(',') if u.strip()]}
        if os.environ.get('TURN_USERNAME'):
            entry['username'] = os.environ['TURN_USERNAME']
        if os.environ.get('TURN_CREDENTIAL'):
            entry['credential'] = os.environ['TURN_CREDENTIAL']
        return {"iceServers": [{"urls": STUN_URLS}, entry], "turn": True}
    return {"iceServers": ice, "turn": False}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
