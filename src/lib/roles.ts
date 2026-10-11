import type { Application, Facility } from "./types";

export type Permission =
  | "applications.view"
  | "applications.review"
  | "applications.endorse"
  | "applications.decide"
  | "records.suspend"
  | "facilities.verify"
  | "payments.view"
  | "payments.reconcile"
  | "users.manage"
  | "settings.manage"
  | "audit.view"
  | "reports.export"
  | "directory.view"
  | "federations.manage"
  | "roles.manage";

export type RoleId =
  | "super_admin"
  | "registrar"
  | "county_officer"
  | "federation_admin"
  | "facilities_officer"
  | "finance_officer"
  | "integrity_officer"
  | "system_admin";

export interface Role {
  id: RoleId;
  label: string;
  office: string;
  scope: "national" | "county" | "sport";
  summary: string;
  duties: string[];
  perms: Permission[];
}

export const ROLES: Role[] = [
  {
    id: "super_admin",
    label: "Super Administrator",
    office: "Office of the Principal Secretary / Control Centre",
    scope: "national",
    summary: "Holds every right and controls who else holds which. Appoints officers, edits role rights and oversees all records.",
    duties: [
      "Create accounts and assign roles, counties and sports",
      "Edit the rights each role holds",
      "Grant or withhold individual rights",
      "Oversee every verification, payment and audit entry",
    ],
    perms: [
      "applications.view", "applications.review", "applications.endorse", "applications.decide", "records.suspend",
      "facilities.verify", "payments.view", "payments.reconcile", "users.manage", "roles.manage", "settings.manage",
      "audit.view", "reports.export", "directory.view", "federations.manage",
    ],
  },
  {
    id: "registrar",
    label: "Sports Registrar",
    office: "Office of the Sports Registrar",
    scope: "national",
    summary: "Makes the final legal decision on every registration and keeps the national register.",
    duties: [
      "Approve or reject registrations",
      "Issue certificates and licences",
      "Suspend or reinstate records",
      "View every record nationwide",
    ],
    perms: [
      "applications.view",
      "applications.review",
      "applications.decide",
      "records.suspend",
      "payments.view",
      "audit.view",
      "reports.export",
      "directory.view",
      "federations.manage",
    ],
  },
  {
    id: "county_officer",
    label: "County Sports Officer",
    office: "County Sports Office",
    scope: "county",
    summary: "First line of review. Checks applicants and verifies facilities within their own county only.",
    duties: [
      "Review applications from their county",
      "Request missing information",
      "Verify and inspect facilities in their county",
      "Escalate for endorsement and decision",
    ],
    perms: ["applications.view", "applications.review", "facilities.verify", "reports.export", "directory.view"],
  },
  {
    id: "federation_admin",
    label: "Federation Administrator",
    office: "National sports federation",
    scope: "sport",
    summary: "Confirms that athletes and clubs belong to the federation for their sport.",
    duties: [
      "Endorse members of their sport",
      "Flag affiliation problems",
      "View registrations for their sport",
    ],
    perms: ["applications.view", "applications.endorse", "directory.view"],
  },
  {
    id: "facilities_officer",
    label: "Facilities Officer",
    office: "Facilities & Infrastructure",
    scope: "national",
    summary: "National view of facilities: verifies records, logs inspections and keeps condition data current.",
    duties: [
      "Verify or reject facility records",
      "Log inspections and condition",
      "Correct GPS and capacity",
    ],
    perms: ["facilities.verify", "reports.export"],
  },
  {
    id: "finance_officer",
    label: "Finance Officer",
    office: "Finance & Accounts",
    scope: "national",
    summary: "Reconciles fees collected and handles manual payments and refunds.",
    duties: [
      "Reconcile M-Pesa and card receipts",
      "Record manual or bank payments",
      "Process refunds",
      "Export finance reports",
    ],
    perms: ["payments.view", "payments.reconcile", "reports.export", "audit.view"],
  },
  {
    id: "integrity_officer",
    label: "Compliance & Integrity Officer",
    office: "Compliance, Anti-Doping & Disputes",
    scope: "national",
    summary: "Acts on integrity cases: suspends or reinstates records under due process.",
    duties: [
      "Suspend or reinstate records",
      "Maintain the case trail",
      "Support disputes and tribunals",
    ],
    perms: ["applications.view", "records.suspend", "audit.view", "directory.view"],
  },
  {
    id: "system_admin",
    label: "System Administrator",
    office: "ICT",
    scope: "national",
    summary: "Runs the platform itself: staff accounts, roles and settings. Cannot approve registrations.",
    duties: [
      "Create staff accounts and assign roles",
      "Maintain fee schedule and lists",
      "Review the audit log",
    ],
    perms: ["users.manage", "settings.manage", "audit.view", "federations.manage"],
  },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r])) as Record<RoleId, Role>;

export interface StaffUser {
  /** Effective rights as computed by the server (role rights plus individual grants and denials). */
  perms?: Permission[];
  extraPerms?: Permission[];
  deniedPerms?: Permission[];
  lastLogin?: string | null;
  mustChangePassword?: boolean;
  needs2fa?: boolean;
  id: string;
  name: string;
  role: RoleId;
  title: string;
  /** county id for county officers */
  countyId?: string;
  countyName?: string;
  /** sport id for federation admins */
  sportId?: string;
  active: boolean;
  email: string;
}

export function can(user: StaffUser | null | undefined, perm: Permission): boolean {
  if (!user || !user.active) return false;
  return user.perms ? user.perms.includes(perm) : ROLE_BY_ID[user.role].perms.includes(perm);
}

export function inScopeApp(user: StaffUser | null | undefined, app: Application): boolean {
  if (!user) return false;
  const r = ROLE_BY_ID[user.role];
  if (r.scope === "county") return app.place.countyId === user.countyId;
  if (r.scope === "sport") return app.sport === user.sportId;
  return true;
}

export function inScopeFacility(user: StaffUser | null | undefined, f: Facility): boolean {
  if (!user) return false;
  const r = ROLE_BY_ID[user.role];
  if (r.scope === "county") return f.place.countyId === user.countyId;
  return true;
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  "applications.view": "View applications",
  "applications.review": "Review & request info",
  "applications.endorse": "Endorse membership",
  "applications.decide": "Approve / reject",
  "records.suspend": "Suspend / reinstate",
  "facilities.verify": "Verify facilities",
  "payments.view": "View payments",
  "payments.reconcile": "Reconcile & refund",
  "users.manage": "Manage staff & roles",
  "settings.manage": "Manage settings & fees",
  "audit.view": "View audit log",
  "reports.export": "Export reports",
  "directory.view": "See the restricted directory",
  "federations.manage": "Manage federations",
  "roles.manage": "Change role rights",
};
