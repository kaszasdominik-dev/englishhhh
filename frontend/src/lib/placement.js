export const PLACEMENT_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
export const PLACEMENT_MAX_QUESTIONS = 14;
export const PLACEMENT_MIN_QUESTIONS = 10;

const levelValue = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5 };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const q = (id, cefr, skill, prompt, options, answer, extra = {}) => ({
  id, cefr, difficulty: levelValue[cefr], skill, prompt, options, answer, ...extra,
});

export const PLACEMENT_QUESTIONS = [
  q('a1_g1','A1','grammar','Choose the correct word: I ___ from Hungary.',['am','is','are','be'],'am'),
  q('a1_g2','A1','grammar','Choose the correct sentence.',['She like coffee.','She likes coffee.','She liking coffee.','She do like coffee.'],'She likes coffee.'),
  q('a1_v1','A1','vocabulary','What does “chair” mean?',['asztal','szék','ajtó','ablak'],'szék'),
  q('a1_v2','A1','vocabulary','Which word means “reggel”?',['morning','evening','night','week'],'morning'),
  q('a1_r1','A1','reading','Anna works in a shop. She starts at 8:00. When does Anna start work?',['At 7:00','At 8:00','At 9:00','At 10:00'],'At 8:00'),
  q('a1_r2','A1','reading','Tom has two cats and one dog. How many pets does Tom have?',['One','Two','Three','Four'],'Three'),
  q('a1_l1','A1','listening','Hallgasd meg, majd válaszolj: Where is the speaker going?',['home','to work','to school','to a restaurant'],'to work',{ audioText:'I am going to work now.' }),
  q('a1_l2','A1','listening','Hallgasd meg, majd válaszolj: What does the speaker want?',['water','coffee','tea','milk'],'water',{ audioText:'Can I have some water, please?' }),

  q('a2_g1','A2','grammar','Yesterday I ___ to the office.',['go','went','gone','going'],'went'),
  q('a2_g2','A2','grammar','There ___ any milk in the fridge.',['isn’t','aren’t','don’t','doesn’t'],'isn’t'),
  q('a2_v1','A2','vocabulary','Which word is closest to “cheap”?',['expensive','inexpensive','heavy','slow'],'inexpensive'),
  q('a2_v2','A2','vocabulary','What does “borrow” mean?',['kölcsönadni','kölcsönkérni','eladni','megjavítani'],'kölcsönkérni'),
  q('a2_r1','A2','reading','Marta missed the bus, so she walked to work. Why did she walk?',['She likes walking.','She missed the bus.','Her car broke down.','She was early.'],'She missed the bus.'),
  q('a2_r2','A2','reading','The meeting starts at 2, but please arrive fifteen minutes early. When should you arrive?',['1:15','1:30','1:45','2:15'],'1:45'),
  q('a2_l1','A2','listening','Hallgasd meg: What did the speaker do last night?',['worked','watched a film','cooked dinner','went running'],'watched a film',{ audioText:'Last night I stayed home and watched a film.' }),
  q('a2_l2','A2','listening','Hallgasd meg: Why is the speaker late?',['traffic','overslept','missed the train','lost the keys'],'traffic',{ audioText:'Sorry I am late. The traffic was terrible this morning.' }),

  q('b1_g1','B1','grammar',"I've lived here ___ 2022.",['for','since','from','during'],'since'),
  q('b1_g2','B1','grammar','If it rains tomorrow, we ___ at home.',['stay','stayed','will stay','would stay'],'will stay'),
  q('b1_v1','B1','vocabulary','What does “deadline” mean?',['határidő','munkakör','fizetés','szerződés'],'határidő'),
  q('b1_v2','B1','vocabulary','Which word best completes this? We need to ___ a solution.',['reach','take','bring','arrive'],'reach'),
  q('b1_r1','B1','reading','The company introduced flexible hours to reduce stress. Staff can now start between 7 and 10. What changed?',['Salaries increased.','Starting times became flexible.','The office moved.','Working days became shorter.'],'Starting times became flexible.'),
  q('b1_r2','B1','reading','Peter accepted the offer although the salary was lower because the role offered better career prospects. Why did he accept it?',['Higher salary','Shorter commute','Better career prospects','More holidays'],'Better career prospects'),
  q('b1_l1','B1','listening','Hallgasd meg: What is the problem?',['The order is late.','The invoice is wrong.','The client cancelled.','The price increased.'],'The invoice is wrong.',{ audioText:'I checked the invoice and the total amount is not correct.' }),
  q('b1_l2','B1','listening','Hallgasd meg: What will the speaker do next?',['call the supplier','send an email','cancel the order','wait until Friday'],'call the supplier',{ audioText:'The parts still have not arrived, so I will call the supplier this afternoon.' }),

  q('b2_g1','B2','grammar','If I ___ about the problem earlier, I would have helped.',['knew','had known','would know','have known'],'had known'),
  q('b2_g2','B2','grammar','The report ___ by Friday, according to the manager.',['must finish','must be finished','must have finish','is must finished'],'must be finished'),
  q('b2_v1','B2','vocabulary','Which word is closest to “reluctant”?',['eager','unwilling','certain','confused'],'unwilling'),
  q('b2_v2','B2','vocabulary','Choose the best phrase: The new system should ___ efficiency.',['enhance','rise','grow up','enlarge'],'enhance'),
  q('b2_r1','B2','reading','Although the proposal was initially rejected, the team revised the financial assumptions and resubmitted it. It was approved the following week. What led to approval?',['A new team','A lower price','Revised financial assumptions','A different deadline'],'Revised financial assumptions'),
  q('b2_r2','B2','reading','The author argues that remote work increases autonomy, but warns that weak communication routines can undermine collaboration. What is the main point?',['Remote work always fails.','Autonomy and communication both matter.','Office work is more efficient.','Collaboration is unnecessary.'],'Autonomy and communication both matter.'),
  q('b2_l1','B2','listening','Hallgasd meg: What is the speaker suggesting?',['cancel the project','delay the launch','hire more people','reduce the price'],'delay the launch',{ audioText:'Given the remaining technical issues, I think we should push the launch back by two weeks rather than rush it.' }),
  q('b2_l2','B2','listening','Hallgasd meg: What is the speaker’s main concern?',['cost','quality','schedule','staff turnover'],'quality',{ audioText:'We can probably meet the deadline, but I am worried that moving this quickly will compromise quality.' }),

  q('c1_g1','C1','grammar','Hardly ___ the meeting started when the fire alarm went off.',['had','has','did','was'],'had'),
  q('c1_g2','C1','grammar','Choose the most natural sentence.',['Not only the plan failed, but it was costly too.','Not only did the plan fail, but it was also costly.','Not only did fail the plan, but costly it was.','The plan not only did fail but costly.'],'Not only did the plan fail, but it was also costly.'),
  q('c1_v1','C1','vocabulary','Which word is closest to “ambiguous”?',['unclear','obvious','irrelevant','precise'],'unclear'),
  q('c1_v2','C1','vocabulary','Choose the best word: The evidence does not ___ such a strong conclusion.',['warrant','owe','claim','afford'],'warrant'),
  q('c1_r1','C1','reading','The policy may improve short-term output, yet its long-term effect is uncertain because the incentives could encourage quantity at the expense of quality. What is the author’s reservation?',['Output will fall immediately.','The policy is too expensive.','Quality may suffer in the long term.','The incentives are too weak.'],'Quality may suffer in the long term.'),
  q('c1_r2','C1','reading','The report stops short of recommending regulation; instead, it argues that voluntary standards should first be tested under independent oversight. What does it advocate initially?',['Immediate regulation','No oversight','Testing voluntary standards','Abandoning standards'],'Testing voluntary standards'),
  q('c1_l1','C1','listening','Hallgasd meg: What is implied?',['The proposal is ready.','The proposal needs further work.','The proposal was rejected permanently.','No decision is possible.'],'The proposal needs further work.',{ audioText:'I would not dismiss the proposal, but in its current form I would hesitate to recommend approval.' }),
  q('c1_l2','C1','listening','Hallgasd meg: What is the speaker’s position?',['strongly supportive','cautiously supportive','completely opposed','indifferent'],'cautiously supportive',{ audioText:'There are clear benefits, provided we address the implementation risks before committing to a full rollout.' }),
];

export function initialPlacementState() {
  return { ability: 2.6, history: [], usedIds: [], skillCounts: {} };
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
  const direction = correct ? 0.42 : -0.48;
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
