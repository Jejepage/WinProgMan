# WinProgMan – Hinweise für Agenten

## Auftrag und Quellen
- Persönliche Projektmanagement-App für eine Person; deutsche Oberfläche. Keine Teamfunktionen.
- Zuerst `Projekt-App – Spezifikation.md`, danach `UMSETZUNGSPLAN.md` und `README.md` lesen.
- Repository: https://github.com/Jejepage/WinProgMan.
- Aktueller Auftrag: vollständige Phase 1 umsetzen, mit sinnvollen Subagenten. Die Spec-Nennung „Claude Code“ ist keine technische Bindung.
- Phase 1: lokale Browser-App, fünf Ansichten, CRUD für Projekte/Links/To-Dos/Ereignisse, Timeline und Kategorien, JSON-Import/Export, ausdrücklich ladbare Beispieldaten.
- Microsoft-Login, OneDrive, Outlook, Tauri/iOS kommen später. Nicht vorzeitig implementieren.

## Architektur
- React + TypeScript + Vite, IndexedDB hinter `ProjectStore`. Kein Backend.
- `src/domain`: Typen, reine Änderungen, Ansichtsabfragen und Datumsregeln.
- `src/storage`: Datenbank und Sicherungsformat. Keine IndexedDB-Aufrufe in UI-Komponenten.
- `src/features`: wiederverwendbare Aufgaben- und Ereignisoberflächen; `src/app`: Navigation und Integration.
- Vier Navigationsbuttons: Überblick, Projekte, To-Dos, Ereignisse. Projektseite als fünfte Detailansicht.
- IDs stabil; `createdAt`/`updatedAt` UTC. Fachliche Daten `YYYY-MM-DD`, Uhrzeit `HH:mm`; lokales Heute. Notizen Klartext.
- Gemeinsame Verträge in `src/domain/types.ts` und `src/storage/ProjectStore.ts` vor paralleler Arbeit lesen.

## Verbindliche Defaults
- Keine blockierenden Pflichtfeldformulare; neutrale Ersatznamen, Datum heute. Links brauchen ein nutzbares Ziel.
- Ruhend wird abgeleitet, kein Archivstatus. Offene Aufgaben ohne Datum zählen im Überblick.
- Überfällig: offenes To-Do mit Datum vor heute. Kommend: Ereignisdatum ab heute, auch bei verstrichener heutiger Uhrzeit.
- Ereignisse aufsteigend nach Datum/Uhrzeit; ohne Uhrzeit zuerst. Standardansicht Liste; Timeline markiert heute.
- Kategorien: Meeting, Telefonat, Milestone, Beschluss, Notiz. Notiz erhält beim Anlegen heute.
- Import prüft alles vor atomarem Ersatz, zeigt Vorschau/Bestätigung und bietet vorher Sicherung. Kein Merge.
- Projektlöschung bestätigt und löscht abhängige Inhalte atomar. Beispieldaten niemals automatisch wiederherstellen.
- Browserpfade anzeigen/kopieren; native Pfadöffnung erst Windows-Phase.

## Zusammenarbeit und Prüfung
- Subagenten sind für diesen Auftrag ausdrücklich autorisiert. Sinnvolle Bereiche: Speicher/Sicherung, Ereignisse/Timeline, unabhängige Prüfung.
- Hauptagent verantwortet gemeinsame Typen, Abhängigkeiten, globale Styles und Integration. Keine gleichzeitigen Änderungen daran.
- Kleine überprüfbare Schritte. Keine isolierte Implementierung der fünf Ansichten mit duplizierter Logik.
- `npm run check`, `npm test`, `npm run build`; Browserabläufe für CRUD, Reload und Import/Export prüfen.
- Tests für fachliche Datumsgrenzen, Referenzen, Importfehler und Persistenz. Keine Tests, die nur einfache Handler spiegeln.
- Nach relevanten Meilensteinen README-Arbeitsstand und verbleibende Einschränkungen aktualisieren, damit neue Chats anschließen können.
- Bestehende Änderungen erhalten; keine Force-Pushes. Secrets und lokale Daten niemals committen.

## Arbeitsstand
- 2026-10-13: Phase 1 implementiert: fünf Ansichten, CRUD, IndexedDB, JSON-Sicherung, Beispiele und CI. `README.md` enthält Startanleitung, aktuelle Prüfergebnisse und Einschränkungen.
- Typprüfung/Build, 22 Domänen-/Speichertests und zwei Edge-Browserabläufe erfolgreich. Desktop/Timeline/schmales Layout visuell geprüft. Safari und echte iOS-Geräte ungeprüft.
- Playwright benutzt Edge und Port 5174; `npm run test:e2e`. Bei Sandbox-EPERM Prüfung außerhalb der Sandbox anfordern. `npm run format:check` für Formatierung.
- Als Nächstes Benutzerfeedback zur Phase-1-Oberfläche aufnehmen; erst danach Phase 2 angehen. Tenant-Freigabe kann parallel geklärt werden.
