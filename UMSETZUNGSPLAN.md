# WinProgMan – Umsetzungsplan

Stand: 13. Oktober 2026. Grundlage: `Projekt-App – Spezifikation.md`.

## 1. Ausgangslage und Ziel

Das GitHub-Repository [Jejepage/WinProgMan](https://github.com/Jejepage/WinProgMan) ist vorhanden, öffentlich und aktuell leer. Der lokale Arbeitsordner enthält die Spec, aber noch keinen Git-Checkout und keinen Anwendungscode. Repository und Inhalte wurden über den GitHub-Connector geprüft.

Ziel der ersten Umsetzung ist eine vollständig bedienbare lokale Web-App: fünf Ansichten, vollständiges Anlegen/Bearbeiten/Löschen, Ereignisliste und Timeline, Filter, JSON-Sicherung und Beispieldaten. Microsoft-Login, Sync, Outlook und native Verpackung bleiben den späteren Phasen vorbehalten. Die Nennung von Claude Code in der Spec legt keine technische Architektur fest; dieser Plan beschreibt die Umsetzung mit Codex und gezielt eingesetzten Subagenten.

## 2. Vorgeschlagene technische Basis

- React und TypeScript für Oberfläche und typisierte Domänenlogik; Vite für Entwicklung und statischen Produktionsbuild. Kein Backend für Phase 1.
- IndexedDB als lokaler Speicher hinter einer asynchronen Schnittstelle. Oberflächenkomponenten greifen niemals direkt auf IndexedDB zu.
- Schlichte CSS-Gestaltung: breite Projektseite mit zwei Spalten; auf schmalen Fenstern untereinander. Vier feste Navigationsbuttons plus Projektseite als Detailansicht.
- Kleine zentrale Zustandsverwaltung mit gemeinsamen Abfragen für alle Ansichten. Zusätzliche State-Management-Bibliothek erst bei tatsächlichem Bedarf.
- Unit-Tests für Datum, Abfragen und Import; Speicherintegrationstests; wenige Browser-End-to-End-Tests für kritische Abläufe.

Diese Auswahl ist eine Empfehlung, keine Vorgabe aus der Spec. Versionen werden beim Projektstart kompatibel gewählt und mit Lockfile festgehalten.

Quellen für die geprüften Grundlagen: [Vite](https://vite.dev/guide/), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [Tauri](https://v2.tauri.app/start/).

## 3. Architektur und Datenvertrag

```text
src/
  app/                 Navigation, Initialisierung, gemeinsamer Zustand
  domain/              Datentypen, Änderungen, Sortierung und Ansichtsabfragen
  storage/             ProjectStore, IndexedDB-Adapter, Migrationen
  features/projects/   Projektliste, Kopf und Links
  features/todos/      Aufgabenliste und Bearbeitung
  features/events/     Ereignisse, Filter und Timeline
  features/overview/   Projektübergreifender Überblick
  features/backup/     JSON-Import und Export
  ui/                  Gemeinsame Bedienelemente und Styles
tests/
docs/
```

Jedes Objekt erhält eine stabile ID sowie technische `createdAt`-/`updatedAt`-Zeitstempel. Links, To-Dos und Ereignisse referenzieren ein Projekt über `projectId`. Diese Metadaten erscheinen nicht als Eingabefelder.

| Objekt | Fachliche Felder |
| --- | --- |
| Projekt | Name, Kurzbeschreibung |
| Link | Anzeigename, URL oder Pfad |
| To-Do | Titel, erledigt, optionales Fälligkeitsdatum |
| Ereignis | Kategorie, Titel, Datum, optionale Uhrzeit, optionaler Notiztext |

Kalenderdaten werden als `YYYY-MM-DD`, Uhrzeiten als `HH:mm` und technische Zeitstempel in UTC gespeichert. Notiztext bleibt Klartext einschließlich Zeilenumbrüchen. Die fünf Kategorien sind fest definiert.

Gemeinsamer Speichervertrag, vor paralleler Implementierung verbindlich festlegen:

```ts
interface ProjectStore {
  load(): Promise<AppData>;
  apply(change: DomainChange): Promise<void>;
  exportData(): Promise<ExportEnvelope>;
  importData(data: ExportEnvelope): Promise<void>;
}
```

`DomainChange` beschreibt gezielte CRUD-Änderungen. Zusammengehörige Änderungen, insbesondere Projektlöschung mit abhängigen Daten und vollständiger Import, erfolgen atomar. Die Oberfläche zeigt Speicherfehler verständlich und bestätigt eine Änderung erst nach erfolgreicher Speicherung.

Exportformat: `schemaVersion`, `exportedAt`, `projects`, `links`, `todos`, `events`. Schema-Version und Migrationen sind unabhängig von der App-Version. Der zukünftige Sync-Dienst ergänzt diesen lokalen Datenzugriff; er ersetzt ihn nicht durch direkte Netzwerkanfragen aus der UI. IDs und Zeitstempel allein stellen noch keine Konfliktlösung dar.

## 4. Arbeitsannahmen für nicht festgelegte Details

Diese Defaults machen Phase 1 direkt umsetzbar. Sie können während des Oberflächentests angepasst werden.

| Thema | Geplanter Default |
| --- | --- |
| Pflichtfeldfreiheit | Keine blockierenden Pflichtfeldformulare. Leere Titel erhalten neutrale Ersatznamen; Ereignisdatum ist mit heute vorbelegt. Ein Link ohne Ziel wird nicht als funktionsfähiger Link angelegt. |
| Ruhende Projekte | Abgeleitet: weder offene To-Dos noch kommende Ereignisse. Kein eigener Status, keine Archivverwaltung. |
| Überblick | Pro Projekt zunächst fünf offene To-Dos und fünf kommende Ereignisse; Anzahl weiterer Einträge und Sprung zur Projektseite. Alle überfälligen Aufgaben bleiben über die vollständige Aufgabenliste erreichbar. |
| Aufgabenreihenfolge | Offen vor erledigt; bei offenen Aufgaben überfällig zuerst, anschließend Datum aufsteigend, danach ohne Datum. Stabile Reihenfolge bei Gleichstand. |
| Überfällig | Offenes To-Do mit Datum vor dem heutigen lokalen Kalendertag. Heute fällige Aufgaben sind nicht überfällig. |
| Kommende Ereignisse | Datum ab heute, einschließlich aller heutigen Ereignisse. Eine bereits verstrichene heutige Uhrzeit blendet den Eintrag nicht aus. |
| Ereignisreihenfolge | Chronologisch aufsteigend, bei gleichem Datum nach Uhrzeit; ohne Uhrzeit zuerst. Timeline nutzt dieselbe Ordnung und markiert heute. |
| Globale Listen | Alle Projekte; Aufgaben enthalten auch erledigte Einträge, Ereignisse auch vergangene. Projektname ist jeweils anklickbar. |
| Notizdatum | Beim Anlegen einer Notiz automatisch heute. Späteres Bearbeiten des Textes verändert das Datum nicht. |
| Projektlöschung | Bestätigung nennt betroffene Inhalte; Projekt, Links, Aufgaben und Ereignisse werden zusammen gelöscht. |
| JSON-Import | Erst vollständig prüfen, dann nach Vorschau und Bestätigung ersetzen. Vorher Export der bisherigen Daten anbieten. Kein Zusammenführen in Phase 1. |
| Beispieldaten | Bewusst per „Beispieldaten laden“ in leerem Bestand; keine automatische Wiederherstellung nach Löschen oder Import. |
| Lokale Pfade | Speichern, anzeigen und kopieren. Öffnen von Datei-/Netzwerkpfaden wird im Zielbrowser geprüft; zuverlässige native Öffnung gehört zur Windows-Phase. |

## 5. Umsetzungspakete und Abhängigkeiten

| Paket | Ergebnis | Abhängigkeit | Verantwortlich |
| --- | --- | --- | --- |
| P0 – Projektstart | Git-Verbindung zum vorhandenen Repo, Spec und Plan übernehmen, README, Vite/TypeScript-Grundgerüst, Lockfile, Build-/Testskripte, GitHub-CI | Keine | Hauptagent |
| P1 – Verträge | Datentypen, Speichervertrag, Datumsregeln, Demo-/Testdatensatz, gemeinsame CRUD-Operationen | P0 | Hauptagent mit Architektur-Subagent |
| P2 – Speicherung | IndexedDB, atomare Änderungen, Referenzprüfung, Initialisierung, Fehlermeldungen | P1 | Daten-Subagent |
| P3 – Erster vollständiger Ablauf | Navigation, Projektliste, Projekt anlegen, Projektkopf bearbeiten, Links und Aufgaben mit CRUD und Speicherung | P1; Integration mit P2 | Hauptagent |
| P4 – Ereignisse | CRUD aller Kategorien, Textnotizen, Datum/Uhrzeit, Liste/Timeline-Umschalter, Heute-Markierung und Filter | P1; Integration mit P2/P3 | Ereignis-Subagent |
| P5 – Übergreifende Ansichten | Überblick, globale Aufgaben-/Ereignislisten, Projektsprünge, Überfällig-Markierung | P3/P4 | Hauptagent |
| P6 – Sicherung und Beispiele | Versionierter Export, validierter atomarer Import, Demo-Aktion | P2; parallel zu P3/P4 möglich | Daten-Subagent |
| P7 – Abnahme | Kritische Tests, Tastaturbedienung, breite/schmale Fenster, Browserprüfung, README für Start und Sicherung | P2–P6 | Prüf-Subagent und Hauptagent |

Der erste überprüfbare Meilenstein ist nach P3 erreicht: Projekt anlegen, Aufgabe hinzufügen/abhaken, Seite neu laden und gespeicherte Daten wiederfinden. Die komplette Phase 1 ist erst nach P7 abgeschlossen.

## 6. Subagenten sinnvoll einsetzen

Für diesen Plan wurden zwei Subagenten eingesetzt: Architektur/Datenhaltung sowie UX/Abnahmekriterien. Ihre Ergebnisse sind in Datenvertrag, Defaults und Abnahme eingeflossen.

Bei der Umsetzung höchstens drei Subagenten neben dem Hauptagenten gleichzeitig:

1. **Datenagent:** `storage/`, Import/Export und Speicher-/Importtests. Liefert einen dokumentierten Adapter und nachvollziehbare Fehlerfälle.
2. **Ereignisagent:** `features/events/`, Timeline, Kategorieauswahl und zugehörige Tests. Nutzt ausschließlich den abgestimmten Datenvertrag.
3. **Prüfagent:** unabhängige Prüfung gegen Spec und Abnahmeliste, später Browsertests; meldet reproduzierbare Fehler mit Priorität.

Der Hauptagent verantwortet Grundgerüst, Domänenverträge, Navigation, Projekte, Aufgaben, Überblick und Integration. Gemeinsame Typen, globale Styles und Paketabhängigkeiten haben jeweils einen Verantwortlichen. Subagenten ändern diese nicht gleichzeitig. Sie arbeiten nach P1 parallel an getrennten Bereichen; Integration erfolgt in kleinen Schritten. Für jede Übergabe werden Umfang, Dateien, Schnittstellen, Abhängigkeiten und Abnahmekriterien benannt.

Die fünf Ansichten werden nicht fünf unabhängigen Agenten zugeteilt: Ihr gemeinsamer Zustand und ihre gemeinsamen Bedienelemente würden unnötige Überschneidungen verursachen.

## 7. Abnahmekriterien für Phase 1

- Alle vier Navigationsbuttons funktionieren; die Projektseite ist aus Projektliste, Überblick und globalen Listen erreichbar.
- Projekte, Links, To-Dos und Ereignisse lassen sich anlegen, bearbeiten und löschen. Änderungen sind in allen betroffenen Ansichten sofort konsistent.
- Abhaken und erneutes Öffnen einer Aufgabe funktionieren; erledigte Aufgaben verschwinden aus dem Überblick.
- Ein Projekt ohne offene Aufgaben und ohne heutige/zukünftige Ereignisse fehlt im Überblick und bleibt in der Projektliste.
- Datumsfälle gestern/heute/morgen, Aufgaben ohne Datum und Ereignisse ohne Uhrzeit sind korrekt. Ein Tageswechsel aktualisiert Überblick und Heute-Markierung auch bei geöffneter App.
- Alle fünf Kategorien sind verfügbar. Liste und Timeline zeigen denselben gefilterten Ereignisbestand; die Heute-Markierung liegt korrekt zwischen Vergangenheit und heute/Zukunft.
- Ein zukünftiges Meeting lässt sich ohne Notiz anlegen und später ergänzen. Eine Notiz erhält automatisch das Erstellungsdatum.
- Mehrzeiliger eingefügter Text bleibt erhalten und wird als Text dargestellt.
- Neuladen erhält den gesamten Bestand. Ein Speicherfehler wird sichtbar und erzeugt keinen vorgetäuschten Erfolg.
- Projektlöschung hinterlässt keine verwaisten Datensätze.
- Export und Wiederimport erhalten IDs, Beziehungen und alle fachlichen Felder. Ungültiges JSON, unbekannte Schema-Version, doppelte IDs und ungültige Projektverweise werden vor jeder Änderung abgewiesen.
- Abbruch eines Imports oder einer Löschbestätigung verändert keine Daten. Fehlgeschlagener Import lässt den alten Bestand vollständig bestehen.
- Beispieldaten enthalten ein aktives und ein ruhendes Projekt, Aufgaben mit/ohne Datum sowie vergangene, heutige und zukünftige Ereignisse aller Kategorien.
- Bedienung per Tastatur, erkennbare Fokuszustände, beschriftete Checkboxen und lesbare leere Zustände sind vorhanden. Breite und schmale Fenster haben keine verdeckten Bedienelemente.
- Build, Typprüfung, relevante Tests und CI sind erfolgreich. Browserabnahme umfasst mindestens Windows Edge/Chrome und einen Safari-Test, falls zugänglich; ungetestete Browser werden dokumentiert.

## 8. GitHub-Arbeitsweise

Beim Implementierungsstart den lokalen Ordner kontrolliert mit dem leeren Repository verbinden und einen initialen Stand auf `main` anlegen. Die bestehende Spec bleibt erhalten. Anschließend kleine Feature-Branches und PRs entlang zusammenhängender Pakete; P1 muss vor parallelen Features integriert sein.

Mögliche Issue-Zuschnitte: Grundgerüst, Domänenvertrag, lokaler Speicher, Projekt-/Aufgabenablauf, Ereignisse/Timeline, globale Ansichten, Sicherung/Beispiele, Abnahme. Jeder Eintrag bekommt konkrete Kriterien aus Abschnitt 7. Keine separate Issue-Flut für einzelne Buttons.

CI prüft Typen, Produktionsbuild und automatisierte Tests. Statische Testveröffentlichung ist eine spätere gesonderte Aktion; ihre Browseradresse bildet einen eigenen lokalen Datenbestand. JSON-Sicherung ermöglicht den Wechsel zwischen Testadressen.

Dieser Plan erstellt noch keine Remote-Issues, Commits oder Anwendung. Die Planung ist lokal gespeichert und kann als Grundlage für die Umsetzung dienen.

## 9. Spätere Phasen

| Phase | Arbeit und Abschlusskriterium |
| --- | --- |
| 2 – Windows | Web-Kern in Tauri verpacken; dauerhaften Speicherort/Migration, native Pfadöffnung, Installation und Updates klären. Der Browser-Prototyp läuft weiterhin unabhängig. |
| 3 – Sync | Tenant-Freigabe, App-Registrierung und erlaubte Graph-Berechtigungen vorab klären. Anschließend Anmeldung, Synchronisierungsformat, Änderungs-/Löschverfolgung und Konfliktstrategie; Zwei-Geräte-Tests einschließlich Offline-Änderungen und Löschkonflikten. |
| 4 – iPhone/iPad | Wrapper nach Prüfung von Login, Speicher und iOS-Einschränkungen auswählen; gemeinsame Web-Logik verwenden. Layout, Datumsverhalten und Sync auf echten Geräten prüfen. |
| Optional – Outlook | Explizite Übertragung eines Meetings und Zuordnung zur Kalender-ID; Schutz vor Duplikaten. Separat von der lokalen Ereignisverwaltung. |

Tenant-Genehmigung kann früh parallel zur Web-Umsetzung geklärt werden. Konfliktstrategie, Archivierung und private Microsoft-Anbindung bleiben offene Produktentscheidungen, blockieren Phase 1 aber nicht. Für den Sync reicht „letzte Änderung gewinnt“ anhand der Geräteuhr allein nicht; die Strategie muss zusammen mit dem Sync-Protokoll festgelegt werden.
