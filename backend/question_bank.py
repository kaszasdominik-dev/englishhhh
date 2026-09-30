"""Deterministic 10,000-item LIVO question bank.

No runtime LLM generation is used. The bank is generated from curated themes,
verbs and vocabulary, then stored in MongoDB on first use.
"""
import random
from pymongo import ASCENDING

THEMES = {
    "daily_life": {
        "hu":"Hétköznapok",
        "actions":[("wake up","wakes up","woke up","woken up","waking up","early"),("leave","leaves","left","left","leaving","home"),("start","starts","started","started","starting","work"),("finish","finishes","finished","finished","finishing","work"),("cook","cooks","cooked","cooked","cooking","dinner"),("watch","watches","watched","watched","watching","a series"),("call","calls","called","called","calling","a friend"),("clean","cleans","cleaned","cleaned","cleaning","the kitchen")],
        "vocab":[("routine","napi rutin"),("appointment","időpont"),("weekend","hétvége"),("alarm","ébresztő"),("break","szünet"),("schedule","időbeosztás"),("chores","házimunkák"),("errand","elintéznivaló")]
    },
    "home": {
        "hu":"Otthon",
        "actions":[("open","opens","opened","opened","opening","the window"),("close","closes","closed","closed","closing","the door"),("wash","washes","washed","washed","washing","the dishes"),("repair","repairs","repaired","repaired","repairing","the shelf"),("move","moves","moved","moved","moving","the table"),("vacuum","vacuums","vacuumed","vacuumed","vacuuming","the carpet"),("paint","paints","painted","painted","painting","the wall"),("lock","locks","locked","locked","locking","the front door")],
        "vocab":[("cupboard","szekrény"),("shelf","polc"),("landlord","főbérlő"),("rent","lakbér"),("balcony","erkély"),("carpet","szőnyeg"),("drawer","fiók"),("ceiling","mennyezet")]
    },
    "family": {
        "hu":"Család",
        "actions":[("visit","visits","visited","visited","visiting","our grandparents"),("help","helps","helped","helped","helping","my brother"),("invite","invites","invited","invited","inviting","the family"),("meet","meets","met","met","meeting","my cousin"),("look after","looks after","looked after","looked after","looking after","the children"),("phone","phones","phoned","phoned","phoning","my parents"),("celebrate","celebrates","celebrated","celebrated","celebrating","a birthday"),("bring","brings","brought","brought","bringing","a present")],
        "vocab":[("relative","rokon"),("cousin","unokatestvér"),("nephew","unokaöcs"),("niece","unokahúg"),("grandparents","nagyszülők"),("engaged","eljegyzett"),("wedding","esküvő"),("household","háztartás")]
    },
    "food_cooking": {
        "hu":"Étel és főzés",
        "actions":[("cut","cuts","cut","cut","cutting","the vegetables"),("boil","boils","boiled","boiled","boiling","the water"),("fry","fries","fried","fried","frying","the onions"),("bake","bakes","baked","baked","baking","a cake"),("serve","serves","served","served","serving","the meal"),("taste","tastes","tasted","tasted","tasting","the soup"),("order","orders","ordered","ordered","ordering","lunch"),("prepare","prepares","prepared","prepared","preparing","dinner")],
        "vocab":[("ingredient","hozzávaló"),("recipe","recept"),("oven","sütő"),("pan","serpenyő"),("slice","felszeletelni"),("portion","adag"),("dessert","desszert"),("spicy","csípős")]
    },
    "shopping": {
        "hu":"Vásárlás",
        "actions":[("buy","buys","bought","bought","buying","a jacket"),("pay","pays","paid","paid","paying","by card"),("return","returns","returned","returned","returning","the shoes"),("try on","tries on","tried on","tried on","trying on","the coat"),("choose","chooses","chose","chosen","choosing","a size"),("compare","compares","compared","compared","comparing","the prices"),("ask for","asks for","asked for","asked for","asking for","a receipt"),("exchange","exchanges","exchanged","exchanged","exchanging","the shirt")],
        "vocab":[("receipt","nyugta"),("refund","visszatérítés"),("discount","kedvezmény"),("checkout","pénztár"),("cashier","pénztáros"),("size","méret"),("fitting room","próbafülke"),("exchange","csere")]
    },
    "city_services": {
        "hu":"Város és szolgáltatások",
        "actions":[("cross","crosses","crossed","crossed","crossing","the street"),("find","finds","found","found","finding","the post office"),("visit","visits","visited","visited","visiting","the library"),("use","uses","used","used","using","the cash machine"),("ask","asks","asked","asked","asking","for directions"),("walk","walks","walked","walked","walking","to the square"),("park","parks","parked","parked","parking","near the station"),("wait","waits","waited","waited","waiting","at the bus stop")],
        "vocab":[("crossing","gyalogátkelő"),("pharmacy","gyógyszertár"),("library","könyvtár"),("town hall","városháza"),("square","tér"),("cash machine","bankautomata"),("pedestrian","gyalogos"),("pavement","járda")]
    },
    "transport": {
        "hu":"Közlekedés",
        "actions":[("catch","catches","caught","caught","catching","the bus"),("miss","misses","missed","missed","missing","the train"),("board","boards","boarded","boarded","boarding","the tram"),("drive","drives","drove","driven","driving","to work"),("change","changes","changed","changed","changing","trains"),("book","books","booked","booked","booking","a ticket"),("leave","leaves","left","left","leaving","the station"),("arrive","arrives","arrived","arrived","arriving","on time")],
        "vocab":[("platform","vágány/peron"),("timetable","menetrend"),("delay","késés"),("fare","viteldíj"),("route","útvonal"),("passenger","utas"),("traffic jam","forgalmi dugó"),("connection","csatlakozás")]
    },
    "travel": {
        "hu":"Utazás",
        "actions":[("pack","packs","packed","packed","packing","a suitcase"),("book","books","booked","booked","booking","a trip"),("visit","visits","visited","visited","visiting","a museum"),("explore","explores","explored","explored","exploring","the old town"),("reserve","reserves","reserved","reserved","reserving","a room"),("take","takes","took","taken","taking","photos"),("plan","plans","planned","planned","planning","the journey"),("check","checks","checked","checked","checking","the map")],
        "vocab":[("destination","úti cél"),("journey","utazás"),("suitcase","bőrönd"),("passport","útlevél"),("guidebook","útikönyv"),("sightseeing","városnézés"),("reservation","foglalás"),("currency","pénznem")]
    },
    "airport": {
        "hu":"Repülőtér",
        "actions":[("check in","checks in","checked in","checked in","checking in","online"),("show","shows","showed","shown","showing","a passport"),("board","boards","boarded","boarded","boarding","the plane"),("weigh","weighs","weighed","weighed","weighing","the luggage"),("scan","scans","scanned","scanned","scanning","the boarding pass"),("collect","collects","collected","collected","collecting","the suitcase"),("pass","passes","passed","passed","passing","through security"),("wait","waits","waited","waited","waiting","at the gate")],
        "vocab":[("boarding pass","beszállókártya"),("gate","kapu"),("luggage","poggyász"),("security","biztonsági ellenőrzés"),("customs","vám"),("runway","kifutópálya"),("departure","indulás"),("arrival","érkezés")]
    },
    "hotel": {
        "hu":"Szálloda",
        "actions":[("check in","checks in","checked in","checked in","checking in","at reception"),("check out","checks out","checked out","checked out","checking out","before eleven"),("reserve","reserves","reserved","reserved","reserving","a double room"),("request","requests","requested","requested","requesting","a late checkout"),("call","calls","called","called","calling","reception"),("use","uses","used","used","using","the room key"),("report","reports","reported","reported","reporting","a problem"),("stay","stays","stayed","stayed","staying","for three nights")],
        "vocab":[("reception","recepció"),("reservation","foglalás"),("single room","egyágyas szoba"),("double room","kétágyas szoba"),("checkout","kijelentkezés"),("towel","törölköző"),("lift","lift"),("guest","vendég")]
    },
    "restaurant": {
        "hu":"Étterem",
        "actions":[("order","orders","ordered","ordered","ordering","the main course"),("recommend","recommends","recommended","recommended","recommending","a dish"),("bring","brings","brought","brought","bringing","the bill"),("serve","serves","served","served","serving","the food"),("reserve","reserves","reserved","reserved","reserving","a table"),("taste","tastes","tasted","tasted","tasting","the sauce"),("choose","chooses","chose","chosen","choosing","dessert"),("ask for","asks for","asked for","asked for","asking for","the menu")],
        "vocab":[("starter","előétel"),("main course","főétel"),("bill","számla"),("tip","borravaló"),("menu","étlap"),("vegetarian","vegetáriánus"),("allergy","allergia"),("reservation","asztalfoglalás")]
    },
    "health": {
        "hu":"Egészség",
        "actions":[("take","takes","took","taken","taking","the medicine"),("book","books","booked","booked","booking","an appointment"),("feel","feels","felt","felt","feeling","better"),("rest","rests","rested","rested","resting","at home"),("call","calls","called","called","calling","the doctor"),("check","checks","checked","checked","checking","the temperature"),("hurt","hurts","hurt","hurt","hurting","my back"),("recover","recovers","recovered","recovered","recovering","quickly")],
        "vocab":[("symptom","tünet"),("fever","láz"),("prescription","recept"),("treatment","kezelés"),("painkiller","fájdalomcsillapító"),("pharmacy","gyógyszertár"),("appointment","időpont"),("recover","felépülni")]
    },
    "work_general": {
        "hu":"Munka",
        "actions":[("start","starts","started","started","starting","a shift"),("finish","finishes","finished","finished","finishing","a task"),("report","reports","reported","reported","reporting","a problem"),("train","trains","trained","trained","training","a new colleague"),("check","checks","checked","checked","checking","the schedule"),("operate","operates","operated","operated","operating","a machine"),("sign","signs","signed","signed","signing","the form"),("wear","wears","wore","worn","wearing","safety shoes")],
        "vocab":[("shift","műszak"),("overtime","túlóra"),("supervisor","felettes"),("colleague","kolléga"),("workplace","munkahely"),("training","képzés"),("task","feladat"),("deadline","határidő")]
    },
    "business": {
        "hu":"Business",
        "actions":[("negotiate","negotiates","negotiated","negotiated","negotiating","the contract"),("send","sends","sent","sent","sending","a proposal"),("review","reviews","reviewed","reviewed","reviewing","the figures"),("contact","contacts","contacted","contacted","contacting","the client"),("approve","approves","approved","approved","approving","the budget"),("prepare","prepares","prepared","prepared","preparing","a presentation"),("increase","increases","increased","increased","increasing","revenue"),("reduce","reduces","reduced","reduced","reducing","costs")],
        "vocab":[("revenue","bevétel"),("expenses","költségek"),("supplier","beszállító"),("proposal","ajánlat/javaslat"),("stakeholder","érintett fél"),("profit","nyereség"),("invoice","számla"),("contract","szerződés")]
    },
    "meetings": {
        "hu":"Megbeszélések",
        "actions":[("join","joins","joined","joined","joining","the meeting"),("present","presents","presented","presented","presenting","the results"),("discuss","discusses","discussed","discussed","discussing","the plan"),("agree","agrees","agreed","agreed","agreeing","on the deadline"),("suggest","suggests","suggested","suggested","suggesting","a solution"),("summarise","summarises","summarised","summarised","summarising","the decision"),("schedule","schedules","scheduled","scheduled","scheduling","a follow-up"),("cancel","cancels","cancelled","cancelled","cancelling","the meeting")],
        "vocab":[("agenda","napirend"),("minutes","jegyzőkönyv"),("action point","feladatpont"),("participant","résztvevő"),("follow-up","utókövetés"),("decision","döntés"),("deadline","határidő"),("consensus","egyetértés")]
    },
    "email_phone": {
        "hu":"E-mail és telefon",
        "actions":[("reply","replies","replied","replied","replying","to the email"),("forward","forwards","forwarded","forwarded","forwarding","the message"),("attach","attaches","attached","attached","attaching","the document"),("call","calls","called","called","calling","the customer"),("leave","leaves","left","left","leaving","a voicemail"),("confirm","confirms","confirmed","confirmed","confirming","the appointment"),("spell","spells","spelled","spelled","spelling","the address"),("receive","receives","received","received","receiving","the email")],
        "vocab":[("attachment","csatolmány"),("subject line","tárgymező"),("recipient","címzett"),("inbox","bejövő levelek"),("voicemail","hangpostaüzenet"),("extension","mellék"),("forward","továbbítani"),("reply","válaszolni")]
    },
    "job_interview": {
        "hu":"Állásinterjú",
        "actions":[("apply","applies","applied","applied","applying","for the job"),("describe","describes","described","described","describing","my experience"),("prepare","prepares","prepared","prepared","preparing","for the interview"),("answer","answers","answered","answered","answering","the question"),("mention","mentions","mentioned","mentioned","mentioning","my strengths"),("explain","explains","explained","explained","explaining","my previous role"),("research","researches","researched","researched","researching","the company"),("arrive","arrives","arrived","arrived","arriving","early")],
        "vocab":[("candidate","jelölt"),("qualification","végzettség/képesítés"),("experience","tapasztalat"),("strength","erősség"),("position","pozíció"),("responsibility","felelősségi kör"),("achievement","eredmény"),("notice period","felmondási idő")]
    },
    "manufacturing": {
        "hu":"Gyártás",
        "actions":[("operate","operates","operated","operated","operating","the machine"),("inspect","inspects","inspected","inspected","inspecting","the part"),("assemble","assembles","assembled","assembled","assembling","the product"),("measure","measures","measured","measured","measuring","the component"),("replace","replaces","replaced","replaced","replacing","the tool"),("stop","stops","stopped","stopped","stopping","the line"),("report","reports","reported","reported","reporting","a defect"),("wear","wears","wore","worn","wearing","protective equipment")],
        "vocab":[("assembly line","összeszerelő sor"),("defect","hiba/selejt"),("component","alkatrész"),("operator","gépkezelő"),("inspection","ellenőrzés"),("tolerance","tűrés"),("downtime","állásidő"),("maintenance","karbantartás")]
    },
    "logistics": {
        "hu":"Logisztika",
        "actions":[("load","loads","loaded","loaded","loading","the truck"),("unload","unloads","unloaded","unloaded","unloading","the pallets"),("ship","ships","shipped","shipped","shipping","the order"),("deliver","delivers","delivered","delivered","delivering","the goods"),("scan","scans","scanned","scanned","scanning","the barcode"),("store","stores","stored","stored","storing","the boxes"),("track","tracks","tracked","tracked","tracking","the shipment"),("pick","picks","picked","picked","picking","the items")],
        "vocab":[("warehouse","raktár"),("pallet","raklap"),("shipment","szállítmány"),("barcode","vonalkód"),("forklift","targonca"),("stock","készlet"),("delivery","kiszállítás"),("inventory","készletnyilvántartás")]
    },
    "finance": {
        "hu":"Pénzügy",
        "actions":[("pay","pays","paid","paid","paying","the invoice"),("transfer","transfers","transferred","transferred","transferring","the money"),("check","checks","checked","checked","checking","the balance"),("calculate","calculates","calculated","calculated","calculating","the cost"),("save","saves","saved","saved","saving","money"),("borrow","borrows","borrowed","borrowed","borrowing","money"),("approve","approves","approved","approved","approving","the payment"),("issue","issues","issued","issued","issuing","an invoice")],
        "vocab":[("balance","egyenleg"),("invoice","számla"),("interest","kamat"),("loan","hitel"),("currency","pénznem"),("payment","fizetés"),("budget","költségvetés"),("cash flow","pénzáramlás")]
    },
    "technology": {
        "hu":"Technológia",
        "actions":[("install","installs","installed","installed","installing","the update"),("restart","restarts","restarted","restarted","restarting","the computer"),("download","downloads","downloaded","downloaded","downloading","the file"),("upload","uploads","uploaded","uploaded","uploading","the document"),("connect","connects","connected","connected","connecting","to Wi-Fi"),("reset","resets","reset","reset","resetting","the password"),("save","saves","saved","saved","saving","the document"),("delete","deletes","deleted","deleted","deleting","the old file")],
        "vocab":[("password","jelszó"),("backup","biztonsági mentés"),("browser","böngésző"),("update","frissítés"),("network","hálózat"),("device","eszköz"),("storage","tárhely"),("settings","beállítások")]
    },
    "education": {
        "hu":"Oktatás",
        "actions":[("study","studies","studied","studied","studying","for the exam"),("submit","submits","submitted","submitted","submitting","the assignment"),("attend","attends","attended","attended","attending","the lesson"),("revise","revises","revised","revised","revising","the topic"),("answer","answers","answered","answered","answering","the question"),("pass","passes","passed","passed","passing","the exam"),("fail","fails","failed","failed","failing","the test"),("take","takes","took","taken","taking","notes")],
        "vocab":[("assignment","beadandó"),("grade","jegy/osztályzat"),("course","kurzus"),("deadline","határidő"),("lecture","előadás"),("revision","ismétlés"),("certificate","bizonyítvány"),("assessment","értékelés/felmérés")]
    },
    "leisure": {
        "hu":"Szabadidő",
        "actions":[("play","plays","played","played","playing","football"),("read","reads","read","read","reading","a novel"),("watch","watches","watched","watched","watching","a film"),("listen","listens","listened","listened","listening","to music"),("visit","visits","visited","visited","visiting","a museum"),("meet","meets","met","met","meeting","friends"),("practice","practices","practiced","practiced","practicing","the guitar"),("go","goes","went","gone","going","for a walk")],
        "vocab":[("hobby","hobbi"),("concert","koncert"),("novel","regény"),("exhibition","kiállítás"),("performance","előadás"),("audience","közönség"),("practice","gyakorlás"),("tournament","verseny/bajnokság")]
    },
    "weather_environment": {
        "hu":"Időjárás és környezet",
        "actions":[("rain","rains","rained","rained","raining","all morning"),("snow","snows","snowed","snowed","snowing","heavily"),("recycle","recycles","recycled","recycled","recycling","plastic"),("save","saves","saved","saved","saving","energy"),("reduce","reduces","reduced","reduced","reducing","waste"),("protect","protects","protected","protected","protecting","the environment"),("plant","plants","planted","planted","planting","trees"),("forecast","forecasts","forecast","forecast","forecasting","rain")],
        "vocab":[("forecast","előrejelzés"),("temperature","hőmérséklet"),("storm","vihar"),("recycling","újrahasznosítás"),("climate","éghajlat"),("pollution","szennyezés"),("renewable","megújuló"),("drought","aszály")]
    },
    "customer_service": {
        "hu":"Ügyfélszolgálat",
        "actions":[("help","helps","helped","helped","helping","the customer"),("solve","solves","solved","solved","solving","the problem"),("refund","refunds","refunded","refunded","refunding","the payment"),("replace","replaces","replaced","replaced","replacing","the item"),("apologise","apologises","apologised","apologised","apologising","for the delay"),("confirm","confirms","confirmed","confirmed","confirming","the order"),("handle","handles","handled","handled","handling","the complaint"),("explain","explains","explained","explained","explaining","the policy")],
        "vocab":[("complaint","panasz"),("refund","visszatérítés"),("replacement","cserepéldány"),("support","támogatás"),("policy","szabályzat"),("resolve","megoldani"),("apologise","elnézést kérni"),("warranty","garancia")]
    },
    "communication": {
        "hu":"Kommunikáció",
        "actions":[("explain","explains","explained","explained","explaining","the problem"),("ask","asks","asked","asked","asking","a question"),("answer","answers","answered","answered","answering","clearly"),("repeat","repeats","repeated","repeated","repeating","the sentence"),("describe","describes","described","described","describing","the situation"),("mention","mentions","mentioned","mentioned","mentioning","the reason"),("clarify","clarifies","clarified","clarified","clarifying","the details"),("agree","agrees","agreed","agreed","agreeing","with the idea")],
        "vocab":[("explain","elmagyarázni"),("clarify","tisztázni"),("repeat","megismételni"),("meaning","jelentés"),("opinion","vélemény"),("reason","ok"),("detail","részlet"),("conversation","beszélgetés")]
    },
}

assert len(THEMES) == 25

def _opts(correct, a, b, seed):
    values = [correct, a, b]
    values = list(dict.fromkeys(values))
    while len(values) < 3:
        values.append(f"option_{len(values)}")
    rnd = random.Random(seed)
    rnd.shuffle(values)
    return values

def _item(qid, theme, qtype, skill, subskill, cefr, prompt, correct, wrong1, wrong2, explanation, target=""):
    options = _opts(correct, wrong1, wrong2, qid)
    return {
        "id": qid, "theme": theme, "themeHu": THEMES[theme]["hu"],
        "questionType": qtype, "skill": skill, "subskill": subskill, "cefr": cefr,
        "instructionHu": "Húzd a megfelelő választ a hiányzó helyre." if qtype == "drag_blank" else "Válaszd ki a helyes választ.",
        "prompt": prompt, "options": options, "correctAnswer": correct,
        "correctIndex": options.index(correct), "target": target,
        "explanationHu": explanation, "status": "active",
        "sourceMethod": "deterministic_curated_template",
    }

def generate_question_bank():
    rows = []
    for theme, data in THEMES.items():
        local = []
        for cycle in range(25):
            for ai, (base, s3, past, pp, ing, comp) in enumerate(data["actions"]):
                seed = f"{theme}:{cycle}:{ai}"
                subj3 = ["He","She","Anna","Peter"][cycle % 4]
                subj = ["I","You","We","They"][cycle % 4]
                past_time = ["yesterday","last night","last week","two days ago"][cycle % 4]
                future_time = ["tomorrow","next week","later today","on Friday"][cycle % 4]

                local.append(("present_simple_3sg", _item("",theme,"drag_blank","grammar","present_simple_3sg","A1",f"{subj3} usually ___ {comp}.",s3,base,past,"He/she/egy név után Present Simple-ben az ige általában -s/-es végződést kap.",base)))
                local.append(("past_simple", _item("",theme,"drag_blank","grammar","past_simple","A2",f"{subj} {past_time} ___ {comp}.",past,base,pp if pp != past else ing,"Lezárt múltbeli időpontnál Past Simple alakot használunk.",base)))
                local.append(("did_base_form", _item("",theme,"drag_blank","grammar","did_base_form","A2",f"Did {subj.lower()} ___ {comp} {past_time}?",base,past,ing,"A did után az ige alapalakban áll.",base)))
                local.append(("didnt_base_form", _item("",theme,"drag_blank","grammar","didnt_base_form","A2",f"{subj} didn't ___ {comp} {past_time}.",base,past,ing,"A didn't után az ige alapalakban áll.",base)))
                local.append(("present_continuous", _item("",theme,"drag_blank","grammar","present_continuous","A1",f"{subj} are ___ {comp} right now." if subj != "I" else f"I am ___ {comp} right now.",ing,base,past,"Present Continuous: am/is/are + -ing.",base)))
                local.append(("present_perfect", _item("",theme,"drag_blank","grammar","present_perfect","B1",f"{subj} have already ___ {comp}." if subj != "He" else f"He has already ___ {comp}.",pp,past,base,"Present Perfect: have/has + past participle.",base)))
                local.append(("going_to", _item("",theme,"drag_blank","grammar","going_to","A2",f"We are going to ___ {comp} {future_time}.",base,past,ing,"A be going to után az ige alapalakban áll.",base)))
                local.append(("modal_should", _item("",theme,"drag_blank","grammar","modal_should","A2",f"We should ___ {comp} carefully.",base,past,ing,"A should után az ige alapalakban áll.",base)))
                local.append(("first_conditional", _item("",theme,"drag_blank","grammar","first_conditional","B1",f"If we {base} {comp} today, we ___ be ready tomorrow.","will","would","did","First Conditional: if + Present Simple, majd will + alapalak.",base)))
                local.append(("second_conditional", _item("",theme,"drag_blank","grammar","second_conditional","B1",f"If I had more time, I ___ {base} {comp}.","would","will","did","Second Conditional: if + Past Simple, majd would + alapalak.",base)))

            for vi, (term, hu) in enumerate(data["vocab"]):
                other = [x[0] for x in data["vocab"] if x[0] != term]
                wrong1 = other[(cycle + vi) % len(other)]
                wrong2 = other[(cycle + vi + 3) % len(other)]
                local.append(("meaning_hu_en", _item("",theme,"multiple_choice","vocabulary","meaning_hu_en","A2",f"Melyik angol szó jelentése: „{hu}”?",term,wrong1,wrong2,f"{hu} = {term}.",term)))
                hu_other = [x[1] for x in data["vocab"] if x[0] != term]
                h1 = hu_other[(cycle + vi) % len(hu_other)]
                h2 = hu_other[(cycle + vi + 3) % len(hu_other)]
                local.append(("meaning_en_hu", _item("",theme,"multiple_choice","vocabulary","meaning_en_hu","A2",f"Mit jelent: „{term}”?",hu,h1,h2,f"{term} = {hu}.",term)))

        # deterministic de-duplication by full learning item
        unique = {}
        for _, item in local:
            key = (item["prompt"], tuple(item["options"]), item["correctAnswer"])
            unique[key] = item
        values = list(unique.values())
        # add safe numbered review variants only if needed
        idx = 0
        while len(values) < 400:
            term, hu = data["vocab"][idx % len(data["vocab"])]
            others = [x[0] for x in data["vocab"] if x[0] != term]
            item = _item("",theme,"multiple_choice","vocabulary","review","A2",
                f"Ismétlés {idx+1}: melyik szó jelentése „{hu}”?",term,others[0],others[1],f"{hu} = {term}.",term)
            values.append(item); idx += 1
        values = values[:400]
        for i, item in enumerate(values, start=1):
            item["id"] = f"LIVO-{theme.upper()}-{i:04d}"
            # reshuffle options from the final stable id so correctIndex is stable
            item["options"] = _opts(item["correctAnswer"], *[x for x in item["options"] if x != item["correctAnswer"]][:2], item["id"])
            item["correctIndex"] = item["options"].index(item["correctAnswer"])
            rows.append(item)
    assert len(rows) == 10000
    return rows

async def ensure_question_bank(db):
    col = db.question_bank
    count = await col.count_documents({"status":"active"})
    if count >= 10000:
        return count
    await col.delete_many({"sourceMethod":"deterministic_curated_template"})
    rows = generate_question_bank()
    for i in range(0, len(rows), 1000):
        await col.insert_many(rows[i:i+1000], ordered=False)
    await col.create_index([("id", ASCENDING)], unique=True)
    await col.create_index([("theme", ASCENDING), ("cefr", ASCENDING), ("skill", ASCENDING), ("subskill", ASCENDING)])
    await col.create_index([("questionType", ASCENDING), ("status", ASCENDING)])
    return len(rows)
