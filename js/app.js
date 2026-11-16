const csrf = document.querySelector('meta[name="csrf-token"]')?.content || 'demo-token';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function toast(text) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = text;
  t.hidden = false;
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

const clock = document.getElementById('clock');
if (clock) {
  const updateClock = () => {
    const time = new Date().toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    clock.textContent = time;
  };
  updateClock();
  setInterval(updateClock, 10000);
}

const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');
const title = document.querySelector('.view-title');

function showView(target) {
  navItems.forEach(link => {
    const isActive = link.dataset.target === target;
    link.classList.toggle('active', isActive);
  });

  views.forEach(view => {
    const isVisible = view.dataset.view === target;
    view.classList.toggle('active', isVisible);
  });

  const viewNames = {
    dashboard: 'Dashboard',
    diagnose: 'Diagnose',
    traceroute: 'Traceroute',
    repair: 'Reparatur',
    updates: 'Updates',
    audit: 'Verlauf / Audit-Log',
    settings: 'Einstellungen'
  };

  if (title) {
    title.textContent = viewNames[target] || 'Dashboard';
  }

  toast('Navigationsseite: ' + (viewNames[target] || 'Dashboard'));
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    showView(item.dataset.target);
    if (item.dataset.target === 'diagnose') runSystemDiagnosis();
  });
});

const actionCards = document.querySelectorAll('.action-card');
actionCards.forEach(card => {
  card.addEventListener('click', event => {
    event.preventDefault();
    const label = card.querySelector('strong')?.textContent || 'Aktion';
    if (label === "Jetzt prüfen") {
      runSystemDiagnosis();
      return;
    }
    toast(label + ' ausgelöst');
  });
});

const linkButtons = document.querySelectorAll('.link-btn');
linkButtons.forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    toast('Audit-Log geöffnet');
  });
});

const powerButton = document.querySelector('.icon-btn');
if (powerButton) {
  powerButton.addEventListener('click', () => toast('System wird beendet'));
}

function auditIcon(level) {
  if (level === 'warn') {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" class="warn"><path d="M12 4 21 20H3L12 4Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true" class="ok"><path d="M5 12.5 9 16l10-10" /></svg>';
}

function renderAuditLog(entries) {
  document.querySelectorAll('[data-audit-list]').forEach(list => {
    list.replaceChildren();
    if (!entries.length) {
      list.innerHTML = '<li class="log-empty">Keine Audit-Einträge vorhanden.</li>';
      return;
    }
    entries.forEach(entry => {
      const item = document.createElement('li');
      item.innerHTML = `${auditIcon(entry.level)}<span>${entry.time}</span><span class="pill ${entry.level}">${entry.level}</span><span>${entry.message}</span>`;
      list.appendChild(item);
    });
  });
}

async function loadAuditLog() {
  try {
    const response = await fetch('./api/audit.php');
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Audit log unavailable');
    renderAuditLog(data.entries);
  } catch (error) {
    document.querySelectorAll('[data-audit-list]').forEach(list => {
      list.innerHTML = '<li class="log-empty">Audit-Log konnte nicht geladen werden.</li>';
    });
    console.error(error);
  }
}

loadAuditLog();

async function runModule(module, options = {}) {
  const response = await fetch('api/run.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ module, ...options })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function runDiagnosticModule(module, options = {}) {
  try {
    const result = await runModule(module, options);
    if (!result.success) throw new Error(result.error || 'Modul meldet einen Fehler');
    return result;
  } catch (error) {
    return { success: false, error: error.message || 'Modul konnte nicht ausgeführt werden' };
  }
}


async function runSystemDiagnosis() {
  showView('diagnose');

  const diagnoseBody = document.querySelector('.diagnose-body');

  if (!diagnoseBody) return;

  diagnoseBody.innerHTML = `
    <div class="scan-column">
      <p>System wird geprüft...</p>
    </div>
    <div class="progress-box">
      <div class="progress-ring">...</div>
    </div>
  `;

  try {
    const hostnameResult = await runDiagnosticModule('hostname');
    const internetResult = await runDiagnosticModule('internet');
    const networkResult = await runDiagnosticModule('network');
    const pingResult = await runDiagnosticModule('ping', { target: '8.8.8.8' });
    const ssdResult = await runDiagnosticModule('ssd');
    const ramResult = await runDiagnosticModule('ram');

    const hostname = hostnameResult.data?.hostname;
    const internet = internetResult.data;
    const network = networkResult.data || {};
    const ping = pingResult.data;

    // Alle Netzwerkadapter vorbereiten
    const interfaces = Array.isArray(network.interfaces)
      ? network.interfaces
      : [];

    const interfaceItems = interfaces.map((item) => {
      const ipv4 = Array.isArray(item.ipv4) ? item.ipv4 : [];
      const gateways = Array.isArray(item.gateways)
        ? item.gateways
        : [];
      const dns = Array.isArray(item.dns) ? item.dns : [];

      const statusClass = item.internet
        ? 'ok'
        : item.status === 'Up'
          ? 'warn'
          : '';

      return `
        <li>
          <strong>${escapeHtml(item.name || 'Unbekannt')}</strong>
          <ul>
            <li>Status: ${escapeHtml(item.status || 'Unbekannt')}</li>
            <li>Beschreibung: ${escapeHtml(item.description || 'Nicht verfügbar')}</li>
            <li>Interface-Index: ${escapeHtml(item.interfaceIndex ?? 'Nicht verfügbar')}</li>
            <li>
              IPv4:
              ${escapeHtml(ipv4.join(', ') || 'Keine IPv4-Adresse')}
            </li>
            <li>
              Gateway:
              ${escapeHtml(gateways.join(', ') || 'Kein Gateway')}
            </li>
            <li>
              DNS:
              ${escapeHtml(dns.join(', ') || 'Nicht konfiguriert')}
            </li>
            <li>
              Internet:
              <strong class="${statusClass}">
                ${escapeHtml(item.internetStatus || 'Nicht getestet')}
              </strong>
            </li>
            <li>
              MAC:
              ${escapeHtml(item.macAddress || 'Unbekannt')}
            </li>
            <li>Verbindungstest-IP: ${escapeHtml(item.testSource || 'Nicht verfügbar')}</li>
          </ul>
        </li>
      `;
    }).join('');

    const networkSummary = `
      <li>
        <strong>Netzwerkadapter (${interfaces.length})</strong>
        <ul>
          ${interfaceItems || '<li>Keine Netzwerkadapter gefunden.</li>'}
        </ul>
      </li>
    `;

    // Datenträgerdaten vorbereiten
    const storage = ssdResult.data || null;

    const memory = ramResult.data || null;

    const ramSummary = `
  <li>
    <strong>Arbeitsspeicher (RAM):</strong>
    <ul>
      <li>Installiert: ${memory ? `${Number(memory.installedGB).toFixed(2)} GB` : 'Nicht verfügbar'}</li>
      <li>Verwendbar: ${memory ? `${Number(memory.usableGB).toFixed(2)} GB` : 'Nicht verfügbar'}</li>
      <li>Belegt: ${memory ? `${Number(memory.usedGB).toFixed(2)} GB` : 'Nicht verfügbar'}</li>
      <li>Verfügbar: ${memory ? `${Number(memory.availableGB).toFixed(2)} GB` : 'Nicht verfügbar'}</li>
      <li>
        Auslastung:
        <strong>${memory ? `${Number(memory.usagePercent).toFixed(1)} %` : 'Nicht verfügbar'}</strong>
      </li>
      <li>Speichermodule: ${memory ? memory.moduleCount : 'Nicht verfügbar'}</li>
    </ul>
  </li>
`;

    const diskItems = (storage?.disks ?? []).map(disk => `
      <li>
        ${escapeHtml(disk.model)} —
        ${escapeHtml(disk.mediaType)},
        ${Number(disk.sizeGB).toFixed(2)} GB,
        Status: ${escapeHtml(disk.healthStatus)}
        <ul>
          <li>Betriebsstatus: ${escapeHtml(Array.isArray(disk.operationalStatus) ? disk.operationalStatus.join(', ') : disk.operationalStatus || 'Nicht verfügbar')}</li>
          <li>Seriennummer: ${escapeHtml(disk.serialNumber || 'Nicht verfügbar')}</li>
          <li>Bus: ${escapeHtml(disk.busType || 'Nicht verfügbar')}</li>
        </ul>
      </li>
    `).join('');

    const volumeItems = (storage?.volumes ?? []).map(volume => `
      <li>
        ${escapeHtml(volume.driveLetter)} —
        ${Number(volume.freeGB).toFixed(2)} GB frei von
        ${Number(volume.sizeGB).toFixed(2)} GB insgesamt
        (${Number(volume.freePercent).toFixed(1)} % frei)
        <ul>
          <li>Bezeichnung: ${escapeHtml(volume.label || 'Nicht verfügbar')}</li>
          <li>Dateisystem: ${escapeHtml(volume.fileSystem || 'Nicht verfügbar')}</li>
          <li>Gesundheitsstatus: ${escapeHtml(volume.healthStatus || 'Nicht verfügbar')}</li>
        </ul>
      </li>
    `).join('');

    const storageWarnings = (storage?.warnings ?? []).map(warning => `
      <li>${escapeHtml(warning)}</li>
    `).join('');

    diagnoseBody.innerHTML = `
      <div class="scan-column">
        <p><strong>System-Analyse abgeschlossen</strong></p>

        <ul>
          <li>Hostname: ${escapeHtml(hostname || 'Unbekannt')}</li>

          ${hostnameResult.error ? `<li>Fehler: ${escapeHtml(hostnameResult.error)}</li>` : ''}
          <li><strong>Internetverbindung:</strong> ${internet ? `${escapeHtml(internet.connected ? 'Verbunden' : 'Nicht verbunden')} (Ziel: ${escapeHtml(internet.target)})` : `Nicht verfügbar${internetResult.error ? ` — ${escapeHtml(internetResult.error)}` : ''}`}</li>
          <li><strong>Ping zu 8.8.8.8:</strong> ${ping ? `${escapeHtml(ping.reachable ? 'Erreichbar' : 'Nicht erreichbar')}; ${escapeHtml(ping.packets_received)}/${escapeHtml(ping.packets_sent)} Pakete empfangen; ${escapeHtml(ping.packets_lost)} verloren; ${escapeHtml(ping.loss_percent)} % Verlust; Durchschnitt ${escapeHtml(ping.average_ms ?? 'Nicht verfügbar')} ms` : `Nicht verfügbar${pingResult.error ? ` — ${escapeHtml(pingResult.error)}` : ''}`}</li>

          ${networkSummary}
          ${networkResult.error ? `<li>Netzwerkfehler: ${escapeHtml(networkResult.error)}</li>` : ''}
          ${ramSummary}
          ${ramResult.error ? `<li>RAM-Fehler: ${escapeHtml(ramResult.error)}</li>` : ''}

          <li>
            <strong>Datenträger-Status:</strong>
            ${escapeHtml(storage?.summary?.healthStatus || 'Nicht verfügbar')}
            ${ssdResult.error ? ` — ${escapeHtml(ssdResult.error)}` : ''}
          </li>

          <li>
            <strong>Datenträger:</strong>
            <ul>
              ${diskItems || '<li>Keine Datenträgerinformationen verfügbar.</li>'}
            </ul>
          </li>

          <li>
            <strong>Volumes:</strong>
            <ul>
              ${volumeItems || '<li>Keine Volume-Informationen verfügbar.</li>'}
            </ul>
          </li>

          ${storageWarnings ? `
            <li>
              <strong>Speicher-Warnungen:</strong>
              <ul>${storageWarnings}</ul>
            </li>
          ` : ''}
        </ul>
      </div>

      <div class="progress-box">
        <div class="progress-ring complete">✓</div>
      </div>
    `;
    diagnoseBody.insertAdjacentHTML('beforeend', `
      <details class="diagnose-raw">
        <summary>Vollständige Moduldaten anzeigen</summary>
        <pre>${escapeHtml(JSON.stringify({ hostname: hostnameResult, internet: internetResult, network: networkResult, ping: pingResult, ram: ramResult, ssd: ssdResult }, null, 2))}</pre>
      </details>
    `);

  } catch (error) {
    console.error(error);

    diagnoseBody.innerHTML = `
      <div class="scan-column">
        <p><strong>System-Analyse fehlgeschlagen</strong></p>
        <p>${escapeHtml(error.message || 'Unbekannter Fehler')}</p>
      </div>

      <div class="progress-box">
        <div class="progress-ring">!</div>
      </div>
    `;
  }
}


const pingButton = document.getElementById('ping-button');

if (pingButton) {
  pingButton.addEventListener('click', runPing);
}

async function runPing() {

  const input = document.getElementById('ping-target');
  const resultBox = document.getElementById('ping-result');

  const target = input.value.trim();

  if (!target) {
    resultBox.innerHTML = `
            <p>Bitte eine Adresse eingeben.</p>
        `;

    return;
  }

  resultBox.innerHTML = `
        <p>Ping wird ausgeführt...</p>
    `;

  try {

    const response = await fetch('api/run.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        module: 'ping',
        target: target
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error || 'Ping fehlgeschlagen'
      );
    }

    showPingResult(result.data);

  } catch (error) {

    console.error(error);

    resultBox.innerHTML = `
            <p>Fehler: ${error.message}</p>
        `;
  }
}

function showPingResult(data) {

  const resultBox = document.getElementById('ping-result');

  if (data.reachable) {

    resultBox.innerHTML = `
            <div>
                <h3>✓ ${data.target} erreichbar</h3>

                <p>
                    Pakete:
                    ${data.packets_received}/${data.packets_sent}
                </p>

                <p>
                    Paketverlust:
                    ${data.loss_percent}%
                </p>

                <p>
                    Durchschnitt:
                    ${data.average_ms} ms
                </p>
            </div>
        `;

  } else {

    resultBox.innerHTML = `
            <div>
                <h3>✕ ${data.target} nicht erreichbar</h3>

                <p>
                    Pakete:
                    ${data.packets_received}/${data.packets_sent}
                </p>

                <p>
                    Paketverlust:
                    ${data.loss_percent}%
                </p>
            </div>
        `;
  }
}

const tracerouteButton = document.getElementById('traceroute-button');
if (tracerouteButton) {
  tracerouteButton.addEventListener('click', runTraceroute);
}

const tracerouteInput = document.getElementById('traceroute-target');
if (tracerouteInput) {
  tracerouteInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') runTraceroute();
  });
}

async function runTraceroute() {
  const input = document.getElementById('traceroute-target');
  const resultBox = document.getElementById('traceroute-result');
  const button = document.getElementById('traceroute-button');
  const target = input.value.trim();

  if (!target) {
    resultBox.innerHTML = '<p>Bitte eine IP-Adresse oder einen Hostnamen eingeben.</p>';
    return;
  }

  button.disabled = true;
  resultBox.innerHTML = '<p>Traceroute läuft auf dem verbundenen PC. Das kann bis zu 30 Sekunden dauern …</p>';

  try {
    const response = await fetch('api/run.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'traceroute', target })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Traceroute fehlgeschlagen');

    const trace = result.data;
    const hopRows = (trace.hops || []).map(hop => `
      <li><strong>Hop ${escapeHtml(hop.number)}:</strong> ${escapeHtml(hop.details)}</li>
    `).join('');
    const rawOutput = (trace.output || []).join('\n');

    resultBox.innerHTML = `
      <div>
        <h3>Route zu ${escapeHtml(trace.target)}</h3>
        <p>${escapeHtml(trace.hopCount)} Hops · Exit-Code ${escapeHtml(trace.exitCode)}</p>
        <ol class="traceroute-hops">${hopRows || '<li>Windows hat keine Hop-Zeilen zurückgegeben.</li>'}</ol>
        <details>
          <summary>Vollständige tracert-Ausgabe</summary>
          <pre class="traceroute-output">${escapeHtml(rawOutput)}</pre>
        </details>
      </div>
    `;
  } catch (error) {
    resultBox.innerHTML = `<p>Traceroute fehlgeschlagen: ${escapeHtml(error.message)}</p>`;
  } finally {
    button.disabled = false;
  }
}
