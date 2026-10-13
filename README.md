# WinProgMan 2.0

## Aktueller Stand: Version 2

Die maßgebliche Spezifikation ist [SPEC_V2.md](SPEC_V2.md). Umsetzung auf `feat/winprogman-v2`, direkt von unverändertem main (`24ceaee`). Die unvollständigen Vorarbeiten von `feat/project-workflow-improvements` wurden nicht übernommen. Die englische Oberfläche und der vollständig lokale Betrieb bleiben erhalten.

- Dauerhafte Projektnummern mit gespeichertem Zähler und automatischer Migration bestehender Projekte in ihrer bisherigen Reihenfolge.
- Settings → Trash für Projekte einschließlich Inhalt sowie einzelne Aufgaben, Ereignisse und Links. Undo, Restore, Delete permanently und Empty trash; keine automatische endgültige Löschung.
- BroadcastChannel aktualisiert andere Tabs. Editoren behalten Entwürfe und erkennen veraltete Revisionen beim Speichern innerhalb einer IndexedDB-Transaktion. Reload latest version, Review changes und explizites Overwrite stehen zur Verfügung.
- Search all durchsucht Nummern, Projektnamen/-beschreibungen, Aufgaben, vollständige Notizen und Linkziele; gruppierte Ergebnisse mit hervorgehobenen Fundstellen.
- Quick Capture für Aufgaben, Ereignisse und Notizen. Projektkontext oder zuletzt verwendetes Projekt; today, tomorrow und ISO-Datum sind im Datumsfeld möglich.
- Next 7 Days umfasst heute und die nächsten sechs Kalendertage, mit Today/Later/Overdue-Filtern, direktem Abhaken und vergrößerter Ansicht.
- Aufgaben können genau einem Ereignis desselben Projekts zugeordnet werden. Ereignisdetails erlauben Anlegen, Verknüpfen, Abhaken und Entfernen von Beziehungen.
- Focus Mode mit Aufgabe, Projektbeschreibung, Ursprungsereignis, aktuellen Ereignissen und Links. Ereignisliste und Timeline nutzen dieselbe aufklappbare Detailkomponente mit sichtbarer Edit-Aktion.
- Native modale Dialoge mit Fokusführung; lokal gebündelte IBM Plex Sans für längere Texte, Mono für Navigation und Metadaten. Styles sind nach Basis, Komponenten, Notizen, Themen und Workflow getrennt.

Tastenkürzel: **Ctrl/Cmd+K** für Quick Capture, **Ctrl/Cmd+Shift+F** für Suche, **Ctrl/Cmd+Enter** zum Speichern und **Escape** zum Schließen eines Dialogs ohne Übernahme des Entwurfs.

**Sicherungsformat 5** enthält Papierkorb, Zähler, Beziehungen und Revisionen; Formate 1–4 bleiben importierbar. Migration, Restore und Import sind atomar. Eine neu ausgewählte ungültige Datei verwirft eine vorherige Vorschau. Der vollständige Import erfordert Bestätigung, behält importierte Projektnummern bei, senkt den lokalen Zähler nicht und macht alte Bearbeitungsstände ungültig. Darstellungspräferenz und zuletzt verwendetes Capture-Projekt liegen außerhalb der Sicherung.

Beim Löschen eines Ereignisses bleiben Aufgaben bestehen. Restore stellt Beziehungen wieder her, soweit keine widersprechende Änderung erfolgte. Einzelne Inhalte erfordern zunächst die Wiederherstellung ihres Projekts. Restore überschreibt keine existierenden Datensätze. Gelöschte Projektthemen werden nicht neu angelegt.

Architektur: `ProjectStore` bleibt die Speichergrenze. `storage/changes.ts` plant atomare Änderungen, `storage/validation.ts` validiert aktive und gelöschte Daten. Der Snapshot-Adapter prüft Revisionen in derselben Transaktion wie den Commit; BroadcastChannel meldet nur erfolgreiche Änderungen. Separate Feature-Komponenten enthalten Dashboard, Projektliste, Suche, Capture, Focus und Trash. Ein späteres Sync-Modul benötigt zusätzlich ein geräteübergreifendes Konfliktprotokoll.

Abnahme am 13. Oktober 2026: Typprüfung, **76 Fach-/Speichertests**, Produktionsbuild, Formatprüfung und **12 Edge-Browserabläufe** erfolgreich. Geprüft sind unter anderem v1–v4-Migration, feste Nummern, atomare Fehlerfälle, Restore-Reihenfolgen, veraltete Editorstände, zwei Browser-Tabs, Löschung des Elternprojekts bei offenem Entwurf, wiederholte Suchsprünge, Quick Capture, Focus, Wochenübersicht, Tastatur sowie bestehende CRUD-/Markdown-/Importabläufe. Befehle: `npm run check`, `npm test`, `npm run build`, `npm run format:check`, `npm run test:e2e`.

Edge-Browserprüfungen verwenden isolierte Testdaten auf Port 5174. `node scripts/visual-review.mjs` erstellt Desktop-, Focus-, Such- und Capture-Screenshots einschließlich schmaler Dark-Mode-Ansicht; der lokale Server muss dafür laufen. Safari und echte iOS-Geräte bleiben manuell zu prüfen. Microsoft-Anmeldung, OneDrive, Outlook, Tauri, Teamfunktionen, KI und Cloud-Backups sind nicht Bestandteil von V2.

Die folgenden Abschnitte dokumentieren die Ausgangsversion; bei Widersprüchen gelten der aktuelle Stand oben und SPEC_V2.

Persönliche Projektverwaltung mit To-Dos und einer Ereignis-Timeline. Englische Oberfläche, lokale Speicherung im Browser und JSON-Sicherung. Kein Konto erforderlich.

## Start

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
