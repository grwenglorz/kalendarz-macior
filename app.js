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
  initFamilyCloudSync();
  setupNavigation();
  setupCalculatorListeners();
  setupModalListeners();
  setupDataSyncListeners();
  registerServiceWorker();
  initYearCalendar();

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

  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('prosnosc_swin_theme', next);
      updateThemeIcon(next);
    });
  }
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('btn-toggle-theme');
  if (btn) {
    btn.innerHTML = theme === 'light' ? '🌙' : '☀️';
  }
}

function setupNavigation() {
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
    pushSowsToCloud();
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
      pullSowsFromCloud(true);
    });
  }
}

function connectFamilyCloud(code, isUserInitiated = false) {
  familyCode = code;
  localStorage.setItem('prosnosc_swin_family_code', familyCode);
  updateCloudStatusBadge(true);

  if (isUserInitiated) {
    showToast(`Połączono z chmurą rodziny: ${familyCode}`);
    pushSowsToCloud();
  }

  pullSowsFromCloud();
  listenToCloudRealtime();
}

function updateCloudStatusBadge(isConnected) {
  const badge = document.getElementById('cloud-status-badge');
  const wrapper = document.getElementById('cloud-badge-wrapper');
  if (!badge) return;

  if (wrapper) wrapper.style.display = 'block';

  if (isConnected) {
    badge.innerHTML = `🟢 Chmura aktywna na żywo: <strong>${familyCode}</strong>`;
    badge.style.display = 'inline-block';
    badge.style.background = 'var(--accent-green-light)';
    badge.style.color = 'var(--accent-green)';
    badge.style.borderColor = 'rgba(42, 157, 143, 0.4)';
  } else {
    badge.innerHTML = `⚪ Chmura nieaktywna (Wpisz Kod Rodziny)`;
    badge.style.display = 'inline-block';
    badge.style.background = 'var(--bg-primary)';
    badge.style.color = 'var(--text-secondary)';
    badge.style.borderColor = 'var(--border-color)';
  }
}

async function pushSowsToCloud() {
  if (!familyCode) return;
  try {
    const cleanTopic = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const url = `https://ntfy.sh/prosnosc_swin_${cleanTopic}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sows)
    });
    console.log('Wysłano dane do chmury.');
  } catch (err) {
    console.log('Błąd wysyłania do chmury:', err);
  }
}

async function pullSowsFromCloud(showToastOnSuccess = false) {
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
          const remoteSows = JSON.parse(eventObj.message);
          if (Array.isArray(remoteSows)) {
            const cleanRemote = remoteSows.filter(s => s.id && !s.id.startsWith('sow_demo_'));
            if (JSON.stringify(cleanRemote) !== JSON.stringify(sows)) {
              sows = cleanRemote;
              saveSowsData(true);
              renderSowsList();
              renderCalendarTimeline();
              renderMenuStats();
              if (showToastOnSuccess) {
                showToast('☁️ Pobrano aktualne dane z chmury!');
              }
            } else if (showToastOnSuccess) {
              showToast('✅ Wszystkie dane są aktualne!');
            }
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
          const remoteSows = JSON.parse(data.message);
          if (Array.isArray(remoteSows)) {
            const cleanRemote = remoteSows.filter(s => s.id && !s.id.startsWith('sow_demo_'));
            if (JSON.stringify(cleanRemote) !== JSON.stringify(sows)) {
              sows = cleanRemote;
              saveSowsData(true);
              renderSowsList();
              renderCalendarTimeline();
              renderMenuStats();
              showToast('⚡ Zsynchronizowano bazę stada z drugiego urządzenia!');
            }
          }
        }
      } catch (e) {}
    };
  } catch (err) {
    console.log('Błąd SSE:', err);
  }
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
    if (currentFilter === 'pregnant') return sow.status === 'pregnant';
    if (currentFilter === 'farrowing') return sow.status === 'farrowing';
    if (currentFilter === 'done') return sow.status === 'done';
    if (currentFilter === 'due_soon') {
      const daysLeft = calculateDaysRemaining(sow.coverageDate, sow.gestationDays);
      return sow.status === 'pregnant' && daysLeft <= 7 && daysLeft >= 0;
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
    document.getElementById('modal-sow-status').value = sowData.status || 'pregnant';
    document.getElementById('modal-sow-notes').value = sowData.notes || '';
  } else {
    title.textContent = 'Nowa Maciora w Rejestrze';
    document.getElementById('modal-sow-id').value = '';
    document.getElementById('modal-sow-coverage').value = sowData?.coverageDate || new Date().toISOString().split('T')[0];
    document.getElementById('modal-sow-days').value = sowData?.gestationDays || 114;
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
  const notes = document.getElementById('modal-sow-notes').value.trim();

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
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sows, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `baza_macior_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Pobrano plik kopii zapasowej!');
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
          if (Array.isArray(imported)) {
            sows = imported.filter(s => s.id && !s.id.startsWith('sow_demo_'));
            saveSowsData();
            renderSowsList();
            renderCalendarTimeline();
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
      let text = `🐖 *Kalkulator Prośności Świń - Podsumowanie:*\n\n`;
      
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

  // Najbliższy poród
  let nextFarrow = null;
  let nextDaysLeft = Infinity;
  sows.filter(s => s.status === 'pregnant').forEach(sow => {
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
    <div class="stat-card" style="border-color:${nextDaysLeft <= 7 ? 'var(--accent-red)' : 'var(--border-color)'};">
      <div class="stat-card-value" style="color:${nextDaysLeft <= 7 ? 'var(--accent-red)' : 'var(--primary)'};">${nextFarrow ? nextDaysLeft + 'd' : '–'}</div>
      <div class="stat-card-label">Do porodu</div>
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
