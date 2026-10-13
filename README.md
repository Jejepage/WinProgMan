# WinProgMan

Persönliche Projektverwaltung mit To-Dos und einer Ereignis-Timeline. Deutsche Oberfläche, lokale Speicherung im Browser und JSON-Sicherung. Kein Konto erforderlich.

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

- Überblick mit offenen Aufgaben, kommenden Ereignissen und überfälligen Aufgaben.
- Vollständige Projektliste und Projektseite mit Kurzbeschreibung und Linkliste.
- Aufgaben anlegen, ändern, abhaken, wieder öffnen und löschen; Datum optional.
- Ereignisse aller fünf Kategorien, freie Textnotizen, Kategorieauswahl, Liste und grafische Timeline.
- Globale Aufgaben-/Ereignislisten mit Sprung zum Projekt.
- JSON exportieren; Import vollständig prüfen, Vorschau anzeigen und nach Bestätigung atomar ersetzen.
- Responsive Oberfläche für breite und schmale Fenster.

## Daten und Sicherung

IndexedDB speichert die Daten lokal pro Browserprofil und Webadresse. Browserdatenlöschung oder ein Wechsel der Adresse kann einen anderen/leeren Bestand ergeben. Deshalb regelmäßig „JSON exportieren“ verwenden. Ein Import ersetzt den gesamten Bestand; vorher wird eine Sicherung angeboten. Beispieldaten werden nicht automatisch erneut geladen.

HTTP(S)-Links öffnen direkt. Lokale Ordner-/Netzwerkpfade werden angezeigt und können kopiert werden; zuverlässiges Öffnen folgt mit der Windows-Verpackung. Notizen sind Klartext, einschließlich eingefügter Zeilenumbrüche.

## Architektur

React/TypeScript/Vite; reine Domänenabfragen in `src/domain`, asynchrone `ProjectStore`-Schnittstelle in `src/storage`, IndexedDB-Adapter mit Transaktionen. Die Oberfläche benutzt ausschließlich den Adapter. IDs und Schema-Version sind für spätere Erweiterung vorgesehen; Microsoft-Login und Sync sind noch nicht implementiert.

## Weiterarbeit in neuen Chats

Zuerst [AGENTS.md](AGENTS.md), [Spec](Projekt-App%20%E2%80%93%20Spezifikation.md) und [Umsetzungsplan](UMSETZUNGSPLAN.md) lesen. Dort stehen Umfang, Defaults, Architektur und die Aufteilung auf Subagenten.

Arbeitsstand 13. Oktober 2026: Phase-1-Oberfläche, CRUD, IndexedDB, Sicherung, Beispieldaten und CI implementiert. Typprüfung, Produktionsbuild und 22 Domänen-/Speichertests erfolgreich. Zwei integrierte Edge-Browsertests prüfen CRUD, Reload, Filter/Timeline, Sicherung/Import und schmales Layout. Desktop- und mobile Screenshots wurden visuell geprüft. npm-Audit nach Aktualisierung des Testwerkzeugs: keine bekannten Sicherheitslücken.

## Browserprüfungen

`npm run test:e2e` führt die integrierten Abläufe mit installiertem Microsoft Edge aus und startet bei Bedarf den Server auf Port 5174. Die Tests nutzen einen eigenen Browserbestand und prüfen CRUD, Neuladen, Timeline, JSON-Sicherung, Import und schmales Layout. Safari/iPhone/iPad sind in dieser Windows-Umgebung bislang nicht geprüft. `node scripts/visual-review.mjs` erstellt mit einem frischen Beispielbestand Screenshots unter `test-results/visual` (Server auf Port 5174 muss laufen).

`npm run format` formatiert den Quellcode; `npm run format:check` prüft ihn.

Die GitHub-CI prüft Typen, Unit-/Speichertests und Produktionsbuild. Die lokale Browserprüfung benötigt Edge; eine spätere Linux-CI-Erweiterung kann Playwright Chromium verwenden.
