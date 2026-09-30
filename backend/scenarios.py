"""Deterministic LIVO role-play scenarios.

The scenario engine owns the finite sequence, hints and limits.
The AI only performs the current role/step; it must not invent a new flow.
"""

SCENARIOS = {
    "airport_checkin": {
        "id": "airport_checkin",
        "title": "Repülőtéri check-in",
        "icon": "plane",
        "theme": "airport",
        "level": "A2",
        "userRole": "passenger",
        "aiRole": "airport check-in employee",
        "description": "Úti cél, útlevél, poggyász, ülőhely és beszállókártya.",
        "maxTurns": 18,
        "hintLimit": 3,
        "helpLimit": 1,
        "steps": [
            {"id":"destination","goal":"The passenger states the destination.","opening":"Good morning. Where are you flying today?","expected":["state a city or country destination"],"hints":["flying","I'm flying to...","I'm flying to London."],"words":["flight","destination"]},
            {"id":"passport","goal":"The passenger responds to a passport request.","opening":"May I see your passport, please?","expected":["hand over or acknowledge passport"],"hints":["passport","Here...","Here you are."],"words":["passport"]},
            {"id":"booking","goal":"Confirm the booking identity.","opening":"What name is the booking under?","expected":["state a name"],"hints":["booking","It's under...","It's under Kaszás."],"words":["booking"]},
            {"id":"baggage","goal":"Say whether there is checked baggage.","opening":"Are you checking in any bags today?","expected":["state number of checked bags or hand luggage only"],"hints":["baggage","I have one...","I have one checked bag."],"words":["baggage","checked bag","hand luggage"]},
            {"id":"weight","goal":"React to a baggage weight issue.","opening":"Your bag is a little over the weight limit. Can you remove something?","expected":["agree, ask how much, or propose moving an item"],"hints":["weight","How much...","How much over the limit is it?"],"words":["weight limit","overweight"]},
            {"id":"seat","goal":"Choose a seat preference.","opening":"Would you prefer a window seat or an aisle seat?","expected":["choose window or aisle"],"hints":["window / aisle","I'd prefer...","I'd prefer an aisle seat, please."],"words":["window seat","aisle seat"]},
            {"id":"dangerous_items","goal":"Answer the security baggage question.","opening":"Do you have any dangerous items or spare lithium batteries in your checked bag?","expected":["answer yes/no appropriately"],"hints":["No","I don't have...","No, I don't have any."],"words":["lithium battery","checked baggage"]},
            {"id":"boarding_pass","goal":"Understand boarding-pass handover.","opening":"All right. Here is your boarding pass.","expected":["acknowledge or thank the employee"],"hints":["thank you","Thanks...","Thank you very much."],"words":["boarding pass"]},
            {"id":"gate","goal":"Understand gate and boarding information.","opening":"Your gate is B12 and boarding starts at 14:20. Is that clear?","expected":["confirm understanding or ask one relevant clarification"],"hints":["gate","Yes, that's...","Yes, that's clear. Thank you."],"words":["gate","boarding"]},
        ],
    },
    "airport_security": {
        "id":"airport_security","title":"Repülőtéri biztonsági ellenőrzés","icon":"shield","theme":"airport","level":"A2","userRole":"passenger","aiRole":"airport security officer",
        "description":"Tálca, laptop, folyadék, fémtárgyak és ellenőrzés.","maxTurns":16,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"tray","goal":"Follow the tray instruction.","opening":"Please put your bag and jacket in a tray.","expected":["acknowledge/follow instruction"],"hints":["tray","Put...","I'll put them in the tray."],"words":["tray","jacket"]},
            {"id":"laptop","goal":"Respond about laptop/electronics.","opening":"Do you have a laptop or tablet in your bag?","expected":["yes/no and optionally identify it"],"hints":["laptop","Yes, I...","Yes, I have a laptop."],"words":["laptop","tablet"]},
            {"id":"liquids","goal":"Respond about liquids.","opening":"Any liquids over 100 millilitres?","expected":["yes/no"],"hints":["liquids","No, I...","No, I don't have any."],"words":["liquid"]},
            {"id":"pockets","goal":"Empty pockets.","opening":"Please empty your pockets before you walk through.","expected":["acknowledge"],"hints":["pockets","Okay, I'll...","Okay, I'll empty my pockets."],"words":["empty","pocket"]},
            {"id":"scanner","goal":"Follow scanner direction.","opening":"Walk through the scanner when you're ready.","expected":["acknowledge"],"hints":["scanner","I'm ready","Okay, I'm ready."],"words":["scanner"]},
            {"id":"secondary","goal":"Handle a secondary check calmly.","opening":"I need to check your bag again. Please step to the side.","expected":["acknowledge or ask why politely"],"hints":["check","Of course","Of course. Is there a problem?"],"words":["secondary check"]},
        ],
    },
    "hotel_checkin": {
        "id":"hotel_checkin","title":"Szállodai bejelentkezés","icon":"hotel","theme":"hotel","level":"A2","userRole":"guest","aiRole":"hotel receptionist",
        "description":"Foglalás, név, éjszakák, reggeli, kaució és kulcs.","maxTurns":16,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"welcome","goal":"Say you have a reservation.","opening":"Good evening. Welcome. Do you have a reservation?","expected":["confirm reservation"],"hints":["reservation","I have...","Yes, I have a reservation."],"words":["reservation"]},
            {"id":"name","goal":"Give the booking name.","opening":"What name is the reservation under?","expected":["state name"],"hints":["under","It's under...","It's under Kaszás."],"words":["under the name"]},
            {"id":"nights","goal":"Confirm number of nights.","opening":"You're staying for three nights, correct?","expected":["confirm or correct"],"hints":["nights","Yes, that's...","Yes, that's correct."],"words":["stay","night"]},
            {"id":"breakfast","goal":"Understand breakfast time.","opening":"Breakfast is from seven to ten. Would you like me to mark that on your key card?","expected":["yes/no"],"hints":["breakfast","Yes, please","Yes, please."],"words":["breakfast","key card"]},
            {"id":"deposit","goal":"Handle a deposit request.","opening":"I need a card for the security deposit, please.","expected":["agree or ask amount"],"hints":["deposit","How much...","How much is the deposit?"],"words":["security deposit"]},
            {"id":"key","goal":"Understand room/floor information.","opening":"Here is your key. Room 508, fifth floor. The lift is on your left.","expected":["acknowledge/thank"],"hints":["thank you","Thanks","Thank you. Have a good evening."],"words":["lift","floor"]},
        ],
    },
    "restaurant_order": {
        "id":"restaurant_order","title":"Éttermi rendelés","icon":"utensils","theme":"restaurant","level":"A2","userRole":"guest","aiRole":"restaurant waiter",
        "description":"Asztal, ital, rendelés, köret, allergia és fizetés.","maxTurns":16,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"table","goal":"State party size.","opening":"Good evening. How many people?","expected":["state party size"],"hints":["people","A table for...","A table for two, please."],"words":["table"]},
            {"id":"drink","goal":"Order a drink.","opening":"Can I get you something to drink?","expected":["order a drink"],"hints":["water","I'd like...","I'd like sparkling water, please."],"words":["sparkling water"]},
            {"id":"main","goal":"Order a main course.","opening":"Are you ready to order?","expected":["order a dish"],"hints":["I'd like","I'd like the...","I'd like the chicken, please."],"words":["order","main course"]},
            {"id":"side","goal":"Choose a side dish.","opening":"Would you like fries, rice or salad with that?","expected":["choose a side"],"hints":["with that","I'll have...","I'll have the salad."],"words":["side dish"]},
            {"id":"allergy","goal":"Respond to allergy question.","opening":"Do you have any food allergies I should know about?","expected":["state allergy or say no"],"hints":["allergy","I don't have...","I don't have any allergies."],"words":["allergy"]},
            {"id":"bill","goal":"Ask for the bill.","opening":"Was everything all right with your meal?","expected":["respond and/or ask for bill"],"hints":["bill","Could we have...","Could we have the bill, please?"],"words":["bill","tip"]},
        ],
    },
    "shopping_return": {
        "id":"shopping_return","title":"Termék visszavitele","icon":"shopping-bag","theme":"shopping","level":"A2","userRole":"customer","aiRole":"shop assistant",
        "description":"Hiba, nyugta, visszatérítés vagy csere.","maxTurns":14,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"problem","goal":"Explain why the item is being returned.","opening":"Hello. How can I help you?","expected":["explain return/problem"],"hints":["return","I'd like to return...","I'd like to return this jacket."],"words":["return"]},
            {"id":"reason","goal":"Give a clear reason.","opening":"What's wrong with it?","expected":["state defect/size/problem"],"hints":["size / broken","It's too...","It's too small for me."],"words":["defective","size"]},
            {"id":"receipt","goal":"Respond about receipt.","opening":"Do you have the receipt?","expected":["yes/no"],"hints":["receipt","Yes, here...","Yes, here it is."],"words":["receipt"]},
            {"id":"choice","goal":"Choose refund or exchange.","opening":"Would you like a refund or an exchange?","expected":["choose refund/exchange"],"hints":["refund / exchange","I'd like...","I'd like a refund, please."],"words":["refund","exchange"]},
            {"id":"payment","goal":"Confirm original payment method.","opening":"Did you pay by card or cash?","expected":["state payment method"],"hints":["card / cash","I paid...","I paid by card."],"words":["payment method"]},
        ],
    },
    "train_station": {
        "id":"train_station","title":"Jegyvásárlás a pályaudvaron","icon":"train","theme":"transport","level":"A2","userRole":"traveller","aiRole":"railway ticket clerk",
        "description":"Úti cél, egyirányú/retúr, időpont, átszállás, vágány.","maxTurns":14,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"destination","goal":"State train destination.","opening":"Where would you like to travel to?","expected":["state destination"],"hints":["to","I'd like to go...","I'd like to go to Vienna."],"words":["destination"]},
            {"id":"return","goal":"Choose single or return ticket.","opening":"Single or return?","expected":["choose single/return"],"hints":["return","A return...","A return ticket, please."],"words":["single ticket","return ticket"]},
            {"id":"time","goal":"Choose departure time.","opening":"What time would you like to leave?","expected":["state time/preference"],"hints":["leave","Around...","Around ten in the morning."],"words":["departure"]},
            {"id":"change","goal":"Understand connection information.","opening":"The cheapest train has one change in Bratislava. Is that okay?","expected":["accept/refuse/ask direct option"],"hints":["change","Is there...","Is there a direct train?"],"words":["change","direct train"]},
            {"id":"platform","goal":"Understand platform information.","opening":"Your train leaves from platform six. Please be there ten minutes early.","expected":["acknowledge"],"hints":["platform","Thank you","Thank you. Platform six."],"words":["platform"]},
        ],
    },
    "taxi_ride": {
        "id":"taxi_ride","title":"Taxi / fuvar","icon":"car","theme":"transport","level":"A2","userRole":"passenger","aiRole":"taxi driver",
        "description":"Cím, útvonal, idő, fizetés.","maxTurns":12,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"destination","goal":"Tell driver where to go.","opening":"Hi. Where are you heading?","expected":["state destination/address"],"hints":["address","Could you take me...","Could you take me to the airport?"],"words":["heading","address"]},
            {"id":"route","goal":"Choose fast/cheap route.","opening":"Do you want the fastest route or the cheaper route?","expected":["choose"],"hints":["fastest / cheaper","The fastest...","The fastest route, please."],"words":["route"]},
            {"id":"time","goal":"Ask or understand ETA.","opening":"It should take about twenty-five minutes with traffic.","expected":["acknowledge or ask arrival time"],"hints":["take","Will we arrive...","Will we arrive before eight?"],"words":["traffic","take"]},
            {"id":"payment","goal":"Ask about card payment.","opening":"We're here. That's twenty-eight euros.","expected":["pay / ask card"],"hints":["card","Can I pay...","Can I pay by card?"],"words":["fare"]},
        ],
    },
    "doctor_visit": {
        "id":"doctor_visit","title":"Orvosnál","icon":"stethoscope","theme":"health","level":"B1","userRole":"patient","aiRole":"doctor",
        "description":"Tünetek, időtartam, fájdalom, gyógyszer és tanács.","maxTurns":16,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"problem","goal":"Describe the main symptom.","opening":"What seems to be the problem today?","expected":["describe symptom"],"hints":["symptom","I've got...","I've got a sore throat and a cough."],"words":["symptom","sore throat"]},
            {"id":"duration","goal":"Say how long symptoms have lasted.","opening":"How long have you had these symptoms?","expected":["state duration"],"hints":["for / since","I've had it for...","I've had it for three days."],"words":["for","since"]},
            {"id":"severity","goal":"Describe severity.","opening":"On a scale from one to ten, how bad is the pain?","expected":["give number/severity"],"hints":["pain","About...","About six out of ten."],"words":["pain"]},
            {"id":"medicine","goal":"State current medication.","opening":"Have you taken any medicine for it?","expected":["yes/no, name medicine"],"hints":["medicine","I've taken...","I've taken some painkillers."],"words":["painkiller"]},
            {"id":"advice","goal":"Understand simple medical advice.","opening":"Rest, drink plenty of fluids, and call us if it gets worse. Do you understand?","expected":["confirm/clarify"],"hints":["understand","Yes, I...","Yes, I understand."],"words":["fluids","get worse"]},
        ],
    },
    "job_interview": {
        "id":"job_interview","title":"Állásinterjú","icon":"briefcase","theme":"interview","level":"B1","userRole":"candidate","aiRole":"job interviewer",
        "description":"Bemutatkozás, tapasztalat, erősség, helyzetkérdés és bérigény.","maxTurns":18,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"intro","goal":"Give a concise professional introduction.","opening":"Tell me a little about yourself.","expected":["short professional introduction"],"hints":["experience","I have experience in...","I have experience in production and team coordination."],"words":["experience"]},
            {"id":"experience","goal":"Describe relevant experience.","opening":"What experience do you have that is relevant to this role?","expected":["describe relevant work"],"hints":["relevant","In my previous role...","In my previous role, I was responsible for..."],"words":["relevant","responsible"]},
            {"id":"strength","goal":"State a strength with evidence.","opening":"What is one of your biggest strengths?","expected":["strength plus example"],"hints":["strength","One of my strengths is...","One of my strengths is problem-solving."],"words":["strength"]},
            {"id":"problem","goal":"Answer a behavioural question.","opening":"Tell me about a time you had to solve a difficult problem at work.","expected":["situation/action/result"],"hints":["situation","The problem was...","The problem was..., so I..., and the result was..."],"words":["result","solve"]},
            {"id":"salary","goal":"Handle salary expectation politely.","opening":"What are your salary expectations?","expected":["state range or diplomatic answer"],"hints":["expectation","I'm looking for...","I'm looking for a salary in the range of..."],"words":["salary expectation"]},
            {"id":"questions","goal":"Ask one relevant interview question.","opening":"Do you have any questions for me?","expected":["ask a relevant job question"],"hints":["team / role","Could you tell me...","Could you tell me more about the team?"],"words":["role","team"]},
        ],
    },
    "business_meeting": {
        "id":"business_meeting","title":"Business meeting","icon":"users","theme":"business","level":"B1","userRole":"team member","aiRole":"meeting chair",
        "description":"Napirend, státusz, probléma, javaslat, határidő.","maxTurns":18,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"status","goal":"Give a short project status.","opening":"Let's start with your update. Where are we with the project?","expected":["status update"],"hints":["status","We're currently...","We're currently on schedule, but..."],"words":["status","on schedule"]},
            {"id":"blocker","goal":"Explain one blocker.","opening":"What's the main issue slowing you down?","expected":["describe blocker"],"hints":["issue","The main issue is...","The main issue is the supplier delay."],"words":["blocker","delay"]},
            {"id":"proposal","goal":"Propose a solution.","opening":"What do you suggest we do?","expected":["make proposal"],"hints":["suggest","I suggest...","I suggest we contact a second supplier."],"words":["suggest","proposal"]},
            {"id":"challenge","goal":"Defend proposal under pushback.","opening":"That will increase costs. Why should we do it?","expected":["give reason/trade-off"],"hints":["because","It would...","It would reduce the risk of a longer delay."],"words":["trade-off","risk"]},
            {"id":"deadline","goal":"Commit to next action/deadline.","opening":"Fine. What can you deliver by Friday?","expected":["commit to deliverable"],"hints":["deliver","By Friday...","By Friday, I can send the revised plan."],"words":["deliverable","deadline"]},
        ],
    },
    "supplier_delay": {
        "id":"supplier_delay","title":"Késő beszállító felhívása","icon":"phone","theme":"business","level":"B1","userRole":"buyer / client","aiRole":"supplier account manager",
        "description":"Késés, ok, új határidő, sürgetés és megoldás.","maxTurns":16,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"identify","goal":"Identify order/problem.","opening":"Good morning, supplier support. How can I help?","expected":["state delayed order issue"],"hints":["order","I'm calling about...","I'm calling about order 1842, which is late."],"words":["order","delay"]},
            {"id":"pushback","goal":"Respond to vague excuse.","opening":"There has been a production issue. We're working on it.","expected":["ask for specifics/new date"],"hints":["delivery date","When exactly...","When exactly can you deliver?"],"words":["production issue","delivery date"]},
            {"id":"deadline","goal":"State why deadline matters.","opening":"I can't guarantee a date yet.","expected":["explain urgency/consequence"],"hints":["urgent","We need...","We need the parts by Thursday or production will stop."],"words":["guarantee","urgent"]},
            {"id":"solution","goal":"Negotiate partial shipment/alternative.","opening":"We may be able to send part of the order first.","expected":["accept/negotiate quantity/date"],"hints":["partial shipment","Can you send...","Can you send half the order tomorrow?"],"words":["partial shipment"]},
            {"id":"confirm","goal":"Confirm agreed next step.","opening":"All right, I'll confirm the quantity by email within an hour.","expected":["confirm and close professionally"],"hints":["confirm","Please confirm...","Please confirm the quantity and delivery time by email."],"words":["confirm"]},
        ],
    },
    "customer_complaint": {
        "id":"customer_complaint","title":"Ügyfélpanasz kezelése","icon":"headphones","theme":"customer_service","level":"B1","userRole":"customer-service agent","aiRole":"angry customer",
        "description":"Panasz megértése, bocsánatkérés, pontosítás, megoldás.","maxTurns":16,"hintLimit":3,"helpLimit":1,
        "steps":[
            {"id":"complaint","goal":"Acknowledge the angry customer's problem.","opening":"I've been waiting a week and my order still isn't here. This is ridiculous.","expected":["acknowledge/apologise"],"hints":["apologise","I'm sorry...","I'm sorry about the delay. Let me check it for you."],"words":["delay","apologise"]},
            {"id":"details","goal":"Ask for identifying details.","opening":"Fine. What do you need from me?","expected":["ask order number/name"],"hints":["order number","Could I have...","Could I have your order number, please?"],"words":["order number"]},
            {"id":"anger","goal":"Stay professional under pressure.","opening":"Why should I trust you? Nobody there has helped me so far.","expected":["reassure without arguing"],"hints":["understand","I understand...","I understand your frustration. I'll take ownership of this."],"words":["frustration","take ownership"]},
            {"id":"solution","goal":"Offer a concrete solution.","opening":"So what are you actually going to do about it?","expected":["offer refund/replacement/expedite"],"hints":["solution","I can...","I can arrange a replacement with express delivery."],"words":["replacement","express delivery"]},
            {"id":"close","goal":"Close with confirmation.","opening":"All right. When will I receive confirmation?","expected":["give confirmation timeline"],"hints":["confirmation","You'll receive...","You'll receive confirmation by email within an hour."],"words":["confirmation"]},
        ],
    },
}

def get_scenario(scenario_id):
    return SCENARIOS.get(str(scenario_id or '').strip())

def public_scenario(item):
    if not item:
        return None
    return {
        "id": item["id"], "title": item["title"], "icon": item.get("icon", "messages"),
        "theme": item["theme"], "level": item["level"], "userRole": item["userRole"],
        "aiRole": item["aiRole"], "description": item["description"],
        "maxTurns": item["maxTurns"], "hintLimit": item["hintLimit"], "helpLimit": item["helpLimit"],
        "steps": [
            {
                "id": s["id"], "opening": s["opening"], "hints": s["hints"],
                "words": s.get("words", []), "goal": s["goal"],
            }
            for s in item["steps"]
        ],
    }

def list_scenarios():
    return [public_scenario(x) for x in SCENARIOS.values()]

def frustration_instruction(level):
    level = max(0, min(3, int(level or 0)))
    return {
        0: "Stay professional, neutral and efficient.",
        1: "Sound slightly impatient, but still professional.",
        2: "Sound clearly impatient and more direct. Do not insult the learner.",
        3: "Sound visibly frustrated and terse, but never abusive, threatening or personal.",
    }[level]

def live_roleplay_prompt(item, step_index=0, frustration=0):
    if not item:
        return ""
    steps = item["steps"]
    lines = []
    for i, step in enumerate(steps, start=1):
        lines.append(f"{i}. {step['id']}: {step['goal']} | opening: {step['opening']}")
    current = steps[max(0, min(len(steps)-1, int(step_index or 0)))]
    return f"""
ROLEPLAY LOCK — HIGHEST PRIORITY
You are now performing a finite LIVO simulation. Your role is: {item['aiRole']}.
The learner role is: {item['userRole']}.
Scenario: {item['title']}.

ABSOLUTE RULES
- Stay in character at all times during normal roleplay turns.
- Never switch topic, never become a general chat assistant, and never start an unrelated conversation.
- Do not teach or correct English during normal roleplay if the learner's meaning is understandable.
- Silently remember meaningful learner mistakes for the end-of-session analysis.
- Ask only ONE thing at a time.
- Never skip ahead on your own.
- The client application owns the scenario sequence. Remain on the CURRENT STEP until a SCENARIO STEP UPDATE instruction arrives.
- If the learner is understandable, react naturally in role.
- If you genuinely cannot understand, ask one short in-character clarification and follow the frustration style below.
- Do not reveal hints unless the client explicitly requests a hint.
- HELP MODE is the only time you may briefly act as an English tutor. After answering that single help question, immediately return to this role and the current scenario step.
- The scenario is finite. Never continue beyond the final step.

FRUSTRATION LEVEL {max(0, min(3, int(frustration or 0)))}:
{frustration_instruction(frustration)}

CURRENT STEP: {current['id']}
CURRENT GOAL: {current['goal']}
CURRENT OPENING: {current['opening']}

FIXED SEQUENCE:
{chr(10).join(lines)}
""".strip()
