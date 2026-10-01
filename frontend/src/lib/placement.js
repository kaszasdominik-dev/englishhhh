export const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const PLACEMENT_MAX_QUESTIONS = 12;
export const PLACEMENT_MIN_QUESTIONS = 10;

const levelValue = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const q = (id, cefr, skill, prompt, options, answer, extra = {}) => ({
  id, cefr, difficulty: levelValue[cefr], skill, prompt, options, answer, ...extra,
});

export const PLACEMENT_QUESTIONS = [
  // A1 — basic everyday English
  q('a1_g1','A1','grammar','Choose the correct word: I ___ tired.',['am','is','are','be'],'am'),
  q('a1_g2','A1','grammar','Choose the correct sentence.',['She have two brothers.','She has two brothers.','She having two brothers.','She is have two brothers.'],'She has two brothers.'),
  q('a1_v1','A1','vocabulary','What does “hungry” mean?',['éhes','fáradt','szomjas','mérges'],'éhes'),
  q('a1_v2','A1','vocabulary','Which word means “konyha”?',['bedroom','kitchen','garden','bathroom'],'kitchen'),
  q('a1_r1','A1','reading','Emma gets up at 7:00 and leaves home at 7:40. When does she get up?',['At 6:40','At 7:00','At 7:40','At 8:00'],'At 7:00'),
  q('a1_r2','A1','reading','Ben likes apples, but he does not like bananas. What does Ben like?',['Apples','Bananas','Both','Neither'],'Apples'),
  q('a1_l1','A1','listening','Hallgasd meg: What should the listener close?',['the door','the window','the book','the bag'],'the window',{ audioText:'Please close the window. It is cold in here.' }),
  q('a1_l2','A1','listening','Hallgasd meg: When is the speaker’s birthday?',['March','May','July','October'],'May',{ audioText:'My birthday is in May.' }),

  // A2 — common situations, simple past/future and everyday vocabulary
  q('a2_g1','A2','grammar','Yesterday we ___ dinner at home.',['eat','ate','eaten','eating'],'ate'),
  q('a2_g2','A2','grammar','This book is ___ than the other one.',['interesting','more interesting','most interesting','interest'],'more interesting'),
  q('a2_v1','A2','vocabulary','What does “neighbour” mean?',['szomszéd','rokon','utas','tanár'],'szomszéd'),
  q('a2_v2','A2','vocabulary','Which word is closest to “usually”?',['never','normally','suddenly','only'],'normally'),
  q('a2_r1','A2','reading','Luca missed the bus, so she took a taxi. Why did she take a taxi?',['She was tired.','She missed the bus.','She likes taxis.','It was raining.'],'She missed the bus.'),
  q('a2_r2','A2','reading','The museum opens at 10, but we want to arrive twenty minutes early. When should we arrive?',['9:20','9:40','10:20','10:40'],'9:40'),
  q('a2_l1','A2','listening','Hallgasd meg: Why could the speaker not sleep?',['It was hot.','The neighbours were noisy.','They were hungry.','They were working.'],'The neighbours were noisy.',{ audioText:'I could not sleep because the neighbours were very noisy.' }),
  q('a2_l2','A2','listening','Hallgasd meg: Where will they meet?',['at the station','outside the cinema','at home','in a café'],'outside the cinema',{ audioText:'Let us meet outside the cinema at half past six.' }),

  // B1 — independent everyday communication, without business vocabulary
  q('b1_g1','B1','grammar',"I've lived here ___ 2022.",['for','since','from','during'],'since'),
  q('b1_g2','B1','grammar','If it rains tomorrow, we ___ at home.',['stay','stayed','will stay','would stay'],'will stay'),
  q('b1_v1','B1','vocabulary','What does “avoid” mean?',['elkerülni','megengedni','elfelejteni','megérkezni'],'elkerülni'),
  q('b1_v2','B1','vocabulary','Which word best completes this? I was tired, ___ I went to bed early.',['so','although','unless','while'],'so'),
  q('b1_r1','B1','reading','Nora started cycling to work because the bus was often crowded. She says cycling also gives her more energy in the morning. Why did she change how she travels?',['The bus was often crowded.','She sold her car.','Her office moved.','Cycling is free at weekends.'],'The bus was often crowded.'),
  q('b1_r2','B1','reading','They planned to spend the weekend by the lake, but the weather forecast predicted heavy rain, so they changed their plans and stayed in the city. Why did they change their plans?',['They were ill.','The hotel was full.','Heavy rain was expected.','They missed the train.'],'Heavy rain was expected.'),
  q('b1_l1','B1','listening','Hallgasd meg: What is the speaker still doing?',['looking for a house','unpacking boxes','painting the kitchen','buying furniture'],'unpacking boxes',{ audioText:'I moved into my new flat last week, but I am still unpacking boxes.' }),
  q('b1_l2','B1','listening','Hallgasd meg: What will the speaker probably do?',['go for a walk','stay inside','visit a friend','cook outside'],'stay inside',{ audioText:'I wanted to go for a walk, but it has started raining heavily, so I think I will stay in.' }),

  // B2 — more nuanced grammar and meaning, still general-life topics
  q('b2_g1','B2','grammar','If I ___ about the traffic, I would have left earlier.',['knew','had known','would know','have known'],'had known'),
  q('b2_g2','B2','grammar','The old bridge ___ next year.',['will repair','will be repaired','will be repair','repairs'],'will be repaired'),
  q('b2_v1','B2','vocabulary','Which word is closest to “reluctant”?',['unwilling','excited','certain','careless'],'unwilling'),
  q('b2_v2','B2','vocabulary','What does “eventually” mean in this sentence: “Eventually, we found the right address.”?',['azonnal','végül','véletlenül','ritkán'],'végül'),
  q('b2_r1','B2','reading','Many people silence phone notifications while studying. This does not remove every distraction, but it can make it easier to stay focused for longer periods. What is the main idea?',['Phones make studying impossible.','Silencing notifications can help concentration.','People should never use phones.','Long study sessions are always better.'],'Silencing notifications can help concentration.'),
  q('b2_r2','B2','reading','Mira enjoys running, but she stopped following a strict training plan because it made exercise feel like an obligation. She now runs when she feels like it and enjoys it more. Why did she change her routine?',['She became injured.','She wanted exercise to feel less forced.','She had less free time.','She started swimming instead.'],'She wanted exercise to feel less forced.'),
  q('b2_l1','B2','listening','Hallgasd meg: Why is the speaker unsure about joining the hike?',['the distance','the weather','the people','the cost'],'the weather',{ audioText:'I would really like to join the hike, but the weather forecast makes me hesitate.' }),
  q('b2_l2','B2','listening','Hallgasd meg: What does the speaker suggest?',['leaving now','waiting a little longer','cancelling everything','asking someone else'],'waiting a little longer',{ audioText:'We could leave now, but I would rather wait another half hour and see if the rain gets lighter.' }),

  // C1 — advanced nuance; these should appear only after strong earlier answers
  q('c1_g1','C1','grammar','Choose the most natural sentence.',['Rarely I have seen such a quiet place.','Rarely have I seen such a quiet place.','Rarely did I have seen such a quiet place.','Rarely I saw have such a quiet place.'],'Rarely have I seen such a quiet place.'),
  q('c1_g2','C1','grammar','I bought extra food, but in the end nobody came. I ___ so much.',['needn’t have bought','mustn’t buy','didn’t need buy','wouldn’t have buy'],'needn’t have bought'),
  q('c1_v1','C1','vocabulary','Which word is closest to “ambiguous”?',['unclear','obvious','ordinary','precise'],'unclear'),
  q('c1_v2','C1','vocabulary','Which word best fits? Her answer was so ___ that I could not tell whether she agreed.',['straightforward','subtle','identical','permanent'],'subtle'),
  q('c1_r1','C1','reading','People often assume that remembering more information means learning better. However, being able to connect ideas and apply them in a new situation may be a stronger sign of understanding. What distinction does the text make?',['Memory and understanding are not always the same.','Remembering facts is useless.','New situations are easier than old ones.','People should study less.'],'Memory and understanding are not always the same.'),
  q('c1_r2','C1','reading','The writer is not arguing that social media is inherently harmful. Rather, the concern is that constant interruption can gradually reduce our tolerance for sustained attention. What is the writer’s main concern?',['All social media should be banned.','People communicate too much.','Frequent interruption may weaken sustained attention.','Online content is too difficult.'],'Frequent interruption may weaken sustained attention.'),
  q('c1_l1','C1','listening','Hallgasd meg: What is implied?',['The speaker completely dislikes the idea.','The speaker sees value but has reservations.','The speaker has no opinion.','The speaker fully agrees without conditions.'],'The speaker sees value but has reservations.',{ audioText:'I can see why people like the idea, although I am not convinced it would work equally well for everyone.' }),
  q('c1_l2','C1','listening','Hallgasd meg: What does the speaker mean?',['The film was perfect.','The film was terrible.','The film had flaws but was still enjoyable.','The speaker did not watch the film.'],'The film had flaws but was still enjoyable.',{ audioText:'It was not without its flaws, but overall I found the film surprisingly engaging.' }),
];

export function initialPlacementState() {
  return { ability: 2.05, history: [], usedIds: [], skillCounts: {} };
}

export function selectNextQuestion(state) {
  const used = new Set(state.usedIds || []);
  const skillCounts = state.skillCounts || {};
  const pool = PLACEMENT_QUESTIONS.filter(item => !used.has(item.id));
  if (!pool.length) return null;
  return [...pool].sort((a, b) => {
    const aSkillPenalty = (skillCounts[a.skill] || 0) * 0.16;
    const bSkillPenalty = (skillCounts[b.skill] || 0) * 0.16;
    const aScore = Math.abs(a.difficulty - state.ability) + aSkillPenalty;
    const bScore = Math.abs(b.difficulty - state.ability) + bSkillPenalty;
    return aScore - bScore;
  })[0];
}

export function answerPlacementQuestion(state, question, selected) {
  const correct = selected === question.answer;
  const direction = correct ? 0.34 : -0.44;
  const difficultyGap = question.difficulty - state.ability;
  const adjustment = direction + (correct ? Math.max(0, difficultyGap) * 0.12 : Math.min(0, difficultyGap) * 0.08);
  const ability = clamp(state.ability + adjustment, 1, 5);
  return {
    ability,
    usedIds: [...(state.usedIds || []), question.id],
    history: [...(state.history || []), { id: question.id, cefr: question.cefr, skill: question.skill, difficulty: question.difficulty, correct, selected }],
    skillCounts: { ...(state.skillCounts || {}), [question.skill]: (state.skillCounts?.[question.skill] || 0) + 1 },
  };
}

export function shouldFinishPlacement(state) {
  const n = state.history?.length || 0;
  if (n >= PLACEMENT_MAX_QUESTIONS) return true;
  if (n < PLACEMENT_MIN_QUESTIONS) return false;
  const recent = state.history.slice(-5);
  const spread = Math.max(...recent.map(x => x.difficulty)) - Math.min(...recent.map(x => x.difficulty));
  return spread <= 1;
}

export function cefrFromAbility(value) {
  if (value < 1.55) return 'A1';
  if (value < 2.55) return 'A2';
  if (value < 3.55) return 'B1';
  if (value < 4.55) return 'B2';
  return 'C1';
}

export function buildPlacementResult(state) {
  const history = state.history || [];
  const bySkill = {};
  for (const item of history) {
    const arr = bySkill[item.skill] || [];
    arr.push(item);
    bySkill[item.skill] = arr;
  }
  const skills = {};
  for (const [skill, items] of Object.entries(bySkill)) {
    const raw = items.reduce((sum, x) => sum + x.difficulty + (x.correct ? 0.28 : -0.62), 0) / items.length;
    skills[skill] = cefrFromAbility(clamp(raw, 1, 5));
  }
  const correct = history.filter(x => x.correct).length;
  return {
    source: 'adaptive_placement',
    cefr: cefrFromAbility(state.ability),
    ability: Number(state.ability.toFixed(2)),
    accuracy: history.length ? Math.round((correct / history.length) * 100) : 0,
    questionCount: history.length,
    skills,
    completedAt: new Date().toISOString(),
    note: 'LIVO CEFR-alapú szintbecslés; nem hivatalos nyelvvizsga.',
  };
}
