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
- IDs stabil; `createdAt`/`updatedAt` UTC. Fachliche Daten `YYYY-MM-DD`, Uhrzeit `HH:mm`; lokales Heute. Notizen als Markdown-Quelltext mit optionaler noteFormat-Markierung; alte unmarkierte Notizen bleiben Klartext.
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
- Typprüfung/Build, 43 Domänen-/Speicher-/Link-/Markdown-Tests und vier Edge-Browserabläufe erfolgreich. Desktop/Timeline/schmales Layout visuell geprüft. Safari und echte iOS-Geräte ungeprüft.
- Playwright benutzt Edge und Port 5174; `npm run test:e2e`. Bei Sandbox-EPERM Prüfung außerhalb der Sandbox anfordern. `npm run format:check` für Formatierung.
- Erweiterungen am 2026-10-13: Projektstatus, eine Projektkategorie mit Einstellungen/Filtern, alle offenen To-Dos im Überblick, Webadressen ohne Protokoll und Markdown-Notizen mit Vorschau/Toolbar/HTML-Einfügen umgesetzt. Sicherungsformat 3, v1/v2 weiterhin importierbar.
- Als Nächstes Benutzerfeedback zur Phase-1-Oberfläche aufnehmen; erst danach Phase 2 angehen. Tenant-Freigabe kann parallel geklärt werden.

## Folgeauftrag 16. Oktober 2026
- Benutzer hat die Tauri-Windows-Testversion mit Installer und festem lokalen Datenbereich ausdrücklich beauftragt. Browser-Testdaten müssen nicht übernommen werden. Die bisherige Einschränkung zu Tauri ist damit für diesen Auftrag aufgehoben.
- Gemeinsamer Web-Kern bleibt erhalten, IndexedDB weiterhin hinter ProjectStore. Native Plattformfunktionen unter `src/platform`, Rust-Hülle unter `src-tauri`.
- Feste Produktionskennung: `io.github.jejepage.winprogman`; WebView-Profil unter `%LOCALAPPDATA%/io.github.jejepage.winprogman/webview`. Entwicklung nutzt `.dev` als getrennte Kennung. Keine automatische Löschung oder Umbenennung dieses Profils bei Updates.
- `npm run desktop:dev` und `npm run desktop:build -- -- --locked`; Buildausgaben unter `src-tauri/target/windows`. Alte lokale Buildreste erhalten, nicht versionieren oder als aktuellen Quellstand behandeln.
- Microsoft-Login, Sync, Outlook, native Pfadöffnung und automatische Updates bleiben spätere Aufgaben. Aktuelle Windows-Abnahme und Einschränkungen in README dokumentieren.
- Windows-CI und NSIS-Installer erfolgreich (Commit 87fe048, PR #5). Lokal 65 Tests und sieben Edge-Abläufe erfolgreich. Installierte Windows-App startet; Projekt/Aufgabe bleiben nach App-Neustart erhalten, nativer JSON-Export und Abbruch sowie Einzelinstanz geprüft. Nativer vollständiger Import, Zwischenablage und externe Links noch nicht praktisch abgenommen. Codex-Testinstallation kann durch Windows-Paketvirtualisierung im Codex-LocalCache liegen; regulären Installer aus Explorer starten. Details und Downloadpfad in README.
- Version 0.2.1: Add task/Add event verwenden jetzt dieselbe Detailseite wie Edit. Neuanlage nutzt Hash-Route mit mode=new und optionaler Projektvorwahl; erst Save erzeugt einen Datensatz. Gemeinsame Editoren, keine Inline-Erstellung. Save/Cancel erhalten die vorherige Liste und deren Filter. Lokal Typprüfung, Build, 65 Tests und acht Edge-Abläufe erfolgreich; zusätzlicher Ablauf prüft Save/Cancel, Projektvorwahl, Filter, verworfene Entwürfe und Reload. Beide Seiten visuell geprüft. Windows-Build 38888408022 erfolgreich; Installer unter src-tauri/target/windows-ci/0.2.1/installer. Reguläre Installation per Installer außerhalb Codex aktualisieren; in diesem Schritt keine erneute native Installation. Browser-App enthält Änderung bereits.
- Zwischenzeitliche Installationssperre 16. Oktober 2026 (danach Benutzerbestätigung „jetzt gehts“, aktuell kein fortbestehender Blocker): Regulärer Explorer-Start des unsignierten Installers 0.2.1 durch Windows App Control gesperrt (CodeIntegrity 3033/3077, NotSigned). Signierung/zulässigen Verteilungsweg und gegebenenfalls IT-Freigabe klären. Erfolgreiche Codex-Testinstallation nicht als reguläre Freigabe behandeln. Keine Abschaltung oder Umgehung von Sicherheitsrichtlinien empfehlen; Browser-App für weitere UI-Tests nutzen.

## Folgeauftrag 0.3.0 – 16. Oktober 2026
- Benutzer hat Umsetzung des abgestimmten Änderungsplans mit „weiter“ beauftragt. Speicherort umfasst ausschließlich intern gespeicherte Projektdaten samt Datenbank; verlinkte Dokumente werden nicht verschoben. Native Ordneröffnung ist für diesen Auftrag ausdrücklich beauftragt.
- Windows-Settings bietet wählbaren leeren lokalen Datenordner. IndexedDB bleibt hinter ProjectStore; ganzes geschlossenes WebView-Profil wird beim nächsten Start nach `<Auswahl>/webview` kopiert. Quelle behalten, kein Überschreiben nicht leerer Ziele. Feste Produktionskennung und bisheriger Standardpfad bleiben gültig; stabile `storage-location.json` im bisherigen App-Verzeichnis enthält aktive/geplante Pfade. Keine automatische Profil-Löschung. Entwicklungskennung weiterhin getrennt. Kein Live-Cloud-Sync des Profils.
- Datenumzug behandelt Dateisperren, Schreibfehler, unzugängliche Ziele, fehlende konfigurierte Profile und unterbrochene/fehlgeschlagene erste WebView-Aktivierung. Alte Daten nicht durch einen leeren Bestand ersetzen; native Startfehlermeldungen und Rückfallpfad erhalten. Neue Rust-Tests laufen zusätzlich in Windows-CI.
- Notes sind eigene UI-Objekte mit Sidebar, Suche und Editor; intern weiterhin Kategorie Notiz in events. Events/Timeline und Dashboard-Zählung schließen Notizen aus. Projektseite: Tasks, Events und Notes getrennt. Legacy-Klartext, IDs und Altzeitangaben bleiben erhalten; Sicherungsformat bleibt 4.
- Aufgabenflags direkt in Listen; atomare `todo.setDoNext`-Änderung erhält andere aktuelle Aufgabenfelder. Projekt-/Linkentwurf wird mit `project.saveWithLinks` atomar gespeichert; Linkaktionen nur im Projekteditor. Icons für Ordner/Web/SharePoint, Windows öffnet ausschließlich geprüfte Ordnerpfade. Projekte werden nach Topic gruppiert; vor Gruppierung filtern, No topic zuletzt, Projektnummern unverändert.
- Aktuelle Prüfergebnisse und verbleibende native Einschränkungen stehen im README-Abschnitt zu 0.3.0. Frühere installierte Version 0.2.1 enthält diese Änderungen erst nach Installer-Update; reguläre Installation in dieser Arbeit nicht automatisch verändern.
- Abnahme 0.3.0: 77 Unit-/Speicher-/Plattformtests, neun Rust-Tests, elf Edge-Abläufe, Typprüfung und Webbuild erfolgreich. Native Entwicklungs-App: Ordnerwahl/Abbruch, Datenumzug mit Restart/Reload und erhaltener Quelle, Linkbearbeitung und Explorer-Ordneröffnung sowie JSON-Export nach Umzug erfolgreich. Nur synthetische Daten im getrennten `.dev`-Profil; Entwicklungszeiger nach Prüfung auf ursprünglichen Entwicklungsordner zurückgesetzt. Details im README.
- Quellcommit `9aafe9d`, Branch `codex/notes-links-storage`, PR #6. Lokale Release-EXE baut; erneute NSIS-Paketierung durch Application Control für `makensis.exe` gesperrt (4551). Aktueller Installer wird über Windows-CI 38948348200 gebaut; vorhandene lokale Buildreste nicht als verifizierten neuen Installer verteilen. Keine Änderungen an Sicherheitsrichtlinien oder regulärer Benutzerinstallation.
- Windows-CI 38948348200 und allgemeine CI für Quellcommit `9aafe9d` erfolgreich. Installer 0.3.0 heruntergeladen und ZIP-SHA256 gegen GitHub-Artefakt geprüft; verifizierte Datei: `src-tauri/target/windows-ci/0.3.0/9aafe9d/installer/WinProgMan_0.3.0_x64-setup.exe`. EXE-Produktversion 0.3.0, SHA256 `d810a00cad37c0d1eeac4ddaf7c8fc40f93dfea06e757737da4f42b8ea89098c`. Benutzerinstallation weiterhin unverändert; App schließen und diesen Installer regulär aus Explorer starten.

## Folgeauftrag Milkdown/Crepe – 16. Oktober 2026
- Konkreter Plan wurde durch Benutzer „freigegeben“; gemeinsame formatierte Bearbeitung für Notes und Event-Notiztexte mit Crepe 7.22.3 umgesetzt. Feste TopBar, Tabellenaktionen, sichere Links, CodeMirror, Undo/Redo, Quellmodus und bereinigtes HTML-/Klartext-Paste. Details und aktueller Prüfstand im neuen README-Abschnitt.
- Implementierung unter `src/features/markdown/`; `MarkdownEditor` hält Dokument lokal und liefert bei Save synchron die aktuelle Quelle. Kein per-Tastendruck-Schreiben in React-Elternzustand oder IndexedDB. Nicht sicher übertragbare Inhalte bleiben im Quellmodus; tatsächliche Quellübernahme startet neue History. Unveränderte Quellen und unmarkierte Klartextnotizen bleiben bytegenau erhalten, einschließlich CRLF. Delete-Bestätigungsabbruch erhält den Entwurf.
- Keine Schema-/Datenmigration, Sicherungsformat bleibt 4. Raw HTML bleibt inert, Markdown-Bilder nur Platzhalter, Datei-Paste/Drop und Uploadplugin deaktiviert. KaTeX-Override 0.19.0 hält transitive Abhängigkeiten ohne bekannte npm-Audit-Befunde; Mathematikfunktion deaktiviert.
- Native Entwicklungsprüfung im getrennten `.dev`-Profil erfolgreich; synthetische Notiz wieder gelöscht und vorherigen Bestand geprüft. Reguläre Installation und vorhandene Installer unverändert; Quellen und Verpackung 0.4.0 sind inzwischen auf GitHub in PR #7 (siehe abschließenden Installer-Prüfstand). Vollständige Word-/Obsidian-Kompatibilität nicht zugesichert, tatsächliche systemweite Rich-Clipboard-Paste und Safari/iOS weiterhin ungeprüft. Performance-Skript `scripts/editor-performance.mjs`, Ergebnisse ignoriert unter `test-results/`.
- Abschließende Prüfung: 109 Tests, 24 Edge-Abläufe, Typprüfung und Webbuild erfolgreich; geänderte Dateien formatiert, globale Formatprüfung meldet 37 unveränderte Altdateien. Isolierter Produktionslauf: 100k Zeichen öffnen 916 ms, Eingabe p95 17,6 ms; 500k öffnen 4,34 s. Breite Tabellen im schmalen Fenster mit internem Scrollen geprüft. Details/Nachweise im README.
- Folgeauftrag Installer/GitHub: Benutzer hat „erstelle einen installer und pushe auf github“ beauftragt. Version 0.4.0 in npm/Tauri/Cargo; Branch `codex/milkdown-editor`. NSIS-Paket über vorhandene Windows-CI bauen und als geprüftes Artefakt herunterladen. Keine automatische Installation, keine Änderung am Produktionsprofil und keine Änderung an Windows-Sicherheitsrichtlinien. Die zusätzliche lokale Datei `Plane folgende Änderungen bevor die.txt` gehört nicht zum Editorauftrag und bleibt unversioniert.
- Installer-Abnahme 17. Oktober 2026: Quellcommit `877507f`, PR #7, Windows-CI `38964440294` und allgemeine CI erfolgreich. Installer 0.4.0 heruntergeladen, ZIP-SHA256 gegen GitHub-Digest geprüft, EXE-Produkt-/Dateiversion 0.4.0. Verifizierte Datei `src-tauri/target/windows-ci/0.4.0/877507f/installer/WinProgMan_0.4.0_x64-setup.exe`, EXE-SHA256 `b8fd2075a61a536617cbfc7a423461214a012664497c4fdc3e68a9224d0bebb2`. Unsigniert; nicht automatisch ausgeführt oder installiert. Vollständige Nachweise in README. Folgende reine Dokumentationscommits verändern den geprüften Installer-Quellstand nicht.

## Folgeauftrag kompakte Listen und Brainstorm – 17. Oktober 2026
- Benutzer hat Plan mit „Ok“ freigegeben; gesonderte Übernahme bestehender Testprojekte nicht erforderlich. Änderungen im Web-Kern umgesetzt: Zeit-Badges in Events entfernt, einheitliche Add-Buttons, eine gemeinsame Projekttabelle mit Topic-Gruppen ohne Topic-Spalte, breitere Projektfelder in Events/Notes.
- Project.number ist jetzt dauerhaft, positive ganze Zahl, automatisch atomar max+1 und im Projekteditor manuell änderbar; globale Eindeutigkeit wird auch im Store/Import geprüft. IDs und Projektverknüpfungen bleiben unverändert.
- Settings: Classic/Color (proportionale Systemschrift mit vier Objektakzenten), Icons and labels/Icons only, unabhängig von Light/Dark/System. Darstellung lokal außerhalb JSON.
- Brainstorm ist globales fortlaufendes Markdown-Dokument in AppData, kein Event/Note. Gemeinsamer Editor mit optionalem onDocumentChange, label und compact; normale Notes/Events bleiben Save/Cancel. Autosave nach600ms und vor Navigation/Export/Import, Queue und Revision-CAS schützen Änderungen. Pro-Tab-Journal stellt beim Reload wieder her; abrupter Prozessabbruch vor Speicherung nicht zugesichert. Bei Mehrfensterkonflikt Entwurf kopieren und nach Reload vergleichen.
- Sicherungsformat 5 enthält number und brainstorm; alte Formate weiter lesbar. samples.load erhält Brainstorm atomar und lehnt vorhandene Projekte ab. Kein Installer, keine neue native Abnahme, kein Push und keine Produktionsinstallation in diesem Auftrag.
- Abnahme: 122 Tests, 29 Edge-Abläufe im vollständigen Schlusslauf, Typprüfung und Webbuild erfolgreich. Geänderte Quellen formatiert; globale Formatprüfung meldet 30 unveränderte Altdateien. Layouts visuell geprüft; Details und native Einschränkungen im README. Bestehende unversionierte Datei „Plane folgende Änderungen bevor die.txt“ unverändert erhalten.

## Verpackung 0.5.0 – 17. Oktober 2026
- Benutzer hat „Erstelle den installer“ beauftragt. Aktuelle UI-/Brainstorm-Änderungen als 0.5.0 mit vorhandener Windows-CI paketieren; nötigen Quellstand auf eigenem Branch `codex/brainstorm-ui` zu GitHub übertragen. Keine automatische Installation, kein Merge und keine Änderung am Produktionsprofil/Sicherheitsrichtlinien. Installer vor Übergabe anhand Artefakt-Digest, EXE-Version und SHA256 prüfen. Unversionierte Benutzerdatei unverändert lassen.
- Installer-Abnahme 0.5.0: Quellcommit `1f8242e`, PR #8, Windows-CI `39011795108` und allgemeine CI erfolgreich. ZIP-Digest geprüft; EXE-Produkt-/Dateiversion 0.5.0, SHA256 `ae5be71bc95f32674ba18f4c598a4e79f222f5884e971b59403f1033c3375413`. Datei `src-tauri/target/windows-ci/0.5.0/1f8242e/installer/WinProgMan_0.5.0_x64-setup.exe`. Unsigniert; nicht ausgeführt/installiert. Neue native Funktionsabnahme steht aus. Nachfolgende reine Dokumentationscommits verändern den geprüften Installer-Quellstand nicht. Details im README.

## Optionales Split Compact – 17. Oktober 2026
- Nachbesserung 18. Oktober: Navigation placement mit Sidebar (Standard) / Top navigation in Split Compact; Icons and labels / Icons only unabhängig davon funktionsfähig. Neue lokale Präferenz `winprogman-navigation`, keine Datenmigration. Unter 761 px responsive Navigation oben. 122 Tests, fünf gezielte Edge-Abläufe, Typprüfung und Webbuild erfolgreich; Details im README.
- Benutzer hat Umsetzung auf `codex/split-compact-ui` beauftragt. Vorrangige Ergänzung: zusätzliches Design unter Settings → Appearance, Classic bleibt Standard. Color erhalten. Designs unabhängig von Light/Dark/System und lokal außerhalb JSON gespeichert; keine Datenmigration.
- Gemeinsame Komponenten bleiben beim Wechsel gemountet; Projekt, Ansicht, Filter und ungespeicherte Projekt-/Link-/Task-/Markdown-Entwürfe bleiben erhalten. Globale Designauswahl für Wechsel während der Bearbeitung. Save/Cancel und bestehendes Brainstorm-Autosave unverändert.
- Gekapselte Tokens/Styles `src/ui/split-compact.css`: horizontale Navigation, kantige Arial-Oberfläche, blaue Projektdatei mit echter Nummer, Do-next-/Offen-/Erledigt-Bereiche, orange/grüne Event-/Note-Vorschauen mit vollständigen Listen und Timeline. Mobil gestapelt.
- Abnahme: 122 Tests, 33 Edge-Abläufe, Typprüfung und Webbuild erfolgreich. Zusätzliche Sichtprüfung und Screenshots siehe README. Kein Push, Installer oder Änderung an regulärer Installation/Produktionsprofil. Unversionierte Benutzerdatei und zuvor erstellte Prompt-Ergänzung erhalten.

## Verpackung 0.6.0 und Settings-Sicherung – 18. Oktober 2026
- Benutzer beauftragt Import/Export in Settings und Erstellung der App. Sicherungsaktionen ausschließlich unter Settings → Import & export, globale Dateieingabe für laufende Importvorschau erhalten. Sicherungsformat und Fachlogik unverändert.
- Version 0.6.0; Split Compact samt Sidebar/Top und Icons only mit vorhandener Windows-CI paketieren. Nötigen Quellstand auf `codex/split-compact-ui` übertragen und PR für CI anlegen. Keine automatische Installation, kein Merge, keine Änderung an Produktionsprofil/Sicherheitsrichtlinien. Installer anhand ZIP-Digest, EXE-Version und SHA256 verifizieren. Endgültigen Prüfstand und Downloadpfad im README dokumentieren; unversionierte Benutzerdateien erhalten.
