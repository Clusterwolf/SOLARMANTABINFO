Tampermonkey-Userscript:
📝 Beschreibung
Dieses Tampermonkey-Skript erweitert die SofarCloud-Weboberfläche mit einer cleveren Statusanzeige im Browser-Tab. Es kombiniert visuelle Statussymbole, eine Ladeanimation und Benachrichtigungen, um Firmware-Upgrades übersichtlicher zu überwachen.

🔧 Funktionen
Ladeanimation im Tab-Titel
Zeigt beim laufenden Upgradeprozess einen animierten Unicode-Spinner (⠋⠙⠹…) vor der Seriennummer an.

Statusanzeige
Nach Abschluss wird entweder 🟢 (Erfolg) oder 🔴 (Gescheitert) + Seriennummer im Tabtitel angezeigt.

Desktop-Benachrichtigungen
Nur bei Erfolg oder Fehlschlag erscheint eine Systembenachrichtigung (Notification API).

Kein Prefix, keine Favicon-Änderung
Das ursprüngliche Favicon bleibt erhalten. Im Titel steht ausschließlich der Status + Seriennummer.

Animation auch im Hintergrund aktiv
Läuft stabil, auch wenn der Tab nicht im Vordergrund ist.

Automatische URL-Erkennung
Funktioniert auf allen SofarCloud-Gerätedetailseiten (/deviceDetail/<SERIAL>).

💻 Kompatibilität
🌐 URL-Match: *solarmanpv.com
⚙️ Voraussetzung: Tampermonkey (mind. Version 5.0 empfohlen)
📥 Installation
Tampermonkey-Erweiterung installieren (falls noch nicht vorhanden).
Neues Userscript hinzufügen.
Den gesamten Skriptinhalt aus [SOLARMANTABINFO.js ] einfügen und speichern.
Seite https://eu.sofarcloud.com/deviceDetail/... öffnen – das Script startet automatisch.
⚙️ Technische Details
Intervall: 250 ms
Farberkennung: basiert auf SVG-Icons oder RGB-Werten
Zustandserkennung: via .upgrade-steps und .loading-SVG
Serialnummer: aus der URL extrahiert
🛡️ Datenschutz & Sicherheit
Dieses Script:

speichert keine Daten,
greift nur lokal im Browser ein,
sendet keine externen Anfragen.
// English

Tampermonkey userscript:
📝 Description
This Tampermonkey script extends the SofarCloud web interface with a clever status display in the browser tab. It combines visual status icons, a loading animation and notifications to make firmware upgrades easier to monitor.

🔧 Features
Loading animation in tab title Displays an animated Unicode spinner (⠋⠙⠹…) in front of the serial number during the upgrade process.

Status display
Upon completion, either 🟢 (success) or 🔴 (failure) + serial number is displayed in the tab title.

Desktop notifications
A system notification (Notification API) appears only in case of success or failure.

No prefix, no favicon change
The original favicon is retained. The title only shows the status + serial number.

Animation also active in the background
Runs stably, even when the tab is not in the foreground.

Automatic URL detection
Works on all SofarCloud device detail pages (/deviceDetail/<SERIAL>).

💻 Compatibility
🌐 URL match: *solarmanpv.com
⚙️ Prerequisite: Tampermonkey (version 5.0 or higher recommended)
📥 Installation
Install the Tampermonkey extension (if not already installed).
Add new userscript.
Paste the entire script content from [SOLARMANTABINFO.js ] and save.
Open the page https://eu.sofarcloud.com/deviceDetail/... – the script will start automatically.
⚙️ Technical details
Interval: 250 ms
Colour detection: based on SVG icons or RGB values
Status detection: via .upgrade-steps and .loading SVG
Serial number: extracted from the URL
🛡️ Data protection & security
This script:

does not store any data,
only intervenes locally in the browser,
does not send any external requests.
🧑‍💻 Author
This script was developed to improve the monitoring of firmware upgrades on SofarCloud.
Feedback or suggestions for improvement are welcome!

📄 Licence
MIT Licence – free to use
