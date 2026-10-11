import json
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

# Sports and organisations directory, in the order and wording of the Ministry's structure document
# ("sports_structure.docx"). The document calls it "an initial directory for validation, not a confirmed
# complete official register", so every entry starts as "To be confirmed" until the Registrar verifies it.
# (id, name as shown, group, federation / organisation exactly as written in the document)
_DIRECTORY = [
    ("athletics", "Athletics", "Track & field", "Athletics Kenya"),
    ("football", "Football", "Ball sports", "Football Kenya Federation"),
    ("rugby", "Rugby union and sevens", "Ball sports", "Kenya Rugby Union/Rugby Football Union of Kenya"),
    ("basketball", "Basketball", "Ball sports", "Kenya Basketball Federation"),
    ("volleyball", "Volleyball", "Ball sports", "Kenya Volleyball Federation"),
    ("cricket", "Cricket", "Ball sports", "Cricket Kenya/Kenya Cricket Association"),
    ("swimming", "Aquatic sports", "Water", "Kenya Aquatics"),
    ("boxing", "Boxing", "Combat", "Boxing Federation of Kenya/Amateur Boxing Association of Kenya"),
    ("handball", "Handball", "Ball sports", "Kenya Handball Federation"),
    ("hockey", "Hockey", "Ball sports", "Kenya Hockey Union"),
    ("netball", "Netball", "Ball sports", "Kenya Netball Association"),
    ("tennis", "Tennis", "Racquet", "Tennis Kenya/Kenya Lawn Tennis Association"),
    ("badminton", "Badminton", "Racquet", "Badminton Kenya"),
    ("table-tennis", "Table tennis", "Racquet", "Kenya Table Tennis Association"),
    ("squash", "Squash", "Racquet", "Kenya Squash Rackets Association"),
    ("golf", "Golf", "Precision & mind", "Kenya Golf Union"),
    ("cycling", "Cycling", "Wheels & horse", "National cycling organisation; verify current registered name"),
    ("baseball", "Baseball", "Ball sports", "National baseball organisation; verify current registered name"),
    ("softball", "Softball", "Ball sports", "National softball organisation; verify current registered name"),
    ("chess", "Chess", "Precision & mind", "Chess Kenya/Kenya Chess Association"),
    ("wrestling", "Wrestling", "Combat", "National wrestling organisation; verify current registered name"),
    ("judo", "Judo", "Combat", "Kenya Judo Association"),
    ("karate", "Karate", "Combat", "Karate-do Association of Kenya"),
    ("taekwondo", "Taekwondo", "Combat", "Kenya Taekwondo Federation"),
    ("weightlifting", "Weightlifting", "Strength", "National weightlifting organisation; verify current registered name"),
    ("powerlifting", "Powerlifting", "Strength", "Verify whether governed separately or jointly with weightlifting"),
    ("bodybuilding", "Bodybuilding and fitness", "Strength", "Kenya Bodybuilding and Fitness Federation"),
    ("darts", "Darts", "Precision & mind", "Kenya Darts Association"),
    ("pool", "Pool, billiards and snooker", "Precision & mind", "Kenya Pool Association; verify discipline structure"),
    ("tug-of-war", "Tug of war", "Strength", "Kenya Tug of War Association"),
    ("equestrian", "Equestrian", "Wheels & horse", "Horse Association of Kenya/Kenya Equestrian Federation; verify current registered name"),
    ("canoeing", "Rowing and canoeing", "Water", "Kenya Rowing and Canoe Federation"),
    ("sailing", "Sailing/yachting", "Water", "Kenya Yachting Federation; verify current registered name"),
    ("archery", "Archery", "Precision & mind", "National archery organisation; verify current registered name"),
    ("gymnastics", "Gymnastics", "Strength", "Gymnastics Federation of Kenya"),
    ("triathlon", "Triathlon", "Track & field", "National triathlon organisation; verify current registered name"),
    ("motorsport", "Motorsport", "Wheels & horse", "Motorsports Kenya Federation"),
    ("american-football", "American football", "Ball sports", "Kenya Federation of American Football"),
    ("esports", "Esports", "Precision & mind", "Electronic Sports Kenya Federation"),
    ("university-sport", "University sport", "Inclusive & institutional", "Kenya University Sports Federation"),
    ("deaf-sport", "Deaf sport", "Inclusive & institutional", "Kenya Sports Federation of the Deaf"),
    ("paralympic", "Paralympic sport", "Inclusive & institutional", "Kenya National Paralympic Committee and its affiliated organisations"),
    ("special-olympics", "Special Olympics", "Inclusive & institutional", "Special Olympics Kenya"),
    ("other", "Other emerging and traditional sports", "Other", "Add through a Registrar-review process"),
]
# Kept from the earlier brief; not in the document, so they sit under "Other" pending Registrar review.
_EXTRA = [
    ("water-polo", "Water polo", "Other", "Kenya Aquatics"),
    ("fencing", "Fencing", "Other", "Kenya Fencing Federation"),
    ("surfing", "Surfing", "Other", "Kenya Surfing Federation"),
    ("skateboarding", "Skateboarding", "Other", "Kenya Skateboarding Federation"),
    ("ice-sports", "Ice sports", "Other", "To be confirmed"),
]
# Names used before the document arrived. Used only to refresh rows nobody has edited.
LEGACY_FEDERATION_NAMES = {
    "football": "Football Kenya Federation (FKF)", "rugby": "Kenya Rugby Union (KRU)", "netball": "Kenya Netball Federation",
    "tennis": "Kenya Tennis Federation", "table-tennis": "Kenya Table Tennis Association", "boxing": "Boxing Federation of Kenya",
    "judo": "Kenya Judo Federation", "karate": "Kenya Karate Federation", "wrestling": "Kenya Wrestling Federation",
    "canoeing": "Kenya Canoe Federation", "cycling": "Cycling Kenya", "motorsport": "Motorsport Federation of Kenya",
    "equestrian": "Kenya Equestrian Federation", "archery": "Kenya Archery Association", "darts": "Kenya Darts Federation",
    "chess": "Chess Kenya", "weightlifting": "Kenya Weightlifting Federation", "badminton": "Badminton Kenya",
    "cricket": "Cricket Kenya", "athletics": "Athletics Kenya", "basketball": "Kenya Basketball Federation",
    "volleyball": "Kenya Volleyball Federation", "handball": "Kenya Handball Federation", "hockey": "Kenya Hockey Union",
    "golf": "Kenya Golf Union", "swimming": "Kenya Aquatics",
}
SPORT_GROUP = {sid: grp for sid, _, grp, _ in _DIRECTORY + _EXTRA}
SPORTS = [(sid, name, fed) for sid, name, _, fed in _DIRECTORY + _EXTRA]  # (id, name, federation)
SPORT_IDS = {s[0] for s in SPORTS}

STAKEHOLDER_TYPES = [
    "Player / Sportsperson", "Club", "Academy", "Technical Team", "Coach", "Scout",
    "Match / Competition Official", "Health & Welfare Staff", "Operations & Admin Staff",
    "Sports Agent / Manager", "Sports Business", "Facility Operator", "Event Organiser", "Federation / Association",
]
# Individuals who register in a specific role from the role catalogue.
PERSONNEL_TYPES = {"Technical Team", "Coach", "Scout", "Match / Competition Official", "Health & Welfare Staff", "Operations & Admin Staff"}
# Legal entities that must quote the certificate they were registered under.
REG_NO_TYPES = {"Club", "Academy", "Federation / Association"}
ORG_TYPES = {"Club", "Academy", "Technical Team", "Sports Business", "Facility Operator", "Event Organiser",
             "Federation / Association"}
LEVELS = ["Professional", "Semi-Professional", "Amateur", "Youth / Junior", "Community"]
FACILITY_TYPES = ["Stadium", "Football Pitch", "Athletics Track", "Indoor Arena", "Swimming Pool", "Basketball Court",
                  "Rugby Ground", "Tennis Court", "Volleyball Court", "Cricket Ground", "Golf Course", "Sports Centre",
                  "Gym / Fitness Centre", "Sports Pitch", "Other"]
CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Under renovation"]
DEFAULT_FEES = {t: (2000 if t == "Club" else 500) for t in STAKEHOLDER_TYPES}


@lru_cache
def roles() -> list[dict]:
    """The role catalogue (155 roles) taken from the Ministry's structure document."""
    return json.loads((DATA / "catalogue.json").read_text())


@lru_cache
def role_by_id() -> dict[str, dict]:
    return {r["id"]: r for r in roles()}


def norm_officials(o) -> list[dict]:
    """Club officials as a list of {role, name, phone, email}. Accepts the older {chairman, ceo, secretary} shape."""
    if not o:
        return []
    if isinstance(o, dict):
        legacy = [("chairperson-president", "chairman"), ("chief-executive-officer-ceo", "ceo"), ("secretary-general-secretary", "secretary")]
        return [{"role": rid, "name": str(o.get(k, "")).strip(), "phone": str(o.get("phone", "")).strip() if rid == "chairperson-president" else "", "email": ""}
                for rid, k in legacy if str(o.get(k, "")).strip()]
    return [{"role": str(x.get("role", "")), "name": str(x.get("name", "")).strip()[:80], "phone": str(x.get("phone", "")).strip()[:20],
             "email": str(x.get("email", "")).strip()[:120]} for x in o if isinstance(x, dict)]


# Club office-bearers that every club must name, by catalogue id.
REQUIRED_OFFICIALS = ["chairperson-president", "secretary-general-secretary", "treasurer-finance-officer"]


@lru_cache
def admin() -> dict:
    return json.loads((DATA / "kenya-admin.json").read_text())


@lru_cache
def admin_index() -> dict:
    idx = {}
    for c in admin()["counties"]:
        for s in c["s"]:
            for w in s["w"]:
                idx[(c["id"], s["id"], w["id"])] = (c["n"], s["n"], w["n"])
    return idx


def resolve_place(county_id: str, sub_id: str, ward_id: str) -> dict | None:
    hit = admin_index().get((county_id, sub_id, ward_id))
    if not hit:
        return None
    return {"county_id": county_id, "sub_id": sub_id, "ward_id": ward_id,
            "county": hit[0], "sub_county": hit[1], "ward": hit[2]}


def osm_facilities() -> list[dict]:
    return json.loads((DATA / "osm-facilities.json").read_text())["facilities"]
