# WinProgMan

Persönliche Projektverwaltung mit To-Dos und einer Ereignis-Timeline. Englische Oberfläche, lokale Speicherung im Browser und JSON-Sicherung. Kein Konto erforderlich.

## Windows-Testversion (Tauri)

Seit 16. Oktober 2026 ist die Windows-Hülle als Quellprojekt enthalten. Die gebaute Anwendung startet ohne Node.js, Terminal oder lokalen Webserver. Voraussetzung auf dem Zielgerät ist Microsoft Edge WebView2; der Installer lädt es bei Bedarf nach. Die Testversion ist nicht signiert. Automatische Updates sind noch nicht eingerichtet.

Der Installer wird unter `src-tauri/target/windows/release/bundle/nsis/WinProgMan_0.2.1_x64-setup.exe` erzeugt. Er installiert für den aktuellen Windows-Benutzer. Die eigentliche Anwendung liegt im Build unter `src-tauri/target/windows/release/winprogman.exe`. Diese EXE verwendet denselben festen Benutzerdatenbereich wie die installierte Version; sie ist keine portable Ausgabe mit Daten neben der EXE.

Die Windows-App beginnt mit einem eigenen Bestand; Browser-Testdaten werden nicht übernommen. Der WebView-Profilordner mit IndexedDB und Darstellungseinstellungen liegt unter `%LOCALAPPDATA%/io.github.jejepage.winprogman/webview`. Kennung und Pfad müssen bei Updates erhalten bleiben. Programmdateien können ersetzt werden, während dieser Datenordner bestehen bleibt. Vor Updates trotzdem JSON exportieren. Ein JSON-Export öffnet unter Windows einen nativen Speicherdialog; Abbrechen schreibt keine Datei. JSON-Import behält die geprüfte Vorschau und Ersetzungsbestätigung. Weblinks öffnen im Standardbrowser. Datei-/Netzwerkpfade bleiben vorerst zum Anzeigen und Kopieren verfügbar.

Zum Entwickeln und Bauen zusätzlich Rust (MSVC-Toolchain), Visual Studio C++ Build Tools mit Windows SDK und WebView2 installieren; siehe [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/).

```powershell
npm ci
npm run desktop:dev
npm run desktop:build -- -- --locked
```

`desktop:dev` verwendet Port 1420 und einen separaten Datenbereich unter `%LOCALAPPDATA%/io.github.jejepage.winprogman.dev/webview`; dadurch verändert die Entwicklung den installierten Bestand nicht. Neue Rust-Builds liegen bewusst unter `src-tauri/target/windows`, getrennt von alten lokalen Buildresten. `Cargo.lock` und `package-lock.json` gehören zum Quellprojekt; `target/`, generierte Schemas und lokale Daten gehören nicht ins Repository. Die Windows-CI baut den Installer als herunterladbares Artefakt; sie veröffentlicht keine Releases automatisch.

Prüfstand 16. Oktober 2026: Typprüfung, Produktions-Webbuild, 65 Fach-/Speicher-/Plattformtests und sieben Edge-Browserabläufe erfolgreich. Die neuen Plattformtests prüfen unter anderem Exportabbruch ohne Schreibzugriff, Schreibfehler, vollständige Sicherungsinhalte, erlaubte externe Protokolle und Bestätigungsabbruch. Neue Plattformdateien, Windows-Konfiguration und Rust-Quellen sind formatiert; die bekannten Formatabweichungen im übrigen Bestand wurden nicht pauschal geändert. Vite ignoriert `src-tauri`, damit gesperrte Rust-Builddateien den Entwicklungsserver nicht beenden. Auf dem lokalen Entwicklungsrechner blockiert eine Windows-Application-Control-Richtlinie erzeugte Rust-Buildprogramme (Fehler 4551); dafür ist der Windows-Build über GitHub Actions eingerichtet.

Der [Windows-Build für Commit 87fe048](https://github.com/Jejepage/WinProgMan/actions/runs/38868174342) war erfolgreich und hat den NSIS-Installer erzeugt. Das heruntergeladene ZIP wurde anhand des GitHub-Artefakt-Hashes geprüft. Lokale Kopie des Installers: `src-tauri/target/windows-ci/installer/WinProgMan_0.2.0_x64-setup.exe`. Native Abnahme auf diesem Rechner: Installation ohne Administratorrechte (Exitcode 0), Start ohne Webserver, Projekt und Aufgabe anlegen, vollständiges Schließen/Neustart mit erhaltenen Daten, JSON-Export mit geprüftem Dateiinhalt, Exportabbruch ohne Datei und nur eine Appinstanz nach zweitem Start erfolgreich. Ein Prüfprojekt „Windows-Test“ bleibt im Testbestand. Die Sicherung liegt unter `test-results/windows-native-backup.json` und wird nicht versioniert. Der Import-Dateidialog öffnet und lässt sich abbrechen; der vollständige native Import, Zwischenablage und das Öffnen externer Links sind noch nicht praktisch abgenommen. Die Importlogik einschließlich Ersetzen/Abbruch bleibt durch die Browser- und Speichertests abgedeckt.

Besonderheit dieser Entwicklungsumgebung: Die aus Codex gestartete Testinstallation liegt tatsächlich unter `C:/Users/User/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Local/WinProgMan`. Auch AppData kann in diesem Kontext umgeleitet werden. Für eine reguläre Installation außerhalb dieser Umgebung den heruntergeladenen Installer direkt aus dem Windows-Explorer starten; die lokale Testinstallation und deren Prüfbestand müssen nicht übernommen werden.

## Start

Änderung in 0.2.1 (16. Oktober 2026): „Add task“ und „Add event“ öffnen dieselbe Detailseite innerhalb der App wie das Bearbeiten. Es gibt kein separates Inline-Anlegeformular mehr. Auf der Projektseite wird das aktuelle Projekt vorgewählt; es bleibt im Detailformular auswählbar. „Save“ legt den Eintrag an und führt zurück, „Cancel“ verwirft den Entwurf ohne Datensatz. Listenfilter und Timeline-Auswahl bleiben beim Zurückkehren erhalten. Die Browser-URL kann auch eine neue Detailansicht öffnen; ein Reload verwirft ungespeicherte Eingaben wie beim Bearbeiten. Bereits gespeicherte Daten bleiben beim Windows-Update erhalten. Typprüfung, Produktionsbuild, 65 Tests und acht Edge-Browserabläufe erfolgreich; beide neuen Detailseiten zusätzlich visuell geprüft. Der [Windows-Build 0.2.1](https://github.com/Jejepage/WinProgMan/actions/runs/38888408022) ist erfolgreich. Heruntergeladener und anhand des Artefakt-Hashes geprüfter Installer: `src-tauri/target/windows-ci/0.2.1/installer/WinProgMan_0.2.1_x64-setup.exe`. Für die regulär installierte Windows-App die App schließen und diesen Installer aus Explorer ausführen; die alte EXE enthält die Änderung erst nach dem Update. Die native Installation wurde in diesem Schritt nicht erneut automatisiert, um die reguläre Benutzerinstallation nicht mit der Codex-Testinstallation zu vermischen.

Voraussetzung: Node.js 24 und npm.

```powershell
npm ci
npm run dev
```

Die im Terminal ausgegebene lokale Adresse öffnen. Beim ersten Start ist der Bestand leer. Ein Projekt anlegen oder ausdrücklich „Beispieldaten laden“ wählen.

```powershell
npm run check
npm test
npm run build
npm run preview
```

Bei Windows-Sandboxfehlern wie `EPERM realpath` brauchen Vite und Vitest Zugriff außerhalb der eingeschränkten Sandbox. Das ist eine Ausführungsbeschränkung der Entwicklungsumgebung.

## Funktionen

- Überblick mit Projekten mit offenen Aufgaben oder kommenden Ereignissen sowie einem separaten „Do next“-Panel; alle offenen Aufgaben bleiben je Projekt sichtbar, auch bei pausierten oder abgeschlossenen Projekten.
- Vollständige Projektliste und Projektseite mit Kurzbeschreibung und Linkliste.
- Projektstatus: Geplant, Aktiv, Pausiert, Abgeschlossen; mehrere Status gleichzeitig per Häkchen sowie Kategoriefilter in der Projektliste auswählbar.
- Eine optionale Kategorie pro Projekt; Kategorien in Einstellungen anlegen, umbenennen und löschen. Projekte und Inhalte bleiben beim Löschen einer Kategorie erhalten.
- Aufgaben anlegen, ändern, abhaken, wieder öffnen und löschen; Datum optional. „Do next“ markiert offene Aufgaben, hebt sie hervor und sortiert sie vor die übrigen offenen Aufgaben. Die Aufgabenliste zeigt Fälligkeits- und Erstellungsdatum.
- Ereignisse aller fünf Kategorien, Markdown-Notizen mit Formatierungsleiste und Vorschau, Kategorieauswahl, Liste und grafische Timeline. Ein Klick auf das Datum öffnet den Editor; vergangene und heutige/kommende Ereignisse sind visuell gekennzeichnet.
- Formatierte Inhalte aus Chatbots einfügen: HTML wird in Markdown umgewandelt; alternativ als Klartext einfügen. Überschriften, Listen, Zitate, Links, Tabellen und Codeblöcke werden unterstützt.
- Globale Aufgaben-/Ereignislisten mit Sprung zum Projekt.
- JSON exportieren; Import vollständig prüfen, Vorschau anzeigen und nach Bestätigung atomar ersetzen.
- Responsive Oberfläche für breite und schmale Fenster.
- Heller und dunkler Modus sowie eine System-Einstellung unter Settings; die Auswahl bleibt im Browser gespeichert.

## Daten und Sicherung

IndexedDB speichert die Daten lokal pro Browserprofil und Webadresse. Browserdatenlöschung oder ein Wechsel der Adresse kann einen anderen/leeren Bestand ergeben. Deshalb regelmäßig „JSON exportieren“ verwenden. Sicherungsformat 4 ergänzt die „Do next“-Markierung; Format 3 enthält Projektstatus, Kategorien und die Markdown-Formatmarkierung. Alte Sicherungen im Format 1, 2 und 3 bleiben importierbar; Projekte aus dem Format 1 erhalten bei der Übernahme den Status Aktiv und zunächst keine Kategorie. „Ruhend“ beschreibt weiterhin automatisch Projekte ohne offene Aufgaben oder kommende Ereignisse, unabhängig vom gewählten Status. Ein Import ersetzt den gesamten Bestand; vorher wird eine Sicherung angeboten. Beispieldaten werden nicht automatisch erneut geladen. Die Darstellungseinstellung liegt separat im lokalen Browserprofil und ist nicht Teil der JSON-Sicherung.

HTTP(S)-Links öffnen direkt. Eindeutige Webadressen wie `www.example.com` erhalten automatisch `https://`; auch bereits gespeicherte Webadressen ohne Protokoll sind anklickbar. Lokale Ordner-/Netzwerkpfade werden angezeigt und können kopiert werden; zuverlässiges Öffnen folgt mit der Windows-Verpackung. Neue und inhaltlich bearbeitete Notizen werden als Markdown-Quelltext gespeichert. Bestehende Notizen ohne Formatmarkierung bleiben als Klartext sichtbar, einschließlich Zeilenumbrüchen und wörtlicher Markdown-/HTML-Zeichen. Beim Bearbeiten werden diese Zeichen zunächst maskiert, um die bisherige Darstellung zu erhalten. Markdown ist im Editor direkt bearbeitbar; Vorschau und gespeicherte Anzeige nutzen denselben Renderer. Rohes HTML wird als Text angezeigt. Bilder werden als Alternativtext dargestellt; komplexe HTML-Layouts, eingebettete Inhalte und exakte Chatbot-Schriftgestaltung werden nicht übernommen.

## Architektur

React/TypeScript/Vite; reine Domänenabfragen in `src/domain`, asynchrone `ProjectStore`-Schnittstelle in `src/storage`, IndexedDB-Adapter mit Transaktionen. Die Oberfläche benutzt ausschließlich den Adapter. IDs und Schema-Version sind für spätere Erweiterung vorgesehen; Microsoft-Login und Sync sind noch nicht implementiert.

## Weiterarbeit in neuen Chats

Zuerst [AGENTS.md](AGENTS.md), [Spec](Projekt-App%20%E2%80%93%20Spezifikation.md) und [Umsetzungsplan](UMSETZUNGSPLAN.md) lesen. Dort stehen Umfang, Defaults, Architektur und die Aufteilung auf Subagenten.

Arbeitsstand 13. Oktober 2026: Phase-1-Oberfläche, CRUD, IndexedDB, Sicherung, Beispieldaten und CI implementiert. Erweiterung nach Benutzerfeedback: Projektstatus, Kategorienverwaltung, Filter, vollständige offene Aufgaben im Überblick, Webadressen ohne Protokoll und Markdown-Notizen umgesetzt. Typprüfung, Produktionsbuild und 43 Domänen-/Speicher-/Link-/Markdown-Tests erfolgreich. Vier integrierte Edge-Browsertests prüfen CRUD, Reload, Filter/Timeline, Sicherung/Import und schmales Layout. Die Erweiterungsprüfung umfasst Kategorien anlegen/umbenennen/löschen, Status und Filter, Speicherung nach Reload, Sicherungen sowie mehr als fünf Aufgaben und offene Aufgaben abgeschlossener Projekte. Markdown-Abnahme: Formatierungsbuttons, Vorschau, formatierte HTML-Zwischenablage (Tabellen/Code), unveränderte Markdown-Quellen, Klartextmodus, ungefährliche HTML-/Linkdarstellung, Reload und Sicherungen sowie alte Klartextnotizen vor/nach Bearbeitung. Desktop- und mobile Screenshots wurden visuell geprüft. npm-Audit nach Aktualisierung des Testwerkzeugs: keine bekannten Sicherheitslücken.

## Browserprüfungen

`npm run test:e2e` führt die integrierten Abläufe mit installiertem Microsoft Edge aus und startet bei Bedarf den Server auf Port 5174. Die Tests nutzen einen eigenen Browserbestand und prüfen CRUD, Neuladen, Timeline, JSON-Sicherung, Import und schmales Layout. Safari/iPhone/iPad sind in dieser Windows-Umgebung bislang nicht geprüft. `node scripts/visual-review.mjs` erstellt mit einem frischen Beispielbestand Screenshots unter `test-results/visual` (Server auf Port 5174 muss laufen).

`npm run format` formatiert den Quellcode; `npm run format:check` prüft ihn.

Die GitHub-CI prüft Typen, Unit-/Speichertests und Produktionsbuild. Die lokale Browserprüfung benötigt Edge; eine spätere Linux-CI-Erweiterung kann Playwright Chromium verwenden.


## Technical Light UI – 13. Oktober 2026

Die Oberfläche folgt der bereitgestellten hellen Designvorlage: lokal gebündelte IBM Plex Mono, Lucide-Icons, helle Sidebar, blaue Akzente, kompakte Projekt-/Aufgabentabellen und gemeinsame Formular-/Kartenstile. Navigation: Dashboard, Projects, Tasks, Events, Settings. Notizen sind über den Kategorie-Filter in Events erreichbar; Timeline nutzt dieselben Ereignisse und Datumsregeln. Ereignistext ist zunächst verborgen und wird über den Titel mit Maus oder Tastatur aufgeklappt. Bestandsinhalte werden nicht übersetzt; englische Anzeigenamen für Status/Kategorien erhalten die gespeicherten Werte. Datenmodell, IndexedDB und Sicherungsformat bleiben unverändert.

Die Projektnummer ist eine Anzeige anhand der aktuellen Projektreihenfolge, kein neues persistiertes Feld. Die Timeline bleibt ein chronologischer Ereigniszeitstrahl: Aufgaben haben keine Start-/Enddaten für ein Gantt-Diagramm. Nutzerkonto und Benachrichtigungen der Vorlage wurden nicht ergänzt. Safari und echte iOS-Geräte bleiben ungeprüft.

Abnahme des neuen Designs: Typprüfung, 43 Fach-/Speichertests, Produktionsbuild, Formatprüfung und vier Edge-Browserabläufe erfolgreich. Desktop und schmales Layout visuell geprüft; Details standardmäßig verborgen und per Titel aufklappbar. Gemeinsame UI-Primitiven stehen in `src/ui/components.tsx`, Tokens und Zustände in `src/ui/styles.css`.

UI-Nachbesserung: Tasks und Events zeigen den Seitentitel nur im Header, ohne New-project-Button. Die Listen behalten Anzahl und jeweilige Anlegeaktion; Projektliste und Projekt-Detailabschnitte bleiben unverändert.

UI-Nachbesserung: Add task/Add event stehen im Seitenheader. Aufgaben bieten All tasks/Open tasks im Tabellenkopfbereich. Kategorieauswahl und List/Timeline sind unten bündig und gleich hoch. Der separate Timeline-Navigationstab entfällt; die Timeline bleibt in Events erreichbar.

Abnahme nach der Textsuche: 43 Unit-/Speichertests und sechs Edge-Browserabläufe (einschließlich Headeraktionen, Aufgabenfilter, integrierter Timeline und Textsuche). Zähler stehen rechts in der Filterzeile.

Kompakte Seitenköpfe: Workspace-Bezeichnungen, obere Datum-/Workspace-Leiste und statische Beschreibungen unter den Seitentiteln entfernt. Fachliche Projektbeschreibungen und Datumsangaben bleiben erhalten.

Aufgabentitel öffnen den Editor per Klick oder Tastatur. Edit-/Löschaktionen und Aktionsspalte entfallen in der Aufgabenliste; Löschen ist im Editor erreichbar.

Textsuche auf den globalen Seiten Projects, Tasks und Events filtert während der Eingabe nach Titel beziehungsweise Projektname. Sie ist mit Status-, Themen-, Aufgaben- und Ereigniskategorie-Filtern kombinierbar und lässt sich über „Clear search“ zurücksetzen. Die Projekt-Detailansicht bleibt unverändert. Typprüfung, 43 Fach-/Speichertests, Produktionsbuild, Formatprüfung und sechs Edge-Browserabläufe erfolgreich; die drei Suchfelder wurden auf dem Desktop visuell geprüft.

Weitere Anpassungen nach Benutzerfeedback: „Do next“ in Aufgaben und Dashboard, kompaktere Aufgabenliste mit Erstellungsdatum ohne Statusspalte, Ereigniseditor über das Datum, Kennzeichnung von vergangenen und kommenden Ereignissen, Projektlöschung im Projekteditor und kombinierbare Status-Häkchen. Settings bietet System/Light/Dark. Sicherungsformat 4 erhält „Do next“ und migriert v1–v3. Die Oberfläche bleibt auf ausdrücklichen Benutzerwunsch englisch; der ursprüngliche Sprachwunsch in der Spezifikation ist damit überholt. Aktuelle Prüfung: 45 Fach-/Speichertests und sieben Edge-Browserabläufe erfolgreich. Desktopansichten im hellen und dunklen Modus visuell geprüft.

14. Oktober 2026: Die sichtbaren Filterbeschriftungen „Show statuses“, „Filter topic“ und „Category“ entfernt; zugängliche Namen bleiben erhalten. Im Browser visuell geprüft. Typprüfung, 45 Fach-/Speichertests, Build und sieben Edge-Browserabläufe erfolgreich. Die Formatprüfung meldet Abweichungen in 32 Dateien des aktuellen Bestands.

Projekteditor: Der obere Button wechselt im Bearbeitungsmodus von „Edit project“ zu „Save“ und speichert das zugehörige Formular. Der zusätzliche Save-Button unten entfällt. Browserprüfung deckt genau einen Save-Button und erfolgreiches Speichern ab. Typprüfung, 45 Tests, Build und sieben Edge-Browserabläufe erfolgreich.

Aufgaben- und Ereignistitel öffnen eine Detailansicht innerhalb der App; bei Ereignissen öffnet auch das Datum diese Ansicht. Nur das geöffnete Objekt wird angezeigt. Save speichert und führt zurück zur vorherigen Liste; Cancel verwirft den Entwurf und führt ebenfalls zurück. Listenfilter bleiben erhalten. Das gilt für globale Listen, Projektseite und Dashboard. Der Notiztext lässt sich weiterhin über den separaten Pfeil in der Ereignisliste aufklappen. Anlegeformulare bleiben in der Liste. Die Detailansicht ist nach Neuladen per URL erreichbar; danach führt Save/Cancel zur jeweiligen globalen Liste. Prüfung: Typprüfung, 45 Tests, Build und sieben Edge-Browserabläufe einschließlich unveränderter Browser-Tabzahl, ausgeblendeter Listen und Rückkehr nach Save/Cancel. Safari und echte iOS-Geräte bleiben ungeprüft.

Ereignisse werden ausschließlich im geöffneten Editor gelöscht; die Ereignisliste hat keinen Delete-Button mehr. Die Löschbestätigung kann abgebrochen werden und führt dann zum unveränderten Entwurf zurück. Erfolgreiches Löschen führt zurück zur Liste.

Ereignisliste: Reihenfolge Datum, Titel mit direkt danebenstehendem Notizpfeil, Past/Today/Upcoming, Kategorie und Projekt. Alle Felder sind linksbündig; Past/Today/Upcoming behalten eine feste Breite. Einheitlicher linker Einzug und eine Mindestbreite für das Datum halten die Felder bei unterschiedlichen Monatsnamen ausgerichtet.
