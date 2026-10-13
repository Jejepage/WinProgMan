# WinProgMan – Spezifikation Version 2.0
## Verbesserungen und funktionale Erweiterungen

**Repository:** https://github.com/Jejepage/WinProgMan  
**Ausgangsbasis:** Aktueller `main`-Branch  
**Ziel:** Bestehende Anwendung gezielt verbessern und erweitern, ohne ihre Einfachheit zu verlieren.

---

# 1. Zielsetzung

WinProgMan ist eine persönliche Projektmanagement-Anwendung zur Verwaltung von Projekten, Aufgaben, Ereignissen, Notizen und projektbezogenen Links.

Die Anwendung soll weiterhin eine schlanke, technisch gestaltete Oberfläche besitzen und für die tägliche Arbeit an mehreren parallelen Projekten optimiert sein.

Mit Version 2.0 sollen insbesondere folgende Ziele erreicht werden:

1. Datenintegrität und Zuverlässigkeit verbessern.
2. Wiederherstellung versehentlich gelöschter Inhalte ermöglichen.
3. Die tägliche Erfassung von Informationen beschleunigen.
4. Projektübergreifende Informationen einfacher auffindbar machen.
5. Aufgaben und Ereignisse miteinander verknüpfen.
6. Eine bessere kurzfristige Arbeitsplanung ermöglichen.
7. Die Bedienbarkeit und Lesbarkeit verbessern.
8. Die Codearchitektur für spätere Erweiterungen vorbereiten.

**Grundprinzip:** Bestehende Funktionalität erhalten. Neue Funktionen möglichst intuitiv integrieren, ohne unnötige Menüs, komplexe Formulare oder zusätzliche Verwaltungsebenen einzuführen.

Die Anwendung bleibt zunächst lokal und vollständig offline nutzbar.

---

# 2. Rahmenbedingungen

## 2.1 Bestehende Architektur

Die aktuelle technische Grundlage bleibt erhalten:

- React und TypeScript
- Vite
- IndexedDB zur lokalen Datenspeicherung
- Bestehende `ProjectStore`-Abstraktion
- Markdown-Unterstützung
- Bestehendes JSON-Import-/Export-System
- Playwright und Vitest
- Englischsprachige Benutzeroberfläche
- Light Mode, Dark Mode und System-Modus

Ein vollständiges Neuschreiben ist nicht vorgesehen.

## 2.2 Nicht Bestandteil dieser Version

Folgende Funktionen werden ausdrücklich nicht implementiert:

- Microsoft-365-Anmeldung
- OneDrive-Synchronisierung
- Outlook-Integration
- Tauri-Desktop-Verpackung
- Benutzerverwaltung
- Teamfunktionen
- KI-Funktionen oder externe KI-APIs
- Automatische Cloud-Backups

Die Architektur soll spätere Erweiterungen jedoch ermöglichen.

## 2.3 Umsetzungsvorgaben

- Bestehende Funktionen dürfen nicht verloren gehen.
- Bestehende lokale Daten müssen erhalten bleiben.
- Datenmigrationen müssen automatisch erfolgen.
- Der JSON-Import älterer Versionen muss weiterhin funktionieren.
- Keine unnötigen neuen Bibliotheken.
- Änderungen müssen durch geeignete Tests abgesichert werden.
- Die Anwendung muss auf breiten und schmalen Bildschirmen funktionieren.
- Alle Änderungen werden auf einem eigenen Feature-Branch entwickelt, nicht direkt auf `main`.

---

# 3. Stabile Projektnummerierung

**Priorität: P1**

## 3.1 Problem

Die aktuelle Projektnummer wird aus der Reihenfolge der Projekte berechnet. Dadurch kann sich eine Nummer beim Bearbeiten, Löschen oder Umordnen ändern.

## 3.2 Neues Verhalten

Jedes Projekt erhält beim Erstellen eine dauerhafte Projektnummer.

Beispiel:

- PRJ-001 – Digitalisation Strategy
- PRJ-002 – Document Management
- PRJ-003 – Smart City Platform

Anforderungen:

- Nummer beim Anlegen automatisch vergeben.
- Nummer bleibt während der gesamten Lebensdauer unverändert.
- Bearbeiten oder Umordnen verändert die Nummer nicht.
- Gelöschte Nummern werden nicht erneut vergeben.
- Projektnummer ist nicht manuell bearbeitbar.
- Nummer bleibt beim Export und Import erhalten.
- Nummer kann in der Projektsuche verwendet werden.

## 3.3 Datenmigration

Bestehende Projekte erhalten beim ersten Laden einmalig feste Nummern in ihrer bisherigen angezeigten Reihenfolge.

Die UUID bleibt weiterhin die interne technische Identität.

Für die nächste Nummer muss ein dauerhafter Zähler geführt werden. Die höchste existierende Nummer allein genügt nicht, da gelöschte Nummern nicht wiederverwendet werden dürfen.

---

# 4. Papierkorb und Undo

**Priorität: P1**

## 4.1 Ziel

Versehendlich gelöschte Inhalte müssen wiederherstellbar sein.

## 4.2 Papierkorb

In den Einstellungen wird ein Bereich `Trash` ergänzt.

Folgende Objekte sollen wiederherstellbar sein:

- Projekte einschließlich ihrer Inhalte
- Aufgaben
- Ereignisse und Notizen
- Projektlinks

Beim Löschen werden die betreffenden Daten zunächst logisch gelöscht und im Papierkorb verfügbar gehalten.

## 4.3 Verhalten

Nach einer Löschung erscheint eine kurze Meldung mit `Undo`.

Beispiel:

`Task deleted — Undo`

Der Papierkorb zeigt:

- Name des Objekts
- Objekttyp
- Zugehöriges Projekt
- Löschdatum

Aktionen:

- Restore
- Delete permanently
- Empty trash

Wird ein Projekt wiederhergestellt, müssen seine zum Löschzeitpunkt zugehörigen Aufgaben, Ereignisse und Links ebenfalls wiederhergestellt werden.

Eine automatische endgültige Löschung erfolgt in dieser Version nicht.

## 4.4 Technische Anforderungen

- Löschung und Wiederherstellung müssen atomar erfolgen.
- Papierkorb-Daten gehören zum JSON-Backup.
- Gelöschte Objekte erscheinen nicht in normalen Listen oder Suchergebnissen.
- Verknüpfungen müssen bei der Wiederherstellung konsistent bleiben.
- Bestehende Daten dürfen durch eine Wiederherstellung nicht unbemerkt überschrieben werden.

---

# 5. Schutz vor veralteten Daten bei mehreren Browser-Tabs

**Priorität: P1**

## 5.1 Ziel

Werden zwei Fenster oder Tabs von WinProgMan geöffnet, müssen Änderungen zuverlässig erkannt werden.

## 5.2 Funktion

Speichert Fenster A eine Änderung, soll Fenster B darüber informiert werden.

Die normalen Listen und Übersichten werden automatisch aktualisiert.

Bei einem geöffneten Editor mit ungespeicherten Änderungen darf der Inhalt jedoch nicht einfach überschrieben werden.

In diesem Fall erscheint ein Hinweis:

`This item has changed in another window.`

Mögliche Aktionen:

- Reload latest version
- Review changes
- Overwrite with my version

## 5.3 Technische Umsetzung

- `BroadcastChannel` für die Kommunikation zwischen Browser-Tabs verwenden.
- Änderungsstand beim Speichern prüfen.
- Optimistic Concurrency Control oder einen gleichwertigen Mechanismus einsetzen.
- Konflikte innerhalb einer IndexedDB-Transaktion erkennen.
- Keine stillschweigende Überschreibung einer zwischenzeitlich geänderten Version.

Diese Logik soll später mit dem OneDrive-Synchronisierungsmodul kompatibel sein.

---

# 6. Globale Volltextsuche

**Priorität: P2**

## 6.1 Ziel

Alle wichtigen Projektinformationen sollen über ein zentrales Suchfeld auffindbar sein.

## 6.2 Durchsuchbare Inhalte

- Projektnummern
- Projektnamen
- Projektbeschreibungen
- Aufgaben
- Ereignistitel
- Vollständige Ereignisnotizen
- Markdown-Inhalte
- Projektlinks einschließlich Anzeigename und Zieladresse

Die vorhandenen lokalen Suchfelder bleiben erhalten.

## 6.3 Benutzeroberfläche

Ein globales Suchfeld wird im oberen Bereich der Anwendung oder über eine Suchaktion erreichbar.

Tastenkürzel: `Ctrl + Shift + F`.

Suchergebnisse werden nach Inhaltstyp gruppiert:

**Projects**
- PRJ-014 – Document Management

**Tasks**
- Review technical proposal

**Events**
- Meeting with supplier

**Notes**
- Technical requirements

Jedes Ergebnis zeigt:

- Titel
- Projektnummer und Projektname
- Inhaltstyp
- Relevanten Textausschnitt mit hervorgehobenem Suchbegriff

Ein Klick öffnet den jeweiligen Datensatz innerhalb des zugehörigen Projekts.

## 6.4 Suchverhalten

- Suche während der Eingabe
- Groß- und Kleinschreibung ignorieren
- Mehrere Suchbegriffe unterstützen
- Keine Beschränkung auf Titel
- Keine externe Suchmaschine
- Keine Netzwerkverbindung
- Keine gelöschten Elemente berücksichtigen
- Markdown-Syntax soll die Suche nicht unnötig beeinträchtigen

Für die derzeitige Datenmenge genügt eine lokale Suchimplementierung. Ein externer Suchindex ist nicht erforderlich.

---

# 7. Quick Capture – Schnellerfassung

**Priorität: P2**

## 7.1 Ziel

Neue Informationen sollen mit möglichst wenigen Aktionen erfasst werden können.

## 7.2 Aufruf

- Tastenkürzel `Ctrl + K`
- Auf macOS später `Cmd + K`
- Zusätzliche Schaltfläche in der Oberfläche

Es öffnet sich ein kompaktes Eingabefenster.

## 7.3 Unterstützte Objekte

- Task
- Event
- Note

## 7.4 Verhalten

Der Nutzer gibt zunächst einen Titel oder kurzen Text ein.

Danach können die wichtigsten Eigenschaften gewählt werden.

**Task:**
- Titel
- Projekt
- Fälligkeitsdatum optional
- Do next

**Event:**
- Titel
- Projekt
- Kategorie
- Datum
- Uhrzeit optional

**Note:**
- Titel
- Projekt
- Notiztext
- Automatisches Erstellungsdatum

Befindet sich der Nutzer bereits innerhalb eines Projekts, wird dieses automatisch vorausgewählt.

Bei einer globalen Erfassung soll die Anwendung das zuletzt verwendete Projekt vorschlagen. Die Zuordnung bleibt vor dem Speichern sichtbar und veränderbar.

## 7.5 Komfortfunktionen

Einfache Datumsangaben wie `today`, `tomorrow` oder konkrete Datumswerte können erkannt und in das Formular übernommen werden.

Eine KI-basierte Sprachinterpretation ist nicht erforderlich.

Tastatur:

- Enter: Eingabe bestätigen, wenn eindeutig
- Ctrl + Enter: Speichern
- Escape: Schließen
- Tab: Zwischen Feldern wechseln

Bei Escape dürfen ungespeicherte Änderungen nicht versehentlich übernommen werden.

---

# 8. Next 7 Days – Wochenübersicht

**Priorität: P2**

## 8.1 Ziel

Alle kurzfristig anstehenden Aufgaben und Ereignisse sollen projektübergreifend in einer gemeinsamen Übersicht erscheinen.

## 8.2 Integration

Auf dem Dashboard wird ein Bereich `Next 7 Days` ergänzt.

Er kann bei Bedarf in einer größeren Ansicht geöffnet werden.

## 8.3 Darstellung

Die Übersicht wird chronologisch nach Tagen gegliedert.

Beispiel:

**Today**
- 09:00 – Supplier meeting – PRJ-004
- Review proposal – PRJ-002

**Tomorrow**
- Prepare presentation – PRJ-007

**Thursday**
- Project milestone – PRJ-003

## 8.4 Filter und Funktionen

- Today
- Next 7 Days
- Later
- Overdue

Die nächsten sieben Tage umfassen den heutigen Tag und die folgenden sechs Kalendertage.

Anforderungen:

- Aufgaben mit Fälligkeitsdatum anzeigen.
- Ereignisse nach Datum und gegebenenfalls Uhrzeit anzeigen.
- Unterschiedliche Objekttypen visuell unterscheiden.
- Überfällige Aufgaben gesondert hervorheben.
- Aufgaben direkt abhaken.
- Mit einem Klick zum Datensatz springen.
- Projektname und Projektnummer anzeigen.
- Aufgaben ohne Fälligkeitsdatum nicht künstlich einem Tag zuordnen; sie bleiben über die vorhandenen Aufgabenlisten und „Do next“ erreichbar.

---

# 9. Aufgaben mit Ereignissen verknüpfen

**Priorität: P2**

## 9.1 Ziel

Aufgaben sollen nachvollziehbar aus Meetings, Beschlüssen oder anderen Ereignissen entstehen können.

## 9.2 Neues Verhalten

Jedes Ereignis kann eine oder mehrere zugehörige Aufgaben besitzen.

Beispiel:

**Event: Supplier Meeting**

- Review supplier offer
- Prepare technical questions
- Schedule follow-up meeting

Im Ereignis wird ein Bereich `Related tasks` angezeigt.

## 9.3 Funktionen

Innerhalb eines Ereignisses:

- Neue verknüpfte Aufgabe anlegen
- Vorhandene Aufgabe verknüpfen
- Zugehörige Aufgaben anzeigen
- Aufgaben direkt abhaken
- Aufgabenverknüpfung wieder entfernen

Innerhalb einer Aufgabe:

- Verknüpftes Ursprungsereignis anzeigen
- Zum Ereignis springen
- Verknüpfung entfernen oder ändern

## 9.4 Datenmodell

Für Version 2 genügt eine optionale Verknüpfung von einer Aufgabe zu genau einem Ursprungsereignis.

Ein Ereignis kann beliebig viele Aufgaben besitzen.

Anforderungen:

- Keine doppelten Beziehungen.
- Verknüpfte Aufgabe und Ereignis gehören zum selben Projekt.
- Löschen eines Ereignisses darf zugehörige Aufgaben nicht löschen.
- Bei Ereignislöschung werden Aufgabenverknüpfungen sicher aufgehoben.
- Bei Wiederherstellung muss die ursprüngliche Verknüpfung, soweit möglich und konsistent, wiederhergestellt werden.
- Beziehungen bleiben bei Export und Import erhalten.

---

# 10. Focus Mode

**Priorität: P2**

## 10.1 Ziel

Der Nutzer soll sich auf eine einzelne Aufgabe konzentrieren können, ohne durch die vollständige Projektverwaltung abgelenkt zu werden.

## 10.2 Aufruf

Jede offene Aufgabe erhält eine Aktion `Focus`.

## 10.3 Darstellung

Focus Mode öffnet eine reduzierte Ansicht, die folgende Informationen enthält:

**Task**
- Aufgabentitel
- Fälligkeitsdatum
- Do-next-Markierung

**Project context**
- Projektnummer
- Projektname
- Projektbeschreibung

**Related information**
- Verknüpftes Ereignis, falls vorhanden
- Relevante aktuelle Projektereignisse
- Projektlinks

## 10.4 Aktionen

- Mark completed
- Edit task
- Open project
- Close focus mode

Die Ansicht darf nicht mit zusätzlichen Informationen überladen werden.

Ein Timer, Pomodoro-System oder eine Zeiterfassung wird nicht implementiert.

Der Focus Mode soll bewusst minimalistisch und ruhig gestaltet sein.

---

# 11. Verbesserungen der Ereignisbedienung

**Priorität: P2**

## 11.1 Problem

Die aktuelle Interaktion hängt teilweise davon ab, ob ein Ereignis eine Notiz besitzt.

## 11.2 Neues Verhalten

Alle Ereignisse sollen einheitlich bedienbar sein.

- Klick auf den Titel öffnet die Detaildarstellung.
- Details können wieder eingeklappt werden.
- Eine klar erkennbare Aktion `Edit` öffnet den Editor.
- Die Aktion ist auch für Ereignisse ohne Notiz zugänglich.
- Löschen bleibt über eine separate Aktion mit Bestätigung möglich.
- Tastaturbedienung entspricht der Mausbedienung.

## 11.3 Detaildarstellung

Die Darstellung enthält bei Bedarf:

- Titel
- Kategorie
- Datum und Uhrzeit
- Zugehöriges Projekt
- Markdown-Notiz
- Verknüpfte Aufgaben
- Bearbeitungsaktionen

Liste und Timeline sollen dieselbe Detailkomponente verwenden.

---

# 12. Verbesserte Tastaturbedienung

**Priorität: P2**

WinProgMan soll stärker auf effiziente Desktop-Bedienung ausgelegt werden.

## 12.1 Tastenkürzel

| Kürzel | Aktion |
|---|---|
| Ctrl + K | Quick Capture |
| Ctrl + Shift + F | Globale Suche |
| Ctrl + Enter | Aktuellen Editor speichern |
| Escape | Editor, Dialog oder Focus Mode schließen |
| Tab / Shift + Tab | Navigation durch Bedienelemente |
| Enter | Ausgewählten Eintrag öffnen bzw. aktivieren |

Die Kurzbefehle müssen kontextabhängig funktionieren.

Sie dürfen keine Texteingaben beschädigen oder Browser-Standardfunktionen unnötig blockieren.

## 12.2 Bedienqualität

- Sichtbare Fokusmarkierung
- Logische Tab-Reihenfolge
- Vollständig bedienbare Dialoge
- Fokus beim Öffnen von Dialogen sinnvoll setzen
- Fokus nach Schließen an den ursprünglichen Auslöser zurückgeben
- Destruktive Aktionen gegen versehentliche Auslösung schützen

---

# 13. Überarbeitung des visuellen Designs

**Priorität: P2**

## 13.1 Ziel

Den bestehenden technischen, minimalistischen Stil beibehalten und die Lesbarkeit verbessern.

## 13.2 Schriftarten

**IBM Plex Mono**

Verwendung für:
- Projektnummern
- Navigation
- Kleine Beschriftungen
- Statusinformationen
- Metadaten
- Technische Elemente

**IBM Plex Sans**

Verwendung für:
- Längere Projektbeschreibungen
- Ereignisnotizen
- Markdown-Inhalte
- Umfangreiche Textpassagen

Die Kombination soll sachlich und modern wirken.

## 13.3 Farben

Die vorhandene Farbpalette grundsätzlich beibehalten:

- Helle neutrale Flächen
- Dunkle Schrift
- Blaue Akzentfarbe
- Dezente Rahmen
- Zurückhaltende Statusfarben

Keine zusätzliche dekorative Farbpalette einführen.

Dark Mode entsprechend konsistent gestalten.

## 13.4 UI-Komponenten

Einheitliche Gestaltung für:

- Dialoge
- Buttons
- Tabellen
- Suchfelder
- Filter
- Formulare
- Statusanzeigen
- Leere Zustände
- Bestätigungen
- Benachrichtigungen

## 13.5 Responsive Design

Auf schmalen Bildschirmen:

- Keine abgeschnittenen Aktionen
- Dialoge innerhalb des sichtbaren Bereichs
- Sinnvolle vertikale Anordnung
- Tabellen dürfen kontrolliert horizontal scrollen
- Focus Mode und Quick Capture müssen bedienbar bleiben

---

# 14. Code- und Architekturverbesserungen

**Priorität: P2**

## 14.1 Ziel

Die Implementierung soll trotz zusätzlicher Funktionen übersichtlich und wartbar bleiben.

## 14.2 App-Komponente

Die bestehende zentrale `App.tsx` enthält viele Aufgaben.

Diese Verantwortlichkeiten sollen soweit sinnvoll getrennt werden:

- Navigation und App-Shell
- Dashboard
- Projektliste
- Projektdetailansicht
- Settings
- Globale Suche
- Quick Capture
- Focus Mode
- Gemeinsame Benachrichtigungen und Dialoge

Die Trennung soll funktional sinnvoll sein. Keine unnötig kleinteilige Komponentenstruktur erzeugen.

## 14.3 CSS-Struktur

Die bestehende zentrale CSS-Datei soll konsolidiert werden.

Ziele:

- Gemeinsame Design-Tokens
- Wiederverwendbare Komponentenstile
- Weniger widersprüchliche CSS-Überschreibungen
- Klare Light-/Dark-Mode-Regeln
- Nachvollziehbare responsive Breakpoints

Beispiel einer möglichen Struktur:

```
src/
  app/
  domain/
  storage/
  features/
    dashboard/
    projects/
    todos/
    events/
    search/
    quick-capture/
    focus/
    trash/
  ui/
    components/
    styles/
```

Die Struktur ist ein Vorschlag und darf bei fachlicher Begründung angepasst werden.

## 14.4 Speicherung

Das bestehende `ProjectStore`-Interface soll weiterverwendet und um die benötigten Funktionen erweitert werden.

Insbesondere:

- Dauerhafte Projektnummern
- Papierkorb
- Wiederherstellung
- Versions- bzw. Konflikterkennung
- Ereignis-Aufgaben-Verknüpfung

Die Datenhaltung muss weiterhin vollständig lokal funktionieren.

Bei Bedarf kann die Speicherung von einem zentralen App-Snapshot auf getrennte Datensätze umgestellt werden. Eine solche Umstellung muss transaktional erfolgen und vollständig getestet sein.

---

# 15. Import, Export und Datenmigration

**Priorität: P1**

## 15.1 Datenformat

Das bestehende versionierte JSON-Format wird erweitert.

Die bisherige Schema-Version 4 soll durch eine neue Version ersetzt werden, die alle neuen Datenfelder unterstützt.

## 15.2 Kompatibilität

Alte Sicherungen der Versionen 1 bis 4 müssen importierbar bleiben.

Beim Import sollen fehlende Felder automatisch auf gültige Standardwerte migriert werden.

Dazu gehören insbesondere:

- Permanente Projektnummern
- Neue optionale Beziehungen
- Papierkorb-Daten
- Technische Änderungsstände

## 15.3 Importvorschau

Die Importvorschau zeigt weiterhin die Anzahl der enthaltenen Projekte, Aufgaben und Ereignisse.

Zusätzlich sollen gegebenenfalls enthaltene Papierkorb-Daten berücksichtigt werden.

Wird eine neue ungültige Datei ausgewählt, muss eine vorherige Importvorschau verworfen werden.

Vor einem vollständigen Datenersatz ist weiterhin eine ausdrückliche Bestätigung erforderlich.

## 15.4 Datenintegrität

Folgende Bedingungen müssen geprüft werden:

- IDs eindeutig
- Projektnummern eindeutig
- Projektverweise gültig
- Ereignis-Aufgaben-Beziehungen gültig
- Zeitstempel gültig
- Keine beschädigten Daten nach fehlgeschlagener Migration
- Keine unbeabsichtigten Datenverluste bei Import oder Wiederherstellung

Ein Import muss vollständig erfolgreich sein oder den bisherigen Datenbestand unverändert lassen.

---

# 16. Testanforderungen

Für neue und angepasste Funktionen müssen geeignete automatisierte Tests erstellt werden.

## 16.1 Unit-Tests

Insbesondere:

- Projektnummern bleiben stabil
- Nummern werden nicht wiederverwendet
- Alte Daten migrieren korrekt
- Aufgaben- und Ereignisverknüpfungen bleiben konsistent
- Datumsauswertung der Wochenübersicht
- Globale Suche und Suchfilter
- Wiederherstellung gelöschter Inhalte

## 16.2 Integrationstests

- Daten bleiben nach Neuladen erhalten.
- Papierkorb und Restore funktionieren.
- Projektlöschung und Wiederherstellung umfassen abhängige Inhalte.
- Mehrere Browser-Tabs erkennen externe Änderungen.
- Veraltete Bearbeitungsstände führen nicht zu unbemerktem Überschreiben.
- Export/Import erhält alle Daten und Beziehungen.

## 16.3 End-to-End-Tests

Mindestens folgende Abläufe:

1. Projekt erstellen und dauerhaft nummerieren.
2. Aufgabe über Quick Capture anlegen.
3. Aufgabe aus einem Ereignis erstellen.
4. Über die globale Suche zum Ereignis navigieren.
5. Aufgabe in Focus Mode öffnen und abschließen.
6. Ein gelöschtes Projekt wiederherstellen.
7. Wochenübersicht bei mehreren Projekten prüfen.
8. Light Mode und Dark Mode prüfen.
9. Tastenkürzel und Dialogbedienung prüfen.
10. Bestehende Kernfunktionen auf Regressionen prüfen.

Vor Abschluss ausführen:

```
npm run check
npm test
npm run build
npm run format:check
npm run test:e2e
```

Soweit die bestehende Testumgebung dies unterstützt, müssen alle Prüfungen erfolgreich sein. Nicht ausführbare Browserprüfungen sind ausdrücklich zu dokumentieren.

---

# 17. Umsetzung in Phasen

Die Umsetzung soll inkrementell erfolgen. Jede Phase muss nach Möglichkeit einen funktionierenden, testbaren Zwischenstand ergeben.

## Phase 1 – Datenintegrität

- Dauerhafte Projektnummern
- Papierkorb und Undo
- Konflikterkennung zwischen Browser-Tabs
- Importfehler beheben
- Schema-Migration
- Tests

## Phase 2 – Schnellere Bedienung

- Quick Capture
- Globale Volltextsuche
- Einheitliche Ereignisbedienung
- Tastaturkürzel
- UX-Verbesserungen

## Phase 3 – Planung und Kontext

- Next 7 Days
- Verknüpfung von Aufgaben und Ereignissen
- Focus Mode
- Dashboard-Integration

## Phase 4 – Technische Konsolidierung

- Komponentenarchitektur aufräumen
- CSS konsolidieren
- Schriftarten und Lesbarkeit optimieren
- Responsive Design überprüfen
- Tests erweitern
- Dokumentation aktualisieren

Die Reihenfolge darf bei technischen Abhängigkeiten angepasst werden. Datenmigration und Rückwärtskompatibilität haben Vorrang vor neuen UI-Funktionen.

---

# 18. Definition of Done

Die Erweiterung ist vollständig, wenn:

- [ ] Alle beschriebenen Funktionen implementiert sind.
- [ ] Bestehende Funktionen weiterhin funktionieren.
- [ ] Projektnummern dauerhaft stabil bleiben.
- [ ] Löschungen wiederherstellbar sind.
- [ ] Browser-Tabs keine stillen Datenüberschreibungen verursachen.
- [ ] Quick Capture funktioniert.
- [ ] Globale Volltextsuche funktioniert.
- [ ] Next 7 Days korrekt arbeitet.
- [ ] Aufgaben mit Ereignissen verknüpft werden können.
- [ ] Focus Mode funktioniert.
- [ ] Ereignisse konsistent bedienbar sind.
- [ ] Tastaturkürzel implementiert sind.
- [ ] UI in Light und Dark Mode konsistent ist.
- [ ] Bestehende Daten und Sicherungen migriert werden können.
- [ ] Automatisierte Tests erfolgreich sind.
- [ ] README und technische Dokumentation aktualisiert sind.

---

# 19. Anweisungen für den Codex-Agenten

1. Das bestehende Repository zunächst vollständig analysieren.
2. Die vorhandene Spezifikation, `AGENTS.md`, `README.md` und den Umsetzungsplan berücksichtigen.
3. Diese Spezifikation ist für die hier beschriebenen Erweiterungen maßgeblich. Bei Widersprüchen zu älteren Dokumenten haben die ausdrücklich genannten neuen Anforderungen Vorrang.
4. Keine bestehenden Funktionen entfernen, sofern dies nicht ausdrücklich erforderlich ist.
5. Technische Detailentscheidungen eigenständig und mit Blick auf Wartbarkeit treffen.
6. Möglichst vorhandene Komponenten und Hilfsfunktionen wiederverwenden.
7. Für größere Änderungen geeignete Tests ergänzen.
8. Nach jeder Implementierungsphase Typprüfung, Tests und Build durchführen.
9. Fehler beheben, bevor die nächste Phase abgeschlossen wird.
10. Änderungen in nachvollziehbaren Commits dokumentieren.
11. Keine direkten Änderungen an `main` und kein automatisches Merge.
12. Am Ende einen Pull Request zur Überprüfung bereitstellen.
13. Nicht implementierte Punkte, bekannte Einschränkungen und erforderliche manuelle Tests klar dokumentieren.
14. Bei rein technischen Detailfragen selbst entscheiden. Rückfragen nur bei echten fachlichen Widersprüchen oder blockierenden Voraussetzungen.

**Wichtig:** In einem vorangegangenen Arbeitsschritt wurde bereits der separate Branch `feat/project-workflow-improvements` mit unvollständigen Vorarbeiten erstellt. Für diese vollständige Umsetzung soll Codex vom unveränderten `main` ausgehen und jene Teilarbeiten nicht ungeprüft übernehmen.

## Abschließendes Entwicklungsprinzip

WinProgMan soll eine schnelle, zuverlässige und übersichtliche persönliche Projektverwaltung bleiben.

Das Ziel ist nicht, möglichst viele neue Funktionen unterzubringen, sondern den täglichen Umgang mit Projekten, Aufgaben und Informationen spürbar zu verbessern.

**Weniger Klicks, mehr Übersicht, bessere Nachvollziehbarkeit und zuverlässige Datenhaltung.**