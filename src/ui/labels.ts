import type { Category, ProjectStatus } from "../domain/types";

export const projectStatusLabels: Record<ProjectStatus, string> = {
  Geplant: "Planned",
  Aktiv: "In progress",
  Pausiert: "Paused",
  Abgeschlossen: "Completed",
};

export const eventCategoryLabels: Record<Category, string> = {
  Meeting: "Meeting",
  Telefonat: "Phone call",
  Milestone: "Milestone",
  Beschluss: "Decision",
  Notiz: "Note",
};

export const statusLabel = (status: ProjectStatus): string =>
  projectStatusLabels[status];
export const categoryLabel = (category: Category): string =>
  eventCategoryLabels[category];

const errorTranslations: Record<string, string> = {
  "Objekt erwartet.": "Expected an object.",
  "Unbekanntes Feld.": "Unknown field.",
  "Gültiger Text erwartet.": "Expected valid text.",
  "UTC-Zeitstempel erwartet.": "Expected a UTC timestamp.",
  "Ungültiger Zeitstempel.": "Invalid timestamp.",
  "Gültiges Datum YYYY-MM-DD erwartet.": "Expected a valid YYYY-MM-DD date.",
  "Nur Sicherungsformat 1, 2 und 3 werden unterstützt.":
    "Only backup formats 1, 2 and 3 are supported.",
  "Liste erwartet.": "Expected an array.",
  "Doppelte ID.": "Duplicate ID.",
  "Liegt vor dem Erstellungszeitpunkt.": "Precedes creation time.",
  "Doppelter Kategoriename.": "Duplicate topic name.",
  "Unbekannter Projektstatus.": "Unknown project status.",
  "Kategorie existiert nicht.": "Topic does not exist.",
  "Projekt existiert nicht.": "Project does not exist.",
  "Nicht unterstütztes Linkprotokoll.": "Unsupported link protocol.",
  "Ungültige URL.": "Invalid URL.",
  "Wahrheitswert erwartet.": "Expected a boolean.",
  "Unbekannte Ereigniskategorie.": "Unknown event category.",
  "Uhrzeit HH:mm erwartet.": "Expected HH:mm time.",
  "Unbekanntes Notizformat.": "Unknown note format.",
  Sicherung: "Backup",
  "Lokaler Speicher konnte nicht geöffnet werden.":
    "Unable to open local storage.",
  "Lokaler Speicher ist durch ein anderes Fenster blockiert.":
    "Local storage is blocked by another window.",
  "Lesen des lokalen Speichers wurde abgebrochen.":
    "Reading local storage was cancelled.",
  "Änderung wurde nicht gespeichert.": "The change was not saved.",
};
export function errorLabel(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const [source, target] of Object.entries(errorTranslations))
    message = message.replaceAll(source, target);
  return message;
}
