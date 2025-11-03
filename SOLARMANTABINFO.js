// ==UserScript==
// @name         Status Dot, Serial Number, and Name in Tab Title (+ Ant-Steps + Spinner paced + PageTimer)
// @namespace    http://tampermonkey.net/
// @version      2025-01-08.9-timer
// @description  Tabtitel: Status-Dot, Name, Seriennummer. Bei Ant-Steps: Spinner statt %. KEINE Step-Infos im Titel. Spinner bleibt aktiv, solange irgendein Timer auf der Seite läuft.
// @match        *://*pro.solarmanpv.com/station/main?id*
// @match        *://*pro.solarmanpv.com/application/DeviceUpgrade*
// @match        *://*pro.solarmanpv.com/business/device*
// @match        *://*pro.solarmanpv.com*
// @match        *://*globalpro.solarmanpv.com/station/main?id*
// @match        *://*globalpro.solarmanpv.com/application/DeviceUpgrade*
// @match        *://*globalpro.solarmanpv.com/business/device*
// @match        *://*globalpro.solarmanpv.com*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=solarmanpv.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  let lastStatusKey = "";
  let manualTitle = "";

  // -------- Spinner (paced) --------
  const spinnerFrames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  let spinnerIndex = 0;

  // Geschwindigkeiten:
  const ACTIVE_SPINNER_INTERVAL_MS = 300; // sichtbarer Tab
  const BG_SPINNER_INTERVAL_MS     = 700; // Hintergrund

  // Kurzzeit-Puffer gegen DOM-Flauten (nur für Step-Erkennung)
  const SPINNER_STICKY_MS = 2500;
  let spinnerStickyUntil = 0;

  let spinnerActiveRef = false;
  let lastSpinTs = 0;
  let spinnerTimer = null;  // Hintergrund-Driver
  let rafId = null;         // Sichtbar-Driver

  const nowTs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const advanceSpinner = () => { spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length; };

  function maybeTickSpinner(ts) {
    if (!spinnerActiveRef) return false;
    const interval = (document.visibilityState === 'visible') ? ACTIVE_SPINNER_INTERVAL_MS : BG_SPINNER_INTERVAL_MS;
    if (ts - lastSpinTs >= interval) {
      lastSpinTs = ts;
      advanceSpinner();
      return true;
    }
    return false;
  }

  function startSpinnerLoops() {
    // Hintergrund-Loop
    if (!spinnerTimer) {
      spinnerTimer = setInterval(() => {
        if (!spinnerActiveRef || document.visibilityState === 'visible') return;
        if (maybeTickSpinner(nowTs())) updateTabTitle(true);
      }, 200);
    }
    // Sichtbar-Loop (rAF) – gedrosselt
    if (document.visibilityState === 'visible' && rafId === null) {
      const loop = (ts) => {
        if (!spinnerActiveRef || document.visibilityState !== 'visible') { rafId = null; return; }
        if (maybeTickSpinner(ts)) updateTabTitle(true);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
    }
  }
  function stopSpinnerLoops() {
    if (spinnerTimer) { clearInterval(spinnerTimer); spinnerTimer = null; }
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      startSpinnerLoops();
      updateTabTitle();
    } else {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }
  });

  // -------- Utils --------
  const cleanText = (t) => (t ? t.trim().replace(/\s+/g, ' ') : null);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const qs  = (sel, root = document) => root.querySelector(sel);

  // --- FAIL-Icon minimal erkennen ---
  function failIconPresent() {
    return document.querySelector(
      'i.iconfont.icon-state-failed.iconresult-fail, i.icon-state-failed.iconresult-fail, i.iconresult-fail'
    ) !== null;
  }

  function parseDurationInText(text) {
    if (!text) return null;
    const s = text.replace(/\s+/g, '');
    let m;
    m = s.match(/(\d+)[′']\s?(\d{1,2})[′']{2}/); if (m) return `${m[1]}'${m[2]}''`; // 1'34''
    m = s.match(/\b(\d{1,2}:\d{2})\b/);          if (m) return m[1];                // mm:ss
    m = s.match(/\b(\d{1,2}:\d{2}:\d{2})\b/);    if (m) return m[1];                // h:mm:ss
    m = s.match(/(\d+)\s?(?:min|m|Min)/i);       if (m) return `${m[1]}min`;
    return null;
  }

  // -------- Seitendaten --------
  function findSpanContent() { const el = qs('span.lh13'); return el ? cleanText(el.textContent) : null; }
  function findAdditionalSpanContents() {
    const spans = qsa('span[data-v-2c1c0c00][data-v-02c2a83a]');
    return spans.map(s => cleanText(s.textContent)).filter(Boolean);
  }
  function findPercentage() {
    const el = qs('div.w6x.taC.cPrompt'); if (el) return cleanText(el.textContent);
    const el2 = qs('.ant-progress-text, .progress, .percent, [class*="progress"]');
    if (el2) {
      const txt = cleanText(el2.textContent);
      const mm = txt && txt.match(/\b\d{1,3}%\b/);
      if (mm) return mm[0];
    }
    const m = document.body.innerText.match(/\b\d{1,3}%\b/);
    return m ? cleanText(m[0]) : null;
  }
  function findAssociatedVersion() {
    let v = null;
    const cand = qsa('div, span, p').filter(el =>
      el.textContent.includes('Zugehörige Version：') || el.textContent.includes('Related Version：'));
    cand.forEach(label => {
      const ns = label.nextSibling; if (!v && ns && ns.textContent) v = cleanText(ns.textContent);
      if (!v && label.parentNode) {
        const node = Array.from(label.parentNode.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        if (node) v = cleanText(node.textContent);
      }
    });
    return v;
  }
  function findLegacyUpgradeStatus() { const el = qs('div.dpIB.vaM_E'); return el ? cleanText(el.textContent) : null; }
  function findSerialNumber() { const m = document.body.innerText.match(/\b(S[A-Z0-9]+|[1-3][0-9]{9})\b/); return cleanText(m ? m[0] : null); }

  // -------- Ant-Design Steps --------
  const lastDurations = new Map();
  let lastTickIndex = null;

  function classToState(clsList, titleText) {
    if (clsList.contains('ant-steps-item-error')) return 'error';
    if (clsList.contains('ant-steps-item-finish')) return 'finished';
    if (clsList.contains('ant-steps-item-process') || clsList.contains('ant-steps-item-active')) {
      const t = (titleText || '').toLowerCase();
      if (t.includes('herunterladen') || t.includes('download')) return 'downloading';
      if (t.includes('upgrade')) return 'upgrading';
      if (t.includes('ergebnis') || t.includes('result')) return 'result';
      return 'processing';
    }
    if (clsList.contains('ant-steps-item-wait')) return 'waiting';
    return 'processing';
  }

  function computeFinishedAll(nodes) {
    if (!nodes.length) return false;
    const allFin = nodes.every(n => n.classList.contains('ant-steps-item-finish'));
    const anyProc = nodes.some(n => n.classList.contains('ant-steps-item-process') || n.classList.contains('ant-steps-item-active'));
    const anyWait = nodes.some(n => n.classList.contains('ant-steps-item-wait'));
    return allFin && !anyProc && !anyWait;
  }

  function pickDotFromState({ anyError, finishedAll, currentItemClassList, currentState }) {
    if (anyError) return '🔴';
    if (finishedAll) return '🟢';
    if (currentItemClassList && currentItemClassList.contains('ant-steps-item-wait')) return '⚪';
    if (currentState === 'waiting') return '⚪';
    return '🟡';
  }

  function getUpgradeStepInfo() {
    const wrapper =
      qs('.upgrade-setp.ant-steps') ||
      qs('.ant-steps.upgrade-setp') ||
      qs('[class*="upgrade-setp"].ant-steps') ||
      qs('.upgrade-setp [class*="ant-steps"]') ||
      qs('[class*="upgrade-setp"]');

    if (!wrapper) return null;

    const itemNodes = qsa('.ant-steps-item', wrapper);
    if (!itemNodes.length) return null;

    const steps = itemNodes.map(it => {
      const title = cleanText(qs('.ant-steps-item-title', it)?.textContent);
      const desc  = cleanText(qs('.ant-steps-item-description', it)?.textContent);
      const duration = parseDurationInText(desc || '');
      const isActive = it.classList.contains('ant-steps-item-process') || it.classList.contains('ant-steps-item-active');
      const state = classToState(it.classList, title);
      return { title, desc, duration, isActive, state, classList: it.classList };
    });

    // Tick-Erkennung der Step-Dauer (für richtigen Step)
    let tickIndex = null;
    steps.forEach((s, i) => {
      if (s.duration) {
        const prev = lastDurations.get(i);
        if (prev !== s.duration) tickIndex = i;
        lastDurations.set(i, s.duration);
      }
    });

    let currentIndex = null;
    if (tickIndex !== null) { currentIndex = tickIndex; lastTickIndex = tickIndex; }
    else if (lastTickIndex !== null) {
      const s = steps[lastTickIndex];
      if (s && s.state !== 'finished' && s.state !== 'error') currentIndex = lastTickIndex;
    }
    if (currentIndex === null) currentIndex = steps.findIndex(s => s.isActive);
    if (currentIndex < 0 || currentIndex === null) currentIndex = steps.findIndex(s => s.state !== 'finished');
    if (currentIndex < 0 || currentIndex === null) currentIndex = steps.length - 1;

    const current = steps[currentIndex];
    const anyError = itemNodes.some(it => it.classList.contains('ant-steps-item-error'));
    const finishedAll = computeFinishedAll(itemNodes);

    const dot = pickDotFromState({
      anyError,
      finishedAll,
      currentItemClassList: itemNodes[currentIndex]?.classList,
      currentState: current?.state
    });

    // Label generieren (Titel zeigt Labels nur, wenn kein Spinner)
    let label = null;
    if (finishedAll)      label = 'Upgrade erfolgreich abgeschlossen';
    else if (current?.state === 'error')       label = 'Upgrade fehlgeschlagen';
    else if (current?.state === 'downloading') label = 'Herunterladen läuft';
    else if (current?.state === 'result')      label = 'Upgrade-Ergebnis';
    else if (current?.state === 'waiting')     label = 'Wartet';
    else                                       label = 'In Bearbeitung';

    return {
      currentState: current?.state || null,
      anyError,
      finishedAll,
      dot,
      label
    };
  }

  // -------- Timer auf der Seite erkennen (allgemein) --------
  const timerLastValues = new WeakMap();
  const TIMER_SEL = [
    '.ant-steps-item-description span', // Benötigte Zeit：0'47''
    '[class*="time"]','[class*="Time"]',
    '[class*="duration"]','[class*="Duration"]',
    '[class*="timer"]','[class*="Timer"]',
    '.countdown','.countup','.elapsed','.remaining'
  ].join(',');

  function extractTimeToken(nodeText) {
    if (!nodeText) return null;
    const t = parseDurationInText(nodeText);
    if (t) return t;
    // Generische Patterns (mm:ss / h:mm:ss)
    const m = nodeText.match(/\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b/);
    return m ? m[0] : null;
  }

  function detectAnyRunningTimer() {
    let running = false;
    const nodes = qsa(TIMER_SEL);
    for (const el of nodes) {
      const token = extractTimeToken(cleanText(el.textContent));
      if (!token) continue;
      const prev = timerLastValues.get(el);
      if (prev && prev !== token) running = true;
      timerLastValues.set(el, token);
    }
    return running;
  }

  // -------- Title (ohne Step-Infos) --------
  function buildTitle({ statusDot, spinnerChar, percentage, spanContent, statusLabel, serialNumber, additionalSpanContents }) {
    if (window.location.href.includes('station/main')) {
      let t = '';
      if (spanContent) t += `${spanContent}`;
      if (additionalSpanContents.length > 0) t += ` | ${additionalSpanContents.join(' | ')}`;
      return t || document.title;
    }
    const parts = [];
    parts.push(statusDot || '🟡');
    if (spinnerChar) parts.push(spinnerChar); else if (percentage) parts.push(percentage);
    if (spanContent) parts.push(spanContent);
    if (statusLabel) parts.push(`· ${statusLabel}`);
    if (serialNumber) parts.push(serialNumber);
    if (additionalSpanContents.length > 0) parts.push(`| ${additionalSpanContents.join(' | ')}`);
    return parts.join(' ');
  }

  // Title-Lock
  const ensureTitleEl = () => { let t = document.querySelector('title'); if (!t) { t = document.createElement('title'); document.head.appendChild(t); } return t; };
  const titleEl = ensureTitleEl();
  const titleObserver = new MutationObserver(() => { if (manualTitle && titleEl.textContent !== manualTitle) { titleEl.textContent = manualTitle; } });
  titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });

  // -------- Notifications (wie gehabt) --------
  function notifyOnce({ statusKey, message }) {
    if (statusKey && statusKey === lastStatusKey) return;
    lastStatusKey = statusKey;
    if (Notification.permission === "granted") new Notification(message);
    else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(p => { if (p === "granted") new Notification(message); });
    }
  }
  function sendNotification({ statusMessage, serialNumber, percentage, associatedVersion, spanContent, additionalSpanContents, stepInfo }) {
    const lines = [
      statusMessage ? `Status: ${statusMessage}` : null,
      serialNumber ? `Seriennummer: ${serialNumber}` : null,
      spanContent ? `Name: ${spanContent}` : null,
      (additionalSpanContents && additionalSpanContents.length > 0) ? `Zusatz: ${additionalSpanContents.join(', ')}` : null,
      associatedVersion ? `Zugehörige Version: ${associatedVersion}` : null,
      percentage ? `Fortschritt: ${percentage}` : null
    ].filter(Boolean);
    const msg = lines.join('\n');
    const statusKey = `${serialNumber||''}|${statusMessage||''}|${stepInfo?.finishedAll?'FIN':''}|${stepInfo?.anyError?'ERR':''}`;
    notifyOnce({ statusKey, message: msg });
  }

  // -------- Main Update --------
  function updateTabTitle(fromAnim = false) {
    const serialNumber = findSerialNumber();
    const legacyStatus = findLegacyUpgradeStatus();
    const stepInfo = getUpgradeStepInfo();

    const failIcon = failIconPresent(); // <-- minimal: detect <i class="iconfont icon-state-failed iconresult-fail">

    let statusDot = '🟡';
    let statusLabel = null;

    if (stepInfo) {
      statusDot = stepInfo.dot;
      statusLabel = stepInfo.label; // wird ggf. unterdrückt, solange Spinner aktiv
    } else if (legacyStatus) {
      const s = cleanText(legacyStatus?.toLowerCase());
      if (s?.includes('succeeded') || s?.includes('erfolgreich')) { statusDot='🟢'; statusLabel='Erfolgreich'; }
      else if (s?.includes('failed') || s?.includes('fehlgeschlagen')) { statusDot='🔴'; statusLabel='Fehlgeschlagen'; }
      else if (s?.includes('transferring') || s?.includes('übertragung')) { statusDot='🟡'; statusLabel='Übertragung'; }
      else if (s?.includes('in progress') || s?.includes('überprüfung')) { statusDot='🟡'; statusLabel='In Bearbeitung'; }
    }


    // FAIL-Icon hat höchste Priorität (minimaler Override):
    if (failIcon) { statusDot = '🔴'; statusLabel = 'Upgrade fehlgeschlagen'; }

    const percentage = findPercentage();
    const associatedVersion = findAssociatedVersion();
    const spanContent = findSpanContent();
    const additionalSpanContents = findAdditionalSpanContents();

    // 1) Step-basiert: will Spinner?
    const wantsSpinnerByStep = !!(stepInfo && !stepInfo.finishedAll && !stepInfo.anyError &&
      (stepInfo.currentState === 'downloading' || stepInfo.currentState === 'upgrading' || stepInfo.currentState === 'processing'));

    // 2) Allgemeiner Seiten-Timer aktiv?
    const pageTimerRunning = detectAnyRunningTimer();

    // Sticky nur für Step-Flauten; Timer erzwingt direkten Spinner.
    if (wantsSpinnerByStep) spinnerStickyUntil = Date.now() + SPINNER_STICKY_MS;

    const spinnerActive = pageTimerRunning || (Date.now() < spinnerStickyUntil);

    // Loops steuern
    spinnerActiveRef = spinnerActive;
    if (spinnerActive) startSpinnerLoops(); else stopSpinnerLoops();

    const spinnerChar = spinnerActive ? spinnerFrames[spinnerIndex] : null;
    const displayPercentage = spinnerActive ? null : percentage;

    // Label im Titel unterdrücken, solange Spinner aktiv (gewünscht)
    const effectiveStatusLabel = spinnerActive ? null : statusLabel;

    const newTitle = buildTitle({
      statusDot,
      spinnerChar,
      percentage: displayPercentage,
      spanContent,
      statusLabel: effectiveStatusLabel,
      serialNumber,
      additionalSpanContents
    });

    if (newTitle && newTitle !== manualTitle) { manualTitle = newTitle; document.title = newTitle; }

    // Terminal? → Benachrichtigung
    const isTerminal = failIcon || (stepInfo && (stepInfo.finishedAll || stepInfo.anyError)) ||
                       (!stepInfo && /(succeeded|erfolgreich|failed|fehlgeschlagen)/i.test(legacyStatus || ''));
    const terminalLabel = isTerminal
      ? ((failIcon) || /(failed|fehlgeschlagen)/i.test(legacyStatus || '') || (stepInfo && stepInfo.anyError)
         ? 'Upgrade fehlgeschlagen' : 'Upgrade erfolgreich abgeschlossen')
      : null;

    if (serialNumber && (statusDot === '🟢' || statusDot === '🔴') && isTerminal) {
      sendNotification({
        statusMessage: terminalLabel || 'Status geändert',
        serialNumber,
        percentage: displayPercentage,
        associatedVersion,
        spanContent,
        additionalSpanContents,
        stepInfo
      });
    }
  }

  // DOM-Observer & periodischer Fallback
  const bodyObserver = new MutationObserver(() => updateTabTitle());
  bodyObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  setInterval(() => updateTabTitle(), 40000);

  // Initial
  updateTabTitle();
})();