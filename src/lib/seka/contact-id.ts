/**
 * Ademco Contact ID Protocol Parser
 * Format: ACCT MT QXYZ GG CCC
 * - ACCT: Account code (3-6 digits)
 * - MT: Message type (18 = Contact ID)
 * - Q: Event qualifier (1=New Event, 3=Restore, 6=Status)
 * - XYZ: Event code (3 digits)
 * - GG: Group/Partition (2 digits)
 * - CCC: Zone/User (3 digits)
 */

export interface ContactIdEvent {
  accountCode: string;
  messageType: string;
  qualifier: string; // E = event, R = restore, S = status
  eventCode: string;
  group: string;
  zone: string;
  raw: string;
}

// Event qualifier mapping
const QUALIFIER_MAP: Record<string, string> = {
  "1": "E", // New Event/Opening
  "3": "R", // Restore/Closing
  "6": "S", // Status
};

// Ademco Contact ID event codes → type + label + severity
export const EVENT_CODES: Record<string, { type: string; label: string; severity: string }> = {
  // Alarme medicale
  "100": { type: "MEDICAL", label: "Urgență medicală", severity: "CRITICAL" },
  "101": { type: "MEDICAL", label: "Urgență medicală personală", severity: "CRITICAL" },

  // Alarme de incendiu
  "110": { type: "FIRE", label: "Alarmă de incendiu", severity: "CRITICAL" },
  "111": { type: "FIRE", label: "Detector de fum", severity: "CRITICAL" },
  "112": { type: "FIRE", label: "Combustie", severity: "CRITICAL" },
  "113": { type: "FIRE", label: "Flux apă", severity: "HIGH" },
  "114": { type: "FIRE", label: "Căldură", severity: "CRITICAL" },
  "115": { type: "FIRE", label: "Stație pompare", severity: "HIGH" },
  "116": { type: "FIRE", label: "Sprinkler duct", severity: "HIGH" },
  "117": { type: "FIRE", label: "Alarmă incendiu manuală", severity: "CRITICAL" },
  "118": { type: "FIRE", label: "Flux tub incendiu", severity: "HIGH" },

  // Alarme de panică
  "120": { type: "PANIC", label: "Panică", severity: "CRITICAL" },
  "121": { type: "PANIC", label: "Panică/Hold-up", severity: "CRITICAL" },
  "122": { type: "PANIC", label: "Panică silențioasă", severity: "CRITICAL" },
  "123": { type: "PANIC", label: "Panică audibilă", severity: "CRITICAL" },

  // Alarme de efracție
  "130": { type: "BURGLARY", label: "Efracție", severity: "HIGH" },
  "131": { type: "BURGLARY", label: "Efracție perimetru", severity: "HIGH" },
  "132": { type: "BURGLARY", label: "Efracție interior", severity: "HIGH" },
  "133": { type: "BURGLARY", label: "Alarmă 24h", severity: "HIGH" },
  "134": { type: "BURGLARY", label: "Intrare/Ieșire", severity: "MEDIUM" },
  "135": { type: "BURGLARY", label: "Alarmă zi/noapte", severity: "MEDIUM" },
  "136": { type: "BURGLARY", label: "Alarmă exterior", severity: "HIGH" },
  "137": { type: "BURGLARY", label: "Tamper/Sabotaj", severity: "HIGH" },
  "138": { type: "BURGLARY", label: "Alarmă proximitate", severity: "MEDIUM" },
  "139": { type: "BURGLARY", label: "Alarmă verificare", severity: "MEDIUM" },

  // Alarme generale
  "140": { type: "GENERAL", label: "Alarmă generală", severity: "MEDIUM" },
  "141": { type: "GENERAL", label: "Alarmă polling", severity: "LOW" },
  "142": { type: "GENERAL", label: "Alarmă expansiune", severity: "LOW" },
  "143": { type: "GENERAL", label: "Tamper senzor", severity: "HIGH" },
  "144": { type: "GENERAL", label: "Tamper senzor verificat", severity: "MEDIUM" },
  "145": { type: "GENERAL", label: "Alarmă șoc/tilt", severity: "MEDIUM" },
  "146": { type: "GENERAL", label: "Alarmă inactivitate", severity: "LOW" },

  // Alarme 24h non-efracție
  "150": { type: "ENVIRONMENTAL", label: "Alarmă 24h non-efracție", severity: "MEDIUM" },
  "151": { type: "ENVIRONMENTAL", label: "Detectare gaz", severity: "HIGH" },
  "152": { type: "ENVIRONMENTAL", label: "Refrigerare", severity: "MEDIUM" },
  "153": { type: "ENVIRONMENTAL", label: "Pierdere căldură", severity: "MEDIUM" },
  "154": { type: "ENVIRONMENTAL", label: "Scurgere apă", severity: "MEDIUM" },
  "155": { type: "ENVIRONMENTAL", label: "Folie ruptă", severity: "LOW" },
  "156": { type: "ENVIRONMENTAL", label: "Problemă zi", severity: "LOW" },
  "157": { type: "ENVIRONMENTAL", label: "Nivel gaz scăzut", severity: "MEDIUM" },
  "158": { type: "ENVIRONMENTAL", label: "Temperatură ridicată", severity: "MEDIUM" },
  "159": { type: "ENVIRONMENTAL", label: "Temperatură scăzută", severity: "MEDIUM" },

  // Supervizare
  "301": { type: "TROUBLE", label: "Lipsă curent AC", severity: "MEDIUM" },
  "302": { type: "TROUBLE", label: "Baterie descărcată", severity: "MEDIUM" },
  "303": { type: "TROUBLE", label: "RAM checksum eroare", severity: "LOW" },
  "304": { type: "TROUBLE", label: "ROM checksum eroare", severity: "LOW" },
  "305": { type: "TROUBLE", label: "Reset sistem", severity: "LOW" },
  "306": { type: "TROUBLE", label: "Schimbare programare panou", severity: "LOW" },
  "307": { type: "TROUBLE", label: "Test auto-protecție", severity: "LOW" },
  "308": { type: "TROUBLE", label: "Cădere comunicație", severity: "HIGH" },
  "309": { type: "TROUBLE", label: "Eroare buclă senzor", severity: "MEDIUM" },

  // Lipsă tensiune / probleme
  "311": { type: "TROUBLE", label: "Lipsă tensiune senzor", severity: "MEDIUM" },
  "312": { type: "TROUBLE", label: "Supravoltaj senzor", severity: "MEDIUM" },
  "320": { type: "TROUBLE", label: "Defect buclă sonar/releu", severity: "MEDIUM" },
  "321": { type: "TROUBLE", label: "Defect buclă linie telefon", severity: "MEDIUM" },
  "330": { type: "TROUBLE", label: "Pierdere senzor supraveghere", severity: "HIGH" },
  "331": { type: "TROUBLE", label: "Pierdere modul RF", severity: "HIGH" },
  "332": { type: "TROUBLE", label: "Pierdere senzor zonă", severity: "HIGH" },
  "333": { type: "TROUBLE", label: "Interferență radio", severity: "MEDIUM" },
  "334": { type: "TROUBLE", label: "Protecție interferență", severity: "LOW" },
  "335": { type: "TROUBLE", label: "Pierdere comunicare zonă", severity: "HIGH" },

  // Armare/Dezarmare
  "400": { type: "ARM_DISARM", label: "Armare/Dezarmare", severity: "LOW" },
  "401": { type: "ARM_DISARM", label: "Armare de la distanță", severity: "LOW" },
  "402": { type: "ARM_DISARM", label: "Armare rapidă", severity: "LOW" },
  "403": { type: "ARM_DISARM", label: "Armare DC", severity: "LOW" },
  "404": { type: "ARM_DISARM", label: "Armare tardivă", severity: "MEDIUM" },
  "405": { type: "ARM_DISARM", label: "Dezarmare tardivă", severity: "MEDIUM" },
  "406": { type: "ARM_DISARM", label: "Anulare alarmă", severity: "LOW" },
  "407": { type: "ARM_DISARM", label: "Armare de la distanță dezarmare", severity: "LOW" },
  "408": { type: "ARM_DISARM", label: "Armare rapidă prin cheie", severity: "LOW" },
  "409": { type: "ARM_DISARM", label: "Armare prin cheie", severity: "LOW" },

  // Dezarmare
  "410": { type: "ARM_DISARM", label: "Acces prin cod", severity: "LOW" },
  "411": { type: "ARM_DISARM", label: "Dezarmare după alarmă", severity: "MEDIUM" },
  "412": { type: "ARM_DISARM", label: "Dezarmare rapidă după alarmă", severity: "MEDIUM" },

  // Test / mentenanță
  "601": { type: "TEST", label: "Test manual", severity: "LOW" },
  "602": { type: "TEST", label: "Test periodic", severity: "LOW" },
  "603": { type: "TEST", label: "Test periodic RF", severity: "LOW" },
  "604": { type: "TEST", label: "Test pompier", severity: "LOW" },
  "605": { type: "TEST", label: "Status panou", severity: "LOW" },
  "606": { type: "TEST", label: "Listare evenimente", severity: "LOW" },

  // Bypass
  "570": { type: "BYPASS", label: "Bypass zonă", severity: "MEDIUM" },
  "571": { type: "BYPASS", label: "Bypass incendiu", severity: "HIGH" },
  "572": { type: "BYPASS", label: "Bypass 24h zonă", severity: "MEDIUM" },
  "573": { type: "BYPASS", label: "Bypass efracție", severity: "HIGH" },
  "574": { type: "BYPASS", label: "Bypass grup", severity: "MEDIUM" },
};

/**
 * Parse a Contact ID message string
 * Example: "1234 18 1130 01 001" → account 1234, new burglary event, partition 1, zone 1
 */
export function parseContactId(raw: string): ContactIdEvent | null {
  // Remove any brackets, spaces normalization
  const clean = raw.replace(/[\[\]]/g, "").trim();

  // Standard format: ACCT MT QXYZ GG CCC
  // ACCT can be HEX (Sempral GPRS uses 6-char hex like "012D33") OR pure digits (PSTN/older)
  // The rest are pure digits.
  const match = clean.match(
    /([0-9A-Fa-f]{3,8})\s*(\d{2})\s*(\d)(\d{3})\s*(\d{2})\s*(\d{3})/
  );

  if (!match) return null;

  const [, accountCode, messageType, qualifierRaw, eventCode, group, zone] = match;

  return {
    accountCode,
    messageType,
    qualifier: QUALIFIER_MAP[qualifierRaw] || qualifierRaw,
    eventCode,
    group,
    zone,
    raw: clean,
  };
}

/**
 * Get event info from code
 */
export function getEventInfo(eventCode: string): {
  type: string;
  label: string;
  severity: string;
} {
  return (
    EVENT_CODES[eventCode] || {
      type: "UNKNOWN",
      label: `Eveniment necunoscut (${eventCode})`,
      severity: "MEDIUM",
    }
  );
}

/**
 * Map SEKA event type to incident type for the app
 */
export function mapToIncidentType(eventType: string): string {
  const mapping: Record<string, string> = {
    BURGLARY: "efractie",
    PANIC: "panica",
    FIRE: "incendiu",
    MEDICAL: "urgenta_medicala",
    ENVIRONMENTAL: "incident_tehnic",
    TROUBLE: "lipsa_tensiune",
    ARM_DISARM: "armare_dezarmare",
    TEST: "test_sistem",
    BYPASS: "bypass_zona",
    GENERAL: "alarma_generala",
    UNKNOWN: "altul",
  };
  return mapping[eventType] || "altul";
}
