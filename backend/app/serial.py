from . import refdata as R
from . import settings as C
from .rbac import PII_ROLES, STAFF_ROLES, effective


def user_out(u) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "role": u.role, "title": u.title,
            "countyId": u.county_id, "countyName": u.county_name, "sportId": u.sport_id, "active": u.active,
            "staff": u.role in STAFF_ROLES, "perms": sorted(effective(u)),
            "extraPerms": u.extra_perms or [], "deniedPerms": u.denied_perms or [], "lastLogin": u.last_login,
            "mustChangePassword": u.must_change_password, "totpEnabled": u.totp_enabled,
            "needs2fa": C.REQUIRE_STAFF_2FA and u.role in STAFF_ROLES and not u.totp_enabled}


def app_out(a, viewer=None, owner_view: bool = False) -> dict:
    pii = owner_view or (viewer is not None and viewer.role in PII_ROLES)
    return {
        "id": a.id, "clubId": a.club_id, "type": a.type, "name": a.name,
        "idNo": a.id_no if pii else "", "kra": a.kra if pii else "",
        "phone": a.phone if pii else "", "email": a.email if pii else "",
        "place": {"countyId": a.county_id, "subId": a.sub_id, "wardId": a.ward_id,
                  "county": a.county, "subCounty": a.sub_county, "ward": a.ward},
        "gps": {"lat": a.lat, "lon": a.lon} if a.lat is not None else None,
        "sport": a.sport, "federation": a.federation, "level": a.level, "clubName": a.club_name,
        "clubOfficials": R.norm_officials(a.officials) if a.officials else None, "role": a.role,
        "roleName": (R.role_by_id().get(a.role or "") or {}).get("name"), "sportOther": a.sport_other, "orgRegNo": a.org_reg_no, "publicListed": bool(a.public_listed), "hasContract": a.has_contract, "notes": a.notes, "status": a.status,
        "payment": {"status": a.pay_status, "amount": a.pay_amount, "method": a.pay_method, "ref": a.pay_ref,
                    "paidAt": a.pay_at, "receipt": a.receipt, "reconciled": a.reconciled},
        "certificateNo": a.cert_no, "createdAt": a.created_at, "updatedAt": a.updated_at,
        "history": a.history or [], "demo": a.demo,
        "photoUrl": f"/api/media/{a.photo_id}" if a.photo_id else None,
        "mediaRequest": a.media_request, "gender": a.gender,
        "dob": a.dob if pii else None, "guardian": a.guardian if pii else None,
        "expiresAt": a.expires_at, "renewing": a.renewing, "appeal": a.appeal, "evidenceNeeded": False,
    }


def directory_row(a) -> dict:
    """Redacted: never includes ID, KRA PIN, phone or email."""
    return {"id": a.id, "name": a.club_name or a.name, "type": a.type, "sport": a.sport, "level": a.level,
            "county": a.county, "countyId": a.county_id, "subCounty": a.sub_county, "ward": a.ward,
            "status": a.status, "certificateNo": a.cert_no, "clubId": a.club_id,
            "role": (R.role_by_id().get(a.role or "") or {}).get("name"),
            "photoUrl": f"/api/media/{a.photo_id}" if a.photo_id else None}


def facility_out(f) -> dict:
    return {
        "id": f.id, "name": f.name, "type": f.type, "sports": f.sports or [],
        "place": {"countyId": f.county_id, "subId": f.sub_id, "wardId": f.ward_id,
                  "county": f.county, "subCounty": f.sub_county, "ward": f.ward},
        "gps": {"lat": f.lat, "lon": f.lon}, "capacity": f.capacity, "ownership": f.ownership,
        "condition": f.condition, "status": f.status, "source": f.source, "createdAt": f.created_at,
        "history": f.history or [], "inspections": f.inspections or [],
    }


def media_out(m, primary: bool = False) -> dict:
    return {"id": m.id, "applicationId": m.application_id, "kind": m.kind, "title": m.title, "mime": m.mime,
            "size": m.size, "createdAt": m.created_at, "url": f"/api/media/{m.id}", "primary": primary}


def event_out(e) -> dict:
    return {"id": e.id, "name": e.name, "sport": e.sport, "date": e.date, "venue": e.venue,
            "county": e.county, "countyId": e.county_id, "organiser": e.organiser, "level": e.level}


def federation_out(f) -> dict:
    return {"sportId": f.sport_id, "sportName": f.sport_name, "name": f.name, "status": f.status,
            "contactEmail": f.contact_email}
