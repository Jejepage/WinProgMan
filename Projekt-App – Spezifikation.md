# Projekt-App – Spezifikation

Oct 13, 2026 · @Joe

## Ziel

Eine schlanke, persönliche Projektmanagement-App für die eigenen Projekte: To-Dos zum Abhaken und Ereignisse, die den Verlauf eines Projekts als Timeline dokumentieren. Die App läuft später auf drei Geräten: Windows (Arbeit), iPhone und iPad.

Leitprinzip: so einfach wie möglich. Keine Teamfunktionen, keine Formulare mit Pflichtfeldern, keine Gruppierungslogik.

In Phase 1 entsteht eine reine Web-App zum Testen der Oberfläche und Abläufe (siehe Abschnitt Phase 1).

## Architektur

Ein gemeinsamer Web-Kern läuft auf allen Plattformen; nur Hülle und Sync-Anbindung unterscheiden sich je Plattform.

- **Web-Kern:** Oberfläche und gesamte Projektlogik als Web-App (HTML/CSS/JS bzw. ein Web-Framework). Logik und Oberfläche sauber getrennt.
- **Windows:** Web-Kern in Tauri verpackt (schlank, nutzt die System-WebView). Electron bleibt Ausweichoption.
- **iPhone / iPad:** Web-Kern in einem iOS-Wrapper.
- **Datenhaltung:** Daten liegen lokal auf jedem Gerät.
- **Synchronisierung:** über die OneDrive-API (Microsoft Graph) mit Microsoft-Login. Die App synct gezielt hoch und runter. Bewusst *keine* einzelne Live-Datenbankdatei im OneDrive-Ordner (Konfliktgefahr).
- **Sync-Modul:** als eigener, austauschbarer Baustein hinter einer klaren Schnittstelle, da sich die Anbindung zwischen Windows und iOS technisch unterscheidet.
- **Outlook (optional, später):** Ereignisse vom Typ Meeting können über denselben Microsoft-Login in den Outlook-Kalender eingetragen werden.

Rahmenbedingung: Der Microsoft-365-Tenant ist stark abgesichert; die App-Registrierung für Graph muss dort einmalig eingerichtet werden.

## Datenmodell

Ein Projekt hat genau zwei Arten von Inhalten: To-Dos (schauen nach vorne) und Ereignisse (dokumentieren, was passiert ist oder ansteht). Freie Notizen sind eine Ereignis-Kategorie, kein eigener Baustein.

| Objekt | Felder | Hinweise |
| --- | --- | --- |
| Projekt | Name, Kurzbeschreibung, Links | Kopf der Projektseite |
| Link | Anzeigename, URL/Pfad | Mehrere pro Projekt, schlichte Liste ohne Gruppierung; z. B. OneDrive-Ordner, Netzwerklaufwerk, Teams-Team |
| To-Do | Titel, erledigt (ja/nein), Datum (optional) | Abhaken per Klick |
| Ereignis | Kategorie, Titel, Datum, Uhrzeit (optional), Notiztext (optional) | Erscheint auf der Timeline |

**Ereignis-Kategorien:** Meeting, Telefonat, Milestone, Beschluss, Notiz.

- Ereignisse können in der Vergangenheit oder Zukunft liegen. Ein zukünftiges Meeting wird nur mit Name, Datum und Uhrzeit angelegt; Notizen kommen später dazu.
- Notiztext ist freier Text, Inhalte werden oft per Copy-Paste eingefügt. Kein strukturiertes Formular (keine Teilnehmer-, Beschluss-Felder).
- Kategorie **Notiz** (Ideen, Brainstorming): Datum wird automatisch auf das Erstellungsdatum gesetzt.

## Oberfläche

Die App hat fünf Ansichten, erreichbar über eine feste Navigation mit Buttons: Überblick, Projekte, To-Dos, Ereignisse und die Projektseite. Ausgelegt für breite Bildschirme, alles möglichst auf einer Seite.

### Navigation

- Buttons: **Überblick** · **Projekte** · **To-Dos** · **Ereignisse**
- Projektseite öffnet sich per Klick aus jeder Ansicht.

### Überblick (Startseite)

- Zeigt nur Projekte, in denen etwas ansteht: offene To-Dos oder kommende Ereignisse.
- Gruppiert nach Projekt: ein Block pro Projekt mit den nächsten offenen To-Dos und kommenden Ereignissen.
- Überfälliges (To-Do mit Datum in der Vergangenheit) ist hervorgehoben.
- Ruhende Projekte erscheinen hier nicht.

### Projekte

- Vollständige Liste aller Projekte, auch ruhender.
- Neues Projekt anlegen.

### Projektseite

1. **Kopf:** Projektname, Kurzbeschreibung, Linkliste (jeder Link mit eigenem Anzeigenamen, öffnet Ordner, Laufwerk oder Teams mit einem Klick).
2. **Spalte To-Dos:** Liste mit Checkbox, optionalem Datum; schnell neues To-Do hinzufügen.
3. **Spalte Ereignisse:** Umschalter zwischen
   - **Liste** (Standard): kompakt, chronologisch
   - **Timeline**: grafischer Zeitstrahl, Heute als Trennlinie zwischen Vergangenem und Kommendem
   - Filter nach Kategorie (z. B. nur Meetings oder nur Notizen)

### Übergreifende Listen

- **To-Dos:** alle To-Dos aller Projekte als einfache Liste, mit Projektname je Eintrag.
- **Ereignisse:** alle Ereignisse aller Projekte, mit Projektname und Kategoriefilter (deckt auch „alle Notizen“ ab).
- Klick auf den Projektnamen springt in die Projektseite.

## Phase 1: Test-Web-App

Phase 1 liefert die komplette Oberfläche als Web-App im Browser, mit lokaler Speicherung und ohne Microsoft-Anbindung. Gebaut wird mit Claude Code.

**Im Umfang**

- [ ] Alle fünf Ansichten aus Abschnitt Oberfläche, inklusive Timeline-Umschalter und Kategoriefilter
- [ ] Anlegen, Bearbeiten, Löschen von Projekten, Links, To-Dos und Ereignissen
- [ ] Lokale Speicherung im Browser (z. B. IndexedDB oder localStorage)
- [ ] Datenzugriff über eine eigene Speicher-Schnittstelle, damit lokale Speicherung später durch das OneDrive-Sync-Modul ergänzt werden kann
- [ ] Export/Import der Daten als JSON (Sicherung beim Testen)
- [ ] Ein paar Beispielprojekte zum Ausprobieren

**Nicht im Umfang**

- OneDrive-Sync, Microsoft-Login, Outlook-Anbindung
- Tauri- und iOS-Verpackung
- Mehrbenutzer- oder Teamfunktionen

## Spätere Phasen und offene Punkte

1. **Phase 2 – Windows:** Web-Kern in Tauri verpacken.
2. **Phase 3 – Sync:** Microsoft-Login und OneDrive-Sync über Graph; App-Registrierung im VDL-Tenant klären.
3. **Phase 4 – iPhone / iPad:** iOS-Wrapper, Sync-Modul für iOS.
4. **Optional:** Meetings in den Outlook-Kalender übertragen.

### Verbindliche Ergänzungen vom 16. Oktober 2026 (Version 0.3.0)

Nach Benutzerfeedback gelten die folgenden Änderungen gegenüber der ursprünglichen Oberfläche: eigene Notes-Navigation und separate Tasks-/Events-/Notes-Bereiche im Projekt; Notizen zählen nicht als kommende Ereignisse. Projektliste nach dem vorhandenen Topic gruppieren. Do-next-Flag direkt in Aufgabenlisten bedienen. Linktypen Ordner, Website und SharePoint mit Icons kennzeichnen; Windows öffnet Ordnerlinks im Explorer. Linkverwaltung einschließlich Kopieraktion ausschließlich im Projekteditor; Projekt und Links gemeinsam mit Save/Cancel behandeln.

Unter Windows muss der Speicherort aller internen Projektdaten samt Datenbank in Settings auswählbar sein. Verlinkte Dateien und Ordner werden nicht verschoben. Bestehende Daten beim kontrollierten Neustart übernehmen, Altbestand behalten und bei fehlgeschlagenem Wechsel weiterverwenden. IndexedDB und der gemeinsame Web-Kern bleiben erhalten; Notes dürfen intern in derselben Sammlung wie Events gespeichert werden. Die inzwischen ausdrücklich gewünschte englische Oberfläche bleibt bestehen. Details und Abnahme siehe README sowie Umsetzungsplan Abschnitt 12.

**Offene Punkte**

- Wird die App-Registrierung im abgesicherten Tenant genehmigt, oder braucht es eine private Microsoft-Anbindung?
- Wie werden Sync-Konflikte aufgelöst (z. B. letzte Änderung gewinnt)?
- Projekt archivieren oder abschließen: nötig, oder reicht „ruhend“?
