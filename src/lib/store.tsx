"use client";

import { ToastViewport } from "@/components/ui/Toasts";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./api";
import { loadAdmin, type AdminData } from "./admin";
import { can as roleCan, type Permission, type StaffUser } from "./roles";
import type {
  Application,
  AppStatus,
  AuditEntry,
  ClubInfo,
  Condition,
  Facility,
  FacilityStatus,
  Federation,
  Place,
  PublicStats,
  GeoPoint,
  AppConfig,
  Notice,
  RoleItem,
  ClubOfficial,
  SportEvent,
  StakeholderType,
} from "./types";
import { PageLoader } from "@/components/ui/Spinner";

export interface Me extends StaffUser {
  phone: string;
  staff: boolean;
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
  needs2fa?: boolean;
}

interface State {
  applications: Application[];
  facilities: Facility[];
  events: SportEvent[];
  federations: Federation[];
  staff: StaffUser[];
  audit: AuditEntry[];
  fees: Record<StakeholderType, number>;
  stats: PublicStats;
  club: ClubInfo | null;
  notifications: Notice[];
  config: AppConfig;
  roles: RoleItem[];
}

export interface RegisterDraft {
  type: StakeholderType;
  name: string;
  idNo: string;
  kra: string;
  phone: string;
  email: string;
  password?: string;
  place: Place;
  gps?: GeoPoint;
  sport: string;
  level: string;
  clubName: string;
  orgRegNo?: string;
  parentId?: string;
  address?: string;
  clubOfficials?: ClubOfficial[];
  publicListing?: boolean;
  role?: string;
  sportOther?: string;
  hasContract?: string;
  notes: string;
  dob?: string;
  gender?: string;
  guardian?: { name: string; phone: string; relationship: string; consent: boolean };
  website?: string;
}

export interface FacilityDraft {
  name: string;
  type: string;
  sports: string[];
  place: Place;
  gps: GeoPoint;
  capacity?: number;
  ownership?: string;
  condition?: string;
}

export interface PlayerDraft {
  name: string;
  idNo: string;
  kra?: string;
  phone?: string;
  email?: string;
  sport?: string;
  level: string;
  hasContract?: string;
  notes?: string;
  dob?: string;
  gender?: string;
  guardian?: { name: string; phone: string; relationship: string; consent: boolean };
  publicListing?: boolean;
}

interface Toast {
  id: number;
  text: string;
  title?: string;
  tone: "ok" | "error";
}

interface Store {
  ready: boolean;
  admin: AdminData;
  state: State;
  me: Me | null;
  /** Signed-in Ministry/federation staff, if any. */
  user: StaffUser | null;
  /** Signed-in applicant (player or club manager), if any. */
  member: Me | null;
  can: (p: Permission) => boolean;
  federationName: (sportId: string) => string;
  refresh: () => Promise<void>;
  login: (identifier: string, password: string, code?: string, audience?: "member" | "staff") => Promise<Me>;
  markNotificationsRead: () => Promise<void>;
  startMpesa: (ids: string[], phone: string) => Promise<string>;
  attemptStatus: (id: string) => Promise<{ status: string; message: string; receipt: string | null }>;
  logout: () => Promise<void>;
  notify: (text: string, tone?: "ok" | "error", title?: string) => void;
  // applicant
  register: (d: RegisterDraft) => Promise<Application>;
  payApplication: (id: string, method: string, ref: string, otp: string) => Promise<void>;
  resubmit: (id: string, note: string) => Promise<void>;
  renew: (id: string) => Promise<void>;
  appeal: (id: string, note: string) => Promise<void>;
  addClubPlayer: (d: PlayerDraft) => Promise<Application>;
  payClub: (ids: string[], method: string, ref: string, otp: string) => Promise<void>;
  addFacility: (d: FacilityDraft) => Promise<Facility>;
  // staff (errors are shown as a toast)
  setStatus: (id: string, status: AppStatus, note?: string) => Promise<boolean>;
  setFacilityStatus: (id: string, status: FacilityStatus, note?: string) => Promise<void>;
  addInspection: (id: string, condition: Condition, note: string) => Promise<void>;
  updateFacility: (id: string, patch: { capacity?: number; ownership?: string; sports?: string[] }) => Promise<void>;
  manualPay: (id: string, method: string, ref: string) => Promise<void>;
  toggleReconciled: (id: string) => Promise<void>;
  refund: (id: string) => Promise<void>;
  setFee: (t: StakeholderType, amount: number) => Promise<void>;
  addStaff: (u: { name: string; email: string; role: string; title: string; password: string; countyId?: string; sportId?: string }) => Promise<boolean>;
  updateStaff: (id: string, patch: { role?: string; active?: boolean; extraPerms?: string[]; deniedPerms?: string[]; countyId?: string; sportId?: string; password?: string }) => Promise<boolean>;
  bulk: (ids: string[], action: string, note?: string) => Promise<void>;
  requestVideo: (id: string, note: string) => Promise<boolean>;
  cancelVideoRequest: (id: string) => Promise<boolean>;
  saveFederation: (sportId: string, f: { name: string; status: string; contactEmail: string }) => Promise<boolean>;
}

type Boot = Partial<State> & {
  me: Me | null;
  facilities?: Facility[];
  club?: ClubInfo | null;
  payments?: { mpesa: boolean; demoOtp: boolean; demo: boolean; required: boolean; simulate: boolean };
  evidence?: AppConfig["evidence"];
  catalogue?: { roles: RoleItem[] };
};

const EMPTY: State = {
  applications: [],
  facilities: [],
  events: [],
  federations: [],
  staff: [],
  audit: [],
  fees: {} as State["fees"],
  stats: { players: 0, clubs: 0, teams: 0, scouts: 0, facilities: 0, events: 0, bySport: {} },
  club: null,
  notifications: [],
  roles: [],
  config: { mpesa: false, demoOtp: true, demo: false, required: false, simulate: false, evidence: { enabled: true, levels: [], sports: [], clubDocuments: true } },
};

// Status change → the server-side action name.
function actionFor(from: AppStatus, to: AppStatus): string | null {
  const map: Record<string, string> = {
    "Submitted>Under review": "review",
    "Under review>Needs info": "need_info",
    "Needs info>Under review": "info_received",
    "Under review>Endorsed": "endorse",
    "Under review>Approved": "approve",
    "Endorsed>Approved": "approve",
    "Submitted>Rejected": "reject",
    "Under review>Rejected": "reject",
    "Endorsed>Rejected": "reject",
    "Approved>Suspended": "suspend",
    "Suspended>Approved": "reinstate",
    "Rejected>Under review": "reopen",
  };
  return map[`${from}>${to}`] ?? null;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [state, setState] = useState<State | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minDelay, setMinDelay] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);


  const apply = useCallback((b: Boot, keepFacilities: boolean) => {
    setMe(b.me);
    setState((prev) => {
      const base = prev ?? EMPTY;
      return {
        applications: b.applications ?? [],
        facilities: keepFacilities ? base.facilities : (b.facilities ?? base.facilities),
        events: b.events ?? base.events,
        federations: b.federations ?? base.federations,
        staff: b.staff ?? [],
        audit: b.audit ?? [],
        fees: b.fees ?? base.fees,
        stats: b.stats ?? base.stats,
        club: b.club ?? null,
        notifications: b.notifications ?? [],
        roles: b.catalogue?.roles ?? base.roles,
        config: b.payments && b.evidence ? { ...b.payments, evidence: b.evidence } : base.config,
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAdmin(), api<Boot>("/bootstrap")])
      .then(([a, b]) => {
        if (cancelled) return;
        setAdmin(a);
        apply(b, false);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed to load data"));
    const t = setTimeout(() => setMinDelay(true), 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [apply]);

  const notify = useCallback((text: string, tone: "ok" | "error" = "ok", title?: string) => {
    setToasts((t) => [...t.slice(-3), { id: (t[t.length - 1]?.id ?? 0) + 1, text, tone, title }]);
  }, []);
  const closeToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    const b = await api<Boot>("/bootstrap?facilities=0");
    apply(b, true);
  }, [apply]);

  const patchFacility = useCallback((f: Facility) => {
    setState((s) => (s ? { ...s, facilities: s.facilities.some((x) => x.id === f.id) ? s.facilities.map((x) => (x.id === f.id ? f : x)) : [f, ...s.facilities] } : s));
  }, []);

  const store = useMemo<Store | null>(() => {
    if (!state || !admin) return null;
    const user: StaffUser | null = me && me.staff && me.active ? me : null;

    /** Run a staff mutation: refresh on success, toast the server's message on failure. */
    const run = async (fn: () => Promise<unknown>, ok?: string): Promise<boolean> => {
      try {
        await fn();
        await refresh();
        if (ok) notify(ok);
        return true;
      } catch (e) {
        notify(e instanceof ApiError ? e.message : "Something went wrong. Please try again.", "error");
        return false;
      }
    };

    return {
      ready: true,
      admin,
      state,
      me,
      user,
      member: me && !me.staff ? me : null,
      can: (p) => roleCan(user, p),
      federationName: (sportId) => state.federations.find((f) => f.sportId === sportId)?.name ?? "",
      refresh,
      notify,

      login: async (identifier, password, code, audience) => {
        const r = await api<{ me: Me }>("/auth/login", "POST", { identifier, password, code: code ?? "", audience });
        await refresh();
        const first = r.me.name.trim().split(/\s+/)[0];
        notify(r.me.staff ? "You are signed in to the staff console." : "Your account is ready.", "ok", `Welcome back, ${first}`);
        return r.me;
      },
      markNotificationsRead: async () => {
        await api("/notifications/read", "POST");
        await refresh();
      },
      startMpesa: async (ids, phone) => {
        const r = await api<{ attemptId: string }>("/pay/mpesa", "POST", { applicationIds: ids, phone });
        return r.attemptId;
      },
      attemptStatus: async (id) => {
        const r = await api<{ status: string; message: string; receipt: string | null }>(`/pay/attempts/${id}`);
        if (r.status !== "Pending") await refresh();
        return r;
      },
      logout: async () => {
        const first = me?.name.trim().split(/\s+/)[0];
        await api("/auth/logout", "POST");
        await refresh();
        notify(first ? `Goodbye, ${first}. Your session has ended safely.` : "Your session has ended safely.", "ok", "Signed out");
      },

      register: async (d) => {
        const r = await api<{ application: Application }>("/registrations", "POST", d as unknown as Record<string, unknown>);
        await refresh();
        return r.application;
      },
      payApplication: async (id, method, ref, otp) => {
        await api(`/applications/${id}/pay`, "POST", { method, ref, otp });
        await refresh();
      },
      resubmit: async (id, note) => {
        await api(`/applications/${id}/resubmit`, "POST", { note });
        await refresh();
      },
      renew: async (id) => {
        try {
          await api(`/applications/${id}/renew`, "POST");
          await refresh();
          notify("Renewal started. Pay the fee to extend your certificate.");
        } catch (e) {
          notify(errText(e), "error");
        }
      },
      appeal: async (id, note) => {
        await api(`/applications/${id}/appeal`, "POST", { note });
        await refresh();
        notify("Appeal lodged. The Registrar has been notified.");
      },
      addClubPlayer: async (d) => {
        const r = await api<{ application: Application }>("/club/players", "POST", d as unknown as Record<string, unknown>);
        await refresh();
        return r.application;
      },
      payClub: async (ids, method, ref, otp) => {
        await api("/club/pay", "POST", { applicationIds: ids, method, ref, otp });
        await refresh();
      },
      addFacility: async (d) => {
        const r = await api<{ facility: Facility }>("/facilities", "POST", d as unknown as Record<string, unknown>);
        patchFacility(r.facility);
        return r.facility;
      },

      setStatus: async (id, status, note) => {
        const from = state.applications.find((a) => a.id === id)?.status;
        const action = from ? actionFor(from, status) : null;
        if (!action) {
          notify("That change is not allowed from the current status.", "error");
          return false;
        }
        return run(() => api(`/applications/${id}/transition`, "POST", { action, note: note ?? "" }), `Status updated to ${status}.`);
      },
      setFacilityStatus: async (id, status, note) => {
        try {
          const r = await api<{ facility: Facility }>(`/facilities/${id}/status`, "POST", { status, note: note ?? "" });
          patchFacility(r.facility);
          notify(`Facility ${status.toLowerCase()}.`);
        } catch (e) {
          notify(e instanceof ApiError ? e.message : "Could not update the facility.", "error");
        }
      },
      addInspection: async (id, condition, note) => {
        try {
          const r = await api<{ facility: Facility }>(`/facilities/${id}/inspections`, "POST", { condition, note });
          patchFacility(r.facility);
          notify("Inspection logged.");
        } catch (e) {
          notify(e instanceof ApiError ? e.message : "Could not log the inspection.", "error");
        }
      },
      updateFacility: async (id, patch) => {
        try {
          const r = await api<{ facility: Facility }>(`/facilities/${id}`, "PATCH", patch);
          patchFacility(r.facility);
        } catch (e) {
          notify(e instanceof ApiError ? e.message : "Could not save changes.", "error");
        }
      },
      manualPay: async (id, method, ref) => {
        await run(() => api(`/payments/${id}/manual`, "POST", { method, ref }), "Payment recorded.");
      },
      toggleReconciled: async (id) => {
        await run(() => api(`/payments/${id}/reconcile`, "POST"));
      },
      refund: async (id) => {
        await run(() => api(`/payments/${id}/refund`, "POST"), "Refund issued.");
      },
      setFee: async (t, amount) => {
        await run(() => api(`/fees/${encodeURIComponent(t)}`, "PUT", { amount }), "Fee updated.");
      },
      addStaff: (u) => run(() => api("/users", "POST", u), "Staff account created."),
      updateStaff: (id, patch) => run(() => api(`/users/${id}`, "PATCH", patch), "Account updated."),
      bulk: async (ids, action, note) => {
        try {
          const r = await api<{ done: number; results: { id: string; ok: boolean; error?: string }[] }>("/applications/bulk", "POST", { ids, action, note: note ?? "" });
          await refresh();
          const failed = r.results.filter((x) => !x.ok);
          notify(`${r.done} updated${failed.length ? `, ${failed.length} skipped: ${failed[0].error}` : "."}`, failed.length ? "error" : "ok");
        } catch (e) {
          notify(errText(e), "error");
        }
      },
      requestVideo: (id, note) => run(() => api(`/applications/${id}/media-request`, "POST", { note }), "Trial video requested. The player will see this in their account."),
      cancelVideoRequest: (id) => run(() => api(`/applications/${id}/media-request`, "DELETE"), "Request cancelled."),
      saveFederation: (sportId, f) => run(() => api(`/federations/${sportId}`, "PUT", f), "Federation saved."),
    };
  }, [state, admin, me, refresh, notify, patchFacility]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-bone px-6 text-center">
        <div>
          <p className="text-xl font-bold text-forest-900">We couldn&apos;t reach the registry.</p>
          <p className="mt-2 text-ink-2">{error}</p>
          <button onClick={() => location.reload()} className="mt-6 rounded-lg bg-forest-800 px-6 py-3 text-sm font-bold text-white">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!store || !minDelay) return <PageLoader label="Loading the national sports registry" />;

  return (
    <StoreContext.Provider value={store}>
      {children}
      <ToastViewport toasts={toasts} onClose={closeToast} />
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore must be used inside <StoreProvider>");
  return s;
}

/** Message from any thrown value, for inline form errors. */
export function errText(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
}
