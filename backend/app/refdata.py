import json
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

# (id, name, federation as listed in the Ministry brief)
SPORTS = [
    ("football", "Football", "Football Kenya Federation (FKF)"), ("athletics", "Athletics", "Athletics Kenya"),
    ("rugby", "Rugby", "Kenya Rugby Union (KRU)"), ("basketball", "Basketball", "Kenya Basketball Federation"),
    ("volleyball", "Volleyball", "Kenya Volleyball Federation"), ("netball", "Netball", "Kenya Netball Federation"),
    ("handball", "Handball", "Kenya Handball Federation"), ("hockey", "Hockey", "Kenya Hockey Union"),
    ("cricket", "Cricket", "Cricket Kenya"), ("tennis", "Tennis", "Kenya Tennis Federation"),
    ("table-tennis", "Table Tennis", "Kenya Table Tennis Association"), ("badminton", "Badminton", "Badminton Kenya"),
    ("boxing", "Boxing", "Boxing Federation of Kenya"), ("judo", "Judo", "Kenya Judo Federation"),
    ("karate", "Karate", "Kenya Karate Federation"), ("wrestling", "Wrestling", "Kenya Wrestling Federation"),
    ("fencing", "Fencing", "Kenya Fencing Federation"), ("swimming", "Swimming", "Kenya Aquatics"),
    ("water-polo", "Water Polo", "Kenya Aquatics"), ("canoeing", "Canoeing", "Kenya Canoe Federation"),
    ("surfing", "Surfing", "Kenya Surfing Federation"), ("cycling", "Cycling", "Cycling Kenya"),
    ("motorsport", "Motorsport", "Motorsport Federation of Kenya"), ("equestrian", "Equestrian", "Kenya Equestrian Federation"),
    ("skateboarding", "Skateboarding", "Kenya Skateboarding Federation"), ("archery", "Archery", "Kenya Archery Association"),
    ("golf", "Golf", "Kenya Golf Union"), ("darts", "Darts", "Kenya Darts Federation"),
    ("chess", "Chess", "Chess Kenya"), ("weightlifting", "Weightlifting", "Kenya Weightlifting Federation"),
    ("ice-sports", "Ice Sports", "To be confirmed"),
]
SPORT_IDS = {s[0] for s in SPORTS}

STAKEHOLDER_TYPES = [
    "Player / Sportsperson", "Club", "Academy", "Technical Team", "Coach", "Scout",
    "Sports Agent / Manager", "Sports Business", "Facility Operator", "Event Organiser", "Federation / Association",
]
ORG_TYPES = {"Club", "Academy", "Technical Team", "Sports Business", "Facility Operator", "Event Organiser",
             "Federation / Association"}
LEVELS = ["Professional", "Semi-Professional", "Amateur", "Youth / Junior", "Community"]
FACILITY_TYPES = ["Stadium", "Football Pitch", "Athletics Track", "Indoor Arena", "Swimming Pool", "Basketball Court",
                  "Rugby Ground", "Tennis Court", "Volleyball Court", "Cricket Ground", "Golf Course", "Sports Centre",
                  "Gym / Fitness Centre", "Sports Pitch", "Other"]
CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Under renovation"]
DEFAULT_FEES = {t: (2000 if t == "Club" else 500) for t in STAKEHOLDER_TYPES}


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
