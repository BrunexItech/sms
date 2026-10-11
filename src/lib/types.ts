export const STAKEHOLDER_TYPES = [
  "Player / Sportsperson",
  "Club",
  "Academy",
  "Technical Team",
  "Coach",
  "Scout",
  "Sports Agent / Manager",
  "Sports Business",
  "Facility Operator",
  "Event Organiser",
  "Federation / Association",
] as const;
export type StakeholderType = (typeof STAKEHOLDER_TYPES)[number];

export const COMPETITION_LEVELS = [
  "Professional",
  "Semi-Professional",
  "Amateur",
  "Youth / Junior",
  "Community",
] as const;

export const FACILITY_TYPES = [
  "Stadium",
  "Football Pitch",
  "Athletics Track",
  "Indoor Arena",
  "Swimming Pool",
  "Basketball Court",
  "Rugby Ground",
  "Tennis Court",
  "Volleyball Court",
  "Cricket Ground",
  "Golf Course",
  "Sports Centre",
  "Gym / Fitness Centre",
  "Sports Pitch",
  "Other",
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const OWNERSHIP = [
  "National Government",
  "County Government",
  "School / University",
  "Private",
  "Club / Federation",
  "Community / Faith-based",
] as const;

export const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Under renovation"] as const;
export type Condition = (typeof CONDITIONS)[number];

export type AppStatus =
  | "Submitted"
  | "Under review"
  | "Needs info"
  | "Endorsed"
  | "Approved"
  | "Rejected"
  | "Suspended";

export interface HistoryEntry {
  at: string;
  by: string;
  role: string;
  action: string;
  note?: string;
}

export interface Payment {
  status: "Pending" | "Paid" | "Refunded";
  amount: number;
  method?: string;
  ref?: string;
  paidAt?: string;
  receipt?: string;
  reconciled?: boolean;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Place {
  countyId: string;
  subId: string;
  wardId: string;
  county: string;
  subCounty: string;
  ward: string;
}

export interface Application {
  id: string;
  /** Set when a verified club registered this player. */
  clubId?: string | null;
  photoUrl?: string | null;
  /** Raised by a verifying officer; never blocks approval. */
  dob?: string | null;
  gender?: string | null;
  guardian?: { name: string; phone: string; relationship: string; consent: boolean } | null;
  expiresAt?: string | null;
  renewing?: boolean;
  appeal?: { note: string; at: string; by: string } | null;
  /** True when the evidence rule still needs a trial video or federation endorsement. */
  evidenceNeeded?: boolean;
  mediaRequest?: { kind: "video"; note: string; by: string; role: string; at: string; fulfilledAt: string | null } | null;
  type: StakeholderType;
  name: string;
  idNo: string;
  kra: string;
  phone: string;
  email: string;
  place: Place;
  gps?: GeoPoint;
  sport: string;
  federation: string;
  level: string;
  clubName: string;
  clubOfficials?: { chairman: string; ceo: string; secretary: string; phone: string };
  hasContract?: "Yes" | "No";
  notes: string;
  status: AppStatus;
  payment: Payment;
  certificateNo?: string;
  createdAt: string;
  updatedAt: string;
  history: HistoryEntry[];
  demo?: boolean;
}

export type FacilityStatus = "Unverified" | "Verified" | "Rejected";

export interface Inspection {
  at: string;
  by: string;
  condition: Condition;
  note: string;
}

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  sports: string[];
  place: Place;
  gps: GeoPoint;
  capacity?: number;
  ownership?: string;
  condition?: Condition;
  status: FacilityStatus;
  source: "OpenStreetMap" | "Registered";
  createdAt: string;
  history: HistoryEntry[];
  inspections: Inspection[];
}

export interface AuditEntry {
  at: string;
  actor: string;
  role: string;
  action: string;
  target: string;
}

export interface Session {
  kind: "staff" | "member";
  /** staff user id, or application id for members */
  id: string;
}

export interface SportEvent {
  id: string;
  name: string;
  sport: string;
  date: string;
  venue: string;
  county: string;
  countyId: string;
  organiser: string;
  level: string;
}

export interface Federation {
  sportId: string;
  sportName: string;
  name: string;
  status: "Recognised" | "To be confirmed";
  contactEmail: string;
}

export interface PublicStats {
  players: number;
  clubs: number;
  teams: number;
  scouts: number;
  facilities: number;
  events: number;
  bySport: Record<string, number>;
}

export interface ClubInfo {
  id: string;
  name: string;
  sport: string;
  place: Place;
}

export interface Media {
  id: string;
  applicationId: string;
  kind: "photo" | "video" | "document";
  title: string;
  mime: string;
  size: number;
  createdAt: string;
  url: string;
  primary: boolean;
}

export interface Notice {
  id: number;
  at: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
}

export interface EvidenceRule {
  enabled: boolean;
  levels: string[];
  sports: string[];
  clubDocuments: boolean;
}

export interface AppConfig {
  mpesa: boolean;
  demoOtp: boolean;
  evidence: EvidenceRule;
}
