# Zwei-Rechner-Test (Sync und Konfliktmeldung)

Ziel: Den OneDrive-Ordner-Sync und die Konfliktmeldung aus Version 0.7.0 mit zwei echten Windows-Rechnern prüfen. Die Ergebnisse tragen wir danach in README und AGENTS.md ein.

Rechner: **A** und **B**. Beide haben denselben Installer (`WinProgMan_0.7.0_x64-setup.exe`) und denselben OneDrive-Ordner als Sync-Ordner (Settings → Sync between computers). Gib den Rechnern unter „This computer's name“ eindeutige Namen, z. B. „A“ und „B“.

**Vorbereitung:** Auf beiden Rechnern vorher eine JSON-Sicherung exportieren (Settings → Import & export). Bei jedem Test den Sync auf beiden Rechnern mit **Pause sync** anhalten, die Änderungen machen und dann gezielt mit **Sync now** in der genannten Reihenfolge abgleichen. Warte bei jedem Schritt, bis OneDrive die Datei des anderen Rechners fertig synchronisiert hat (Wolken-/Häkchen-Symbol im Explorer).

Trage in die Spalte „Ergebnis“ ein: OK, Abweichung (mit Beschreibung) oder nicht getestet.

| # | Test | Ablauf | Erwartung | Ergebnis |
|---|------|--------|-----------|----------|
| 1 | Erstabgleich | A: Beispieldaten laden, Sync now. B: Sync-Ordner wählen, „Use folder data instead…“ | B zeigt dieselben Projekte; A und B zeigen „Synced …“ | |
| 2 | Einfache Änderung | A: Aufgabe umbenennen, Sync now. B: Sync now | B zeigt den neuen Titel, keine Konfliktmeldung | |
| 3 | Notiz-Konflikt | Beide: Sync pausieren. A: Notiz bearbeiten (später als B). B: dieselbe Notiz bearbeiten (früher). A: Sync now, danach B: Sync now | B zeigt die Fassung von A. In B erscheint in der Navigation „Changed on another computer – your version is in the trash“. Settings → Trash → **Compare versions** zeigt die abweichenden Felder; **Restore as copy** legt die Fassung von B als „… (other version)“ an | |
| 4 | Brainstorm-Konflikt | Beide pausiert. A und B ändern den Brainstorm-Text. A: Sync now, danach B: Sync now | B zeigt den Text von A; sein eigener Text liegt im Papierkorb; **Restore as copy** hängt ihn an den aktuellen Text an | |
| 5 | Bearbeitung schlägt Löschung | Beide pausiert. A: Aufgabe löschen. B: dieselbe Aufgabe bearbeiten. A: Sync now, danach B: Sync now, dann A: Sync now | Die Aufgabe bleibt auf beiden Rechnern bestehen, mit der Bearbeitung von B | |
| 6 | Löschung ohne Gegenbearbeitung | A: Aufgabe löschen, Sync now. B: Sync now | Aufgabe ist auf B verschwunden und liegt in Settings → Trash | |
| 7 | Noch nicht fertige Datei | Auf B den Sync während eines laufenden OneDrive-Uploads der A-Datei anstoßen (große Änderung, sofort Sync now auf B) | Entweder wird die Datei gelesen oder „Waiting for other device“ erscheint; es geht nichts verloren, der nächste Lauf holt sie nach | |
| 8 | Keine Konflikte bei bloß älterem Stand | A: Änderung, Sync now. B: Sync now (B hat nichts selbst geändert) | Änderung kommt an, **keine** Konfliktmeldung | |
| 9 | Lokale Sicherung | Nach Test 3: Ordner `%LOCALAPPDATA%\io.github.jejepage.winprogman\backups` auf B ansehen | Es gibt eine `backup-…json` vom Zeitpunkt vor dem ändernden Merge | |
| 10 | Datenort | Prüfen, dass im OneDrive-Ordner nur `device-….json` liegen | Keine Datenbank, kein WebView-Profil im OneDrive | |

**Zusätzlich beobachten:** Meldungen wie „Sync problem“, Wartezeiten über zwei Minuten, doppelte Einträge, verschwundene Daten.

**Bei einer Abweichung:** Notiere Rechner, Schritt, erwartetes und tatsächliches Verhalten, dann gib mir die Beschreibung. Hänge, wenn möglich, die Datei `device-….json` der beiden Rechner an, aber bitte erst nach Prüfung auf private Inhalte.
