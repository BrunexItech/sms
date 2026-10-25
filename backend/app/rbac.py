"""Roles and rights. Role rights can be edited by the Super Administrator (stored in settings);
individual users can additionally be granted or denied rights. The server is authoritative."""

CATALOG = [
    "applications.view", "applications.review", "applications.endorse", "applications.decide", "records.suspend",
    "facilities.verify", "payments.view", "payments.reconcile", "users.manage", "roles.manage", "settings.manage",
    "audit.view", "reports.export", "directory.view", "federations.manage",
]
ALL = set(CATALOG)

DEFAULTS: dict[str, set[str]] = {
    "super_admin": set(ALL),
    "registrar": {"applications.view", "applications.review", "applications.decide", "records.suspend",
                  "payments.view", "audit.view", "reports.export", "directory.view", "federations.manage"},
    "county_officer": {"applications.view", "applications.review", "facilities.verify", "reports.export", "directory.view"},
    "federation_admin": {"applications.view", "applications.endorse", "directory.view"},
    "facilities_officer": {"facilities.verify", "reports.export"},
    "finance_officer": {"payments.view", "payments.reconcile", "reports.export", "audit.view"},
    "integrity_officer": {"applications.view", "records.suspend", "audit.view", "directory.view"},
    "system_admin": {"users.manage", "settings.manage", "audit.view", "federations.manage"},
    "member": set(),
}
ROLE_PERMS: dict[str, set[str]] = {k: set(v) for k, v in DEFAULTS.items()}
STAFF_ROLES = set(DEFAULTS) - {"member"}
SCOPE = {"county_officer": "county", "federation_admin": "sport"}
# roles that may see personal identifiers (ID, KRA PIN, phone, email)
PII_ROLES = {"super_admin", "registrar", "county_officer", "integrity_officer"}


def load_overrides(value: dict | None) -> None:
    """Apply stored role-rights overrides (settings.role_perms)."""
    for role, perms in (value or {}).items():
        if role in ROLE_PERMS and role not in ("super_admin", "member"):
            ROLE_PERMS[role] = set(perms) & ALL


def effective(user) -> set[str]:
    if not user or not user.active:
        return set()
    if user.role == "super_admin":
        return set(ALL)
    return (ROLE_PERMS.get(user.role, set()) | set(user.extra_perms or [])) - set(user.denied_perms or [])


def can(user, perm: str) -> bool:
    return perm in effective(user)


def app_in_scope(user, a) -> bool:
    s = SCOPE.get(user.role)
    # a national federation answers to the Registrar, not to the county officer of its head-office county
    if s in ("county", "sport") and a.type == "Federation / Association":
        return False
    if s == "county":
        return a.county_id == user.county_id
    if s == "sport":
        return a.sport == user.sport_id
    return True


def facility_in_scope(user, f) -> bool:
    return not (SCOPE.get(user.role) == "county" and f.county_id != user.county_id)
