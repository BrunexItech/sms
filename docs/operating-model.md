# Operating model: how the platform is run, and by whom

This is the model the prototype is built around. It is a proposal for the Ministry to confirm against its
organisation chart and the Sports Act 2013, not a statement of existing policy.

## Two audiences

| Audience | What they do | Where |
|---|---|---|
| **Public** (players, clubs, academies, coaches, scouts, agents, businesses, facility operators, organisers, federations) | Register, pay, track a registration, print a certificate, look up the directory, verify a certificate, register facilities | `/`, `/register`, `/clubs`, `/players`, `/teams`, `/directory`, `/facilities`, `/events`, `/payments`, `/verify`, `/account`, `/resources`, `/contact`, `/sports-act`, `/credits` |
| **Staff** (seven named offices) | Review, endorse, decide, verify, reconcile, administer | `/console/*` |

## Application lifecycle

```
Submitted ──▶ Under review ──▶ Endorsed ──▶ Approved ──▶ Suspended
   │               │  ▲                         │            │
   │               ▼  │                         └─ Reinstate ┘
   │          Needs info                        
   └─────────▶ Rejected (with reason)
```

1. **Applicant** submits and pays (prototype: demo OTP; production: M-Pesa Daraja).
2. **County Sports Officer** starts review, or asks for missing information.
3. **Federation Administrator** endorses membership for their sport.
4. **Sports Registrar** approves (certificate issued) or rejects (reason required). Approval is blocked if the fee is unpaid.
5. **Compliance & Integrity Officer** or the Registrar suspends or reinstates, with a recorded reason.

## Sports, organisations and roles (from the Ministry's structure document)

The catalogue follows `sports_structure.docx` exactly:

- **Sports and organisations directory**: 44 entries (athletics through Special Olympics, plus "Other emerging and traditional sports"), with the federation or organisation name as written in the document. The document describes the list as an initial directory for validation, so every entry starts as **To be confirmed**; the Registrar confirms or corrects each in the Control Center. Five sports from the earlier brief that are not in the document (water polo, fencing, surfing, skateboarding, ice sports) are kept under "Other" pending review.
- **Role catalogue**: 155 roles in six groups (club leadership and administration, teams and coaching, officials and competitions, health/welfare/integrity, operations and communications, and sport-specific roles for 16 sport groups).
- **Club officials**: a club must name its Chairperson/President, Secretary-General/Secretary and Treasurer/Finance Officer; the CEO and any other leadership role (vice-chair, board member, legal, compliance, and so on) can be added.
- **Individuals with a role**: coaches, technical team, scouts, officials, health and welfare staff and operations staff each pick their role from the catalogue. Sport-specific roles only appear for that sport.
- **Unlisted sports**: choosing "Other emerging and traditional sports" asks for the sport's name; the Registrar reviews it with the application.

An existing server picks up new catalogue entries automatically on start (names are only refreshed on rows nobody has edited).

## Control Center and rights

The **Super Administrator** holds every right and controls who holds which. In the Control Center they:

- create staff accounts and assign role, county and sport;
- edit the rights each **role** holds (applied immediately, restorable to defaults);
- grant or withhold individual rights for one person, while county and sport limits still apply;
- see **verification coverage**: counties with no county officer and sports with no federation administrator, and appoint one in a click;
- block or restore applicant sign-ins.

Safeguards: nobody changes their own role or access; only a Super Administrator can create or change another; the last active Super Administrator cannot be demoted or disabled; every change is in the audit log. The System Administrator can manage accounts but not role rights.

## Photos and trial videos

Each **player** record has a profile photo and photo gallery (up to 8) and trial videos (up to 4). The account that registered the player (the player, or the club for roster players) uploads and deletes; verifying officers in scope can view them during review. Files are checked by their actual bytes (not the claimed type), size-limited, never public, and served only to those two audiences.

## Roles

| Role | Scope | Can | Cannot |
|---|---|---|---|
| Super Administrator | National | Everything, including editing rights and appointing officers | (nothing withheld; all actions audited) |
| Sports Registrar | National | Approve/reject, suspend, view all, export | Change fees or accounts |
| County Sports Officer | Own county | Review, request info, verify county facilities | Approve, see other counties |
| Federation Administrator | Own sport | View and endorse members | See ID/KRA/phone/email, approve |
| Facilities Officer | National | Verify facilities, log inspections | Touch registrations |
| Finance Officer | National | Reconcile, record manual payments, refund | Approve registrations |
| Compliance & Integrity Officer | National | Suspend/reinstate | Approve new registrations |
| System Administrator | National | Staff accounts, roles, fees, audit log | Approve registrations (separation of duties) |

## Controls

- **Separation of duties:** whoever administers accounts cannot approve; whoever approves cannot change fees.
- **Scope by county and sport**, enforced in the console.
- **Data minimisation:** the public directory shows approved records only, and never ID, KRA PIN, phone or email. Federation staff do not see personal identifiers.
- **Audit log** of every consequential action (who, what, when, which record). Exportable.
- **Certificate verification** is public, so third parties can check a certificate without calling the Ministry.

## Applicant journey

1. **Player** registers on the public site, creates a password and pays. They then wait for verification (county, federation, Registrar). They see only their own status.
2. **Club** applies the same way. Until verified it cannot register players.
3. Once the club is **Approved**, My account opens the club portal: add players (duplicate IDs refused), pay for them, track each one's verification.
4. A player added by a club needs the club to be Approved at the moment of approval, and the same review chain.
5. Anyone can verify a certificate by its number; nothing else about people or clubs is public.

## Still to do before launch

- Replace the mock payment/OTP with M-Pesa Daraja and an SMS or email provider (the API refuses payments in production until one is configured).
- Federation names come from the Ministry brief and are all marked "To be confirmed"; the Registrar confirms or corrects each in the console.
- Password reset, two-factor for staff, and email verification.
- Replace the hero image and crest with official or licensed artwork.

## Zero-cost data sources

| Need | Source | Licence |
|---|---|---|
| Base map | OpenStreetMap tiles via Leaflet | ODbL (attribution shown) |
| Place search | Nominatim (user-initiated only, respects usage policy) | ODbL |
| Counties, sub-counties, wards (47 / 290 / 1,450) | OCHA COD-AB via HDX, bundled in `public/data/kenya-admin.json` | CC BY-IGO |
| Facilities base data (459 named) | OpenStreetMap via Overpass, bundled in `public/data/osm-facilities.json` | ODbL |
| County outlines | Public Kenya county boundaries, simplified in `src/data/kenya-map.ts` | Public data |
| Sport equipment photographs (31) | Wikimedia Commons, in `public/sports/`, credited per image on `/credits` | CC0 / CC BY / CC BY-SA / public domain |
| Hero image and crest | Cropped from the Ministry's own design mockup; replace with official or licensed artwork before launch | Supplied by the Ministry |

Limits to plan for: the public OSM tile server and Nominatim are fair-use. At national scale, self-host tiles
(for example with an OSM extract of Kenya) on the Ministry's own server; this stays free.
