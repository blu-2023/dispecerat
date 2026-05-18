export const incidentTypeLabels: Record<string, string> = {
  persoana_suspecta: "Persoană suspectă",
  acces_neautorizat: "Acces neautorizat",
  incident_parcare: "Incident parcare",
  comportament_suspect: "Comportament suspect",
  perimetru_incalcat: "Perimetru încălcat",
  efractie: "Efracție",
  lipsa_tensiune: "Lipsă tensiune",
  verificare_client: "Verificare client",
  stationare_nepermisa: "Staționare nepermisă",
  incident_tehnic: "Incident tehnic",
  panica: "Panică",
  incendiu: "Incendiu",
  sabotaj: "Sabotaj",
  urgenta_medicala: "Urgență medicală",
  armare_dezarmare: "Armare/Dezarmare",
  test_sistem: "Test sistem",
  bypass_zona: "Bypass zonă",
  alarma_generala: "Alarmă generală",
  altul: "Altul",
};

export const incidentTypes = Object.entries(incidentTypeLabels).map(
  ([value, label]) => ({ value, label })
);

export const severityLabels: Record<string, string> = {
  LOW: "Scăzut",
  MEDIUM: "Mediu",
  HIGH: "Ridicat",
  CRITICAL: "Critic",
};

export const severityOptions = Object.entries(severityLabels).map(
  ([value, label]) => ({ value, label })
);

export const statusLabels: Record<string, string> = {
  NEW: "Nou",
  IN_PROGRESS: "În lucru",
  SENT: "Trimis",
  CONFIRMED: "Confirmat",
  CLOSED: "Închis",
  CANCELLED: "Anulat",
};

export const statusColors: Record<string, string> = {
  NEW: "bg-blue-900/30 text-blue-400",
  IN_PROGRESS: "bg-yellow-900/30 text-yellow-400",
  SENT: "bg-green-900/30 text-green-400",
  CONFIRMED: "bg-emerald-900/30 text-emerald-400",
  CLOSED: "bg-slate-700 text-slate-300",
  CANCELLED: "bg-red-900/30 text-red-400",
};

export const severityColors: Record<string, string> = {
  CRITICAL: "bg-red-900/30 text-red-400",
  HIGH: "bg-orange-900/30 text-orange-400",
  MEDIUM: "bg-yellow-900/30 text-yellow-400",
  LOW: "bg-green-900/30 text-green-400",
};

export const roleLabels: Record<string, string> = {
  DISPECERAT: "Dispecer",
  ADMIN: "Administrator",
  DIRECTOR: "Director",
};

export const roleOptions = Object.entries(roleLabels).map(
  ([value, label]) => ({ value, label })
);

// Roles allowed to manage other users (create/edit/disable/reset password).
export const USER_ADMIN_ROLES = ["ADMIN", "DIRECTOR"];

export const sourceLabels: Record<string, string> = {
  VPN_VIDEO: "VPN Video",
  MANUAL: "Manual",
  SEKA: "SEKA Alarmă",
};

export const sourceColors: Record<string, string> = {
  VPN_VIDEO: "bg-blue-900/30 text-blue-400",
  MANUAL: "bg-slate-700 text-slate-300",
  SEKA: "bg-orange-900/30 text-orange-400",
};

export const sekaStatusColors: Record<string, string> = {
  ONLINE: "bg-green-900/30 text-green-400",
  OFFLINE: "bg-slate-700 text-slate-300",
  ERROR: "bg-red-900/30 text-red-400",
};

export const sekaEventStatusColors: Record<string, string> = {
  NEW: "bg-blue-900/30 text-blue-400",
  PROCESSED: "bg-green-900/30 text-green-400",
  IGNORED: "bg-slate-700 text-slate-300",
  ERROR: "bg-red-900/30 text-red-400",
};
