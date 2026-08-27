/* ==========================================================================
   KALKULATOR PROŚNOŚCI ŚWIŃ - SYNCHRONIZACJA REAL-TIME (app.js)
   ========================================================================== */

const INITIAL_DEMO_SOWS = [];

let sows = [];
let currentFilter = 'all';
let familyCode = '';
let eventSource = null;
let isSyncing = false;
let currentCalYear = new Date().getFullYear();

function getOffsetDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSowsData();
  initFieldsModule();
  initFamilyCloudSync();
  setupNavigation();
  setupCalculatorListeners();
  setupModalListeners();
  setupDataSyncListeners();
  registerServiceWorker();
  initYearCalendar();
  setupNotificationListeners();
  checkUpcomingFarrowingsAndNotify();

  const todayStr = new Date().toISOString().split('T')[0];
  const coverageInput = document.getElementById('calc-coverage-date');
  if (coverageInput) {
    coverageInput.value = todayStr;
    calculateGestation();
  }

  renderSowsList();
  renderCalendarTimeline();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker OK'))
      .catch(err => console.log('Błąd SW:', err));
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('prosnosc_swin_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  const themeBtns = document.querySelectorAll('.btn-toggle-theme-global');
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('prosnosc_swin_theme', next);
      updateThemeIcon(next);
    });
  });
}

function updateThemeIcon(theme) {
  const themeBtns = document.querySelectorAll('.btn-toggle-theme-global');
  themeBtns.forEach(btn => {
    btn.innerHTML = theme === 'light' ? '🌙' : '☀️';
  });
}

let fields = [];
let treatments = [];

function setupLobbyNavigation() {
  const btnOpenPigs = document.getElementById('btn-open-pigs');
  const btnOpenFields = document.getElementById('btn-open-fields');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnBackLobby = document.getElementById('btn-back-lobby');
  const btnBackLobbyFields = document.getElementById('btn-back-lobby-fields');
  const btnBackLobbySettings = document.getElementById('btn-back-lobby-settings');

  if (btnOpenPigs) {
    btnOpenPigs.addEventListener('click', () => {
      switchScreen('pigs');
    });
  }

  if (btnOpenFields) {
    btnOpenFields.addEventListener('click', () => {
      switchScreen('fields');
    });
  }

  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      switchScreen('settings');
    });
  }

  if (btnBackLobby) {
    btnBackLobby.addEventListener('click', () => {
      switchScreen('lobby');
    });
  }

  if (btnBackLobbyFields) {
    btnBackLobbyFields.addEventListener('click', () => {
      switchScreen('lobby');
    });
  }

  if (btnBackLobbySettings) {
    btnBackLobbySettings.addEventListener('click', () => {
      switchScreen('lobby');
    });
  }
}

function switchScreen(screenName) {
  const screenLobby = document.getElementById('screen-lobby');
  const screenPigs = document.getElementById('screen-pigs');
  const screenFields = document.getElementById('screen-fields');
  const screenSettings = document.getElementById('screen-settings');

  if (screenLobby) screenLobby.classList.remove('active');
  if (screenPigs) screenPigs.classList.remove('active');
  if (screenFields) screenFields.classList.remove('active');
  if (screenSettings) screenSettings.classList.remove('active');

  if (screenName === 'pigs') {
    if (screenPigs) screenPigs.classList.add('active');
    renderMenuStats();
    renderSowsList();
    renderCalendarTimeline();
  } else if (screenName === 'fields') {
    if (screenFields) screenFields.classList.add('active');
    renderFieldsStats();
    renderFieldsList();
    renderTreatmentsList();
  } else if (screenName === 'settings') {
    if (screenSettings) screenSettings.classList.add('active');
  } else {
    if (screenLobby) screenLobby.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupNavigation() {
  setupLobbyNavigation();

  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.tab;

      navItems.forEach(i => i.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      item.classList.add('active');
      const targetPane = document.getElementById(`tab-${targetTab}`);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      if (targetTab === 'sows') renderSowsList();
      if (targetTab === 'calendar') renderCalendarTimeline();
      if (targetTab === 'calc') renderMenuStats();
    });
  });
}

function setupCalculatorListeners() {
  const coverageInput = document.getElementById('calc-coverage-date');
  const daysInput = document.getElementById('calc-gestation-days');
  const saveBtn = document.getElementById('btn-save-calc-to-sow');

  if (coverageInput) coverageInput.addEventListener('change', calculateGestation);
  if (daysInput) daysInput.addEventListener('input', calculateGestation);

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const covDate = coverageInput.value;
      const days = parseInt(daysInput?.value) || 114;

      if (!covDate) {
        showToast('Wybierz datę pokrycia!');
        return;
      }

      openSowModal({
        coverageDate: covDate,
        gestationDays: days
      });
    });
  }
}

function calculateGestation() {
  const coverageInput = document.getElementById('calc-coverage-date');
  const daysInput = document.getElementById('calc-gestation-days');

  if (!coverageInput) return;

  const coverageVal = coverageInput.value;
  const days = parseInt(daysInput?.value) || 114;

  if (!coverageVal) return;

  const coverageDate = new Date(coverageVal + 'T00:00:00');
  const farrowingDate = new Date(coverageDate);
  farrowingDate.setDate(farrowingDate.getDate() + days);

  const today = new Date();
  today.setHours(0,0,0,0);

  const diffTime = farrowingDate - today;
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.floor((today - coverageDate) / (1000 * 60 * 60 * 24));
  const progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / days) * 100)));

  // FORMATOWANIE DATY BEZ NAZWY DNIA TYGODNIA (np. 11.12.2026)
  const day = String(farrowingDate.getDate()).padStart(2, '0');
  const month = String(farrowingDate.getMonth() + 1).padStart(2, '0');
  const year = farrowingDate.getFullYear();
  const formattedDate = `${day}.${month}.${year}`;

  const resDateEl = document.getElementById('res-farrow-date');
  if (resDateEl) resDateEl.textContent = formattedDate;
  
  const resProgressFill = document.getElementById('res-progress-fill');
  if (resProgressFill) resProgressFill.style.width = `${progressPercent}%`;
  
  const resProgressText = document.getElementById('res-progress-text');
  if (resProgressText) resProgressText.textContent = `${progressPercent}% (${daysElapsed} z ${days} dni)`;

  const daysLeftEl = document.getElementById('res-days-left');
  if (daysLeftEl) {
    if (daysRemaining > 0) {
      daysLeftEl.textContent = `⏳ Pozostało: ${daysRemaining} dni`;
      daysLeftEl.style.color = 'var(--accent-gold)';
    } else if (daysRemaining === 0) {
      daysLeftEl.textContent = `🚨 Termin DZISIAJ!`;
      daysLeftEl.style.color = 'var(--primary-hover)';
    } else {
      daysLeftEl.textContent = `✅ Termin minął ${Math.abs(daysRemaining)} dni temu`;
      daysLeftEl.style.color = 'var(--accent-green)';
    }
  }

  const icsBtn = document.getElementById('btn-download-ics');
  if (icsBtn) {
    icsBtn.onclick = () => downloadIcsFile('Maciora', coverageDate, farrowingDate);
  }
}

function loadSowsData() {
  const saved = localStorage.getItem('prosnosc_swin_sows');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      sows = parsed.filter(s => s.id && !s.id.startsWith('sow_demo_'));
    } catch (e) {
      sows = [];
    }
  } else {
    sows = [];
  }
  saveSowsData(true);
}

function saveSowsData(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_sows', JSON.stringify(sows));
  if (!skipCloudPush && familyCode) {
    pushFarmDataToCloud();
  }
}

function initFamilyCloudSync() {
  const savedCode = localStorage.getItem('prosnosc_swin_family_code') || '';
  const codeInput = document.getElementById('family-code-input');
  if (codeInput) codeInput.value = savedCode;
  
  if (savedCode) {
    connectFamilyCloud(savedCode.trim().toUpperCase());
  } else {
    updateCloudStatusBadge(false);
  }

  const connectBtn = document.getElementById('btn-connect-family');
  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      const code = (document.getElementById('family-code-input')?.value || '').trim().toUpperCase();
      if (!code) {
        showToast('Wpisz dowolny własny Kod Rodziny (np. RODZINA123)!');
        return;
      }
      connectFamilyCloud(code, true);
    });
  }

  const manualSyncBtn = document.getElementById('btn-manual-sync-now');
  if (manualSyncBtn) {
    manualSyncBtn.addEventListener('click', () => {
      if (!familyCode) {
        showToast('Najpierw połącz się z Kodem Rodziny!');
        return;
      }
      pullFarmDataFromCloud(true);
    });
  }
}

function connectFamilyCloud(code, isUserInitiated = false) {
  familyCode = code;
  localStorage.setItem('prosnosc_swin_family_code', familyCode);
  updateCloudStatusBadge(true);

  if (isUserInitiated) {
    showToast(`Połączono z chmurą gospodarstwa: ${familyCode}`);
    pushFarmDataToCloud();
  }

  pullFarmDataFromCloud();
  listenToCloudRealtime();
}

function updateCloudStatusBadge(isConnected) {
  const badges = [
    document.getElementById('cloud-status-badge'),
    document.getElementById('cloud-status-badge-fields'),
    document.getElementById('cloud-status-badge-lobby'),
    document.getElementById('cloud-status-badge-settings')
  ];

  badges.forEach(badge => {
    if (!badge) return;
    if (isConnected) {
      badge.innerHTML = `🟢 Chmura aktywna na żywo: <strong>${familyCode}</strong>`;
      badge.style.display = 'inline-block';
      badge.style.background = 'var(--accent-green-light)';
      badge.style.color = 'var(--accent-green)';
      badge.style.borderColor = 'rgba(42, 157, 143, 0.4)';
      badge.style.cursor = 'pointer';
      badge.title = 'Chmura zsynchronizowana. Kliknij, aby sprawdzić aktualizacje.';
      badge.onclick = () => pullFarmDataFromCloud(true);
    } else {
      badge.innerHTML = `⚪ Chmura nieaktywna (Kliknij, aby połączyć)`;
      badge.style.display = 'inline-block';
      badge.style.background = 'var(--bg-primary)';
      badge.style.color = 'var(--text-secondary)';
      badge.style.borderColor = 'var(--border-color)';
      badge.style.cursor = 'pointer';
      badge.title = 'Kliknij, aby wpisać wspólny Kod Gospodarstwa';
      badge.onclick = () => {
        const code = prompt('Wpisz wspólny Kod Gospodarstwa (taki sam na komputerze i telefonie, np. WENGLORZ):', familyCode || '');
        if (code && code.trim()) {
          connectFamilyCloud(code.trim().toUpperCase(), true);
        }
      };
    }
  });
}

async function pushFarmDataToCloud() {
  if (!familyCode) return;
  try {
    const cleanTopic = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const url = `https://ntfy.sh/prosnosc_swin_${cleanTopic}`;

    const payload = {
      type: 'gr_wenglorz_farm_sync',
      version: 2,
      timestamp: Date.now(),
      sows: sows,
      fields: fields,
      treatments: treatments
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Wysłano pełne dane gospodarstwa (maciory + pola + opryski) do chmury.');
  } catch (err) {
    console.log('Błąd wysyłania do chmury:', err);
  }
}

async function pullFarmDataFromCloud(showToastOnSuccess = false) {
  if (!familyCode) return;
  try {
    const cleanTopic = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const url = `https://ntfy.sh/prosnosc_swin_${cleanTopic}/json?poll=1`;

    const res = await fetch(url);
    if (res.ok) {
      const textData = await res.text();
      const lines = textData.trim().split('\n');
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        const eventObj = JSON.parse(lastLine);
        if (eventObj && eventObj.message) {
          const remoteData = JSON.parse(eventObj.message);
          const changed = applyRemoteSyncData(remoteData);
          if (changed && showToastOnSuccess) {
            showToast('☁️ Pobrano aktualne dane gospodarstwa z chmury!');
          } else if (showToastOnSuccess) {
            showToast('✅ Wszystkie dane są aktualne!');
          }
        }
      }
    }
  } catch (err) {
    console.log('Błąd pobierania:', err);
  }
}

function listenToCloudRealtime() {
  if (!familyCode) return;
  if (eventSource) {
    eventSource.close();
  }

  const cleanTopic = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const sseUrl = `https://ntfy.sh/prosnosc_swin_${cleanTopic}/sse`;

  try {
    eventSource = new EventSource(sseUrl);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.message) {
          const remoteData = JSON.parse(data.message);
          applyRemoteSyncData(remoteData, true);
        }
      } catch (e) {}
    };
  } catch (err) {
    console.log('Błąd SSE:', err);
  }
}

function applyRemoteSyncData(dataObj, showToastNotice = false) {
  let changed = false;

  if (dataObj && typeof dataObj === 'object' && !Array.isArray(dataObj)) {
    // Nowy format gospodarstwa
    if (Array.isArray(dataObj.sows)) {
      const cleanRemoteSows = dataObj.sows.filter(s => s.id && !s.id.startsWith('sow_demo_'));
      if (JSON.stringify(cleanRemoteSows) !== JSON.stringify(sows)) {
        sows = cleanRemoteSows;
        saveSowsData(true);
        renderSowsList();
        renderCalendarTimeline();
        renderMenuStats();
        changed = true;
      }
    }
    if (Array.isArray(dataObj.fields)) {
      if (JSON.stringify(dataObj.fields) !== JSON.stringify(fields)) {
        fields = dataObj.fields;
        saveFieldsData(true);
        renderFieldsStats();
        renderFieldsList();
        changed = true;
      }
    }
    if (Array.isArray(dataObj.treatments)) {
      if (JSON.stringify(dataObj.treatments) !== JSON.stringify(treatments)) {
        treatments = dataObj.treatments;
        saveTreatmentsData(true);
        renderTreatmentsList();
        changed = true;
      }
    }
  } else if (Array.isArray(dataObj)) {
    // Starszy format: sama tablica macior
    const cleanRemote = dataObj.filter(s => s.id && !s.id.startsWith('sow_demo_'));
    if (JSON.stringify(cleanRemote) !== JSON.stringify(sows)) {
      sows = cleanRemote;
      saveSowsData(true);
      renderSowsList();
      renderCalendarTimeline();
      renderMenuStats();
      changed = true;
    }
  }

  if (changed && showToastNotice) {
    showToast('⚡ Zsynchronizowano dane gospodarstwa z drugim urządzeniem!');
  }
  return changed;
}

function renderSowsList() {
  const container = document.getElementById('sows-list-container');
  if (!container) return;

  const searchQuery = (document.getElementById('sow-search-input')?.value || '').toLowerCase();
  
  let filtered = sows.filter(sow => {
    const matchesSearch = sow.name.toLowerCase().includes(searchQuery) || 
                          (sow.pen && sow.pen.toLowerCase().includes(searchQuery));
    if (!matchesSearch) return false;

    if (currentFilter === 'all') return true;
    if (currentFilter === 'postawiona') return sow.status === 'postawiona';
    if (currentFilter === 'pregnant') return sow.status === 'pregnant';
    if (currentFilter === 'farrowing') return sow.status === 'farrowing';
    if (currentFilter === 'done') return sow.status === 'done';
    if (currentFilter === 'due_soon') {
      const daysLeft = calculateDaysRemaining(sow.coverageDate, sow.gestationDays);
      return (sow.status === 'pregnant' || sow.status === 'postawiona') && daysLeft <= 7 && daysLeft >= 0;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const daysA = calculateDaysRemaining(a.coverageDate, a.gestationDays);
    const daysB = calculateDaysRemaining(b.coverageDate, b.gestationDays);
    return daysA - daysB;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🐖</div>
        <h3>Brak macior w rejestrze</h3>
        <p>Dodaj pierwszą własną maciorę klikając przycisk poniżej!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(sow => renderSowCardHTML(sow)).join('');

  filtered.forEach(sow => {
    const card = document.getElementById(`sow-card-${sow.id}`);
    if (!card) return;

    const btnEdit = card.querySelector('.btn-edit-sow');
    const btnDelete = card.querySelector('.btn-delete-sow');
    const btnIcs = card.querySelector('.btn-ics-sow');
    const statusSelect = card.querySelector('.sow-status-select');

    if (btnEdit) btnEdit.onclick = () => openSowModal(sow);
    if (btnDelete) btnDelete.onclick = () => deleteSow(sow.id);
    if (btnIcs) {
      btnIcs.onclick = () => {
        const covDate = new Date(sow.coverageDate + 'T00:00:00');
        const farrowDate = addDays(covDate, sow.gestationDays || 114);
        downloadIcsFile(`Maciora: ${sow.name}`, covDate, farrowDate);
      };
    }
    if (statusSelect) {
      statusSelect.onchange = (e) => {
        sow.status = e.target.value;
        saveSowsData();
        renderSowsList();
        renderCalendarTimeline();
        renderMenuStats();
        showToast(`Zaktualizowano status dla ${sow.name}`);
      };
    }
  });
}

function renderSowCardHTML(sow) {
  const covDate = new Date(sow.coverageDate + 'T00:00:00');
  const daysTotal = sow.gestationDays || 114;
  const farrowDate = addDays(covDate, daysTotal);
  
  const today = new Date();
  today.setHours(0,0,0,0);

  const daysElapsed = Math.floor((today - covDate) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((farrowDate - today) / (1000 * 60 * 60 * 24));
  const progressPercent = Math.min(100, Math.max(0, Math.round((daysElapsed / daysTotal) * 100)));

  const day = String(farrowDate.getDate()).padStart(2, '0');
  const month = String(farrowDate.getMonth() + 1).padStart(2, '0');
  const year = farrowDate.getFullYear();
  const formattedFarrowDate = `${day}.${month}.${year}`;

  const formattedCovDate = covDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' });

  const badgeHTML = getStatusBadge(sow.status, daysRemaining);

  return `
    <div class="sow-card" id="sow-card-${sow.id}">
      <div class="sow-card-header">
        <div>
          <div class="sow-name">${escapeHTML(sow.name)}</div>
          <div class="sow-subtitle">📍 ${escapeHTML(sow.pen || 'Brak przypisanego kojca')} | Pokrycie: ${formattedCovDate}</div>
        </div>
        ${badgeHTML}
      </div>

      <div class="progress-container">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="progress-labels">
          <span>Dzień ${daysElapsed} z ${daysTotal}</span>
          <span>📅 Termin: <strong>${formattedFarrowDate}</strong></span>
        </div>
      </div>

      ${sow.notes ? `<div style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:8px;">📝 <em>${escapeHTML(sow.notes)}</em></div>` : ''}

      <div class="sow-actions">
        <select class="form-control sow-status-select" style="padding:6px; font-size:0.82rem; width:auto; flex:1;">
          <option value="postawiona" ${sow.status === 'postawiona' ? 'selected' : ''}>🐖 Postawiona</option>
          <option value="pregnant" ${sow.status === 'pregnant' ? 'selected' : ''}>🤰 W ciąży</option>
          <option value="farrowing" ${sow.status === 'farrowing' ? 'selected' : ''}>🍼 Na porodówce</option>
          <option value="done" ${sow.status === 'done' ? 'selected' : ''}>✅ Wyproszona</option>
          <option value="repeat" ${sow.status === 'repeat' ? 'selected' : ''}>❌ Powtórka</option>
        </select>
        <button class="icon-btn btn-ics-sow" title="Dodaj do kalendarza (.ics)">📅</button>
        <button class="icon-btn btn-edit-sow" title="Edytuj">✏️</button>
        <button class="icon-btn btn-delete-sow" title="Usuń" style="color:var(--accent-red)">🗑️</button>
      </div>
    </div>
  `;
}

function getStatusBadge(status, daysRemaining) {
  if (status === 'postawiona') {
    return `<span class="badge" style="background:#1e293b; color:#38bdf8; border:1px solid #0284c7;">🐖 Postawiona</span>`;
  }
  if (status === 'done') {
    return `<span class="badge badge-done">✅ Wyproszona</span>`;
  }
  if (status === 'repeat') {
    return `<span class="badge badge-repeat">❌ Powtórka</span>`;
  }
  if (status === 'farrowing') {
    return `<span class="badge badge-farrowing">🍼 Porodówka</span>`;
  }
  if (daysRemaining <= 7 && daysRemaining >= 0) {
    return `<span class="badge badge-farrowing">🚨 Termin za ${daysRemaining}d</span>`;
  }
  return `<span class="badge badge-pregnant">🤰 ${daysRemaining}d</span>`;
}

function renderCalendarTimeline() {
  const container = document.getElementById('calendar-timeline-container');
  if (!container) return;

  const sorted = [...sows].sort((a,b) => {
    const dateA = addDays(new Date(a.coverageDate + 'T00:00:00'), a.gestationDays || 114);
    const dateB = addDays(new Date(b.coverageDate + 'T00:00:00'), b.gestationDays || 114);
    return dateA - dateB;
  });

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px 10px;">
        <div class="empty-icon">📅</div>
        <h3>Brak zaplanowanych wyproszeń</h3>
        <p>Gdy dodasz maciorę do rejestru, automatycznie pojawi się tutaj w terminarzu!</p>
      </div>
    `;
    return;
  }

  let html = '<div class="timeline">';
  sorted.forEach(sow => {
    const covDate = new Date(sow.coverageDate + 'T00:00:00');
    const farrowDate = addDays(covDate, sow.gestationDays || 114);
    const today = new Date();
    today.setHours(0,0,0,0);
    const daysRemaining = Math.ceil((farrowDate - today) / (1000 * 60 * 60 * 24));

    const day = String(farrowDate.getDate()).padStart(2, '0');
    const month = String(farrowDate.getMonth() + 1).padStart(2, '0');
    const year = farrowDate.getFullYear();
    const dateFormatted = `${day}.${month}.${year}`;

    const covDay = String(covDate.getDate()).padStart(2, '0');
    const covMonth = String(covDate.getMonth() + 1).padStart(2, '0');
    const covYear = covDate.getFullYear();
    const covFormatted = `${covDay}.${covMonth}.${covYear}`;

    let daysText = '';
    if (sow.status === 'done') {
      daysText = '<span style="color:var(--text-muted)">✅ Wyproszona</span>';
    } else if (daysRemaining > 0) {
      daysText = `Pozostało: <strong style="color:var(--primary); font-size:0.92rem;">${daysRemaining} dni</strong>`;
    } else if (daysRemaining === 0) {
      daysText = `<strong style="color:var(--accent-red); font-size:0.92rem;">🚨 Poród DZISIAJ!</strong>`;
    } else {
      daysText = `<span style="color:var(--text-muted)">Termin minął ${Math.abs(daysRemaining)} dni temu</span>`;
    }

    const badgeHTML = getStatusBadge(sow.status, daysRemaining);

    html += `
      <div class="timeline-item ${daysRemaining <= 7 && daysRemaining >= 0 && sow.status !== 'done' ? 'active' : ''} ${sow.status === 'done' ? 'done' : ''}">
        <div class="timeline-day" style="font-size:0.85rem; font-weight:800; min-width:85px; text-align:center;">
          📅 ${dateFormatted}
        </div>
        <div class="timeline-details" style="flex:1;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <h4 style="font-size:1rem; font-weight:800; margin:0;">${escapeHTML(sow.name)}</h4>
            ${badgeHTML}
          </div>
          <p style="font-size:0.82rem; margin:2px 0;">📍 Kojec: <strong>${escapeHTML(sow.pen || 'Brak')}</strong></p>
          <p style="font-size:0.8rem; color:var(--text-secondary); margin:2px 0;">Pokrycie: ${covFormatted} • ${daysText}</p>
        </div>
      </div>
    `;
  });
  html += '</div>';

  container.innerHTML = html;
}

function setupModalListeners() {
  const modal = document.getElementById('sow-modal');
  const btnAdd = document.getElementById('btn-add-sow-main');
  const btnClose = document.getElementById('btn-close-modal');
  const form = document.getElementById('sow-form');

  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      openSowModal();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', closeSowModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeSowModal();
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSowFromModal();
    });
  }

  const chips = document.querySelectorAll('.chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderSowsList();
    });
  });

  const searchInput = document.getElementById('sow-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderSowsList);
  }
}

function openSowModal(sowData = null) {
  const modal = document.getElementById('sow-modal');
  const title = document.getElementById('modal-title');
  const form = document.getElementById('sow-form');

  if (!modal || !form) return;

  form.reset();

  if (sowData && sowData.id) {
    title.textContent = 'Edytuj Maciorę';
    document.getElementById('modal-sow-id').value = sowData.id;
    document.getElementById('modal-sow-name').value = sowData.name || '';
    document.getElementById('modal-sow-coverage').value = sowData.coverageDate || '';
    document.getElementById('modal-sow-days').value = sowData.gestationDays || 114;
    document.getElementById('modal-sow-pen').value = sowData.pen || '';
    document.getElementById('modal-sow-status').value = sowData.status || 'postawiona';
    const notesEl = document.getElementById('modal-sow-notes');
    if (notesEl) notesEl.value = sowData.notes || '';
  } else {
    title.textContent = 'Nowa Maciora w Rejestrze';
    document.getElementById('modal-sow-id').value = '';
    document.getElementById('modal-sow-coverage').value = sowData?.coverageDate || new Date().toISOString().split('T')[0];
    document.getElementById('modal-sow-days').value = sowData?.gestationDays || 114;
    document.getElementById('modal-sow-status').value = 'postawiona';
    const notesEl = document.getElementById('modal-sow-notes');
    if (notesEl) notesEl.value = '';
  }

  modal.classList.add('active');
}

function closeSowModal() {
  const modal = document.getElementById('sow-modal');
  if (modal) modal.classList.remove('active');
}

function saveSowFromModal() {
  const id = document.getElementById('modal-sow-id').value;
  const name = document.getElementById('modal-sow-name').value.trim();
  const coverageDate = document.getElementById('modal-sow-coverage').value;
  const gestationDays = parseInt(document.getElementById('modal-sow-days').value) || 114;
  const pen = document.getElementById('modal-sow-pen').value.trim();
  const status = document.getElementById('modal-sow-status').value;
  const notesEl = document.getElementById('modal-sow-notes');
  const notes = notesEl ? notesEl.value.trim() : '';

  if (!name || !coverageDate) {
    showToast('Wypełnij nazwę maciory i datę pokrycia!');
    return;
  }

  if (id) {
    const index = sows.findIndex(s => s.id === id);
    if (index !== -1) {
      sows[index] = { ...sows[index], name, coverageDate, gestationDays, pen, status, notes };
      showToast('Zaktualizowano dane maciory!');
    }
  } else {
    const newSow = {
      id: 'sow_' + Date.now(),
      name,
      coverageDate,
      gestationDays,
      pen,
      status,
      notes,
      createdAt: new Date().toISOString()
    };
    sows.push(newSow);
    showToast('Dodano maciorę do rejestru i terminarza!');
  }

  saveSowsData();
  closeSowModal();
  renderSowsList();
  renderCalendarTimeline();
  renderMenuStats();
}

function deleteSow(id) {
  if (confirm('Czy na pewno chcesz usunąć tę maciorę z rejestru?')) {
    sows = sows.filter(s => s.id !== id);
    saveSowsData();
    renderSowsList();
    renderCalendarTimeline();
    renderMenuStats();
    showToast('Usunięto maciorę.');
  }
}

function setupDataSyncListeners() {
  const btnExportJson = document.getElementById('btn-export-json');
  const btnImportJson = document.getElementById('btn-import-json');
  const fileInput = document.getElementById('input-import-file');
  const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const fullFarmBackup = {
        type: 'gr_wenglorz_full_backup',
        version: 2,
        exportedAt: new Date().toISOString(),
        familyCode: familyCode || '',
        sows: sows,
        fields: fields,
        treatments: treatments
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullFarmBackup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `baza_gr_wenglorz_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('💾 Pobrano pełną bazę gospodarstwa (maciory + pola)!');
    });
  }

  if (btnImportJson && fileInput) {
    btnImportJson.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported && typeof imported === 'object' && !Array.isArray(imported)) {
            // Nowy pełny format gospodarstwa
            if (Array.isArray(imported.sows)) {
              sows = imported.sows.filter(s => s.id && !s.id.startsWith('sow_demo_'));
              saveSowsData();
              renderSowsList();
              renderCalendarTimeline();
              renderMenuStats();
            }
            if (Array.isArray(imported.fields)) {
              fields = imported.fields;
              saveFieldsData();
              renderFieldsStats();
              renderFieldsList();
            }
            if (Array.isArray(imported.treatments)) {
              treatments = imported.treatments;
              saveTreatmentsData();
              renderTreatmentsList();
            }
            if (imported.familyCode) {
              connectFamilyCloud(imported.familyCode, true);
            }
            showToast('✅ Pomyślnie wczytano całą bazę gospodarstwa!');
          } else if (Array.isArray(imported)) {
            // Starszy format z samą listą macior
            sows = imported.filter(s => s.id && !s.id.startsWith('sow_demo_'));
            saveSowsData();
            renderSowsList();
            renderCalendarTimeline();
            renderMenuStats();
            showToast('Pomyślnie wczytano bazę macior!');
          } else {
            showToast('Nieprawidłowy format pliku kopii!');
          }
        } catch (err) {
          showToast('Błąd podczas odczytu pliku.');
        }
      };
      reader.readAsText(file);
    });
  }

  if (btnShareWhatsapp) {
    btnShareWhatsapp.addEventListener('click', () => {
      const pregnantSows = sows.filter(s => s.status === 'pregnant' || s.status === 'farrowing');
      let text = `🐖 *GR WENGLORZ - Podsumowanie Wyproszeń:*\n\n`;
      
      pregnantSows.forEach(s => {
        const covDate = new Date(s.coverageDate + 'T00:00:00');
        const farrowDate = addDays(covDate, s.gestationDays || 114);
        const formattedDate = farrowDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
        text += `• *${s.name}* (${s.pen || 'Kojec'}) -> Termin: *${formattedDate}*\n`;
      });

      if (navigator.share) {
        navigator.share({
          title: 'Wyproszenia macior',
          text: text
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text);
        showToast('Skopiowano podsumowanie do schowka!');
      }
    });
  }
}

function downloadIcsFile(title, startDate, farrowDate) {
  const formatDateForIcs = (d) => d.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 8);
  
  const startStr = formatDateForIcs(farrowDate);
  const endStr = formatDateForIcs(addDays(farrowDate, 1));

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kalkulator Prosnosci Swin//PL',
    'BEGIN:VEVENT',
    `SUMMARY:🐖 ${title}`,
    `DESCRIPTION:Przewidywany termin porodu maciory (obliczony wg zasady 3M+3T+3D).`,
    `DTSTART;VALUE=DATE:${startStr}`,
    `DTEND;VALUE=DATE:${endStr}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Pobrano plik przypomnienia kalendarza (.ics)!');
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function calculateDaysRemaining(coverageDateStr, totalDays = 114) {
  const covDate = new Date(coverageDateStr + 'T00:00:00');
  const farrowDate = addDays(covDate, totalDays);
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.ceil((farrowDate - today) / (1000 * 60 * 60 * 24));
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&< me"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m] || m);
}

function showToast(message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>🐖</span> <span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

/* ==========================================================================
   MENU - STATYSTYKI I NAJBLIŻSZY PORÓD
   ========================================================================== */

function initYearCalendar() {
  renderMenuStats();
}

function renderMenuStats() {
  const statsContainer = document.getElementById('menu-stats');
  if (!statsContainer) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalSows = sows.length;
  const pregnantSows = sows.filter(s => s.status === 'pregnant').length;
  const farrowingSows = sows.filter(s => s.status === 'farrowing').length;
  const postawioneSows = sows.filter(s => s.status === 'postawiona').length;

  // Najbliższy poród
  let nextFarrow = null;
  let nextDaysLeft = Infinity;
  sows.filter(s => s.status === 'pregnant' || s.status === 'postawiona').forEach(sow => {
    const d = calculateDaysRemaining(sow.coverageDate, sow.gestationDays);
    if (d >= 0 && d < nextDaysLeft) {
      nextDaysLeft = d;
      nextFarrow = sow;
    }
  });

  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-value">${totalSows}</div>
      <div class="stat-card-label">Wszystkich macior</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-value" style="color:var(--accent-gold);">${pregnantSows}</div>
      <div class="stat-card-label">W ciąży</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-value" style="color:var(--accent-blue);">${farrowingSows}</div>
      <div class="stat-card-label">Na porodówce</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-value" style="color:#38bdf8;">${postawioneSows}</div>
      <div class="stat-card-label">Postawionych</div>
    </div>
  `;

  // Karta najbliższego porodu
  const nextCard = document.getElementById('menu-next-farrow-card');
  const nextContent = document.getElementById('menu-next-farrow-content');
  if (nextCard && nextContent) {
    if (nextFarrow) {
      const covDate = new Date(nextFarrow.coverageDate + 'T00:00:00');
      const farrowDate = addDays(covDate, nextFarrow.gestationDays || 114);
      const d = String(farrowDate.getDate()).padStart(2, '0');
      const mo = String(farrowDate.getMonth() + 1).padStart(2, '0');
      const yr = farrowDate.getFullYear();
      nextContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:800; font-size:1rem;">${escapeHTML(nextFarrow.name)}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary);">${escapeHTML(nextFarrow.pen || 'Brak kojca')}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:1.3rem; font-weight:900; color:var(--accent-red);">${nextDaysLeft} dni</div>
            <div style="font-size:0.78rem; color:var(--text-secondary);">${d}.${mo}.${yr}</div>
          </div>
        </div>
      `;
      nextCard.style.display = 'block';
    } else {
      nextCard.style.display = 'none';
    }
  }
}

/* ==========================================================================
   POWIADOMIENIA O PORODACH (3 DNI PRZED)
   ========================================================================== */

function setupNotificationListeners() {
  const btnEnable = document.getElementById('btn-enable-notifications');
  const btnTest = document.getElementById('btn-test-notification');

  updateNotificationButtonState();

  if (btnEnable) {
    btnEnable.addEventListener('click', async () => {
      if (!('Notification' in window)) {
        showToast('Twoja przeglądarka nie obsługuje powiadomień.');
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        updateNotificationButtonState();
        if (permission === 'granted') {
          showToast('✅ Powiadomienia włączone!');
          sendAppNotification('🔔 Powiadomienia włączone!', 'Będziesz otrzymywać przypomnienia na 3 dni przed porodem maciory.');
          checkUpcomingFarrowingsAndNotify();
        } else if (permission === 'denied') {
          showToast('Zezwolenie na powiadomienia zostało zablokowane w przeglądarce.');
        }
      } catch (e) {
        console.log('Błąd powiadomień:', e);
      }
    });
  }

  if (btnTest) {
    btnTest.addEventListener('click', () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        Notification.requestPermission().then(p => {
          if (p === 'granted') {
            updateNotificationButtonState();
            sendAppNotification('🚨 Test: Poród za 3 dni!', 'Maciora: Baśka (Kojec 2) ma planowany poród za 3 dni! Przygotuj porodówkę.');
          } else {
            showToast('Musisz najpierw zezwolić na powiadomienia!');
          }
        });
      } else {
        sendAppNotification('🚨 Test: Poród za 3 dni!', 'Maciora: Baśka (Kojec 2) ma planowany poród za 3 dni! Przygotuj porodówkę.');
      }
    });
  }
}

function updateNotificationButtonState() {
  const btnText = document.getElementById('notif-btn-text');
  const btnIcon = document.getElementById('notif-btn-icon');
  const btnEnable = document.getElementById('btn-enable-notifications');

  if (!btnText || !btnIcon || !btnEnable) return;

  if (!('Notification' in window)) {
    btnText.textContent = 'Powiadomienia niedostępne';
    btnEnable.disabled = true;
    return;
  }

  if (Notification.permission === 'granted') {
    btnIcon.textContent = '✅';
    btnText.textContent = 'Powiadomienia są włączone';
    btnEnable.style.backgroundColor = '#166534';
    btnEnable.style.borderColor = '#15803d';
  } else if (Notification.permission === 'denied') {
    btnIcon.textContent = '❌';
    btnText.textContent = 'Powiadomienia zablokowane';
  } else {
    btnIcon.textContent = '🔔';
    btnText.textContent = 'Włącz powiadomienia na telefonie';
  }
}

function sendAppNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%2300e676"/><text x="50" y="65" font-size="50" text-anchor="middle">🐖</text></svg>',
          badge: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%2300e676"/><text x="50" y="65" font-size="50" text-anchor="middle">🐖</text></svg>',
          vibrate: [200, 100, 200],
          tag: 'farrowing-alert-' + Date.now(),
          renotify: true
        });
      });
    } else {
      new Notification(title, {
        body,
        icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%2300e676"/><text x="50" y="65" font-size="50" text-anchor="middle">🐖</text></svg>'
      });
    }
  } catch (e) {
    console.log('Błąd wysyłania powiadomienia:', e);
  }
}

function checkUpcomingFarrowingsAndNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  sows.filter(s => s.status === 'pregnant' || s.status === 'postawiona' || s.status === 'farrowing').forEach(sow => {
    if (!sow.coverageDate) return;
    const daysRemaining = calculateDaysRemaining(sow.coverageDate, sow.gestationDays);

    if (daysRemaining <= 3 && daysRemaining >= 0) {
      const notifKey = `notif_sent_${sow.id}_${todayStr}_${daysRemaining}`;
      if (!localStorage.getItem(notifKey)) {
        const covDate = new Date(sow.coverageDate + 'T00:00:00');
        const farrowDate = addDays(covDate, sow.gestationDays || 114);
        const farrowStr = `${String(farrowDate.getDate()).padStart(2,'0')}.${String(farrowDate.getMonth()+1).padStart(2,'0')}.${farrowDate.getFullYear()}`;

        const alertTitle = daysRemaining === 0 
          ? `🚨 PORÓD DZISIAJ: ${sow.name}!`
          : `🚨 Za ${daysRemaining} dni poród: ${sow.name}!`;

        const alertBody = `Kojec: ${sow.pen || 'Brak'} | Termin: ${farrowStr}. Przygotuj porodówkę!`;

        sendAppNotification(alertTitle, alertBody);
        localStorage.setItem(notifKey, '1');
      }
    }
  });
}

/* ==========================================================================
   MODUŁ: POLA I UPRAWY (DZIAŁKI, ZASIEWY, EWIDENCJA OPRYSKÓW)
   ========================================================================== */

function initFieldsModule() {
  loadFieldsData();
  loadTreatmentsData();
  setupFieldsModuleListeners();
}

function loadFieldsData() {
  const saved = localStorage.getItem('prosnosc_swin_fields');
  if (saved) {
    try {
      fields = JSON.parse(saved);
    } catch (e) {
      fields = [];
    }
  } else {
    fields = [];
  }
}

function saveFieldsData(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_fields', JSON.stringify(fields));
  renderFieldsStats();
  renderFieldsList();
  renderTreatmentsList();
  if (!skipCloudPush && familyCode) {
    pushFarmDataToCloud();
  }
}

function loadTreatmentsData() {
  const saved = localStorage.getItem('prosnosc_swin_treatments');
  if (saved) {
    try {
      treatments = JSON.parse(saved);
    } catch (e) {
      treatments = [];
    }
  } else {
    treatments = [];
  }
}

function saveTreatmentsData(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_treatments', JSON.stringify(treatments));
  renderFieldsStats();
  renderFieldsList();
  renderTreatmentsList();
  if (!skipCloudPush && familyCode) {
    pushFarmDataToCloud();
  }
}

function switchFieldTab(targetTab) {
  const fieldNavItems = document.querySelectorAll('.nav-item-fields');
  fieldNavItems.forEach(i => {
    if (i.dataset.fieldTab === targetTab) i.classList.add('active');
    else i.classList.remove('active');
  });

  document.querySelectorAll('#screen-fields .tab-pane').forEach(p => p.classList.remove('active'));
  const targetSection = document.getElementById(`tab-${targetTab}`);
  if (targetSection) targetSection.classList.add('active');

  if (targetTab === 'fields-all') renderFieldsList();
  if (targetTab === 'fields-menu') renderFieldsStats();
}

function setupFieldsModuleListeners() {
  // Nawigacja dolna w module pól
  const fieldNavItems = document.querySelectorAll('.nav-item-fields');
  fieldNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.dataset.fieldTab;
      switchFieldTab(targetTab);
    });
  });

  // Przyciski dodawania
  const btnAddField = document.getElementById('btn-add-field-main');
  const btnAddFieldMenu = document.getElementById('btn-add-field-menu');
  const btnAddTreatmentMain = document.getElementById('btn-add-treatment-main');
  const btnAddTreatmentQuick = document.getElementById('btn-add-treatment-quick');

  if (btnAddField) btnAddField.addEventListener('click', () => openFieldModal());
  if (btnAddFieldMenu) btnAddFieldMenu.addEventListener('click', () => openFieldModal());
  if (btnAddTreatmentMain) btnAddTreatmentMain.addEventListener('click', () => openTreatmentModal());
  if (btnAddTreatmentQuick) btnAddTreatmentQuick.addEventListener('click', () => openTreatmentModal());

  // Formularz Pola
  const fieldForm = document.getElementById('field-form');
  const btnCloseField = document.getElementById('btn-close-field-modal');
  if (fieldForm) {
    fieldForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveFieldFromModal();
    });
  }
  if (btnCloseField) btnCloseField.addEventListener('click', closeFieldModal);

  // Formularz Zabiegu
  const treatmentForm = document.getElementById('treatment-form');
  const btnCloseTreatment = document.getElementById('btn-close-treatment-modal');
  if (treatmentForm) {
    treatmentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveTreatmentFromModal();
    });
  }
  if (btnCloseTreatment) btnCloseTreatment.addEventListener('click', closeTreatmentModal);

  // Dynamiczne podpowiedzi odmian w zależności od wpisanej uprawy
  const cropInput = document.getElementById('modal-field-crop');
  if (cropInput) {
    cropInput.addEventListener('input', () => {
      updateVarietySuggestions(cropInput.value);
    });
    cropInput.addEventListener('change', () => {
      updateVarietySuggestions(cropInput.value);
    });
  }

  // Kafelki / Chipsy filtrowania upraw w widoku Wszystkie Pola
  const cropChips = document.querySelectorAll('#field-crop-chips .chip');
  cropChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const cropKey = chip.dataset.cropFilter;
      currentFieldCropFilter = cropKey;
      renderFieldsList();
    });
  });

  // Wyszukiwarki
  const fieldSearch = document.getElementById('field-search-input');
  if (fieldSearch) fieldSearch.addEventListener('input', renderFieldsList);

  const treatmentSearch = document.getElementById('treatment-search-input');
  if (treatmentSearch) treatmentSearch.addEventListener('input', renderTreatmentsList);
}

const CROP_VARIETIES = {
  pszenica: [
    'RGT Kilimanjaro', 'Euforia', 'Formacja', 'Hondia', 'Artist', 'KWS Emil',
    'KWS Donovan', 'Symetria', 'Baryton', 'Tybalt', 'Goplana', 'Harenda', 'KWS Olympos', 'Wilejka'
  ],
  rzepak: [
    'LG Aviron', 'DK Exstorm', 'DK Exsteel', 'KWS Umberto', 'Architect', 'Bumblebee',
    'Ambassador', 'Crotora', 'Tigris', 'PT303', 'Feliciano KWS', 'Duke'
  ],
  kukurydza: [
    'Pioneer P8834', 'Pioneer P9903', 'DKC 3595', 'DKC 3939', 'KWS Gusano',
    'KWS Figaro', 'LG 31.250', 'Huligan', 'Mas 24.C', 'RGT Exxon', 'P9241'
  ],
  jeczmien_ozimy: [
    'KWS Higgins', 'Jakubus', 'KWS Kosmos', 'Zenek', 'Mirabelle', 'Melia', 'Titus', 'Zita', 'Valerie'
  ],
  jeczmien: [
    'KWS Cantton', 'RGT Planet', 'Laureate', 'Soldo', 'Eusebio', 'Farmer', 'Pilote', 'Ella'
  ],
  owies: [
    'Bingo', 'Kozak', 'Figaro', 'Reflex', 'Romulus', 'Gniady', 'Panteon', 'Nawigator'
  ]
};

function updateVarietySuggestions(cropName) {
  const datalist = document.getElementById('variety-suggestions');
  if (!datalist) return;

  const c = (cropName || '').toLowerCase();
  let varieties = [];

  if (c.includes('pszenic')) {
    varieties = CROP_VARIETIES.pszenica;
  } else if (c.includes('rzepak')) {
    varieties = CROP_VARIETIES.rzepak;
  } else if (c.includes('kukurydz')) {
    varieties = CROP_VARIETIES.kukurydza;
  } else if ((c.includes('jęczmień') || c.includes('jeczmien')) && c.includes('ozim')) {
    varieties = CROP_VARIETIES.jeczmien_ozimy;
  } else if (c.includes('jęczmień') || c.includes('jeczmien')) {
    varieties = CROP_VARIETIES.jeczmien;
  } else if (c.includes('owie') || c.includes('ows')) {
    varieties = CROP_VARIETIES.owies;
  } else {
    varieties = [...CROP_VARIETIES.pszenica, ...CROP_VARIETIES.rzepak, ...CROP_VARIETIES.kukurydza];
  }

  datalist.innerHTML = varieties.map(v => `<option value="${escapeHTML(v)}">`).join('');
}

let currentFieldCropFilter = 'all';

function setFieldCropFilter(cropKey, switchTab = true) {
  currentFieldCropFilter = cropKey;
  renderFieldsStats();
  renderFieldsList();
  if (switchTab) {
    switchFieldTab('fields-all');
  }
}

function filterFieldByCrop(f, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  const c = (f.crop || '').toLowerCase();
  if (filterKey === 'pszenica') return c.includes('pszenic');
  if (filterKey === 'rzepak') return c.includes('rzepak');
  if (filterKey === 'kukurydza') return c.includes('kukurydz');
  if (filterKey === 'jeczmien') return c.includes('jęczmień') || c.includes('jeczmien');
  if (filterKey === 'owies') return c.includes('owie') || c.includes('ows');
  return true;
}

function getCropFilterName(filterKey) {
  switch(filterKey) {
    case 'pszenica': return 'Pszenica';
    case 'rzepak': return 'Rzepak';
    case 'kukurydza': return 'Kukurydza';
    case 'jeczmien': return 'Jęczmień';
    case 'owies': return 'Owies';
    default: return 'Wszystkie';
  }
}

function getCropDefaultName(filterKey) {
  switch(filterKey) {
    case 'pszenica': return 'Pszenica';
    case 'rzepak': return 'Rzepak';
    case 'kukurydza': return 'Kukurydza';
    case 'jeczmien': return 'Jęczmień';
    case 'owies': return 'Owies';
    default: return '';
  }
}

function renderFieldsStats() {
  const statsContainer = document.getElementById('fields-stats');
  if (!statsContainer) return;

  const totalArea = fields.reduce((sum, f) => sum + (parseFloat(f.areaHa) || 0), 0).toFixed(2);
  const totalFields = fields.length;
  
  const wheatFields = fields.filter(f => (f.crop || '').toLowerCase().includes('pszenic')).length;
  const rapeFields = fields.filter(f => (f.crop || '').toLowerCase().includes('rzepak')).length;
  const cornFields = fields.filter(f => (f.crop || '').toLowerCase().includes('kukurydz')).length;
  const barleyFields = fields.filter(f => {
    const c = (f.crop || '').toLowerCase();
    return c.includes('jęczmień') || c.includes('jeczmien');
  }).length;
  const oatFields = fields.filter(f => {
    const c = (f.crop || '').toLowerCase();
    return c.includes('owie') || c.includes('ows');
  }).length;

  statsContainer.innerHTML = `
    <div class="stat-card clickable ${currentFieldCropFilter === 'all' ? 'active' : ''}" data-crop-filter="all">
      <div class="stat-card-value" style="color:#eab308;">${totalArea} ha</div>
      <div class="stat-card-label">Łączny Areał</div>
    </div>
    <div class="stat-card clickable ${currentFieldCropFilter === 'all' ? 'active' : ''}" data-crop-filter="all">
      <div class="stat-card-value">${totalFields}</div>
      <div class="stat-card-label">Wszystkie Działki</div>
    </div>
    <div class="stat-card clickable ${currentFieldCropFilter === 'pszenica' ? 'active' : ''}" data-crop-filter="pszenica">
      <div class="stat-card-value" style="color:#38bdf8;">${wheatFields}</div>
      <div class="stat-card-label">Pola z pszenicą</div>
    </div>
    <div class="stat-card clickable ${currentFieldCropFilter === 'rzepak' ? 'active' : ''}" data-crop-filter="rzepak">
      <div class="stat-card-value" style="color:#22c55e;">${rapeFields}</div>
      <div class="stat-card-label">Pola z rzepakiem</div>
    </div>
    <div class="stat-card clickable ${currentFieldCropFilter === 'kukurydza' ? 'active' : ''}" data-crop-filter="kukurydza">
      <div class="stat-card-value" style="color:#f59e0b;">${cornFields}</div>
      <div class="stat-card-label">Pola z kukurydzą</div>
    </div>
    <div class="stat-card clickable ${currentFieldCropFilter === 'jeczmien' ? 'active' : ''}" data-crop-filter="jeczmien">
      <div class="stat-card-value" style="color:#fb923c;">${barleyFields}</div>
      <div class="stat-card-label">Pola z jęczmieniem</div>
    </div>
    <div class="stat-card clickable ${currentFieldCropFilter === 'owies' ? 'active' : ''}" data-crop-filter="owies">
      <div class="stat-card-value" style="color:#2dd4bf;">${oatFields}</div>
      <div class="stat-card-label">Pola z owsem</div>
    </div>
  `;

  statsContainer.querySelectorAll('.stat-card.clickable').forEach(card => {
    card.onclick = () => {
      const filterKey = card.dataset.cropFilter;
      if (filterKey === 'all') {
        currentFieldCropFilter = 'all';
        renderFieldsStats();
        renderFieldsList();
        switchFieldTab('fields-all');
      } else {
        currentFieldCropFilter = filterKey;
        const defaultCrop = getCropDefaultName(filterKey);
        openFieldModal(null, defaultCrop);
      }
    };
  });
}

function renderFieldsList() {
  const container = document.getElementById('fields-container');
  if (!container) return;

  // Synchronizacja aktywnych kafelków / chipsów upraw
  const cropChips = document.querySelectorAll('#field-crop-chips .chip');
  cropChips.forEach(chip => {
    if (chip.dataset.cropFilter === currentFieldCropFilter) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });

  const query = (document.getElementById('field-search-input')?.value || '').toLowerCase();
  const filtered = fields.filter(f => {
    const matchesCrop = filterFieldByCrop(f, currentFieldCropFilter);
    const matchesQuery = (f.name || '').toLowerCase().includes(query) ||
                         (f.parcelNo || '').toLowerCase().includes(query) ||
                         (f.crop || '').toLowerCase().includes(query) ||
                         (f.variety || '').toLowerCase().includes(query);
    return matchesCrop && matchesQuery;
  });

  let html = '';

  // Pasek aktywnego filtru jeśli wybrano konkretną uprawę
  if (currentFieldCropFilter !== 'all') {
    html += `
      <div style="background:#1e293b; border:1px solid var(--primary); border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <span style="font-weight:800; color:#ffffff;">🌾 Filtrowanie: ${getCropFilterName(currentFieldCropFilter)}</span>
          <span style="font-size:0.8rem; color:var(--text-secondary); margin-left:6px;">(${filtered.length} działek)</span>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-reset-crop-filter" style="padding:4px 10px; font-size:0.78rem;">
          ✖️ Pokaż wszystkie
        </button>
      </div>
    `;
  }

  if (filtered.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">🌾</div>
        <h3>Brak działek ${currentFieldCropFilter !== 'all' ? `z uprawą: ${getCropFilterName(currentFieldCropFilter)}` : 'w rejestrze'}</h3>
        <p>Przejdź do zakładki <strong>📊 Menu</strong>, aby dodać nowe pole lub wybrać inną uprawę.</p>
      </div>
    `;
    container.innerHTML = html;
    
    const resetBtn = document.getElementById('btn-reset-crop-filter');
    if (resetBtn) resetBtn.onclick = () => setFieldCropFilter('all', false);
    return;
  }

  html += filtered.map(field => {
    const fieldTreatments = treatments.filter(t => t.fieldId === field.id);
    const sortedTreatments = [...fieldTreatments].sort((a,b) => new Date(b.date) - new Date(a.date));

    // Policz ile zabiegów w poszczególnych latach
    const yearsCounts = {};
    fieldTreatments.forEach(t => {
      const yr = new Date(t.date + 'T00:00:00').getFullYear();
      yearsCounts[yr] = (yearsCounts[yr] || 0) + 1;
    });
    const yearsSummary = Object.keys(yearsCounts).sort((a,b)=>b-a).map(yr => `${yr}: ${yearsCounts[yr]}`).join(', ');

    return `
      <div class="sow-card" id="field-card-${field.id}">
        <div class="sow-card-header">
          <div>
            <div class="sow-name">🌾 ${escapeHTML(field.name)}</div>
            <div class="sow-subtitle">📐 <strong>${parseFloat(field.areaHa).toFixed(2)} ha</strong> ${field.parcelNo ? `| ${escapeHTML(field.parcelNo)}` : ''}</div>
          </div>
          <span class="badge" style="background:#2a2415; color:#eab308; border:1px solid #ca8a04;">
            ${escapeHTML(field.crop || 'Brak uprawy')}
          </span>
        </div>

        <div style="font-size:0.85rem; margin:8px 0; color:var(--text-secondary);">
          <div>🌱 Odmiana: <strong>${escapeHTML(field.variety || 'Nie podano')}</strong></div>
          ${field.sowingDate ? `<div>📅 Siew: ${new Date(field.sowingDate).toLocaleDateString('pl-PL')}</div>` : ''}
          ${field.notes ? `<div style="margin-top:2px;">📝 <em>${escapeHTML(field.notes)}</em></div>` : ''}
        </div>

        <!-- ZINTEGROWANA LISTA OPRYSKÓW TEGO POLA -->
        <div style="background:#0f172a; border-radius:8px; padding:10px 12px; margin:10px 0; border:1px solid #1e293b;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div style="font-size:0.75rem; font-weight:800; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">
              🧪 Wykonane opryski (${fieldTreatments.length}):
            </div>
            ${yearsSummary ? `<div style="font-size:0.72rem; color:#38bdf8;">${yearsSummary}</div>` : ''}
          </div>

          ${sortedTreatments.length === 0 ? `
            <div style="font-size:0.78rem; color:var(--text-secondary); padding:2px 0;">
              Brak wpisanych oprysków na to pole.
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${sortedTreatments.slice(0, 3).map(t => {
                let badgeColor = '#38bdf8';
                if (t.treatmentType === 'Herbicyd') badgeColor = '#22c55e';
                if (t.treatmentType === 'Fungicyd') badgeColor = '#eab308';
                if (t.treatmentType === 'Insektycyd') badgeColor = '#ef4444';
                return `
                  <div style="font-size:0.8rem; display:flex; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <span>
                      <strong style="color:${badgeColor};">[${escapeHTML(t.treatmentType)}]</strong> 
                      <span style="color:#ffffff;">${escapeHTML(t.product)}</span>
                      ${t.dosePerHa ? `<small style="color:var(--text-secondary);">(${escapeHTML(t.dosePerHa)})</small>` : ''}
                    </span>
                    <span style="font-size:0.75rem; color:var(--text-secondary);">${new Date(t.date).toLocaleDateString('pl-PL')}</span>
                  </div>
                `;
              }).join('')}
            </div>
            ${sortedTreatments.length > 3 ? `
              <div style="font-size:0.75rem; color:#38bdf8; margin-top:6px; cursor:pointer;" onclick="openFieldHistoryModal('${field.id}')">
                ➔ Zobacz wszystkie ${sortedTreatments.length} zabiegów w historii pola
              </div>
            ` : ''}
          `}
        </div>

        <div class="sow-actions">
          <button class="btn btn-sm btn-primary btn-add-treat-for-field" data-id="${field.id}" style="font-size:0.85rem; padding:8px 12px; font-weight:700;">
            🧪 Wpisz Oprysk
          </button>
          <button class="btn btn-sm btn-secondary btn-history-for-field" data-id="${field.id}" style="font-size:0.82rem; padding:8px 10px;">
            📜 Cała Historia
          </button>
          <button class="icon-btn btn-edit-field" data-id="${field.id}" title="Edytuj">✏️</button>
          <button class="icon-btn btn-delete-field" data-id="${field.id}" title="Usuń" style="color:var(--accent-red)">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  const resetBtn = document.getElementById('btn-reset-crop-filter');
  if (resetBtn) resetBtn.onclick = () => setFieldCropFilter('all', false);

  filtered.forEach(field => {
    const card = document.getElementById(`field-card-${field.id}`);
    if (!card) return;

    const btnHist = card.querySelector('.btn-history-for-field');
    const btnAddT = card.querySelector('.btn-add-treat-for-field');
    const btnEdit = card.querySelector('.btn-edit-field');
    const btnDelete = card.querySelector('.btn-delete-field');

    if (btnHist) btnHist.onclick = () => openFieldHistoryModal(field.id);
    if (btnAddT) btnAddT.onclick = () => openTreatmentModal(null, field.id);
    if (btnEdit) btnEdit.onclick = () => openFieldModal(field);
    if (btnDelete) btnDelete.onclick = () => deleteField(field.id);
  });
}

function renderTreatmentsList() {
  const container = document.getElementById('treatments-container');
  if (!container) return;

  const query = (document.getElementById('treatment-search-input')?.value || '').toLowerCase();
  const sorted = [...treatments].sort((a,b) => new Date(b.date) - new Date(a.date));
  const filtered = sorted.filter(t => 
    (t.fieldName || '').toLowerCase().includes(query) ||
    (t.product || '').toLowerCase().includes(query) ||
    (t.treatmentType || '').toLowerCase().includes(query) ||
    (t.date || '').includes(query)
  );

  let html = '';

  // SEKJCA: TWOJE POLA - SZYBKIE WPISYWANIE OPRYSKU
  if (fields.length > 0) {
    html += `
      <div style="margin-bottom: 18px;">
        <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          🌾 Wybierz pole do wykonania oprysku:
        </div>
        <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
    `;

    fields.forEach(field => {
      const fieldTreatments = treatments.filter(t => t.fieldId === field.id);
      html += `
        <div class="card" style="padding: 12px 14px; margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #ffffff;">🌾 ${escapeHTML(field.name)}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary);">
              ${parseFloat(field.areaHa).toFixed(2)} ha • <strong>${escapeHTML(field.crop || 'Brak uprawy')}</strong> (${fieldTreatments.length} zabiegów)
            </div>
          </div>
          <button class="btn btn-primary btn-sm btn-quick-spray-field" data-field-id="${field.id}" style="padding: 8px 12px; font-size: 0.82rem; white-space: nowrap;">
            <span>🧪 Wpisz Oprysk</span>
          </button>
        </div>
      `;
    });

    html += `
        </div>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        📋 Historia wykonanych zabiegów:
      </div>
    `;
  }

  // HISTORIA ZABIEGÓW
  if (filtered.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-icon">🧪</div>
        <h3>Brak wykonanych zabiegów</h3>
        <p>Gdy wykonasz oprysk lub nawożenie, kliknij <strong>Wpisz Oprysk</strong> przy danym polu!</p>
      </div>
    `;
    container.innerHTML = html;
  } else {
    html += filtered.map(t => {
      const dateFormatted = new Date(t.date + 'T00:00:00').toLocaleDateString('pl-PL', { day:'numeric', month:'short', year:'numeric' });

      let typeColor = '#38bdf8';
      if (t.treatmentType === 'Herbicyd') typeColor = '#22c55e';
      if (t.treatmentType === 'Fungicyd') typeColor = '#eab308';
      if (t.treatmentType === 'Insektycyd') typeColor = '#ef4444';
      if (t.treatmentType.includes('Nawóz')) typeColor = '#a855f7';

      return `
        <div class="sow-card" id="treatment-card-${t.id}">
          <div class="sow-card-header">
            <div>
              <div class="sow-name">🧪 ${escapeHTML(t.product)}</div>
              <div class="sow-subtitle">🌾 Pole: <strong>${escapeHTML(t.fieldName)}</strong> | 📅 ${dateFormatted}</div>
            </div>
            <span class="badge" style="background:#1e293b; color:${typeColor}; border:1px solid ${typeColor};">
              ${escapeHTML(t.treatmentType)}
            </span>
          </div>

          <div style="font-size:0.85rem; margin:8px 0; color:var(--text-secondary);">
            <div>💧 Dawka: <strong>${escapeHTML(t.dosePerHa || 'Nie podano')}</strong> ${t.waterVolume ? `| Woda: ${escapeHTML(t.waterVolume)} l/ha` : ''}</div>
            ${t.reasonTarget ? `<div>🎯 Zwalczany agrofag / Cel: <strong>${escapeHTML(t.reasonTarget)}</strong></div>` : ''}
            ${t.notes ? `<div style="margin-top:4px;">📝 Warunki: <em>${escapeHTML(t.notes)}</em></div>` : ''}
          </div>

          <div class="sow-actions">
            <button class="icon-btn btn-edit-treatment" data-id="${t.id}" title="Edytuj">✏️</button>
            <button class="icon-btn btn-delete-treatment" data-id="${t.id}" title="Usuń" style="color:var(--accent-red)">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  // Podpięcie przycisków szybkiego oprysku
  container.querySelectorAll('.btn-quick-spray-field').forEach(btn => {
    btn.onclick = () => {
      const fId = btn.dataset.fieldId;
      openTreatmentModal(null, fId);
    };
  });

  // Podpięcie edycji i usuwania
  filtered.forEach(t => {
    const card = document.getElementById(`treatment-card-${t.id}`);
    if (!card) return;

    const btnEdit = card.querySelector('.btn-edit-treatment');
    const btnDelete = card.querySelector('.btn-delete-treatment');

    if (btnEdit) btnEdit.onclick = () => openTreatmentModal(t);
    if (btnDelete) btnDelete.onclick = () => deleteTreatment(t.id);
  });
}

function openFieldModal(fieldData = null, prefillCrop = null) {
  const modal = document.getElementById('field-modal');
  const title = document.getElementById('field-modal-title');
  const form = document.getElementById('field-form');
  if (!modal || !form) return;

  form.reset();

  if (fieldData && fieldData.id) {
    title.textContent = 'Edytuj Pole / Działkę';
    document.getElementById('modal-field-id').value = fieldData.id;
    document.getElementById('modal-field-name').value = fieldData.name || '';
    document.getElementById('modal-field-area').value = fieldData.areaHa || '';
    document.getElementById('modal-field-parcel').value = fieldData.parcelNo || '';
    document.getElementById('modal-field-crop').value = fieldData.crop || '';
    document.getElementById('modal-field-variety').value = fieldData.variety || '';
    document.getElementById('modal-field-sowing-date').value = fieldData.sowingDate || '';
    document.getElementById('modal-field-sprays').value = fieldData.sprays || '';
    document.getElementById('modal-field-notes').value = fieldData.notes || '';
  } else {
    const cropToUse = prefillCrop !== null ? prefillCrop : (currentFieldCropFilter !== 'all' ? getCropDefaultName(currentFieldCropFilter) : '');
    title.textContent = cropToUse 
      ? `Dodaj Pole (${cropToUse})`
      : 'Dodaj Nowe Pole / Działkę';
    document.getElementById('modal-field-id').value = '';
    document.getElementById('modal-field-sowing-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('modal-field-sprays').value = '';
    document.getElementById('modal-field-crop').value = cropToUse || '';
  }

  // Zaktualizuj listę podpowiedzi odmian dla aktualnej uprawy
  const currentCropVal = document.getElementById('modal-field-crop').value;
  updateVarietySuggestions(currentCropVal);

  modal.classList.add('active');
}

function closeFieldModal() {
  const modal = document.getElementById('field-modal');
  if (modal) modal.classList.remove('active');
}

function saveFieldFromModal() {
  const id = document.getElementById('modal-field-id').value;
  const name = document.getElementById('modal-field-name').value.trim();
  const areaHa = parseFloat(document.getElementById('modal-field-area').value) || 0;
  const parcelNo = document.getElementById('modal-field-parcel').value.trim();
  const crop = document.getElementById('modal-field-crop').value.trim();
  const variety = document.getElementById('modal-field-variety').value.trim();
  const sowingDate = document.getElementById('modal-field-sowing-date').value;
  const sprays = document.getElementById('modal-field-sprays').value.trim();
  const notes = document.getElementById('modal-field-notes').value.trim();

  if (!name || areaHa <= 0) {
    showToast('Podaj nazwę pola i poprawną powierzchnię w ha!');
    return;
  }

  if (id) {
    const idx = fields.findIndex(f => f.id === id);
    if (idx !== -1) {
      const oldSprays = fields[idx].sprays || '';
      fields[idx] = { ...fields[idx], name, areaHa, parcelNo, crop, variety, sowingDate, sprays, notes };
      
      // Jeśli dopisano oprysk, dodaj go jako nowy wpis zabiegu
      if (sprays && sprays !== oldSprays) {
        treatments.push({
          id: 'treatment_' + Date.now(),
          fieldId: id,
          fieldName: name,
          date: sowingDate || new Date().toISOString().split('T')[0],
          treatmentType: 'Oprysk',
          product: sprays,
          dosePerHa: '',
          waterVolume: 200,
          reasonTarget: 'Zabieg polowy',
          notes: '',
          createdAt: new Date().toISOString()
        });
        saveTreatmentsData();
      }
      showToast('Zaktualizowano dane pola!');
    }
  } else {
    const fieldId = 'field_' + Date.now();
    const newField = {
      id: fieldId,
      name,
      areaHa,
      parcelNo,
      crop,
      variety,
      sowingDate,
      sprays,
      notes,
      createdAt: new Date().toISOString()
    };
    fields.push(newField);

    // Jeśli podano oprysk przy tworzeniu pola, od razu zapisz go do zabiegów
    if (sprays) {
      treatments.push({
        id: 'treatment_' + Date.now(),
        fieldId: fieldId,
        fieldName: name,
        date: sowingDate || new Date().toISOString().split('T')[0],
        treatmentType: 'Oprysk',
        product: sprays,
        dosePerHa: '',
        waterVolume: 200,
        reasonTarget: 'Zabieg polowy',
        notes: '',
        createdAt: new Date().toISOString()
      });
      saveTreatmentsData();
    }

    showToast('Dodano pole do rejestru!');
  }

  saveFieldsData();
  closeFieldModal();
  renderFieldsStats();
  renderFieldsList();
  switchFieldTab('fields-all');
}

function deleteField(id) {
  if (confirm('Czy na pewno chcesz usunąć to pole z rejestru?')) {
    fields = fields.filter(f => f.id !== id);
    saveFieldsData();
    showToast('Usunięto pole.');
  }
}

function openTreatmentModal(treatmentData = null, preselectedFieldId = null) {
  const modal = document.getElementById('treatment-modal');
  const title = document.getElementById('treatment-modal-title');
  const form = document.getElementById('treatment-form');
  const fieldSelect = document.getElementById('modal-treatment-field');
  if (!modal || !form || !fieldSelect) return;

  if (fields.length === 0) {
    showToast('Najpierw dodaj przynajmniej jedno pole!');
    openFieldModal();
    return;
  }

  form.reset();

  fieldSelect.innerHTML = fields.map(f => `
    <option value="${f.id}" data-name="${escapeHTML(f.name)}">
      🌾 ${escapeHTML(f.name)} (${parseFloat(f.areaHa).toFixed(2)} ha - ${escapeHTML(f.crop || 'Brak uprawy')})
    </option>
  `).join('');

  if (treatmentData && treatmentData.id) {
    title.textContent = 'Edytuj Zabieg / Oprysk';
    document.getElementById('modal-treatment-id').value = treatmentData.id;
    fieldSelect.value = treatmentData.fieldId || fields[0].id;
    document.getElementById('modal-treatment-date').value = treatmentData.date || '';
    document.getElementById('modal-treatment-type').value = treatmentData.treatmentType || 'Herbicyd';
    document.getElementById('modal-treatment-product').value = treatmentData.product || '';
    document.getElementById('modal-treatment-dose').value = treatmentData.dosePerHa || '';
    document.getElementById('modal-treatment-water').value = treatmentData.waterVolume || '';
    document.getElementById('modal-treatment-reason').value = treatmentData.reasonTarget || '';
    document.getElementById('modal-treatment-notes').value = treatmentData.notes || '';
  } else {
    title.textContent = 'Zapisz Nowy Zabieg / Oprysk';
    document.getElementById('modal-treatment-id').value = '';
    document.getElementById('modal-treatment-date').value = new Date().toISOString().split('T')[0];
    if (preselectedFieldId) fieldSelect.value = preselectedFieldId;
  }

  modal.classList.add('active');
}

function closeTreatmentModal() {
  const modal = document.getElementById('treatment-modal');
  if (modal) modal.classList.remove('active');
}

function saveTreatmentFromModal() {
  const id = document.getElementById('modal-treatment-id').value;
  const fieldSelect = document.getElementById('modal-treatment-field');
  const fieldId = fieldSelect.value;
  const selectedOption = fieldSelect.options[fieldSelect.selectedIndex];
  const fieldName = selectedOption ? selectedOption.dataset.name : 'Pole';

  const date = document.getElementById('modal-treatment-date').value;
  const treatmentType = document.getElementById('modal-treatment-type').value;
  const product = document.getElementById('modal-treatment-product').value.trim();
  const dosePerHa = document.getElementById('modal-treatment-dose').value.trim();
  const waterVolume = parseInt(document.getElementById('modal-treatment-water').value) || 0;
  const reasonTarget = document.getElementById('modal-treatment-reason').value.trim();
  const notes = document.getElementById('modal-treatment-notes').value.trim();

  if (!product || !date) {
    showToast('Podaj nazwę środka/preparatu i datę zabiegu!');
    return;
  }

  if (id) {
    const idx = treatments.findIndex(t => t.id === id);
    if (idx !== -1) {
      treatments[idx] = { ...treatments[idx], fieldId, fieldName, date, treatmentType, product, dosePerHa, waterVolume, reasonTarget, notes };
      showToast('Zaktualizowano zabieg!');
    }
  } else {
    const newT = {
      id: 'treatment_' + Date.now(),
      fieldId,
      fieldName,
      date,
      treatmentType,
      product,
      dosePerHa,
      waterVolume,
      reasonTarget,
      notes,
      createdAt: new Date().toISOString()
    };
    treatments.push(newT);
    showToast('Zapisano zabieg w ewidencji!');
  }

  saveTreatmentsData();
  closeTreatmentModal();
}

function deleteTreatment(id) {
  if (confirm('Czy na pewno chcesz usunąć ten wpis o zabiegu?')) {
    treatments = treatments.filter(t => t.id !== id);
    saveTreatmentsData();
    showToast('Usunięto wpis o zabiegu.');
  }
}

/* ==========================================================================
   KSIĘGA POLOWA - WIELOLETNIA HISTORIA ZABIEGÓW NA POLU (4+ LATA)
   ========================================================================== */

let activeHistoryFieldId = null;

function openFieldHistoryModal(fieldId) {
  activeHistoryFieldId = fieldId;
  const field = fields.find(f => f.id === fieldId);
  if (!field) return;

  const modal = document.getElementById('field-history-modal');
  const nameEl = document.getElementById('history-modal-field-name');
  const infoEl = document.getElementById('history-modal-field-info');
  const container = document.getElementById('history-timeline-container');
  const btnClose = document.getElementById('btn-close-history-modal');
  const btnAdd = document.getElementById('btn-history-add-treatment');

  if (!modal || !nameEl || !infoEl || !container) return;

  nameEl.innerHTML = `🌾 Historia Pola: <strong>${escapeHTML(field.name)}</strong>`;
  infoEl.innerHTML = `📐 Powierzchnia: <strong>${parseFloat(field.areaHa).toFixed(2)} ha</strong> ${field.parcelNo ? `| ${escapeHTML(field.parcelNo)}` : ''} | Uprawa: <strong>${escapeHTML(field.crop || 'Brak')}</strong> (${escapeHTML(field.variety || '')})`;

  if (btnClose) btnClose.onclick = closeFieldHistoryModal;
  if (btnAdd) {
    btnAdd.onclick = () => {
      closeFieldHistoryModal();
      openTreatmentModal(null, field.id);
    };
  }

  // Pobierz wszystkie zabiegi dla tego pola
  const fieldTreatments = treatments.filter(t => t.fieldId === field.id);
  const sorted = [...fieldTreatments].sort((a,b) => new Date(b.date) - new Date(a.date));

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 24px 10px;">
        <div class="empty-icon">📜</div>
        <h4>Brak wpisów w historii tego pola</h4>
        <p>Możesz zapisać zabiegi z tego roku oraz z poprzednich lat (np. 2023, 2024, 2025, 2026)!</p>
      </div>
    `;
    modal.classList.add('active');
    return;
  }

  // Pogrupuj zabiegi po latach (np. 2026, 2025, 2024, 2023...)
  const groupsByYear = {};
  sorted.forEach(t => {
    const yr = new Date(t.date + 'T00:00:00').getFullYear() || 'Inne';
    if (!groupsByYear[yr]) groupsByYear[yr] = [];
    groupsByYear[yr].push(t);
  });

  const years = Object.keys(groupsByYear).sort((a,b) => b - a);

  let html = '';
  years.forEach(year => {
    const list = groupsByYear[year];
    html += `
      <div style="margin-bottom: 20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1e293b; padding:8px 12px; border-radius:8px; border-left:4px solid #ca8a04; margin-bottom:10px;">
          <div style="font-weight:800; font-size:1rem; color:#eab308;">📅 SEZON / ROK ${year}</div>
          <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:700;">Zabiegów: ${list.length}</div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
    `;

    list.forEach(t => {
      const dateFormatted = new Date(t.date + 'T00:00:00').toLocaleDateString('pl-PL', { day:'numeric', month:'long', year:'numeric' });

      let typeColor = '#38bdf8';
      if (t.treatmentType === 'Herbicyd') typeColor = '#22c55e';
      if (t.treatmentType === 'Fungicyd') typeColor = '#eab308';
      if (t.treatmentType === 'Insektycyd') typeColor = '#ef4444';
      if (t.treatmentType.includes('Nawóz')) typeColor = '#a855f7';

      html += `
        <div class="card" style="padding: 12px 14px; margin-bottom: 0; background: var(--bg-card); border: 1px solid var(--border-color);">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
            <div style="font-weight:800; font-size:0.95rem; color:#ffffff;">🧪 ${escapeHTML(t.product)}</div>
            <span class="badge" style="background:#1e293b; color:${typeColor}; border:1px solid ${typeColor}; font-size:0.75rem;">
              ${escapeHTML(t.treatmentType)}
            </span>
          </div>

          <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">
            <div>📅 Data: <strong>${dateFormatted}</strong> | 💧 Dawka: <strong>${escapeHTML(t.dosePerHa || '–')}</strong> ${t.waterVolume ? `(woda: ${t.waterVolume} l/ha)` : ''}</div>
            ${t.reasonTarget ? `<div>🎯 Cel: <strong>${escapeHTML(t.reasonTarget)}</strong></div>` : ''}
            ${t.notes ? `<div>📝 Uwagi: <em>${escapeHTML(t.notes)}</em></div>` : ''}
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
            <button class="icon-btn btn-hist-edit" data-id="${t.id}" title="Edytuj" style="padding:4px 8px; font-size:0.85rem;">✏️</button>
            <button class="icon-btn btn-hist-del" data-id="${t.id}" title="Usuń" style="padding:4px 8px; font-size:0.85rem; color:var(--accent-red);">🗑️</button>
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Podepnij akcje edycji i usuwania wewnątrz modalu historii
  container.querySelectorAll('.btn-hist-edit').forEach(btn => {
    btn.onclick = () => {
      const tId = btn.dataset.id;
      const treatment = treatments.find(t => t.id === tId);
      if (treatment) {
        closeFieldHistoryModal();
        openTreatmentModal(treatment);
      }
    };
  });

  container.querySelectorAll('.btn-hist-del').forEach(btn => {
    btn.onclick = () => {
      const tId = btn.dataset.id;
      deleteTreatment(tId);
      openFieldHistoryModal(activeHistoryFieldId);
    };
  });

  modal.classList.add('active');
}

function closeFieldHistoryModal() {
  const modal = document.getElementById('field-history-modal');
  if (modal) modal.classList.remove('active');
  activeHistoryFieldId = null;
}



