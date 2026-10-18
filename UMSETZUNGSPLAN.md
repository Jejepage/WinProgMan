# WinProgMan – Umsetzungsplan

## Aktueller Folgeauftrag: optionales Split Compact (17. Oktober 2026)

Folgeauftrag 18. Oktober 2026: Import/Export ausschließlich nach Settings verschieben und den gesamten UI-Stand als Windows-App 0.6.0 paketieren. Nötigen Quellstand für bestehende Windows-CI übertragen, Installer herunterladen/verifizieren; keine Installation und kein Merge. Dieser Auftrag hebt die frühere Einschränkung zu Verpackung/Push für diesen Stand auf.

Abgeschlossen: Quellcommit `dd0294a`, PR #9, 122 Tests/35 Edge-Abläufe sowie Windows-CI mit neun Rust-Tests erfolgreich. Installer 0.6.0 heruntergeladen und ZIP-Digest, EXE-Version/SHA256 geprüft; Pfad und vollständige Nachweise im README. Keine automatische Installation oder Änderung am Produktionsprofil.

Nach Benutzerfeedback vom 18. Oktober 2026: Navigation im Split-Compact-Design wahlweise links in der Sidebar (Standard) oder oben. Die bestehende Symbol-/Textauswahl bleibt in beiden Positionen unabhängig bedienbar und gespeichert. Unter 761 px responsive Navigation oben. Abnahme siehe README.

Die verbindliche Ergänzung hat Vorrang vor dem ursprünglichen Designprompt: Classic bleibt Standard und vollständig verfügbar; Split Compact ist zusätzlich auswählbar und unabhängig von Light/Dark/System. Vorhandenes Color bleibt erhalten. Branch: `codex/split-compact-ui`.

Gemeinsame Fachlogik, Datenquellen und Editoren erhalten. Layout über stabile gemeinsame Markup-Struktur und ausschließlich für Split Compact geltende Styles/Tokens trennen; keine Design-Keys oder Austausch von Editor-Komponenten. Lokale Designpräferenz ohne Datenmigration. Globale Designauswahl ermöglicht Umschalten bei offenem Entwurf, ohne Navigation auszulösen.

Referenz: weiße Arbeitsfläche, Text #11140F, Metadaten #394034, Linien #161B12, Projektfläche #1B32B4 mit Weiß, Do next/Notes #D5FF3F, kommende Events #FF874D mit #11170B. Arial und kräftige Projekttitel, kurze Metadaten/Nummern in Consolas, ausschließlich rechteckige Elemente. Dark-Variante mit dunklen Arbeitsflächen und lesbaren Akzenten. Projektdatei links ca. 30 %, Aufgaben rechts, darunter Ereignis-/Notizvorschauen mit Zugriff auf vollständige Listen und Timeline. Mobil gestapelt, intern scrollende Editortabellen. Bestehende englische Beschriftungen, Suche/Filter/CRUD/Import/Export/Save/Cancel erhalten.

Abnahme und verbleibende Grenzen stehen im neuesten README-Abschnitt. Keine Verpackung, kein Push, keine Installation in diesem UI-Auftrag.

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

## 10. Geplante Erweiterung nach Benutzerfeedback

Abgestimmt am 13. Oktober 2026. Die Erweiterung ist implementiert; Prüfstand und verbleibende Einschränkungen stehen in README.md.

### Festgelegtes Verhalten

- Projekte erhalten einen manuellen Status: Geplant, Aktiv, Pausiert oder Abgeschlossen. Vorschlag für neue und bestehende Projekte: Aktiv. „Ruhend“ bleibt eine abgeleitete Kennzeichnung anhand offener Aufgaben und kommender Ereignisse, unabhängig vom manuellen Status.
- Jedes Projekt kann genau einer frei verwaltbaren Projektkategorie zugeordnet werden; ohne Zuordnung ist erlaubt. Projektkategorien sind unabhängig von den festen Ereigniskategorien.
- Eine neue Einstellungsansicht ermöglicht Anlegen, Umbenennen und Löschen von Projektkategorien. Vorschlag: Beim Löschen nach Bestätigung die Zuordnung betroffener Projekte aufheben; Projekte und Inhalte bleiben erhalten. Doppelte Kategorienamen nach Trimmen und ohne Beachtung der Groß-/Kleinschreibung vermeiden.
- Status und Kategorie werden beim Anlegen und im Projektkopf auswählbar sowie in der Projektliste angezeigt. Die Projektliste erhält Status- und Kategoriefilter. Einstellungen über einen zusätzlichen Zugang öffnen; die vier fachlichen Navigationsbuttons bleiben bestehen.
- Der Überblick zeigt alle offenen To-Dos je Projekt, ohne die bisherige Grenze von fünf. Das gilt auch für pausierte und abgeschlossene Projekte sowie Aufgaben ohne Datum. Die bestehende Sortierung und Hervorhebung überfälliger Aufgaben bleiben erhalten. Die Begrenzung kommender Ereignisse wird durch diesen Auftrag nicht geändert.
- Das Linkproblem entstand durch eine Webadresse ohne https://. Vollständige HTTP(S)-Adressen funktionieren bereits. Geplante Verbesserung: eindeutig erkennbare Webadressen ohne Protokoll beim Speichern mit https:// ergänzen. Lokale und Netzwerkpfade dabei unverändert erhalten; keine pauschale Umwandlung aller Ziele in Webadressen.

### Umsetzung in überprüfbaren Schritten

1. Gemeinsame Typen und Domänenregeln um Projektstatus, Projektkategorien mit stabilen IDs und optionale Kategoriezuordnung erweitern. Bestehende Projekte beim Laden auf den vorgeschlagenen Status Aktiv migrieren.
2. IndexedDB und versioniertes Sicherungsformat erweitern. Alte Sicherungen weiter importieren können; neue Sicherungen enthalten Status und Kategorien. Kategorieverweise vollständig vor einem atomaren Import prüfen. Migration erhält IDs, Inhalte und Beziehungen.
3. Kategorienverwaltung in Einstellungen und Auswahl in Projektformularen integrieren; Anzeige und Filter in der Projektliste ergänzen.
4. To-Do-Begrenzung im Überblick entfernen und Webadressennormalisierung ergänzen.
5. Typprüfung, Domänen-/Speichertests, Build und Browserabläufe prüfen. Schwerpunkt: Bestandsmigration, alte/neue Sicherungen, ungültige Kategorieverweise, Kategorieumbenennung/-löschung, mehr als fünf offene Aufgaben, alle vier Status sowie Webadressen und unveränderte Pfade. README und Arbeitsstand anschließend aktualisieren.

Die Benutzerentscheidungen zu Statusliste, einer Kategorie je Projekt und allen offenen Aufgaben unabhängig vom Status sind verbindlich. Die übrigen als Vorschlag gekennzeichneten Details sind sinnvolle Umsetzungsdefaults.


## 11. Markdown-Notizen

Am 13. Oktober 2026 zur Umsetzung beauftragt: Markdown-Editor für alle Ereignisnotizen mit Formatierungsleiste, Bearbeiten/Vorschau, Überschriften, Listen, Zitaten, Links, Tabellen und Codeblöcken. Formatierte Zwischenablageinhalte werden in Markdown umgewandelt; Klartext-Einfügen bleibt wählbar. Vorhandene Klartextnotizen werden durch eine optionale Formatmarkierung unterschieden und behalten ihre bisherige Darstellung. Sicherungsformat 3 ergänzt die Markierung; Versionen 1 und 2 bleiben importierbar. Anzeige ohne aktives HTML und ohne automatisch geladene Bilder. Prüfstand siehe README.md.

## 12. Folgeauftrag 0.3.0 – 16. Oktober 2026

Benutzer hat zunächst Planung und anschließend Umsetzung mit „weiter“ beauftragt. Diese Änderungen ersetzen die früheren Einschränkungen zu fehlender Gruppierung, Notizen nur als Ereignisansicht und nativer Ordneröffnung:

1. Datenordner unter Windows in Settings auswählbar; umfasst nur interne Projektdaten und Datenbank. Gemeinsamer Web-Kern und IndexedDB bleiben erhalten. Geschlossenes WebView-Profil beim nächsten Start in einen leeren lokalen Zielordner kopieren, Quelle behalten, stabile Pfadkonfiguration außerhalb des verschiebbaren Profils. Fehler und unterbrochene Aktivierung dürfen den Altbestand nicht verlieren oder mit einem leeren Profil ersetzen.
2. Do-next-Flag direkt in Aufgabenlisten mit sofortiger Speicherung, bestehender Dashboard-Integration und Schutz erledigter Aufgaben.
3. Linktypen Ordner/Web/SharePoint automatisch erkennen und mit Icons darstellen. Native Windows-Ordneröffnung prüft absolute Pfade und tatsächliche Ordner; Browser zeigt einen passenden Hinweis.
4. Events und Notes in Navigation, Listen, Suche, Editoren und Projektseite trennen. Intern bestehende Ereignissammlung mit Kategorie Notiz beibehalten, dadurch keine Daten-/Sicherungsmigration. Dashboard, Ereigniszähler und Timeline schließen Notizen aus. Notes mit Datum, Titel, Projekt und Markdown; alte Klartextinhalte bleiben erhalten.
5. Linkaktionen ausschließlich im Projekteditor. Projekt- und Linkentwurf gemeinsam atomar speichern, bei Cancel vollständig verwerfen.
6. Projektliste nach vorhandenen Topics gruppieren; nach Such-/Status-/Topicfilter gruppieren, leere Gruppen auslassen und No topic zuletzt anzeigen. Bisherige Projektnummern erhalten.

Hauptagent verantwortet gemeinsame Typen, Domänenabfragen, atomare Speicheränderungen, App-Integration, Flag-Bedienung, Gruppierung, Styles und Abnahme. Subagenten bearbeiten getrennt native Speicherortwahl, Ereignis-/Notizenoberfläche sowie Links/Projekteditor; unabhängige Prüfungen ergänzen die Integration. Prüfstand, Installation und verbliebene Einschränkungen siehe README.

## 13. Milkdown/Crepe – freigegeben und integriert, 16. Oktober 2026

Der Benutzer hat nach Prüfung des konkreten Plans die Umsetzung mit „freigegeben“ beauftragt. Notes und Event-Notiztexte verwenden gemeinsam Crepe 7.22.3 mit fester TopBar, Tabellenaktionen, CodeMirror und optionalem Quellmodus. Formatierte Bearbeitung ist Standard; nicht sicher übertragbare Inhalte bleiben mit Hinweis als Quelle erhalten. Rohes HTML, Bilder und Anhänge erhalten keine aktiven Ausführungs-, Lade- oder Uploadpfade.

Die Integration liegt in `src/features/markdown/`; der bestehende `MarkdownEditor` kapselt den React-Lebenszyklus und stellt dem Event-/Notes-Formular synchrones Lesen bei Save bereit. Der Hauptagent verantwortet Abhängigkeiten, gemeinsamen Adapter, Entwürfe und Styles. Subagenten haben Clipboard-Härtung, unabhängige Kompatibilitätsprüfung, Browserregressionen und Produktionsmessung beigetragen. Keine Änderungen an ProjectStore, Domänentypen, IndexedDB-Schema oder Sicherungsformat 4. Unveränderte Markdown- und Legacy-Quellen bleiben bytegenau erhalten; Save/Cancel und abgebrochene Löschbestätigung schützen den ganzen Entwurf.

Umgesetzt und geprüft: TopBar einschließlich Tastaturaktivierung, Listenwechsel, sichere Links mit zusammengehörigem gemischt formatiertem Text, Tabellenzeilen/-spalten, Code, Undo/Redo, Quellwechsel, HTML-/Klartext-Paste und explizite Abweisung von Datei-Paste/Drop. Neue Tests prüfen erlaubte Normalisierung gegen tatsächlichen Inhaltsverlust; reine Quellmoduswechsel normalisieren den Bestand nicht. Eine geänderte Quelle startet beim Übernehmen eine neue Undo-History. Komplexe Word-Layouts, Obsidian-Erweiterungen, Bilder/Anhänge und exakte Quellschreibweise nach Rich-Text-Änderungen bleiben außerhalb der Zusage.

Produktionsmessung ist reproduzierbar über `node scripts/editor-performance.mjs` nach Webbuild, mit isoliertem Edge-Profil. Native Prüfung erfolgte nur im getrennten `.dev`-Profil mit synthetischer, anschließend gelöschter Notiz; vorheriger Bestand wurde verglichen. Aktuelle Zahlen, Grenzen und Nachweise stehen im neuen README-Abschnitt. Diese Arbeit aktualisiert weder die reguläre Installation noch einen Installer; frühere Installer enthalten weiterhin den früheren Editor. Keine Commits oder Veröffentlichungen in diesem Schritt.

### Verpackung 0.4.0

Nach erfolgreicher Editorabnahme hat der Benutzer GitHub-Push und einen neuen Installer ausdrücklich beauftragt. npm-, Tauri- und Cargo-Version sind 0.4.0. Die feste Produktionskennung und das Daten-/Sicherungsformat bleiben unverändert. Umsetzung auf `codex/milkdown-editor` mit PR gegen `main`; Windows-CI prüft Web und Rust und erzeugt den NSIS-Installer. Vor Übergabe Artefakt-ZIP mit GitHub-SHA256 vergleichen und EXE-Produktversion/Hash dokumentieren. Die reguläre Benutzerinstallation wird nicht automatisch verändert.
`17. Oktober 2026`: Verpackung abgeschlossen. Quellcommit `877507f`, PR #7; Windows-CI `38964440294` und allgemeine CI erfolgreich. NSIS-Installer 0.4.0 heruntergeladen, ZIP-Digest gegen GitHub verglichen und EXE-Version/Hash geprüft. Lokaler Pfad und SHA256 stehen in README/AGENTS. Keine automatische Installation; spätere Dokumentationscommits verändern diesen Installer-Quellstand nicht.

## 14. Kompakte Listen, Darstellung und Brainstorm – 17. Oktober 2026

Der Benutzer hat den vorgestellten Plan mit „Ok“ bestätigt; die Übernahme bestehender Testprojekte ist nicht erforderlich. Änderungen: Ereigniszeit-Badges entfernen, Anlegebuttons vereinheitlichen, Projekttabelle mit einmaligem Kopf und Topic-Gruppen ohne Topic-Spalte, gespeicherte und manuell eindeutig änderbare Projektnummern, Symbolseitenleiste und alternative proportionale Color-Gestaltung. Globale Brainstorm-Seite mit gemeinsamem Markdown-Editor, automatischer Speicherung und Aufnahme in Sicherungsformat 5. Die bisherige Darstellung und Light/Dark/System bleiben auswählbar.

Hauptagent verantwortet App-Integration, Projekteditor, Listen, globale Styles und Dokumentation. Subagenten ergänzen atomare Projektnummern/Brainstorm-Speicherung und Validierung, Brainstorm-Editor mit Autosave/Recovery sowie Browserregressionen und unabhängige Prüfung. IndexedDB bleibt hinter ProjectStore. Keine native Speicherpfadänderung, keine Produktionsinstallation und keine Veröffentlichung in diesem Auftrag. Aktuelle Abnahme und Einschränkungen siehe README.

### Verpackung 0.5.0

Auf Folgeauftrag „Erstelle den installer“ wurden npm/Tauri/Cargo auf 0.5.0 gesetzt und der Quellstand `1f8242e` auf `codex/brainstorm-ui` als PR #8 übertragen. Windows-CI `39011795108` erzeugte erfolgreich den NSIS-Installer; allgemeine CI ebenfalls erfolgreich. Artefakt-ZIP-Digest, EXE-Produkt-/Dateiversion und SHA256 geprüft. Lokaler Downloadpfad und Nachweise im README. Keine automatische Installation, kein Merge und keine Änderung am Produktionsprofil oder an Sicherheitsrichtlinien.
