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
  loadFarmTasks();
  loadMachinesData();
  loadMachineServicesData();
  initFieldsModule();
  initMachinesModule();
  initFamilyCloudSync();
  setupNavigation();
  setupFarmTaskListeners();
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

  renderFarmDashboard();
  renderMachinesStats();
  renderMachinesList();
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
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('prosnosc_swin_theme', next);
      updateThemeIcon(next);
      showToast(next === 'dark' ? '🌙 Tryb Czarno-Jasnozielony' : '☀️ Tryb Biało-Jasnozielony');
    });
  });
}

function updateThemeIcon(theme) {
  const themeBtns = document.querySelectorAll('.btn-toggle-theme-global');
  themeBtns.forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('title', theme === 'dark' ? 'Włącz tryb jasny' : 'Włącz tryb ciemny');
  });
}

let fields = [];
let treatments = [];
let customCrops = [];
let deletedBaseCrops = [];
let farmTasks = [];
let machines = [];
let machineServices = [];
let currentMachineFilter = 'all';

function loadMachinesData() {
  const saved = localStorage.getItem('prosnosc_swin_machines');
  if (saved) {
    try {
      machines = JSON.parse(saved);
    } catch (e) {
      machines = [];
    }
  } else {
    // Domyślne przykładowe maszyny przy pierwszym uruchomieniu
    machines = [
      {
        id: 'mach_1',
        name: 'John Deere 6120M',
        type: 'Ciągnik',
        regNo: 'SR 4892A',
        hours: 3450,
        inspectionDate: getOffsetDateString(45),
        lastOilHours: 3300,
        oilInterval: 250,
        notes: 'Główny ciągnik polowy',
        createdAt: new Date().toISOString()
      },
      {
        id: 'mach_2',
        name: 'Ursus C-360',
        type: 'Ciągnik',
        regNo: 'SR 1102',
        hours: 6820,
        inspectionDate: getOffsetDateString(12),
        lastOilHours: 6600,
        oilInterval: 250,
        notes: 'Do prac gospodarczych i ładowacza',
        createdAt: new Date().toISOString()
      }
    ];
    saveMachinesData(true);
  }
}

function saveMachinesData(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_machines', JSON.stringify(machines));
  if (!skipCloudPush && familyCode) {
    pushFarmDataToCloud();
  }
  renderFarmDashboard();
}

function loadMachineServicesData() {
  const saved = localStorage.getItem('prosnosc_swin_machine_services');
  if (saved) {
    try {
      machineServices = JSON.parse(saved);
    } catch (e) {
      machineServices = [];
    }
  } else {
    // Przykładowe wpisy serwisowe
    machineServices = [
      {
        id: 'serv_1',
        machineId: 'mach_1',
        serviceType: 'Wymiana oleju i filtrów',
        date: getOffsetDateString(-60),
        hours: 3300,
        cost: 650,
        performedBy: 'Samodzielnie',
        desc: 'Olej John Deere Plus-50 II 15W40, filtr oleju i paliwa',
        createdAt: new Date().toISOString()
      },
      {
        id: 'serv_2',
        machineId: 'mach_2',
        serviceType: 'Naprawa / Awaria',
        date: getOffsetDateString(-25),
        hours: 6790,
        cost: 320,
        performedBy: 'Warsztat',
        desc: 'Wymiana pompy wody, nowy pasek klinowy',
        createdAt: new Date().toISOString()
      }
    ];
    saveMachineServicesData(true);
  }
}

function saveMachineServicesData(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_machine_services', JSON.stringify(machineServices));
  if (!skipCloudPush && familyCode) {
    pushFarmDataToCloud();
  }
  renderFarmDashboard();
}

function loadFarmTasks() {
  const saved = localStorage.getItem('prosnosc_swin_farm_tasks');
  if (saved) {
    try {
      farmTasks = JSON.parse(saved);
    } catch (e) {
      farmTasks = [];
    }
  } else {
    farmTasks = [
      { id: 'task_1', title: 'Sprawdzenie maciory nr 12', due: 'Jutro', priority: 'urgent', icon: '📅' },
      { id: 'task_2', title: 'Przegląd ciągnika', due: 'Za 3 dni', priority: 'planned', icon: '🔧' }
    ];
    saveFarmTasks(true);
  }
}

function saveFarmTasks(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_farm_tasks', JSON.stringify(farmTasks));
  if (!skipCloudPush && familyCode) {
    pushFarmDataToCloud();
  }
  renderFarmDashboard();
}

function setupFarmTaskListeners() {
  const modal = document.getElementById('farm-task-modal');
  const btnClose = document.getElementById('btn-close-task-modal');
  const form = document.getElementById('farm-task-form');

  if (btnClose && modal) {
    btnClose.onclick = () => modal.classList.remove('active');
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('active');
    };
  }

  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('task-title').value.trim();
      const due = document.getElementById('task-due').value.trim();
      const priority = document.getElementById('task-priority').value;
      const icon = document.getElementById('task-icon').value;

      if (!title) return;

      const newTask = {
        id: 'task_' + Date.now(),
        title,
        due,
        priority,
        icon,
        createdAt: new Date().toISOString()
      };

      farmTasks.unshift(newTask);
      saveFarmTasks();
      form.reset();
      if (modal) modal.classList.remove('active');
      showToast('✅ Dodano zadanie do Pulpitu Gospodarstwa!');
    };
  }
}

function openFarmTaskModal() {
  const modal = document.getElementById('farm-task-modal');
  if (modal) {
    const form = document.getElementById('farm-task-form');
    if (form) form.reset();
    modal.classList.add('active');
  }
}

function deleteFarmTask(taskId) {
  farmTasks = farmTasks.filter(t => t.id !== taskId);
  saveFarmTasks();
  showToast('Usunięto zadanie.');
}

function toggleFarmTask(taskId) {
  const task = farmTasks.find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    saveFarmTasks();
    showToast(task.completed ? '🎉 Oznaczono zadanie jako zrobione!' : 'Przywrócono zadanie.');
  }
}

function renderFarmDashboard() {
  const container = document.getElementById('farm-dashboard-container');
  if (!container) return;

  const now = new Date();
  const days = ['NIEDZIELA', 'PONIEDZIAŁEK', 'WTOREK', 'ŚRODA', 'CZWARTEK', 'PIĄTEK', 'SOBOTA'];
  const months = ['STYCZNIA', 'LUTEGO', 'MARCA', 'KWIETNIA', 'MAJA', 'CZERWCA', 'LIPCA', 'SIERPNIA', 'WRZEŚNIA', 'PAŹDZIERNIKA', 'LISTOPADA', 'GRUDNIA'];
  const dateStr = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;

  // 1. Liczba świń
  const totalSows = sows.length;

  // 2. Powierzchnia pól
  let totalArea = 0;
  if (Array.isArray(fields)) {
    totalArea = fields.reduce((sum, f) => sum + (parseFloat(f.areaHa) || 0), 0);
  }
  const areaFormatted = totalArea > 0 ? (totalArea.toFixed(2).replace(/\.00$/, '')) : '0';

  // 3. Najbliższy poród
  let closestSow = null;
  let minDays = Infinity;
  sows.filter(s => s.status === 'pregnant' || s.status === 'postawiona' || s.status === 'farrowing').forEach(s => {
    if (!s.coverageDate) return;
    const d = calculateDaysRemaining(s.coverageDate, s.gestationDays);
    if (d >= 0 && d < minDays) {
      minDays = d;
      closestSow = s;
    }
  });

  let nearestFarrowValue = '–';
  let nearestFarrowSub = 'Brak w najbliższych dniach';
  if (closestSow) {
    nearestFarrowValue = minDays === 0 ? 'Dzisiaj!' : `${minDays} dni`;
    nearestFarrowSub = `${escapeHTML(closestSow.name)}${closestSow.pen ? ` (${escapeHTML(closestSow.pen)})` : ''}`;
  }

  // 4. Zadania automatyczne z rejestru macior (wyproszenia do 7 dni)
  const autoTasks = [];
  sows.filter(s => s.status === 'pregnant' || s.status === 'postawiona' || s.status === 'farrowing').forEach(s => {
    if (!s.coverageDate) return;
    const d = calculateDaysRemaining(s.coverageDate, s.gestationDays);
    if (d >= 0 && d <= 7) {
      autoTasks.push({
        id: 'auto_sow_' + s.id,
        isAuto: true,
        sowId: s.id,
        icon: '🐖',
        title: `Poród maciory: ${s.name}${s.pen ? ` (Kojec ${s.pen})` : ''}`,
        due: d === 0 ? 'Dzisiaj!' : (d === 1 ? 'Jutro' : `Za ${d} dni`),
        priority: d <= 3 ? 'urgent' : 'planned',
        days: d
      });
    }
  });
  // Auto zadania dla maszyn (przeglądy techniczne i wymiany oleju)
  if (Array.isArray(machines)) {
    machines.forEach(m => {
      if (m.inspectionDate) {
        const inspDate = new Date(m.inspectionDate + 'T00:00:00');
        const today = new Date();
        today.setHours(0,0,0,0);
        const daysLeft = Math.ceil((inspDate - today) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 30) {
          autoTasks.push({
            id: 'auto_mach_insp_' + m.id,
            isAuto: true,
            isMachine: true,
            machineId: m.id,
            icon: '🚜',
            title: `Przegląd techniczny: ${m.name}${m.regNo ? ` (${m.regNo})` : ''}`,
            due: daysLeft < 0 ? `Po terminie (${Math.abs(daysLeft)} dni temu)!` : (daysLeft === 0 ? 'Dzisiaj!' : `Za ${daysLeft} dni`),
            priority: daysLeft <= 7 ? 'urgent' : 'planned',
            days: daysLeft
          });
        }
      }
      if (m.hours != null && m.lastOilHours != null && m.oilInterval) {
        const nextOil = (parseInt(m.lastOilHours) || 0) + (parseInt(m.oilInterval) || 250);
        const remHours = nextOil - (parseInt(m.hours) || 0);
        if (remHours <= 20) {
          autoTasks.push({
            id: 'auto_mach_oil_' + m.id,
            isAuto: true,
            isMachine: true,
            machineId: m.id,
            icon: '🛢️',
            title: `Wymiana oleju: ${m.name}`,
            due: remHours <= 0 ? `Pilne! Przekroczono o ${Math.abs(remHours)} Mth` : `Za ${remHours} Mth`,
            priority: remHours <= 10 ? 'urgent' : 'planned',
            days: remHours <= 0 ? -1 : 5
          });
        }
      }
    });
  }

  autoTasks.sort((a, b) => a.days - b.days);

  // Połącz automatyczne zadania i zadania własne (nieukończone)
  const activeCustomTasks = farmTasks.filter(t => !t.completed);
  const allTasks = [...autoTasks, ...activeCustomTasks];
  const urgentCount = allTasks.filter(t => t.priority === 'urgent' || t.due === 'Dzisiaj!' || t.due === 'Jutro').length;

  const isOnline = Boolean(familyCode);
  const onlineBadgeHtml = isOnline
    ? `<span class="dashboard-online-badge">ONLINE</span>`
    : `<span class="dashboard-online-badge offline">LOKALNIE</span>`;

  container.innerHTML = `
    <div class="farm-dashboard">
      <div class="dashboard-top">
        <div class="dashboard-title-group">
          <h2>GOSPODARSTWO</h2>
          <div class="dashboard-date">${dateStr}</div>
        </div>
        <div>
          ${onlineBadgeHtml}
        </div>
      </div>

      <!-- SIATKA 4 KAFELKÓW (ZGODNIE ZE ZDJĘCIEM) -->
      <div class="dashboard-grid">
        <!-- 1. Liczba świń -->
        <div class="dashboard-stat-box" id="dash-stat-pigs" title="Przejdź do rejestru świń">
          <div class="dashboard-stat-label">Liczba świń</div>
          <div class="dashboard-stat-value">${totalSows}</div>
          <div class="dashboard-stat-sub">Wszystkie grupy</div>
        </div>

        <!-- 2. Powierzchnia pól -->
        <div class="dashboard-stat-box" id="dash-stat-fields" title="Przejdź do modułu pól">
          <div class="dashboard-stat-label">Powierzchnia pól</div>
          <div class="dashboard-stat-value">${areaFormatted} ha</div>
          <div class="dashboard-stat-sub">${fields.length} ${fields.length === 1 ? 'działka' : (fields.length >= 2 && fields.length <= 4 ? 'działki' : 'działek')}</div>
        </div>

        <!-- 3. Zadania na dziś -->
        <div class="dashboard-stat-box" id="dash-stat-tasks" title="Zobacz zadania poniżej">
          <div class="dashboard-stat-label">Zadania na dziś</div>
          <div class="dashboard-stat-value" style="color:var(--accent-gold);">${urgentCount}</div>
          <div class="dashboard-stat-sub" style="color:var(--accent-gold);">Do wykonania</div>
        </div>

        <!-- 4. Najbliższy poród -->
        <div class="dashboard-stat-box" id="dash-stat-farrow" title="Zobacz najbliższe wyproszenie">
          <div class="dashboard-stat-label">Najbliższy poród</div>
          <div class="dashboard-stat-value" style="color:${minDays <= 3 ? 'var(--accent-red)' : 'var(--primary)'};">${nearestFarrowValue}</div>
          <div class="dashboard-stat-sub" style="color:${minDays <= 3 ? 'var(--accent-red)' : 'var(--text-secondary)'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${nearestFarrowSub}
          </div>
        </div>
      </div>

      <!-- SEKCJA: NAJBLIŻSZE ZADANIA -->
      <div class="dashboard-tasks-card">
        <div class="dashboard-tasks-header">
          <div class="dashboard-tasks-title">NAJBLIŻSZE ZADANIA</div>
          <button class="btn btn-sm btn-primary" id="btn-dashboard-add-task" style="padding:4px 10px; font-size:0.75rem; border-radius:6px; cursor:pointer;">
            ➕ Zadanie
          </button>
        </div>

        <div id="dashboard-tasks-list" style="display:flex; flex-direction:column;">
          ${allTasks.length === 0 ? `
            <div style="font-size:0.8rem; color:var(--text-muted); padding:10px 0; text-align:center;">
              Brak pilnych zadań. Kliknij <strong>➕ Zadanie</strong>, aby zapisać przypomnienie!
            </div>
          ` : allTasks.map(t => {
            const isUrgent = t.priority === 'urgent' || t.due === 'Dzisiaj!' || t.due === 'Jutro';
            const badgeClass = isUrgent ? 'badge-urgent' : 'badge-planned';
            const badgeText = isUrgent ? 'Pilne' : 'Planowane';

            return `
              <div class="dashboard-task-item" data-task-id="${t.id}">
                <div class="dashboard-task-left">
                  <div class="dashboard-task-icon">${t.icon || '📅'}</div>
                  <div class="dashboard-task-info">
                    <div class="dashboard-task-title">${escapeHTML(t.title)}</div>
                    <div class="dashboard-task-time">${escapeHTML(t.due)}</div>
                  </div>
                </div>
                <div class="dashboard-task-right">
                  <span class="${badgeClass}">${badgeText}</span>
                  ${t.isMachine ? `
                    <button class="btn btn-sm btn-secondary btn-dash-open-mach" data-mach-id="${t.machineId}" title="Zobacz maszynę" style="padding:3px 6px; font-size:0.72rem; border-radius:6px;">
                      👁️
                    </button>
                  ` : (t.isAuto ? `
                    <button class="btn btn-sm btn-secondary btn-dash-open-sow" data-sow-id="${t.sowId}" title="Zobacz maciorę" style="padding:3px 6px; font-size:0.72rem; border-radius:6px;">
                      👁️
                    </button>
                  ` : `
                    <button class="btn btn-sm btn-secondary btn-dash-done-task" data-task-id="${t.id}" title="Oznacz jako wykonane" style="padding:3px 6px; font-size:0.75rem; color:var(--primary); border-radius:6px;">
                      ✓
                    </button>
                    <button class="btn btn-sm btn-secondary btn-dash-del-task" data-task-id="${t.id}" title="Usuń zadanie" style="padding:3px 6px; font-size:0.72rem; color:var(--accent-red); border-radius:6px;">
                      🗑️
                    </button>
                  `)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Podpięcia kliknięć w statystykach
  document.getElementById('dash-stat-pigs')?.addEventListener('click', () => switchScreen('pigs'));
  document.getElementById('dash-stat-fields')?.addEventListener('click', () => switchScreen('fields'));
  document.getElementById('dash-stat-tasks')?.addEventListener('click', () => {
    document.querySelector('.dashboard-tasks-card')?.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('dash-stat-farrow')?.addEventListener('click', () => {
    if (closestSow) {
      switchScreen('pigs');
      openSowModal(closestSow);
    } else {
      switchScreen('pigs');
    }
  });

  // Dodawanie zadania
  document.getElementById('btn-dashboard-add-task')?.addEventListener('click', () => {
    openFarmTaskModal();
  });

  // Interakcje z zadaniami
  container.querySelectorAll('.btn-dash-open-mach').forEach(btn => {
    btn.onclick = () => {
      switchScreen('machines');
    };
  });

  container.querySelectorAll('.btn-dash-open-sow').forEach(btn => {
    btn.onclick = () => {
      const sId = btn.dataset.sowId;
      const s = sows.find(item => item.id === sId);
      if (s) {
        switchScreen('pigs');
        openSowModal(s);
      }
    };
  });

  container.querySelectorAll('.btn-dash-done-task').forEach(btn => {
    btn.onclick = () => {
      const tId = btn.dataset.taskId;
      toggleFarmTask(tId);
    };
  });

  container.querySelectorAll('.btn-dash-del-task').forEach(btn => {
    btn.onclick = () => {
      const tId = btn.dataset.taskId;
      deleteFarmTask(tId);
    };
  });
}

function setupLobbyNavigation() {
  const btnOpenPigs = document.getElementById('btn-open-pigs');
  const btnOpenMachines = document.getElementById('btn-open-machines');
  const btnOpenFields = document.getElementById('btn-open-fields');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnBackLobby = document.getElementById('btn-back-lobby');
  const btnBackLobbyMachines = document.getElementById('btn-back-lobby-machines');
  const btnBackLobbyFields = document.getElementById('btn-back-lobby-fields');
  const btnBackLobbySettings = document.getElementById('btn-back-lobby-settings');

  if (btnOpenPigs) {
    btnOpenPigs.addEventListener('click', () => {
      switchScreen('pigs');
    });
  }

  if (btnOpenMachines) {
    btnOpenMachines.addEventListener('click', () => {
      switchScreen('machines');
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

  if (btnBackLobbyMachines) {
    btnBackLobbyMachines.addEventListener('click', () => {
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
  const screenMachines = document.getElementById('screen-machines');
  const screenFields = document.getElementById('screen-fields');
  const screenSettings = document.getElementById('screen-settings');

  if (screenLobby) screenLobby.classList.remove('active');
  if (screenPigs) screenPigs.classList.remove('active');
  if (screenMachines) screenMachines.classList.remove('active');
  if (screenFields) screenFields.classList.remove('active');
  if (screenSettings) screenSettings.classList.remove('active');

  if (screenName === 'pigs') {
    if (screenPigs) screenPigs.classList.add('active');
    renderMenuStats();
    renderSowsList();
    renderCalendarTimeline();
  } else if (screenName === 'machines') {
    if (screenMachines) screenMachines.classList.add('active');
    renderMachinesStats();
    renderMachinesList();
  } else if (screenName === 'fields') {
    if (screenFields) screenFields.classList.add('active');
    renderFieldsStats();
    renderFieldsList();
    renderTreatmentsList();
  } else if (screenName === 'settings') {
    if (screenSettings) screenSettings.classList.add('active');
  } else {
    if (screenLobby) screenLobby.classList.add('active');
    renderFarmDashboard();
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
    scheduleCloudBirthAlerts();
  }
  renderFarmDashboard();
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
    document.getElementById('cloud-status-badge-machines'),
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

  renderFarmDashboard();
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
      machines: machines,
      machineServices: machineServices,
      fields: fields,
      treatments: treatments,
      customCrops: customCrops,
      deletedBaseCrops: deletedBaseCrops,
      farmTasks: farmTasks
    };

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Wysłano pełne dane gospodarstwa (maciory + maszyny + pola + uprawy + zadania) do chmury.');
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
    if (Array.isArray(dataObj.machines)) {
      if (JSON.stringify(dataObj.machines) !== JSON.stringify(machines)) {
        machines = dataObj.machines;
        saveMachinesData(true);
        renderMachinesStats();
        renderMachinesList();
        changed = true;
      }
    }
    if (Array.isArray(dataObj.machineServices)) {
      if (JSON.stringify(dataObj.machineServices) !== JSON.stringify(machineServices)) {
        machineServices = dataObj.machineServices;
        saveMachineServicesData(true);
        renderMachinesStats();
        renderMachinesList();
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
    if (Array.isArray(dataObj.customCrops)) {
      if (JSON.stringify(dataObj.customCrops) !== JSON.stringify(customCrops)) {
        customCrops = dataObj.customCrops;
        saveCustomCrops(true);
        renderFieldsStats();
        renderCropFilterChips();
        changed = true;
      }
    }
    if (Array.isArray(dataObj.deletedBaseCrops)) {
      if (JSON.stringify(dataObj.deletedBaseCrops) !== JSON.stringify(deletedBaseCrops)) {
        deletedBaseCrops = dataObj.deletedBaseCrops;
        localStorage.setItem('prosnosc_swin_deleted_base_crops', JSON.stringify(deletedBaseCrops));
        renderFieldsStats();
        renderCropFilterChips();
        changed = true;
      }
    }
    if (Array.isArray(dataObj.farmTasks)) {
      if (JSON.stringify(dataObj.farmTasks) !== JSON.stringify(farmTasks)) {
        farmTasks = dataObj.farmTasks;
        saveFarmTasks(true);
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

  if (changed) {
    renderFarmDashboard();
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
        machines: machines,
        machineServices: machineServices,
        fields: fields,
        treatments: treatments,
        customCrops: customCrops,
        farmTasks: farmTasks
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullFarmBackup, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `baza_gr_wenglorz_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('💾 Pobrano pełną bazę gospodarstwa (maciory + maszyny + pola + uprawy + zadania)!');
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
            if (Array.isArray(imported.machines)) {
              machines = imported.machines;
              saveMachinesData();
            }
            if (Array.isArray(imported.machineServices)) {
              machineServices = imported.machineServices;
              saveMachineServicesData();
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
            if (Array.isArray(imported.customCrops)) {
              customCrops = imported.customCrops;
              saveCustomCrops();
            }
            if (Array.isArray(imported.farmTasks)) {
              farmTasks = imported.farmTasks;
              saveFarmTasks();
            }
            if (imported.familyCode) {
              connectFamilyCloud(imported.familyCode, true);
            }
            renderMachinesStats();
            renderMachinesList();
            renderFarmDashboard();
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

function isNotificationsEnabled() {
  const pref = localStorage.getItem('prosnosc_swin_notif_enabled');
  // Domyślnie włączone, chyba że użytkownik kliknął Wyłącz ('false')
  return pref !== 'false';
}

function updateNotificationButtonState() {
  const statusText = document.getElementById('notif-status-text');
  const btnToggle = document.getElementById('btn-toggle-notifications');
  const btnIcon = document.getElementById('notif-toggle-btn-icon');
  const btnLabel = document.getElementById('notif-toggle-btn-text');

  if (!btnToggle || !statusText) return;

  const enabled = isNotificationsEnabled();

  if (enabled) {
    statusText.innerHTML = '🟢 WŁĄCZONE (Aktywne)';
    statusText.style.color = 'var(--primary)';
    if (btnIcon) btnIcon.textContent = '🔴';
    if (btnLabel) btnLabel.textContent = 'Wyłącz';
    btnToggle.className = 'btn btn-secondary btn-sm';
    btnToggle.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
    btnToggle.style.borderColor = '#ef4444';
    btnToggle.style.color = '#ef4444';
  } else {
    statusText.innerHTML = '⚪ WYŁĄCZONE (Nieaktywne)';
    statusText.style.color = 'var(--text-muted)';
    if (btnIcon) btnIcon.textContent = '🟢';
    if (btnLabel) btnLabel.textContent = 'Włącz';
    btnToggle.className = 'btn btn-primary btn-sm';
    btnToggle.style.backgroundColor = 'var(--btn-primary-bg)';
    btnToggle.style.borderColor = 'var(--btn-primary-bg)';
    btnToggle.style.color = '#ffffff';
  }
}

function setupNotificationListeners() {
  const btnToggle = document.getElementById('btn-toggle-notifications');
  const btnTest = document.getElementById('btn-test-notification');

  updateNotificationButtonState();

  if (btnToggle) {
    btnToggle.addEventListener('click', async () => {
      const isCurrentlyEnabled = isNotificationsEnabled();

      if (isCurrentlyEnabled) {
        // WYŁĄCZAMY
        localStorage.setItem('prosnosc_swin_notif_enabled', 'false');
        updateNotificationButtonState();
        showToast('🔕 Powiadomienia zostały WYŁĄCZONE.');
      } else {
        // WŁĄCZAMY
        localStorage.setItem('prosnosc_swin_notif_enabled', 'true');
        updateNotificationButtonState();
        showToast('🔔 Powiadomienia zostały WŁĄCZONE!');

        if ('Notification' in window && Notification.permission !== 'granted') {
          try {
            await Notification.requestPermission();
          } catch (e) {
            console.log('Błąd żądania uprawnień:', e);
          }
        }

        sendAppNotification('🔔 Powiadomienia włączone!', 'Będziesz otrzymywać przypomnienia o wyproszeniach macior.');
        checkUpcomingFarrowingsAndNotify();
        scheduleCloudBirthAlerts();
      }
    });
  }

  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      if (!isNotificationsEnabled()) {
        showToast('Powiadomienia są wyłączone. Włącz je najpierw przyciskiem obok!');
        return;
      }

      if ('Notification' in window && Notification.permission !== 'granted') {
        try {
          await Notification.requestPermission();
        } catch (e) {}
      }

      sendAppNotification('🚨 Test: Poród za 3 dni!', 'Maciora: Baśka (Kojec 2) ma planowany poród za 3 dni! Przygotuj porodówkę.');
      sendCloudTestAlert();
    });
  }
}

async function sendCloudTestAlert() {
  if (!familyCode) return;
  const cleanTopic = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
  try {
    await fetch(`https://ntfy.sh/prosnosc_swin_${cleanTopic}`, {
      method: 'POST',
      headers: {
        'Title': '🚨 Test: Poród maciory za 3 dni!',
        'Priority': 'urgent',
        'Tags': 'pig,warning,alarm_clock',
        'Click': window.location.href
      },
      body: 'Maciora: Baśka (Kojec 2) ma planowany poród za 3 dni! Powiadomienia w tle działają prawidłowo!'
    });
    showToast('🚀 Wysłano testowe powiadomienie Push do chmury!');
  } catch (e) {
    console.log('Błąd testu chmury:', e);
  }
}

function sendAppNotification(title, body) {
  if (!isNotificationsEnabled()) return;

  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body,
          icon: './logo.jpg',
          badge: './logo.jpg',
          vibrate: [300, 100, 300, 100, 300],
          data: { url: './index.html' },
          tag: 'farrowing-alert-' + Date.now(),
          renotify: true,
          requireInteraction: true
        });
      });
    } else {
      new Notification(title, {
        body,
        icon: './logo.jpg'
      });
    }
  } catch (e) {
    console.log('Błąd wysyłania powiadomienia:', e);
  }
}

async function scheduleCloudBirthAlerts() {
  if (!familyCode || !isNotificationsEnabled()) return;
  const cleanTopic = familyCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const alertTopic = `prosnosc_swin_${cleanTopic}`;
  const now = new Date();

  // Przejrzyj wszystkie ciężarne maciory i zaplanuj powiadomienia w chmurze
  for (const sow of sows) {
    if (!sow.coverageDate || (sow.status !== 'pregnant' && sow.status !== 'postawiona' && sow.status !== 'farrowing')) continue;

    const covDate = new Date(sow.coverageDate + 'T00:00:00');
    const farrowDate = addDays(covDate, sow.gestationDays || 114);
    
    // 1. Alert na 3 dni przed porodem o godz. 08:00 rano
    const alert3Days = new Date(farrowDate);
    alert3Days.setDate(alert3Days.getDate() - 3);
    alert3Days.setHours(8, 0, 0, 0);

    const diff3DaysSec = Math.floor((alert3Days - now) / 1000);
    const key3Days = `cloud_alert_scheduled_${sow.id}_3days_${alert3Days.toISOString().split('T')[0]}`;

    if (diff3DaysSec > 0 && diff3DaysSec < 30 * 24 * 3600 && !localStorage.getItem(key3Days)) {
      try {
        await fetch(`https://ntfy.sh/${alertTopic}`, {
          method: 'POST',
          headers: {
            'Title': `🚨 Za 3 dni poród: ${sow.name}!`,
            'Priority': 'urgent',
            'Tags': 'pig,warning,alarm_clock',
            'Delay': `${diff3DaysSec}s`,
            'Click': window.location.href
          },
          body: `Maciora: ${sow.name} (Kojec: ${sow.pen || 'Brak'}). Planowany termin porodu to ${farrowDate.toLocaleDateString('pl-PL')}. Przygotuj porodówkę!`
        });
        localStorage.setItem(key3Days, '1');
      } catch (e) {
        console.log('Błąd harmonogramu powiadomień:', e);
      }
    }

    // 2. Alert w dzień porodu o godz. 07:00 rano
    const alert0Days = new Date(farrowDate);
    alert0Days.setHours(7, 0, 0, 0);
    const diff0DaysSec = Math.floor((alert0Days - now) / 1000);
    const key0Days = `cloud_alert_scheduled_${sow.id}_0days_${alert0Days.toISOString().split('T')[0]}`;

    if (diff0DaysSec > 0 && diff0DaysSec < 30 * 24 * 3600 && !localStorage.getItem(key0Days)) {
      try {
        await fetch(`https://ntfy.sh/${alertTopic}`, {
          method: 'POST',
          headers: {
            'Title': `🚨 PORÓD DZISIAJ: ${sow.name}!`,
            'Priority': 'urgent',
            'Tags': 'pig,rotating_light,alarm_clock',
            'Delay': `${diff0DaysSec}s`,
            'Click': window.location.href
          },
          body: `Dziś przypada termin porodu maciory ${sow.name} (Kojec: ${sow.pen || 'Brak'})!`
        });
        localStorage.setItem(key0Days, '1');
      } catch (e) {
        console.log('Błąd harmonogramu powiadomień:', e);
      }
    }
  }
}

function checkUpcomingFarrowingsAndNotify() {
  if (!isNotificationsEnabled()) return;
  scheduleCloudBirthAlerts();

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
   MODUŁ: POLA I UPRAWY (DZIAŁKI, ZASIEWY, EWIDENCJA OPRYSKÓW, SEZONY)
   ========================================================================== */

function getDefaultCurrentSeason() {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = now.getMonth() + 1;
  return mo >= 8 ? `${yr}/${yr + 1}` : `${yr - 1}/${yr}`;
}

let savedSeasonRaw = localStorage.getItem('prosnosc_swin_season_year');
let currentSeasonYear = getDefaultCurrentSeason();
if (savedSeasonRaw) {
  if (savedSeasonRaw === 'all') {
    currentSeasonYear = 'all';
  } else if (savedSeasonRaw.includes('/')) {
    currentSeasonYear = savedSeasonRaw;
  } else if (!isNaN(parseInt(savedSeasonRaw))) {
    const parsedYr = parseInt(savedSeasonRaw);
    currentSeasonYear = `${parsedYr}/${parsedYr + 1}`;
  }
}

function initFieldsModule() {
  loadCustomCrops();
  loadDeletedBaseCrops();
  loadFieldsData();
  loadTreatmentsData();
  renderSeasonYearSelector();
  setupFieldsModuleListeners();
}

function getFieldSeason(field) {
  if (field.season) return field.season;
  if (field.sowingDate) {
    const d = new Date(field.sowingDate + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return m >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    }
  }
  return getDefaultCurrentSeason();
}

function getSeasonFields(season = currentSeasonYear) {
  if (!season || season === 'all') return fields;
  return fields.filter(f => getFieldSeason(f) === season);
}

function getSeasonTreatments(season = currentSeasonYear) {
  if (!season || season === 'all') return treatments;
  return treatments.filter(t => {
    if (t.season) return t.season === season;
    return isDateInSeason(t.date, season);
  });
}

function isDateInSeason(dateStr, seasonStr) {
  if (!seasonStr || seasonStr === 'all') return true;
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return false;
  const yr = d.getFullYear();
  const mo = d.getMonth() + 1;

  if (seasonStr.includes('/')) {
    const [y1, y2] = seasonStr.split('/').map(Number);
    // Sierpień-grudzień roku początkowego (siewy ozime) lub styczeń-październik roku zbioru
    if (yr === y1 && mo >= 8) return true;
    if (yr === y2 && mo <= 10) return true;
    if (yr === y1 || yr === y2) return true;
    return false;
  }
  return yr === parseInt(seasonStr);
}

function getAvailableSeasons() {
  const seasons = new Set();
  const now = new Date();
  const baseYr = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  // Generuj sezony wstecz i w przód
  for (let y = baseYr - 3; y <= baseYr + 2; y++) {
    seasons.add(`${y}/${y + 1}`);
  }

  // Dodaj sezony z istniejących zabiegów i pól
  treatments.forEach(t => {
    if (t.season) seasons.add(t.season);
    if (t.date) {
      const d = new Date(t.date + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const s = m >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
        seasons.add(s);
      }
    }
  });
  fields.forEach(f => {
    if (f.season) seasons.add(f.season);
    if (f.sowingDate) {
      const d = new Date(f.sowingDate + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const s = m >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
        seasons.add(s);
      }
    }
  });

  return Array.from(seasons).sort((a, b) => {
    const yA = parseInt(a.split('/')[0]);
    const yB = parseInt(b.split('/')[0]);
    return yB - yA;
  });
}

function copyParcelsToCurrentSeason() {
  if (currentSeasonYear === 'all') return;
  const uniqueParcelsMap = new Map();
  fields.forEach(f => {
    if (!uniqueParcelsMap.has(f.name.toLowerCase())) {
      uniqueParcelsMap.set(f.name.toLowerCase(), f);
    }
  });

  if (uniqueParcelsMap.size === 0) return;

  if (confirm(`Czy chcesz dodać ${uniqueParcelsMap.size} działek do sezonu ${currentSeasonYear} (z czystymi uprawami do wpisania na nowo)?`)) {
    uniqueParcelsMap.forEach(f => {
      fields.push({
        id: 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: f.name,
        areaHa: f.areaHa,
        parcelNo: f.parcelNo || '',
        crop: '',
        variety: '',
        sowingDate: '',
        sprays: '',
        notes: f.notes || '',
        season: currentSeasonYear,
        createdAt: new Date().toISOString()
      });
    });
    saveFieldsData();
    showToast(`📋 Przepisano ${uniqueParcelsMap.size} działek na sezon ${currentSeasonYear}!`);
  }
}

function renderSeasonYearSelector() {
  const select = document.getElementById('select-season-year');
  if (!select) return;

  const availableSeasons = getAvailableSeasons();
  let optionsHtml = `<option value="all" ${currentSeasonYear === 'all' ? 'selected' : ''}>🌟 Wszystkie Sezony (Całość)</option>`;
  availableSeasons.forEach(s => {
    optionsHtml += `<option value="${s}" ${currentSeasonYear === s ? 'selected' : ''}>Sezon ${s}</option>`;
  });
  select.innerHTML = optionsHtml;
}

function setSeasonYear(season) {
  currentSeasonYear = season;
  localStorage.setItem('prosnosc_swin_season_year', currentSeasonYear);
  renderSeasonYearSelector();
  renderFieldsStats();
  renderFieldsList();
  renderTreatmentsList();
  showToast(currentSeasonYear === 'all' ? '📅 Wyświetlam całą historię (wszystkie sezony)' : `📅 Przełączono na Sezon: ${currentSeasonYear}`);
}

function stepSeasonYear(delta) {
  if (currentSeasonYear === 'all') {
    currentSeasonYear = getDefaultCurrentSeason();
  }
  let y1;
  if (currentSeasonYear.includes('/')) {
    y1 = parseInt(currentSeasonYear.split('/')[0]);
  } else {
    y1 = parseInt(currentSeasonYear);
  }
  const nextY1 = y1 + delta;
  const nextSeason = `${nextY1}/${nextY1 + 1}`;
  setSeasonYear(nextSeason);
}

function loadCustomCrops() {
  const saved = localStorage.getItem('prosnosc_swin_custom_crops');
  if (saved) {
    try {
      customCrops = JSON.parse(saved);
    } catch (e) {
      customCrops = [];
    }
  } else {
    customCrops = [];
  }
}

function loadDeletedBaseCrops() {
  const saved = localStorage.getItem('prosnosc_swin_deleted_base_crops');
  if (saved) {
    try {
      deletedBaseCrops = JSON.parse(saved);
    } catch (e) {
      deletedBaseCrops = [];
    }
  } else {
    deletedBaseCrops = [];
  }
}

function saveCustomCrops(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_custom_crops', JSON.stringify(customCrops));
  renderFieldsStats();
  renderCropFilterChips();
  if (!skipCloudPush && familyCode) {
    pushFarmDataToCloud();
  }
}

function openCropModal() {
  const modal = document.getElementById('crop-modal');
  const form = document.getElementById('crop-form');
  const input = document.getElementById('modal-crop-name');
  if (!modal || !form) return;
  form.reset();
  modal.classList.add('active');
  if (input) setTimeout(() => input.focus(), 150);
}

function closeCropModal() {
  const modal = document.getElementById('crop-modal');
  if (modal) modal.classList.remove('active');
}

function saveCropCategoryFromModal() {
  const input = document.getElementById('modal-crop-name');
  const name = (input?.value || '').trim();
  if (!name) {
    showToast('Wpisz nazwę uprawy!');
    return;
  }

  const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
  
  // Jeśli to była wcześniej usunięta uprawa bazowa, przywróć ją
  const baseMatch = BASE_CROPS.find(b => b.shortName.toLowerCase() === formattedName.toLowerCase());
  if (baseMatch && deletedBaseCrops.includes(baseMatch.key)) {
    deletedBaseCrops = deletedBaseCrops.filter(k => k !== baseMatch.key);
    localStorage.setItem('prosnosc_swin_deleted_base_crops', JSON.stringify(deletedBaseCrops));
    if (familyCode) pushFarmDataToCloud();
    closeCropModal();
    renderFieldsStats();
    renderCropFilterChips();
    showToast(`✅ Przywrócono kafelek dla uprawy: ${formattedName}!`);
    return;
  }

  const existsBase = BASE_CROPS.some(b => b.shortName.toLowerCase() === formattedName.toLowerCase() && !deletedBaseCrops.includes(b.key));
  const existsCustom = customCrops.some(c => c.toLowerCase() === formattedName.toLowerCase());

  if (existsBase || existsCustom) {
    showToast(`Uprawa "${formattedName}" już istnieje w menu!`);
    closeCropModal();
    return;
  }

  customCrops.push(formattedName);
  saveCustomCrops();
  closeCropModal();
  showToast(`✅ Utworzono kafelek dla uprawy: ${formattedName}!`);
}

function deleteCropCategory(cropKey, cropName) {
  const fieldCount = fields.filter(f => filterFieldByCrop(f, cropKey)).length;
  let confirmMsg = `Czy na pewno chcesz usunąć kafelek uprawy "${cropName}"?`;
  if (fieldCount > 0) {
    confirmMsg += `\n(Uwaga: Masz ${fieldCount} działek z tą uprawą. Same działki nie zostaną skasowane, ale kafelek zniknie z podsumowania).`;
  }

  if (confirm(confirmMsg)) {
    if (cropKey.startsWith('custom_')) {
      const targetSlug = cropKey.replace('custom_', '').toLowerCase();
      customCrops = customCrops.filter(c => c.toLowerCase().replace(/[^a-z0-9]/g, '_') !== targetSlug && c.toLowerCase() !== cropName.toLowerCase());
      saveCustomCrops();
    } else {
      if (!deletedBaseCrops.includes(cropKey)) {
        deletedBaseCrops.push(cropKey);
        localStorage.setItem('prosnosc_swin_deleted_base_crops', JSON.stringify(deletedBaseCrops));
        if (familyCode) pushFarmDataToCloud();
      }
    }

    if (currentFieldCropFilter === cropKey) {
      currentFieldCropFilter = 'all';
    }
    renderFieldsStats();
    renderCropFilterChips();
    renderFieldsList();
    showToast(`🗑️ Usunięto kafelek uprawy: ${cropName}`);
  }
}

function loadFieldsData() {
  const saved = localStorage.getItem('prosnosc_swin_fields');
  if (saved) {
    try {
      fields = JSON.parse(saved);
      let updated = false;
      fields.forEach(f => {
        if (!f.season) {
          f.season = getFieldSeason(f);
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem('prosnosc_swin_fields', JSON.stringify(fields));
      }
    } catch (e) {
      fields = [];
    }
  } else {
    fields = [];
  }
}

function saveFieldsData(skipCloudPush = false) {
  localStorage.setItem('prosnosc_swin_fields', JSON.stringify(fields));
  renderSeasonYearSelector();
  renderFieldsStats();
  renderFieldsList();
  renderTreatmentsList();
  renderUniqueSpraysRecords();
  renderFarmDashboard();
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
  renderSeasonYearSelector();
  renderFieldsStats();
  renderFieldsList();
  renderTreatmentsList();
  renderUniqueSpraysRecords();
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
  if (targetTab === 'fields-records') renderUniqueSpraysRecords();
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
  const btnAddFieldAll = document.getElementById('btn-add-field-all');
  const btnAddTreatmentMain = document.getElementById('btn-add-treatment-main');
  const btnAddTreatmentQuick = document.getElementById('btn-add-treatment-quick');
  const btnAddTreatFromRecords = document.getElementById('btn-add-treatment-from-records');
  const recordsSearchInput = document.getElementById('records-spray-search-input');

  if (btnAddTreatFromRecords) {
    btnAddTreatFromRecords.addEventListener('click', () => openTreatmentModal());
  }
  if (recordsSearchInput) {
    recordsSearchInput.addEventListener('input', () => renderUniqueSpraysRecords());
  }

  // Kontrolki wyboru sezonu / roku
  const seasonSelect = document.getElementById('select-season-year');
  const btnPrevSeason = document.getElementById('btn-prev-season-year');
  const btnNextSeason = document.getElementById('btn-next-season-year');

  if (seasonSelect) {
    seasonSelect.addEventListener('change', () => {
      setSeasonYear(seasonSelect.value);
    });
  }
  if (btnPrevSeason) {
    btnPrevSeason.addEventListener('click', () => stepSeasonYear(-1));
  }
  if (btnNextSeason) {
    btnNextSeason.addEventListener('click', () => stepSeasonYear(1));
  }

  if (btnAddField) btnAddField.addEventListener('click', () => openFieldModal());
  if (btnAddFieldMenu) btnAddFieldMenu.addEventListener('click', () => openFieldModal());
  if (btnAddFieldAll) {
    btnAddFieldAll.addEventListener('click', () => {
      const defaultCrop = currentFieldCropFilter !== 'all' ? getCropDefaultName(currentFieldCropFilter) : '';
      openFieldModal(null, defaultCrop, true);
    });
  }
  if (btnAddTreatmentMain) btnAddTreatmentMain.addEventListener('click', () => openTreatmentModal());
  if (btnAddTreatmentQuick) btnAddTreatmentQuick.addEventListener('click', () => openTreatmentModal());

  // Formularz Nowego Kafelka Uprawy
  const cropForm = document.getElementById('crop-form');
  const btnCloseCrop = document.getElementById('btn-close-crop-modal');
  if (cropForm) {
    cropForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveCropCategoryFromModal();
    });
  }
  if (btnCloseCrop) btnCloseCrop.addEventListener('click', closeCropModal);

  // Formularz Pola
  const fieldForm = document.getElementById('field-form');
  const btnCloseField = document.getElementById('btn-close-field-modal');
  const fieldNameInput = document.getElementById('modal-field-name');

  if (fieldNameInput) {
    const handleFieldSelection = () => {
      const val = fieldNameInput.value.trim().toLowerCase();
      if (!val) return;
      const found = fields.find(f => f.name.toLowerCase() === val);
      if (found) {
        document.getElementById('modal-field-id').value = found.id;
        if (found.areaHa && (!document.getElementById('modal-field-area').value || parseFloat(document.getElementById('modal-field-area').value) === 0)) {
          document.getElementById('modal-field-area').value = found.areaHa;
        }
        if (found.parcelNo && !document.getElementById('modal-field-parcel').value) {
          document.getElementById('modal-field-parcel').value = found.parcelNo;
        }
        if (found.variety && !document.getElementById('modal-field-variety').value) {
          document.getElementById('modal-field-variety').value = found.variety;
        }
        if (found.sowingDate && !document.getElementById('modal-field-sowing-date').value) {
          document.getElementById('modal-field-sowing-date').value = found.sowingDate;
        }
        if (found.notes && document.getElementById('modal-field-notes') && !document.getElementById('modal-field-notes').value) {
          document.getElementById('modal-field-notes').value = found.notes;
        }
        const fTreatments = treatments.filter(t => t.fieldId === found.id);
        const existingProducts = fTreatments.map(t => t.product).filter(Boolean);
        const sprayText = found.sprays || existingProducts.join(', ');
        const spraysInput = document.getElementById('modal-field-sprays');
        if (spraysInput && !spraysInput.value) {
          spraysInput.value = sprayText;
        }
      }
    };
    fieldNameInput.addEventListener('input', handleFieldSelection);
    fieldNameInput.addEventListener('change', handleFieldSelection);
  }

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

  // Formularz Edycji Środka w Zapisach
  const editSprayForm = document.getElementById('edit-spray-form');
  const btnCloseEditSpray = document.getElementById('btn-close-edit-spray-modal');
  if (editSprayForm) {
    editSprayForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveEditSprayFromModal();
    });
  }
  if (btnCloseEditSpray) {
    btnCloseEditSpray.addEventListener('click', closeEditSprayModal);
  }

  // Auto-dopasowanie rodzaju zabiegu (Herbicyd, Fungicyd, Insektycyd...) po wybraniu środka
  const bindSprayTypeAutoDetect = (inputEl, selectEl) => {
    if (!inputEl || !selectEl) return;
    const detect = () => {
      const val = inputEl.value.trim().toLowerCase();
      if (!val) return;
      const found = POPULAR_SPRAYS.find(s => s.name.toLowerCase() === val || val.includes(s.name.toLowerCase()));
      if (found && found.type) {
        if (found.type.includes('Herbicyd')) selectEl.value = 'Herbicyd';
        else if (found.type.includes('Fungicyd')) selectEl.value = 'Fungicyd';
        else if (found.type.includes('Insektycyd')) selectEl.value = 'Insektycyd';
        else if (found.type.includes('Regulator')) selectEl.value = 'Regulator';
        else if (found.type.includes('dolistny')) selectEl.value = 'Nawóz dolistny';
        else if (found.type.includes('doglebowy')) selectEl.value = 'Nawóz doglebowy';
      }
    };
    inputEl.addEventListener('input', detect);
    inputEl.addEventListener('change', detect);
  };

  bindSprayTypeAutoDetect(document.getElementById('modal-field-sprays'), document.getElementById('modal-field-treatment-type'));
  bindSprayTypeAutoDetect(document.getElementById('modal-treatment-product'), document.getElementById('modal-treatment-type'));

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

const BASE_CROPS = [
  { key: 'pszenica', label: 'Pola z pszenicą', shortName: 'Pszenica', icon: '🌾', color: '#38bdf8' },
  { key: 'rzepak', label: 'Pola z rzepakiem', shortName: 'Rzepak', icon: '🌼', color: '#22c55e' },
  { key: 'kukurydza', label: 'Pola z kukurydzą', shortName: 'Kukurydza', icon: '🌽', color: '#f59e0b' },
  { key: 'jeczmien', label: 'Pola z jęczmieniem', shortName: 'Jęczmień', icon: '🟠', color: '#fb923c' },
  { key: 'owies', label: 'Pola z owsem', shortName: 'Owies', icon: '🔷', color: '#2dd4bf' }
];

function getAllCropsList() {
  const list = BASE_CROPS.filter(b => !deletedBaseCrops.includes(b.key));
  const allCustomSet = new Set(customCrops);
  const seasonFields = getSeasonFields();
  
  seasonFields.forEach(f => {
    const rawCrop = (f.crop || '').trim();
    if (!rawCrop) return;
    const isBase = BASE_CROPS.some(b => filterFieldByCrop(f, b.key));
    if (!isBase) {
      const formatted = rawCrop.charAt(0).toUpperCase() + rawCrop.slice(1);
      allCustomSet.add(formatted);
    }
  });

  const colors = ['#a855f7', '#ec4899', '#14b8a6', '#84cc16', '#06b6d4', '#f43f5e', '#e11d48'];
  let colorIdx = 0;

  allCustomSet.forEach(cName => {
    const key = 'custom_' + cName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    list.push({
      key: key,
      label: `Pola: ${cName}`,
      shortName: cName,
      icon: '🌱',
      color: colors[colorIdx % colors.length],
      isCustom: true,
      customName: cName
    });
    colorIdx++;
  });

  return list;
}

let currentFieldCropFilter = 'all';

function setFieldCropFilter(cropKey, switchTab = true) {
  currentFieldCropFilter = cropKey;
  renderFieldsStats();
  renderFieldsList();
  renderCropFilterChips();
  if (switchTab) {
    switchFieldTab('fields-all');
  }
}

function filterFieldByCrop(f, filterKey) {
  if (!filterKey || filterKey === 'all') return true;
  const c = (f.crop || '').toLowerCase().trim();
  if (filterKey === 'pszenica') return c.includes('pszenic');
  if (filterKey === 'rzepak') return c.includes('rzepak');
  if (filterKey === 'kukurydza') return c.includes('kukurydz');
  if (filterKey === 'jeczmien') return c.includes('jęczmień') || c.includes('jeczmien');
  if (filterKey === 'owies') return c.includes('owie') || c.includes('ows');
  
  if (filterKey.startsWith('custom_')) {
    const targetCrop = filterKey.replace('custom_', '').toLowerCase();
    return c.replace(/[^a-z0-9]/g, '_').includes(targetCrop);
  }
  return c.includes(filterKey.toLowerCase());
}

function getCropFilterName(filterKey) {
  const all = getAllCropsList();
  const found = all.find(c => c.key === filterKey);
  if (found) return found.shortName;
  if (filterKey === 'all') return 'Wszystkie';
  return filterKey;
}

function getCropDefaultName(filterKey) {
  const all = getAllCropsList();
  const found = all.find(c => c.key === filterKey);
  if (found) return found.shortName;
  return '';
}

function renderFieldsStats() {
  const statsContainer = document.getElementById('fields-stats');
  if (!statsContainer) return;

  const seasonFields = getSeasonFields();
  const totalArea = seasonFields.reduce((sum, f) => sum + (parseFloat(f.areaHa) || 0), 0).toFixed(2);
  const totalFields = seasonFields.length;
  const allCrops = getAllCropsList();

  const seasonLabel = currentSeasonYear === 'all' ? 'Łączny Areał' : `Łączny Areał (${currentSeasonYear})`;

  let html = `
    <div class="stat-card clickable ${currentFieldCropFilter === 'all' ? 'active' : ''}" data-crop-filter="all">
      <div class="stat-card-value" style="color:#eab308;">${totalArea} ha</div>
      <div class="stat-card-label">${seasonLabel}</div>
    </div>
    <div class="stat-card clickable ${currentFieldCropFilter === 'all' ? 'active' : ''}" data-crop-filter="all">
      <div class="stat-card-value">${totalFields}</div>
      <div class="stat-card-label">${currentSeasonYear === 'all' ? 'Wszystkie Działki' : 'Działki w Sezonie'}</div>
    </div>
  `;

  allCrops.forEach(crop => {
    const count = seasonFields.filter(f => filterFieldByCrop(f, crop.key)).length;
    html += `
      <div class="stat-card clickable ${currentFieldCropFilter === crop.key ? 'active' : ''}" data-crop-filter="${crop.key}" style="position: relative;">
        <button class="btn-delete-crop-tile" data-crop-key="${crop.key}" data-crop-name="${escapeHTML(crop.shortName)}" title="Usuń kafelek uprawy">🗑️</button>
        <div class="stat-card-value" style="color:${crop.color};">${count}</div>
        <div class="stat-card-label">${escapeHTML(crop.label)}</div>
      </div>
    `;
  });

  html += `
    <div class="stat-card clickable stat-card-add-new" data-crop-action="add_crop_category">
      <div class="stat-card-value" style="color:var(--primary);">➕</div>
      <div class="stat-card-label" style="color:#ffffff; font-weight:700;">Dodaj Uprawę</div>
    </div>
  `;

  statsContainer.innerHTML = html;

  statsContainer.querySelectorAll('.btn-delete-crop-tile').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const key = btn.dataset.cropKey;
      const name = btn.dataset.cropName;
      deleteCropCategory(key, name);
    };
  });

  statsContainer.querySelectorAll('.stat-card.clickable').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.btn-delete-crop-tile')) return;

      const action = card.dataset.cropAction;
      if (action === 'add_crop_category') {
        openCropModal();
        return;
      }

      const filterKey = card.dataset.cropFilter;
      if (filterKey === 'all') {
        currentFieldCropFilter = 'all';
        renderFieldsStats();
        renderFieldsList();
        renderCropFilterChips();
        switchFieldTab('fields-all');
      } else {
        currentFieldCropFilter = filterKey;
        const defaultCrop = getCropDefaultName(filterKey);
        openFieldModal(null, defaultCrop);
      }
    };
  });
}

function renderCropFilterChips() {
  const chipsContainer = document.getElementById('field-crop-chips');
  if (!chipsContainer) return;

  const seasonFields = getSeasonFields();
  const totalAreaAll = seasonFields.reduce((sum, f) => sum + (parseFloat(f.areaHa) || 0), 0);
  const totalAreaAllStr = totalAreaAll > 0 ? `${parseFloat(totalAreaAll.toFixed(2))} ha` : '0 ha';

  const allCrops = getAllCropsList();
  let html = `
    <button class="chip ${currentFieldCropFilter === 'all' ? 'active' : ''}" data-crop-filter="all" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; width:100%; padding:6px 4px; line-height:1.2;">
      <span>🌾 Wszystkie</span>
      <span style="font-size:0.72rem; font-weight:800; opacity:0.85; margin-top:2px;">${totalAreaAllStr}</span>
    </button>
  `;

  allCrops.forEach(crop => {
    const isActive = currentFieldCropFilter === crop.key;
    const matchingFields = seasonFields.filter(f => filterFieldByCrop(f, crop.key));
    const cropArea = matchingFields.reduce((sum, f) => sum + (parseFloat(f.areaHa) || 0), 0);
    const cropAreaStr = cropArea > 0 ? `${parseFloat(cropArea.toFixed(2))} ha` : '0 ha';

    html += `
      <button class="chip ${isActive ? 'active' : ''}" data-crop-filter="${crop.key}" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; width:100%; padding:6px 4px; line-height:1.2;">
        <span>${crop.icon} ${escapeHTML(crop.shortName)}</span>
        <span style="font-size:0.72rem; font-weight:800; opacity:0.85; margin-top:2px;">${cropAreaStr}</span>
      </button>
    `;
  });

  chipsContainer.innerHTML = html;

  chipsContainer.querySelectorAll('.chip').forEach(chip => {
    chip.onclick = () => {
      currentFieldCropFilter = chip.dataset.cropFilter;
      renderFieldsList();
      renderCropFilterChips();
    };
  });
}

function renderFieldsList() {
  const container = document.getElementById('fields-container');
  if (!container) return;

  // Renderowanie dynamicznych chipsów upraw
  renderCropFilterChips();

  const seasonFields = getSeasonFields();
  const query = (document.getElementById('field-search-input')?.value || '').toLowerCase();
  const filtered = seasonFields.filter(f => {
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
    const activeCropFields = seasonFields.filter(f => filterFieldByCrop(f, currentFieldCropFilter));
    const activeCropArea = activeCropFields.reduce((sum, f) => sum + (parseFloat(f.areaHa) || 0), 0).toFixed(2);

    html += `
      <div style="background:#1e293b; border:1px solid var(--primary); border-radius:10px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div>
          <div style="font-weight:800; color:#ffffff; font-size:0.95rem;">
            🌾 ${getCropFilterName(currentFieldCropFilter)}: <span style="color:#22c55e; font-size:1.05rem; font-weight:900;">${activeCropArea} ha</span>
          </div>
          <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
            Liczba działek: <strong>${filtered.length}</strong>
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-reset-crop-filter" style="padding:6px 12px; font-size:0.78rem; white-space:nowrap; flex-shrink:0;">
          ✖️ Pokaż wszystkie
        </button>
      </div>
    `;
  }

  if (filtered.length === 0) {
    const isNewSeason = seasonFields.length === 0;
    html += `
      <div class="empty-state" style="padding: 24px 16px;">
        <div class="empty-icon">🌾</div>
        <h3>${currentFieldCropFilter !== 'all' ? `Brak działek z uprawą: ${getCropFilterName(currentFieldCropFilter)}` : `Brak wpisanych działek w Sezonie ${currentSeasonYear === 'all' ? 'wszystkich' : currentSeasonYear}`}</h3>
        <p style="color:var(--text-secondary); margin-top:6px;">${isNewSeason ? `Na ten sezon (${currentSeasonYear}) nie wpisano jeszcze żadnych pól. Wpisz pola na nowo lub skopiuj listę działek z innego sezonu.` : 'Przejdź do menu, aby dodać nowe pole lub wybrać inną uprawę.'}</p>
        <div style="display:flex; flex-direction:column; gap:8px; align-items:center; margin-top:14px;">
          <button class="btn btn-primary" id="btn-empty-add-field" style="padding:8px 18px; font-size:0.85rem; font-weight:700;">
            ➕ Dodaj Pole na Sezon ${currentSeasonYear === 'all' ? '' : currentSeasonYear}
          </button>
          ${isNewSeason && fields.length > 0 ? `
            <button class="btn btn-secondary btn-sm" id="btn-copy-parcels-from-prev" style="padding:6px 14px; font-size:0.78rem; margin-top:4px;">
              📋 Przepisz same działki (nazwy i ha) z poprzedniego sezonu
            </button>
          ` : ''}
        </div>
      </div>
    `;
    container.innerHTML = html;
    
    const resetBtn = document.getElementById('btn-reset-crop-filter');
    if (resetBtn) resetBtn.onclick = () => setFieldCropFilter('all', false);
    const btnEmptyAdd = document.getElementById('btn-empty-add-field');
    if (btnEmptyAdd) btnEmptyAdd.onclick = () => openFieldModal();
    const btnCopy = document.getElementById('btn-copy-parcels-from-prev');
    if (btnCopy) btnCopy.onclick = () => copyParcelsToCurrentSeason();
    return;
  }

  html += filtered.map(field => {
    const fieldTreatments = treatments.filter(t => t.fieldId === field.id);
    const sortedTreatments = [...fieldTreatments].sort((a,b) => new Date(b.date) - new Date(a.date));

    // Jeśli wybrano konkretny sezon, przefiltruj opryski tego sezonu
    const displayedTreatments = currentSeasonYear === 'all'
      ? sortedTreatments
      : sortedTreatments.filter(t => isDateInSeason(t.date, currentSeasonYear));

    // Policz ile zabiegów w poszczególnych latach
    const yearsCounts = {};
    fieldTreatments.forEach(t => {
      const yr = new Date(t.date + 'T00:00:00').getFullYear();
      yearsCounts[yr] = (yearsCounts[yr] || 0) + 1;
    });
    const yearsSummary = Object.keys(yearsCounts).sort((a,b)=>b-a).map(yr => `${yr}: ${yearsCounts[yr]}`).join(', ');

    const seasonTitle = currentSeasonYear === 'all'
      ? `🧪 Wykonane opryski (${displayedTreatments.length}):`
      : `🧪 Opryski w Sezonie ${currentSeasonYear} (${displayedTreatments.length}):`;

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
              ${seasonTitle}
            </div>
            ${yearsSummary ? `<div style="font-size:0.72rem; color:#38bdf8;">${yearsSummary}</div>` : ''}
          </div>

          ${displayedTreatments.length === 0 ? `
            <div style="font-size:0.78rem; color:var(--text-secondary); padding:2px 0;">
              ${currentSeasonYear === 'all' ? 'Brak wpisanych oprysków na to pole.' : `Brak zabiegów w sezonie ${currentSeasonYear}.`}
            </div>
          ` : `
            <div style="display:flex; flex-direction:column; gap:4px;" id="field-treatments-list-${field.id}">
              ${displayedTreatments.map((t, idx) => {
                let badgeColor = '#38bdf8';
                if (t.treatmentType === 'Herbicyd') badgeColor = '#22c55e';
                if (t.treatmentType === 'Fungicyd') badgeColor = '#eab308';
                if (t.treatmentType === 'Insektycyd') badgeColor = '#ef4444';
                if (t.treatmentType === 'Regulator') badgeColor = '#a855f7';
                if (t.treatmentType === 'Nawóz dolistny') badgeColor = '#06b6d4';
                const isExtra = idx >= 3;
                return `
                  <div class="field-treat-item-${field.id}" style="font-size:0.8rem; display:${isExtra ? 'none' : 'flex'}; justify-content:space-between; align-items:center; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.05);" data-extra="${isExtra ? '1' : '0'}">
                    <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis;">
                      <strong style="color:${badgeColor};">[${escapeHTML(t.treatmentType)}]</strong> 
                      <span style="color:#ffffff; font-weight:600;">${escapeHTML(t.product)}</span>
                      ${t.dosePerHa ? `<small style="color:var(--text-secondary);">(${escapeHTML(t.dosePerHa)})</small>` : ''}
                    </span>
                    <div style="display:flex; align-items:center; gap:6px; margin-left:8px;">
                      <span style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap;">${new Date(t.date).toLocaleDateString('pl-PL')}</span>
                      <button class="icon-btn btn-delete-treatment-quick" data-treatment-id="${t.id}" data-field-id="${field.id}" data-crop="${escapeHTML(field.crop || '')}" title="Usuń ten oprysk" style="padding:2px 4px; font-size:0.8rem; color:#ef4444; background:none; border:none; cursor:pointer;">🗑️</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            ${displayedTreatments.length > 3 ? `
              <div class="btn-toggle-field-treatments" data-field-id="${field.id}" data-expanded="false" data-count="${displayedTreatments.length}" style="font-size:0.75rem; color:#38bdf8; margin-top:6px; cursor:pointer; font-weight:700; user-select:none;">
                🔽 Rozwiń wszystkie opryski (${displayedTreatments.length})
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

  // Obsługa rozwijania / zwijania listy oprysków na kafelku
  container.querySelectorAll('.btn-toggle-field-treatments').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const fId = btn.dataset.fieldId;
      const count = btn.dataset.count;
      const isExp = btn.dataset.expanded === 'true';
      const items = container.querySelectorAll(`.field-treat-item-${fId}[data-extra="1"]`);
      items.forEach(el => {
        el.style.display = isExp ? 'none' : 'flex';
      });
      btn.dataset.expanded = isExp ? 'false' : 'true';
      btn.innerHTML = isExp ? `🔽 Rozwiń wszystkie opryski (${count})` : `🔼 Zwiń listę oprysków`;
    };
  });

  container.querySelectorAll('.btn-delete-treatment-quick').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tId = btn.dataset.treatmentId;
      const fId = btn.dataset.fieldId;
      const crop = btn.dataset.crop;
      deleteTreatmentQuick(tId, fId, crop);
    };
  });

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
  const seasonFiltered = currentSeasonYear === 'all'
    ? sorted
    : sorted.filter(t => isDateInSeason(t.date, currentSeasonYear));

  const filtered = seasonFiltered.filter(t => 
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
      const fieldTreatments = treatments.filter(t => t.fieldId === field.id && isDateInSeason(t.date, currentSeasonYear));
      html += `
        <div class="card" style="padding: 12px 14px; margin-bottom: 0; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
          <div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #ffffff;">🌾 ${escapeHTML(field.name)}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary);">
              ${parseFloat(field.areaHa).toFixed(2)} ha • <strong>${escapeHTML(field.crop || 'Brak uprawy')}</strong> (${fieldTreatments.length} zabiegów w ${currentSeasonYear === 'all' ? 'historii' : 'sezonie'})
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
        📋 Historia wykonanych zabiegów ${currentSeasonYear === 'all' ? '(Wszystkie sezony)' : `(Sezon ${currentSeasonYear})`}:
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

let currentRecordsCategoryFilter = 'all';

function getUniqueAppliedSprays() {
  const map = new Map();
  const seasonTreatments = getSeasonTreatments();
  const seasonFields = getSeasonFields();

  // 1. Z bazy zabiegów wybranego sezonu (seasonTreatments)
  seasonTreatments.forEach(t => {
    if (!t.product || !t.product.trim()) return;
    const name = t.product.trim();
    const key = name.toLowerCase();

    const relatedField = fields.find(f => f.id === t.fieldId);
    const cropName = relatedField ? (relatedField.crop || 'Inna uprawa') : '';
    const fieldArea = relatedField ? (parseFloat(relatedField.areaHa) || 0) : 0;
    const fieldName = t.fieldName || (relatedField ? relatedField.name : 'Pole');

    if (!map.has(key)) {
      map.set(key, {
        name: name,
        type: t.treatmentType || 'Herbicyd',
        crops: new Set(),
        fieldsMap: new Map(),
        treatmentCount: 0,
        lastDate: t.date || '',
        doses: new Set(),
        waterVolumes: new Set(),
        reasons: new Set(),
        notes: new Set()
      });
    }

    const item = map.get(key);
    item.treatmentCount++;
    if (cropName) item.crops.add(cropName);
    if (t.fieldId) {
      item.fieldsMap.set(t.fieldId, { name: fieldName, area: fieldArea });
    }
    if (t.date && (!item.lastDate || new Date(t.date) > new Date(item.lastDate))) {
      item.lastDate = t.date;
    }
    if (t.dosePerHa && t.dosePerHa.trim()) item.doses.add(t.dosePerHa.trim());
    if (t.waterVolume) item.waterVolumes.add(t.waterVolume);
    if (t.reasonTarget && t.reasonTarget.trim()) item.reasons.add(t.reasonTarget.trim());
    if (t.notes && t.notes.trim()) item.notes.add(t.notes.trim());
    if (t.treatmentType) item.type = t.treatmentType;
  });

  // 2. Z pól wybranego sezonu (seasonFields)
  seasonFields.forEach(f => {
    if (!f.sprays || !f.sprays.trim()) return;
    const sprayList = f.sprays.split(',');
    sprayList.forEach(rawS => {
      const name = rawS.trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        const foundPopular = POPULAR_SPRAYS.find(p => p.name.toLowerCase() === key);
        map.set(key, {
          name: name,
          type: foundPopular ? foundPopular.type : 'Oprysk',
          crops: new Set(f.crop ? [f.crop] : []),
          fieldsMap: new Map([[f.id, { name: f.name, area: parseFloat(f.areaHa) || 0 }]]),
          treatmentCount: 1,
          lastDate: f.sowingDate || '',
          doses: new Set(),
          waterVolumes: new Set(),
          reasons: new Set(),
          notes: new Set()
        });
      } else {
        const item = map.get(key);
        if (f.crop) item.crops.add(f.crop);
        item.fieldsMap.set(f.id, { name: f.name, area: parseFloat(f.areaHa) || 0 });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.lastDate && b.lastDate) return new Date(b.lastDate) - new Date(a.lastDate);
    if (a.lastDate) return -1;
    if (b.lastDate) return 1;
    return b.treatmentCount - a.treatmentCount;
  });
}

function renderUniqueSpraysRecords() {
  const container = document.getElementById('records-sprays-container');
  const chipsContainer = document.getElementById('records-category-chips');
  if (!container) return;

  const uniqueSprays = getUniqueAppliedSprays();
  const query = (document.getElementById('records-spray-search-input')?.value || '').toLowerCase().trim();

  // Kategorie
  const categories = [
    { key: 'all', label: 'Wszystkie', icon: '🌾' },
    { key: 'Herbicyd', label: 'Herbicydy', icon: '🌿' },
    { key: 'Fungicyd', label: 'Fungicydy', icon: '🍄' },
    { key: 'Insektycyd', label: 'Insektycydy', icon: '🐛' },
    { key: 'Regulator', label: 'Regulatory', icon: '📏' },
    { key: 'Nawóz dolistny', label: 'Odżywki', icon: '🧪' },
    { key: 'Nawóz doglebowy', label: 'Doglebowe', icon: '🌱' }
  ];

  if (chipsContainer) {
    chipsContainer.innerHTML = categories.map(cat => {
      const isActive = currentRecordsCategoryFilter === cat.key;
      const count = cat.key === 'all' 
        ? uniqueSprays.length 
        : uniqueSprays.filter(s => (s.type || '').toLowerCase().includes(cat.key.toLowerCase())).length;
      return `
        <button class="chip ${isActive ? 'active' : ''}" data-cat="${cat.key}" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; width:100%; padding:6px 4px; line-height:1.2;">
          <span>${cat.icon} ${escapeHTML(cat.label)}</span>
          <span style="font-size:0.72rem; font-weight:800; opacity:0.85; margin-top:2px;">(${count})</span>
        </button>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.chip').forEach(btn => {
      btn.onclick = () => {
        currentRecordsCategoryFilter = btn.dataset.cat;
        renderUniqueSpraysRecords();
      };
    });
  }

  // Filtrowanie
  const filtered = uniqueSprays.filter(s => {
    const matchesCat = currentRecordsCategoryFilter === 'all' || 
      (s.type || '').toLowerCase().includes(currentRecordsCategoryFilter.toLowerCase());
    const cropsStr = Array.from(s.crops).join(' ').toLowerCase();
    const fieldsStr = Array.from(s.fieldsMap.values()).map(f => f.name).join(' ').toLowerCase();
    const matchesQuery = !query || 
      s.name.toLowerCase().includes(query) ||
      (s.type || '').toLowerCase().includes(query) ||
      cropsStr.includes(query) ||
      fieldsStr.includes(query);
    return matchesCat && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px 16px;">
        <div class="empty-icon">🧪</div>
        <h3>Brak zapisanych unikalnych oprysków</h3>
        <p style="margin-top:6px; color:var(--text-secondary);">${query ? 'Nie znaleziono oprysków pasujących do wyszukiwania.' : 'Gdy dodasz opryski do pól lub wykonasz zabieg, pojawią się tutaj bez żadnych powtórzeń!'}</p>
        <button class="btn btn-primary" id="btn-empty-add-treatment" style="margin-top:14px;">
          ➕ Wpisz Pierwszy Oprysk
        </button>
      </div>
    `;
    const btnEmpty = document.getElementById('btn-empty-add-treatment');
    if (btnEmpty) btnEmpty.onclick = () => openTreatmentModal();
    return;
  }

  let html = `
    <div style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:12px; font-weight:700; display:flex; justify-content:space-between; align-items:center;">
      <span>Łącznie unikalnych środków: <strong style="color:#22c55e;">${filtered.length}</strong></span>
      <span style="font-size:0.75rem; color:#38bdf8;">✨ Bez powtórzeń</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
  `;

  filtered.forEach(s => {
    let typeColor = '#38bdf8';
    if (s.type === 'Herbicyd') typeColor = '#22c55e';
    if (s.type === 'Fungicyd') typeColor = '#eab308';
    if (s.type === 'Insektycyd') typeColor = '#ef4444';
    if (s.type === 'Regulator') typeColor = '#a855f7';
    if (s.type.includes('Nawóz')) typeColor = '#06b6d4';

    const cropsArr = Array.from(s.crops);
    const fieldsArr = Array.from(s.fieldsMap.values());
    const totalArea = fieldsArr.reduce((sum, f) => sum + (f.area || 0), 0).toFixed(2);
    const lastDateFormatted = s.lastDate ? new Date(s.lastDate + 'T00:00:00').toLocaleDateString('pl-PL') : 'Brak daty';
    const dosesStr = Array.from(s.doses).join(', ');

    html += `
      <div class="card" style="padding:14px; margin-bottom:0; border:1px solid var(--border-color); background:var(--bg-card); border-radius:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
          <div>
            <div style="font-size:1.05rem; font-weight:800; color:var(--heading-color);">🧪 ${escapeHTML(s.name)}</div>
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:5px;">
              ${cropsArr.map(c => `
                <span class="badge" style="font-size:0.72rem; padding:2px 6px; background:var(--bg-card-alt); color:#38bdf8; border:1px solid #334155;">
                  🌾 ${escapeHTML(c)}
                </span>
              `).join('')}
            </div>
          </div>
          <span class="badge" style="background:var(--bg-card-alt); color:${typeColor}; border:1px solid ${typeColor}; font-size:0.78rem; white-space:nowrap; font-weight:700;">
            ${escapeHTML(s.type)}
          </span>
        </div>

        <div style="font-size:0.82rem; color:var(--text-secondary); margin:8px 0; line-height:1.4;">
          <div>📍 Działki: <strong>${fieldsArr.length}</strong> (łącznie <strong style="color:#22c55e;">${totalArea} ha</strong>) • Użyto: <strong>${s.treatmentCount}x</strong></div>
          <div>📅 Ostatnie użycie: <strong style="color:var(--heading-color);">${lastDateFormatted}</strong></div>
          ${dosesStr ? `<div>💧 Stosowane dawki: <strong style="color:var(--heading-color);">${escapeHTML(dosesStr)}</strong></div>` : ''}
          ${fieldsArr.length > 0 ? `<div style="font-size:0.76rem; color:#94a3b8; margin-top:3px;">🌾 Pola: ${escapeHTML(fieldsArr.map(f=>f.name).join(', '))}</div>` : ''}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:10px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
          <div style="display:flex; gap:6px;">
            <button class="btn btn-sm btn-secondary btn-edit-unique-spray" data-spray-name="${escapeHTML(s.name)}" data-spray-type="${escapeHTML(s.type)}" title="Edytuj nazwę lub rodzaj" style="padding:6px 10px; font-size:0.75rem; border-radius:6px; cursor:pointer;">
              ✏️ Edytuj
            </button>
            <button class="btn btn-sm btn-secondary btn-delete-unique-spray" data-spray-name="${escapeHTML(s.name)}" title="Usuń ten środek ze wszystkich wpisów" style="padding:6px 10px; font-size:0.75rem; color:#ef4444; border-color:rgba(239,68,68,0.3); border-radius:6px; cursor:pointer;">
              🗑️ Usuń
            </button>
          </div>
          <button class="btn btn-sm btn-primary btn-apply-unique-spray" data-spray-name="${escapeHTML(s.name)}" data-spray-type="${escapeHTML(s.type)}" style="padding:6px 14px; font-size:0.78rem; font-weight:700; border-radius:6px; cursor:pointer; white-space:nowrap;">
            ➕ Zastosuj
          </button>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  container.querySelectorAll('.btn-edit-unique-spray').forEach(btn => {
    btn.onclick = () => {
      const sprayName = btn.dataset.sprayName;
      const sprayType = btn.dataset.sprayType;
      openEditSprayModal(sprayName, sprayType);
    };
  });

  container.querySelectorAll('.btn-delete-unique-spray').forEach(btn => {
    btn.onclick = () => {
      const sprayName = btn.dataset.sprayName;
      deleteUniqueSpray(sprayName);
    };
  });

  container.querySelectorAll('.btn-apply-unique-spray').forEach(btn => {
    btn.onclick = () => {
      const sprayName = btn.dataset.sprayName;
      const sprayType = btn.dataset.sprayType;
      openTreatmentModal(null, null);
      setTimeout(() => {
        const prodInput = document.getElementById('modal-treatment-product');
        const typeSelect = document.getElementById('modal-treatment-type');
        if (prodInput) prodInput.value = sprayName;
        if (typeSelect && sprayType) typeSelect.value = sprayType;
      }, 50);
    };
  });
}

function openEditSprayModal(name, type) {
  const modal = document.getElementById('edit-spray-modal');
  if (!modal) return;

  document.getElementById('modal-edit-spray-old-name').value = name || '';
  document.getElementById('modal-edit-spray-name').value = name || '';
  const typeSelect = document.getElementById('modal-edit-spray-type');
  if (typeSelect && type) {
    typeSelect.value = type;
  }
  modal.classList.add('active');
}

function closeEditSprayModal() {
  const modal = document.getElementById('edit-spray-modal');
  if (modal) modal.classList.remove('active');
}

function saveEditSprayFromModal() {
  const oldName = (document.getElementById('modal-edit-spray-old-name')?.value || '').trim();
  const newName = (document.getElementById('modal-edit-spray-name')?.value || '').trim();
  const newType = document.getElementById('modal-edit-spray-type')?.value || 'Herbicyd';

  if (!newName) {
    showToast('Podaj nazwę środka!');
    return;
  }

  const oldLower = oldName.toLowerCase();

  // 1. Zaktualizuj wpisy w treatments
  treatments.forEach(t => {
    if (t.product && t.product.trim().toLowerCase() === oldLower) {
      t.product = newName;
      if (newType) t.treatmentType = newType;
    }
  });

  // 2. Zaktualizuj wpisy w fields.sprays
  fields.forEach(f => {
    if (f.sprays && f.sprays.toLowerCase().includes(oldLower)) {
      const parts = f.sprays.split(',').map(s => {
        if (s.trim().toLowerCase() === oldLower) {
          return newName;
        }
        return s.trim();
      });
      f.sprays = parts.join(', ');
    }
  });

  saveTreatmentsData(false);
  saveFieldsData(false);
  closeEditSprayModal();
  showToast(`✏️ Zaktualizowano środek: ${newName}`);
}

function deleteUniqueSpray(sprayName) {
  if (!sprayName) return;
  const targetLower = sprayName.trim().toLowerCase();

  const confirmMsg = `Czy na pewno chcesz usunąć środek "${sprayName}" ze wszystkich pól i ewidencji zabiegów?`;
  if (!confirm(confirmMsg)) return;

  // 1. Usuń zabiegi z treatments
  treatments = treatments.filter(t => (t.product || '').trim().toLowerCase() !== targetLower);

  // 2. Usuń ten środek z pól fields.sprays
  fields.forEach(f => {
    if (f.sprays && f.sprays.toLowerCase().includes(targetLower)) {
      const parts = f.sprays.split(',')
        .map(s => s.trim())
        .filter(s => s.toLowerCase() !== targetLower);
      f.sprays = parts.join(', ');
    }
  });

  saveTreatmentsData(false);
  saveFieldsData(false);
  showToast(`🗑️ Usunięto środek: ${sprayName}`);
}

const POPULAR_SPRAYS = [
  { name: 'Boxer 800 EC', type: 'Herbicyd' },
  { name: 'Input Plex', type: 'Fungicyd' },
  { name: 'Axial Komplett Pak', type: 'Herbicyd' },
  { name: 'Moddus 250 EC', type: 'Regulator' },
  { name: 'Caryx 240 SL', type: 'Regulator' },
  { name: 'Priaxor', type: 'Fungicyd' },
  { name: 'Delcaps 050 CS', type: 'Insektycyd' },
  { name: 'Mocznik 46%', type: 'Nawóz dolistny' },
  { name: 'Siarczan magnezu', type: 'Nawóz dolistny' },
  { name: 'Tarcza Łan 250 EW', type: 'Fungicyd' },
  { name: 'Falcon 460 EC', type: 'Fungicyd' },
  { name: 'CCC 750 (Antywylegacz)', type: 'Regulator' },
  { name: 'Roundup 360 Plus', type: 'Herbicyd' },
  { name: 'Mustang Forte 195 SE', type: 'Herbicyd' },
  { name: 'Lancet Plus 125 WG', type: 'Herbicyd' },
  { name: 'Biathlon 4D', type: 'Herbicyd' },
  { name: 'Prosaro 250 EC', type: 'Fungicyd' },
  { name: 'Elatus Era', type: 'Fungicyd' },
  { name: 'Amistar 250 SC', type: 'Fungicyd' },
  { name: 'Karate Zeon 050 CS', type: 'Insektycyd' },
  { name: 'Kipen 050 SL', type: 'Insektycyd' },
  { name: 'Saletra amonowa', type: 'Nawóz doglebowy' },
  { name: 'Polifoska 6 / 8', type: 'Nawóz doglebowy' },
  { name: 'YaraVita Zboże / Rzepak', type: 'Nawóz dolistny' }
];

function populateSpraySuggestions() {
  const datalist = document.getElementById('spray-suggestions');
  if (!datalist) return;

  const map = new Map();
  POPULAR_SPRAYS.forEach(s => {
    map.set(s.name, s.type);
  });
  treatments.forEach(t => {
    if (t.product && t.product.trim()) {
      map.set(t.product.trim(), t.treatmentType || 'Oprysk');
    }
  });
  fields.forEach(f => {
    if (f.sprays && f.sprays.trim()) {
      f.sprays.split(',').forEach(s => {
        if (s.trim() && !map.has(s.trim())) {
          map.set(s.trim(), 'Oprysk');
        }
      });
    }
  });

  datalist.innerHTML = Array.from(map.entries()).map(([name, type]) => `
    <option value="${escapeHTML(name)}" label="${escapeHTML(type)}">
  `).join('');
}

function openFieldModal(fieldData = null, prefillCrop = null, hideExtras = false) {
  const modal = document.getElementById('field-modal');
  const title = document.getElementById('field-modal-title');
  const form = document.getElementById('field-form');
  const extraSec = document.getElementById('field-modal-extra-section');
  if (!modal || !form) return;

  form.reset();

  if (extraSec) {
    extraSec.style.display = hideExtras ? 'none' : 'block';
  }

  if (fieldData && fieldData.id) {
    title.textContent = 'Edytuj Pole / Działkę';
    document.getElementById('modal-field-id').value = fieldData.id;
    document.getElementById('modal-field-name').value = fieldData.name || '';
    document.getElementById('modal-field-area').value = fieldData.areaHa || '';
    document.getElementById('modal-field-parcel').value = fieldData.parcelNo || '';
    document.getElementById('modal-field-crop').value = fieldData.crop || '';
    document.getElementById('modal-field-variety').value = fieldData.variety || '';
    document.getElementById('modal-field-sowing-date').value = fieldData.sowingDate || '';
    
    // Pobierz istniejące zabiegi do pola oprysków
    const fTreatments = treatments.filter(t => t.fieldId === fieldData.id);
    const existingProducts = fTreatments.map(t => t.product).filter(Boolean);
    const sprayText = fieldData.sprays || existingProducts.join(', ');
    const spraysInput = document.getElementById('modal-field-sprays');
    const notesInput = document.getElementById('modal-field-notes');
    const typeSelect = document.getElementById('modal-field-treatment-type');
    if (spraysInput) spraysInput.value = sprayText;
    if (notesInput) notesInput.value = fieldData.notes || '';
    if (typeSelect && fTreatments.length > 0 && fTreatments[0].treatmentType) {
      typeSelect.value = fTreatments[0].treatmentType;
    }
  } else {
    const cropToUse = prefillCrop !== null ? prefillCrop : (currentFieldCropFilter !== 'all' ? getCropDefaultName(currentFieldCropFilter) : '');
    title.textContent = cropToUse 
      ? `Dodaj Pole (${cropToUse})`
      : 'Dodaj Nowe Pole / Działkę';
    document.getElementById('modal-field-id').value = '';
    const now = new Date();
    let defDate = now.toISOString().split('T')[0];
    if (currentSeasonYear && currentSeasonYear !== 'all') {
      if (currentSeasonYear.includes('/')) {
        const [y1, y2] = currentSeasonYear.split('/').map(Number);
        if (now.getFullYear() !== y1 && now.getFullYear() !== y2) {
          defDate = `${y1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
      } else {
        defDate = `${currentSeasonYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
    }
    document.getElementById('modal-field-sowing-date').value = defDate;
    document.getElementById('modal-field-crop').value = cropToUse || '';
    document.getElementById('modal-field-variety').value = '';
    const spraysInput = document.getElementById('modal-field-sprays');
    const notesInput = document.getElementById('modal-field-notes');
    if (spraysInput) spraysInput.value = '';
    if (notesInput) notesInput.value = '';
  }

  // Wypełnij listę istniejących pól do szybkiego wyboru
  const datalist = document.getElementById('existing-fields-suggestions');
  if (datalist) {
    datalist.innerHTML = fields.map(f => `
      <option value="${escapeHTML(f.name)}" label="${parseFloat(f.areaHa).toFixed(2)} ha ${f.crop ? `(${escapeHTML(f.crop)})` : ''}">
    `).join('');
  }

  // Wypełnij podpowiedzi oprysków
  populateSpraySuggestions();

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
  const treatmentType = document.getElementById('modal-field-treatment-type')?.value || 'Herbicyd';
  const sprays = (document.getElementById('modal-field-sprays')?.value || '').trim();
  const notes = (document.getElementById('modal-field-notes')?.value || '').trim();
  const syncAllSprays = document.getElementById('modal-field-sync-sprays')?.checked;

  if (!name || areaHa <= 0) {
    showToast('Podaj nazwę pola i poprawną powierzchnię w ha!');
    return;
  }

  if (id) {
    const idx = fields.findIndex(f => f.id === id);
    if (idx !== -1) {
      const oldSprays = fields[idx].sprays || '';
      fields[idx] = { 
        ...fields[idx], 
        name, 
        areaHa, 
        parcelNo, 
        crop, 
        variety, 
        sowingDate,
        sprays,
        notes
      };

      // Jeśli wyczyszczono opryski
      if (!sprays && oldSprays) {
        if (syncAllSprays && crop) {
          const matchingFields = fields.filter(f => (f.crop || '').toLowerCase().trim() === crop.toLowerCase().trim());
          matchingFields.forEach(f => { f.sprays = ''; });
          treatments = treatments.filter(t => !matchingFields.some(mf => mf.id === t.fieldId));
          saveTreatmentsData(true);
          showToast(`Usunięto opryski ze wszystkich pól z uprawą: ${crop}!`);
        } else {
          treatments = treatments.filter(t => t.fieldId !== id);
          saveTreatmentsData(true);
          showToast('Usunięto opryski z tego pola!');
        }
      } else if (sprays && syncAllSprays && crop) {
        const matchingFields = fields.filter(f => (f.crop || '').toLowerCase().trim() === crop.toLowerCase().trim());
        matchingFields.forEach(f => { f.sprays = sprays; });
        matchingFields.forEach(f => {
          const exists = treatments.some(t => t.fieldId === f.id && t.product.toLowerCase().trim() === sprays.toLowerCase().trim());
          if (!exists) {
            const oldT = treatments.find(t => t.fieldId === f.id && oldSprays && t.product.toLowerCase().trim() === oldSprays.toLowerCase().trim());
            if (oldT) {
              oldT.product = sprays;
              oldT.treatmentType = treatmentType;
            } else {
              treatments.push({
                id: 'treatment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                fieldId: f.id,
                fieldName: f.name,
                date: sowingDate || new Date().toISOString().split('T')[0],
                treatmentType: treatmentType,
                product: sprays,
                dosePerHa: '',
                waterVolume: 200,
                reasonTarget: 'Zabieg polowy',
                notes: '',
                createdAt: new Date().toISOString()
              });
            }
          }
        });
        saveTreatmentsData(true);
        showToast(`Zaktualizowano opryski we wszystkich polach z uprawą: ${crop}!`);
      } else if (sprays && sprays !== oldSprays) {
        const oldT = treatments.find(t => t.fieldId === id && oldSprays && t.product.toLowerCase().trim() === oldSprays.toLowerCase().trim());
        if (oldT) {
          oldT.product = sprays;
          oldT.treatmentType = treatmentType;
        } else {
          treatments.push({
            id: 'treatment_' + Date.now(),
            fieldId: id,
            fieldName: name,
            date: sowingDate || new Date().toISOString().split('T')[0],
            treatmentType: treatmentType,
            product: sprays,
            dosePerHa: '',
            waterVolume: 200,
            reasonTarget: 'Zabieg polowy',
            notes: '',
            createdAt: new Date().toISOString()
          });
        }
        saveTreatmentsData(true);
        showToast('Zaktualizowano dane pola i opryski!');
      } else {
        showToast('Zaktualizowano dane pola!');
      }
    }
  } else {
    const targetSeason = (currentSeasonYear && currentSeasonYear !== 'all') ? currentSeasonYear : getDefaultCurrentSeason();
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
      season: targetSeason,
      createdAt: new Date().toISOString()
    };
    fields.push(newField);

    if (sprays && syncAllSprays && crop) {
      const matchingFields = fields.filter(f => (f.crop || '').toLowerCase().trim() === crop.toLowerCase().trim() && getFieldSeason(f) === targetSeason);
      matchingFields.forEach(f => {
        f.sprays = sprays;
        const exists = treatments.some(t => t.fieldId === f.id && t.product.toLowerCase() === sprays.toLowerCase());
        if (!exists) {
          treatments.push({
            id: 'treatment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            fieldId: f.id,
            fieldName: f.name,
            date: sowingDate || new Date().toISOString().split('T')[0],
            treatmentType: treatmentType,
            product: sprays,
            dosePerHa: '',
            waterVolume: 200,
            reasonTarget: 'Zabieg polowy',
            notes: '',
            season: targetSeason,
            createdAt: new Date().toISOString()
          });
        }
      });
      saveTreatmentsData(true);
      showToast(`Dodano pole i zapisano opryski we wszystkich polach z uprawą: ${crop}!`);
    } else if (sprays) {
      treatments.push({
        id: 'treatment_' + Date.now(),
        fieldId: fieldId,
        fieldName: name,
        date: sowingDate || new Date().toISOString().split('T')[0],
        treatmentType: treatmentType,
        product: sprays,
        dosePerHa: '',
        waterVolume: 200,
        reasonTarget: 'Zabieg polowy',
        notes: '',
        season: targetSeason,
        createdAt: new Date().toISOString()
      });
      saveTreatmentsData(true);
      showToast('Dodano pole do rejestru!');
    } else {
      showToast('Dodano pole do rejestru!');
    }
  }

  saveFieldsData();
  closeFieldModal();
  renderFieldsStats();
  renderFieldsList();
  switchFieldTab('fields-all');
}

function deleteTreatmentQuick(treatmentId, fieldId, crop) {
  const targetT = treatments.find(t => t.id === treatmentId);
  if (!targetT) return;

  const matchingCropTreatments = treatments.filter(t => {
    if (t.product.toLowerCase().trim() !== targetT.product.toLowerCase().trim()) return false;
    const fld = fields.find(f => f.id === t.fieldId);
    return fld && (fld.crop || '').toLowerCase().trim() === (crop || '').toLowerCase().trim();
  });

  if (matchingCropTreatments.length > 1) {
    if (confirm(`Czy chcesz usunąć oprysk "${targetT.product}" ze WSZYSTKICH pól z uprawą "${crop}" (${matchingCropTreatments.length} działek)?\n\nKliknij [OK], aby usunąć z całej uprawy.\nKliknij [Anuluj], jeśli chcesz usunąć tylko z tego jednego pola.`)) {
      const matchIds = new Set(matchingCropTreatments.map(t => t.id));
      treatments = treatments.filter(t => !matchIds.has(t.id));
      fields.filter(f => (f.crop || '').toLowerCase().trim() === (crop || '').toLowerCase().trim()).forEach(f => {
        f.sprays = '';
      });
      saveTreatmentsData(true);
      saveFieldsData(true);
      renderFieldsList();
      showToast(`🗑️ Usunięto oprysk "${targetT.product}" ze wszystkich pól z uprawą: ${crop}!`);
      return;
    }
  }

  if (confirm(`Czy na pewno chcesz usunąć oprysk "${targetT.product}" z tego pola?`)) {
    treatments = treatments.filter(t => t.id !== treatmentId);
    const fld = fields.find(f => f.id === fieldId);
    if (fld) {
      fld.sprays = '';
      saveFieldsData(true);
    }
    saveTreatmentsData(true);
    renderFieldsList();
    showToast(`🗑️ Usunięto oprysk "${targetT.product}"!`);
  }
}

function deleteField(id) {
  if (confirm('Czy na pewno chcesz usunąć to pole z rejestru?')) {
    fields = fields.filter(f => f.id !== id);
    saveFieldsData();
    showToast('Usunięto pole.');
  }
}

function updateTreatmentApplyAllLabel() {
  const fieldSelect = document.getElementById('modal-treatment-field');
  const labelEl = document.getElementById('modal-treatment-apply-all-label');
  if (!fieldSelect || !labelEl) return;
  const sId = fieldSelect.value;
  const f = fields.find(fld => fld.id === sId);
  if (f && f.crop) {
    labelEl.innerHTML = `🔄 Zapisz ten oprysk we <strong>wszystkich polach z uprawą: ${escapeHTML(f.crop)}</strong>`;
  } else {
    labelEl.innerHTML = `🔄 Zapisz ten oprysk we <strong>wszystkich polach z tą uprawą</strong>`;
  }
}

function openTreatmentModal(treatmentData = null, preselectedFieldId = null) {
  const modal = document.getElementById('treatment-modal');
  const title = document.getElementById('treatment-modal-title');
  const form = document.getElementById('treatment-form');
  const fieldSelect = document.getElementById('modal-treatment-field');
  const applyAllCheckbox = document.getElementById('modal-treatment-apply-all');
  if (!modal || !form || !fieldSelect) return;

  const seasonFields = getSeasonFields();
  if (seasonFields.length === 0) {
    showToast(`Najpierw dodaj przynajmniej jedno pole w sezonie ${currentSeasonYear === 'all' ? '' : currentSeasonYear}!`);
    openFieldModal();
    return;
  }

  form.reset();

  fieldSelect.innerHTML = seasonFields.map(f => `
    <option value="${f.id}" data-name="${escapeHTML(f.name)}" data-crop="${escapeHTML(f.crop || '')}">
      🌾 ${escapeHTML(f.name)} (${parseFloat(f.areaHa).toFixed(2)} ha - ${escapeHTML(f.crop || 'Brak uprawy')})
    </option>
  `).join('');

  fieldSelect.onchange = updateTreatmentApplyAllLabel;

  if (applyAllCheckbox) applyAllCheckbox.checked = true;

  if (treatmentData && treatmentData.id) {
    title.textContent = 'Edytuj Zabieg / Oprysk';
    document.getElementById('modal-treatment-id').value = treatmentData.id;
    fieldSelect.value = treatmentData.fieldId || seasonFields[0].id;
    document.getElementById('modal-treatment-date').value = treatmentData.date || '';
    document.getElementById('modal-treatment-type').value = treatmentData.treatmentType || 'Herbicyd';
    document.getElementById('modal-treatment-product').value = treatmentData.product || '';
    document.getElementById('modal-treatment-dose').value = treatmentData.dosePerHa || '';
    document.getElementById('modal-treatment-water').value = treatmentData.waterVolume || '';
    document.getElementById('modal-treatment-reason').value = treatmentData.reasonTarget || '';
    document.getElementById('modal-treatment-notes').value = treatmentData.notes || '';
    if (applyAllCheckbox) applyAllCheckbox.checked = false;
  } else {
    title.textContent = 'Zapisz Nowy Zabieg / Oprysk';
    document.getElementById('modal-treatment-id').value = '';
    const now = new Date();
    let defDate = now.toISOString().split('T')[0];
    if (currentSeasonYear && currentSeasonYear !== 'all') {
      if (currentSeasonYear.includes('/')) {
        const [y1, y2] = currentSeasonYear.split('/').map(Number);
        if (now.getFullYear() !== y1 && now.getFullYear() !== y2) {
          defDate = `${y1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        }
      } else {
        defDate = `${currentSeasonYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }
    }
    document.getElementById('modal-treatment-date').value = defDate;
    if (preselectedFieldId) fieldSelect.value = preselectedFieldId;
  }

  populateSpraySuggestions();
  updateTreatmentApplyAllLabel();
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
  const applyAll = document.getElementById('modal-treatment-apply-all')?.checked;

  const selectedField = fields.find(f => f.id === fieldId);
  const targetCrop = selectedField ? (selectedField.crop || '').trim() : '';

  const date = document.getElementById('modal-treatment-date').value;
  const treatmentType = document.getElementById('modal-treatment-type').value;
  const product = document.getElementById('modal-treatment-product').value.trim();
  const dosePerHa = document.getElementById('modal-treatment-dose').value.trim();
  const waterVolume = parseFloat(document.getElementById('modal-treatment-water').value) || null;
  const reasonTarget = document.getElementById('modal-treatment-reason').value.trim();
  const notes = document.getElementById('modal-treatment-notes').value.trim();

  if (!product || !date) {
    showToast('Podaj datę oraz nazwę zastosowanego środka!');
    return;
  }

  const targetSeason = (currentSeasonYear && currentSeasonYear !== 'all') ? currentSeasonYear : getDefaultCurrentSeason();

  if (id) {
    const idx = treatments.findIndex(t => t.id === id);
    if (idx !== -1) {
      treatments[idx] = {
        ...treatments[idx],
        fieldId,
        fieldName,
        date,
        treatmentType,
        product,
        dosePerHa,
        waterVolume,
        reasonTarget,
        notes,
        season: targetSeason
      };
      showToast('Zaktualizowano zabieg.');
    }
  } else {
    if (applyAll && targetCrop) {
      const matchingFields = getSeasonFields().filter(f => (f.crop || '').toLowerCase().trim() === targetCrop.toLowerCase().trim());
      matchingFields.forEach(f => {
        treatments.push({
          id: 'treatment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          fieldId: f.id,
          fieldName: f.name,
          date,
          treatmentType,
          product,
          dosePerHa,
          waterVolume,
          reasonTarget,
          notes,
          season: targetSeason,
          createdAt: new Date().toISOString()
        });
      });
      saveFieldsData(true);
      showToast(`✅ Zapisano oprysk we wszystkich polach z uprawą: ${targetCrop} (${matchingFields.length} działek)!`);
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
        season: targetSeason,
        createdAt: new Date().toISOString()
      };
      treatments.push(newT);

      if (selectedField) {
        if (selectedField.sprays) {
          if (!selectedField.sprays.toLowerCase().includes(product.toLowerCase())) {
            selectedField.sprays = `${selectedField.sprays}, ${product}`;
          }
        } else {
          selectedField.sprays = product;
        }
        saveFieldsData(true);
      }

      showToast('Zapisano zabieg w ewidencji!');
    }
  }

  saveTreatmentsData();
  closeTreatmentModal();
  renderFieldsList();
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

/* ==========================================================================
   MODUŁ: MASZYNY I SPRZĘT (TRACTORS, EQUIPMENT, MOTOHOURS, SERVICE & COSTS)
   ========================================================================== */

function initMachinesModule() {
  const btnAdd = document.getElementById('btn-add-machine');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => openMachineModal());
  }

  // Wyszukiwarka maszyn
  const searchInput = document.getElementById('machine-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => renderMachinesList());
  }

  // Filtry kategorii sprzętu
  const filterChips = document.querySelectorAll('#machine-filter-chips .chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentMachineFilter = chip.dataset.machineFilter || 'all';
      renderMachinesList();
    });
  });

  // Modal maszyny
  const machineModal = document.getElementById('machine-modal');
  const btnCloseMachine = document.getElementById('btn-close-machine-modal');
  const machineForm = document.getElementById('machine-form');

  if (btnCloseMachine) {
    btnCloseMachine.addEventListener('click', closeMachineModal);
  }
  if (machineModal) {
    machineModal.addEventListener('click', (e) => {
      if (e.target === machineModal) closeMachineModal();
    });
  }
  if (machineForm) {
    machineForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveMachineFromModal();
    });
  }

  // Modal serwisu / naprawy
  const serviceModal = document.getElementById('machine-service-modal');
  const btnCloseService = document.getElementById('btn-close-service-modal');
  const serviceForm = document.getElementById('machine-service-form');

  if (btnCloseService) {
    btnCloseService.addEventListener('click', closeMachineServiceModal);
  }
  if (serviceModal) {
    serviceModal.addEventListener('click', (e) => {
      if (e.target === serviceModal) closeMachineServiceModal();
    });
  }
  if (serviceForm) {
    serviceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveMachineServiceFromModal();
    });
  }

  // Modal szybkiej aktualizacji motogodzin
  const mthModal = document.getElementById('machine-update-mth-modal');
  const btnCloseMth = document.getElementById('btn-close-mth-modal');
  const mthForm = document.getElementById('machine-update-mth-form');

  if (btnCloseMth) {
    btnCloseMth.addEventListener('click', closeUpdateMthModal);
  }
  if (mthModal) {
    mthModal.addEventListener('click', (e) => {
      if (e.target === mthModal) closeUpdateMthModal();
    });
  }
  if (mthForm) {
    mthForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveMthFromModal();
    });
  }
}

function renderMachinesStats() {
  const countEl = document.getElementById('stats-machines-count');
  const dueEl = document.getElementById('stats-machines-due');
  const costEl = document.getElementById('stats-machines-repairs-cost');

  if (countEl) countEl.textContent = machines.length;

  let dueCount = 0;
  const today = new Date();
  today.setHours(0,0,0,0);

  machines.forEach(m => {
    let isDue = false;
    // Sprawdź przegląd
    if (m.inspectionDate) {
      const inspDate = new Date(m.inspectionDate + 'T00:00:00');
      const diffDays = Math.ceil((inspDate - today) / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) isDue = true;
    }
    // Sprawdź olej
    if (m.hours != null && m.lastOilHours != null && m.oilInterval) {
      const nextOil = (parseInt(m.lastOilHours) || 0) + (parseInt(m.oilInterval) || 250);
      const remHours = nextOil - (parseInt(m.hours) || 0);
      if (remHours <= 20) isDue = true;
    }
    if (isDue) dueCount++;
  });

  if (dueEl) {
    dueEl.textContent = dueCount;
    dueEl.style.color = dueCount > 0 ? 'var(--accent-red)' : 'var(--primary)';
  }

  // Łączny koszt serwisów i napraw
  const totalCost = machineServices.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);
  if (costEl) {
    costEl.textContent = totalCost > 0 ? `${totalCost.toLocaleString('pl-PL')} zł` : '0 zł';
  }
}

function getMachineIcon(type) {
  switch (type) {
    case 'Ciągnik': return '🚜';
    case 'Kombajn': return '🌾';
    case 'Opryskiwacz': return '🧪';
    case 'Maszyna': return '⚙️';
    case 'Przyczepa': return '🚛';
    case 'Ładowarka': return '🏗️';
    default: return '📋';
  }
}

function renderMachinesList() {
  const container = document.getElementById('machines-container');
  if (!container) return;

  const searchQuery = (document.getElementById('machine-search-input')?.value || '').toLowerCase().trim();

  let filtered = machines.filter(m => {
    // Filtrowanie po tekście
    const matchSearch = (m.name && m.name.toLowerCase().includes(searchQuery)) ||
                        (m.regNo && m.regNo.toLowerCase().includes(searchQuery)) ||
                        (m.notes && m.notes.toLowerCase().includes(searchQuery));
    if (!matchSearch) return false;

    // Filtrowanie po typie
    if (currentMachineFilter === 'all') return true;
    return m.type === currentMachineFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px 14px; text-align: center;">
        <div class="empty-icon" style="font-size: 2.5rem; margin-bottom: 10px;">🚜</div>
        <h3 style="font-size: 1.1rem; font-weight: 800; margin-bottom: 6px;">Brak maszyn w wykazie</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 320px; margin: 0 auto 16px auto;">
          Dodaj swoje ciągniki i maszyny rolnicze, aby kontrolować motogodziny, terminy wymiany oleju i koszty napraw!
        </p>
        <button class="btn btn-primary" onclick="openMachineModal()" style="width: auto; padding: 8px 18px; margin: 0 auto;">
          ➕ Dodaj Pierwszą Maszynę
        </button>
      </div>
    `;
    return;
  }

  const today = new Date();
  today.setHours(0,0,0,0);

  let html = '';
  filtered.forEach(m => {
    const icon = getMachineIcon(m.type);
    const hours = parseInt(m.hours) || 0;
    const lastOil = parseInt(m.lastOilHours) || 0;
    const interval = parseInt(m.oilInterval) || 250;
    const nextOilHours = lastOil + interval;
    const oilRemaining = nextOilHours - hours;

    // Procent zużycia oleju
    const oilElapsed = Math.max(0, hours - lastOil);
    const oilPercent = Math.min(100, Math.round((oilElapsed / interval) * 100));

    let oilColor = '#22c55e';
    let oilStatusText = '';
    if (oilRemaining <= 0) {
      oilColor = '#ef4444';
      oilStatusText = `🚨 Wymień olej! (Przekroczono o ${Math.abs(oilRemaining)} Mth)`;
    } else if (oilRemaining <= 25) {
      oilColor = '#eab308';
      oilStatusText = `⚠️ Zbliża się wymiana (za ${oilRemaining} Mth)`;
    } else {
      oilStatusText = `✅ Za ${oilRemaining} Mth (przy ${nextOilHours} Mth)`;
    }

    // Przegląd techniczny / OC
    let inspStatusText = 'Brak terminu';
    let inspColor = 'var(--text-secondary)';
    let inspDaysLeft = null;

    if (m.inspectionDate) {
      const inspDate = new Date(m.inspectionDate + 'T00:00:00');
      inspDaysLeft = Math.ceil((inspDate - today) / (1000 * 60 * 60 * 24));
      const formattedDate = inspDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'numeric', year: 'numeric' });

      if (inspDaysLeft < 0) {
        inspColor = '#ef4444';
        inspStatusText = `🚨 Minął ${Math.abs(inspDaysLeft)} dni temu (${formattedDate})`;
      } else if (inspDaysLeft === 0) {
        inspColor = '#ef4444';
        inspStatusText = `🚨 TERMIN DZISIAJ! (${formattedDate})`;
      } else if (inspDaysLeft <= 30) {
        inspColor = '#eab308';
        inspStatusText = `⚠️ Za ${inspDaysLeft} dni (${formattedDate})`;
      } else {
        inspColor = 'var(--heading-color)';
        inspStatusText = `📅 ${formattedDate} (za ${inspDaysLeft} dni)`;
      }
    }

    // Usługi dla tej maszyny
    const services = machineServices
      .filter(s => s.machineId === m.id)
      .sort((a,b) => new Date(b.date) - new Date(a.date));
    const machTotalCost = services.reduce((sum, s) => sum + (parseFloat(s.cost) || 0), 0);

    html += `
      <div class="machine-card" data-machine-id="${m.id}">
        <!-- NAGŁÓWEK KARTY -->
        <div class="machine-card-header">
          <div>
            <div class="machine-title-row">
              <span style="font-size: 1.3rem;">${icon}</span>
              <h3 class="machine-title">${escapeHTML(m.name)}</h3>
              <span class="machine-type-badge">${escapeHTML(m.type || 'Maszyna')}</span>
              ${m.regNo ? `<span class="machine-reg-badge">${escapeHTML(m.regNo)}</span>` : ''}
            </div>
            ${m.notes ? `<div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">📝 ${escapeHTML(m.notes)}</div>` : ''}
          </div>

          <div class="machine-actions">
            <button class="icon-btn btn-mach-quick-mth" data-id="${m.id}" title="Szybka aktualizacja motogodzin" style="width:34px; height:34px; font-size:0.9rem; color:var(--primary);">
              ⏱️
            </button>
            <button class="icon-btn btn-mach-add-service" data-id="${m.id}" title="Dodaj naprawę lub wymianę oleju" style="width:34px; height:34px; font-size:0.9rem;">
              🛠️
            </button>
            <button class="icon-btn btn-mach-edit" data-id="${m.id}" title="Edytuj maszynę" style="width:34px; height:34px; font-size:0.9rem;">
              ✏️
            </button>
            <button class="icon-btn btn-mach-del" data-id="${m.id}" title="Usuń maszynę" style="width:34px; height:34px; font-size:0.9rem; color:var(--accent-red);">
              🗑️
            </button>
          </div>
        </div>

        <!-- SIATKA STATUSÓW MASZYNY -->
        <div class="machine-stats-grid">
          <!-- Licznik motogodzin -->
          <div class="machine-stat-box" style="border-left: 3px solid var(--primary);">
            <div class="machine-stat-label">Licznik motogodzin</div>
            <div class="machine-stat-value" style="color:var(--primary); font-size:1.15rem; display:flex; align-items:center; justify-content:space-between;">
              <span>${hours} Mth</span>
              <button class="icon-btn btn-mach-quick-mth" data-id="${m.id}" title="Zaktualizuj licznik" style="width:24px; height:24px; font-size:0.75rem; border:none; background:none;">✏️</button>
            </div>
          </div>

          <!-- Wymiana oleju i filtrów -->
          <div class="machine-stat-box" style="border-left: 3px solid ${oilColor};">
            <div class="machine-stat-label">Wymiana oleju</div>
            <div class="machine-stat-value" style="font-size:0.88rem; color:${oilColor}; font-weight:800;">
              ${oilStatusText}
            </div>
            <div class="machine-progress-bar" title="Zużycie oleju: ${oilPercent}%">
              <div class="machine-progress-fill" style="width: ${oilPercent}%; background: ${oilColor};"></div>
            </div>
          </div>

          <!-- Przegląd techniczny / OC -->
          <div class="machine-stat-box" style="border-left: 3px solid ${inspColor};">
            <div class="machine-stat-label">Przegląd techniczny / OC</div>
            <div class="machine-stat-value" style="font-size:0.85rem; color:${inspColor};">
              ${inspStatusText}
            </div>
          </div>

          <!-- Koszty napraw i serwisu -->
          <div class="machine-stat-box">
            <div class="machine-stat-label">Koszty serwisu</div>
            <div class="machine-stat-value" style="font-size:0.95rem; color:var(--heading-color);">
              ${machTotalCost > 0 ? `${machTotalCost.toLocaleString('pl-PL')} zł` : '0 zł'}
              <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:normal;"> (${services.length})</span>
            </div>
          </div>
        </div>

        <!-- PRZYCISK: SZYBKIE AKCJE -->
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button class="btn btn-sm btn-secondary btn-mach-quick-mth" data-id="${m.id}" style="padding:5px 10px; font-size:0.78rem; font-weight:700;">
            ⏱️ Zmień Mth
          </button>
          <button class="btn btn-sm btn-primary btn-mach-add-service" data-id="${m.id}" style="padding:5px 12px; font-size:0.78rem; font-weight:700;">
            🛠️ Dodaj Serwis / Naprawę
          </button>
        </div>

        <!-- SEKCJA ROZWIJANA: HISTORIA SERWISU I NAPRAW -->
        <div class="machine-services-section">
          <button type="button" class="machine-services-toggle" data-target="services-list-${m.id}">
            <span>📜 Historia napraw i wymian oleju (${services.length})</span>
            <span class="services-toggle-arrow">▼</span>
          </button>

          <div id="services-list-${m.id}" style="display: none; margin-top: 6px;">
            ${services.length === 0 ? `
              <div style="font-size:0.8rem; color:var(--text-muted); padding:8px 0;">
                Brak wpisów serwisowych dla tej maszyny. Kliknij <strong>🛠️ Dodaj Serwis</strong>, aby zapisać wymianę oleju lub naprawę!
              </div>
            ` : services.map(s => {
              const sDate = new Date(s.date + 'T00:00:00').toLocaleDateString('pl-PL', { day:'numeric', month:'short', year:'numeric' });
              let sTypeBadge = 'var(--text-secondary)';
              if (s.serviceType === 'Wymiana oleju i filtrów') sTypeBadge = '#22c55e';
              else if (s.serviceType === 'Naprawa / Awaria') sTypeBadge = '#ef4444';
              else if (s.serviceType === 'Przegląd techniczny') sTypeBadge = '#38bdf8';
              else if (s.serviceType === 'Wymiana części') sTypeBadge = '#eab308';

              return `
                <div class="machine-service-item">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
                    <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                      <span class="service-type-badge" style="background:rgba(255,255,255,0.08); color:${sTypeBadge}; border:1px solid ${sTypeBadge};">
                        ${escapeHTML(s.serviceType)}
                      </span>
                      <strong style="font-size:0.85rem; color:var(--heading-color);">📅 ${sDate}</strong>
                      ${s.hours ? `<span style="font-size:0.8rem; color:var(--primary); font-weight:700;">• ${s.hours} Mth</span>` : ''}
                    </div>

                    <div style="display:flex; align-items:center; gap:6px;">
                      ${s.cost ? `<strong style="font-size:0.9rem; color:var(--primary);">${parseFloat(s.cost).toLocaleString('pl-PL')} zł</strong>` : ''}
                      <button class="icon-btn btn-service-del" data-id="${s.id}" title="Usuń wpis" style="width:26px; height:26px; font-size:0.75rem; color:var(--accent-red); padding:0;">
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">
                    <div>${escapeHTML(s.desc)}</div>
                    ${s.performedBy ? `<div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">Wykonawca: ${escapeHTML(s.performedBy)}</div>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Podpięcia interakcji
  container.querySelectorAll('.machine-services-toggle').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.dataset.target;
      const targetEl = document.getElementById(targetId);
      const arrow = btn.querySelector('.services-toggle-arrow');
      if (targetEl) {
        if (targetEl.style.display === 'none') {
          targetEl.style.display = 'block';
          if (arrow) arrow.textContent = '▲';
        } else {
          targetEl.style.display = 'none';
          if (arrow) arrow.textContent = '▼';
        }
      }
    };
  });

  container.querySelectorAll('.btn-mach-quick-mth').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openUpdateMthModal(btn.dataset.id);
    };
  });

  container.querySelectorAll('.btn-mach-add-service').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openMachineServiceModal(btn.dataset.id);
    };
  });

  container.querySelectorAll('.btn-mach-edit').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const m = machines.find(x => x.id === btn.dataset.id);
      if (m) openMachineModal(m);
    };
  });

  container.querySelectorAll('.btn-mach-del').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteMachine(btn.dataset.id);
    };
  });

  container.querySelectorAll('.btn-service-del').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteMachineService(btn.dataset.id);
    };
  });
}

function openMachineModal(machine = null) {
  const modal = document.getElementById('machine-modal');
  const title = document.getElementById('machine-modal-title');
  const form = document.getElementById('machine-form');

  if (!modal || !form) return;
  form.reset();

  if (machine && machine.id) {
    if (title) title.textContent = '✏️ Edytuj Maszynę / Sprzęt';
    document.getElementById('machine-edit-id').value = machine.id;
    document.getElementById('machine-name').value = machine.name || '';
    document.getElementById('machine-type').value = machine.type || 'Ciągnik';
    document.getElementById('machine-reg').value = machine.regNo || '';
    document.getElementById('machine-hours').value = machine.hours != null ? machine.hours : '';
    document.getElementById('machine-inspection-date').value = machine.inspectionDate || '';
    document.getElementById('machine-last-oil-hours').value = machine.lastOilHours != null ? machine.lastOilHours : '';
    document.getElementById('machine-oil-interval').value = machine.oilInterval || 250;
    document.getElementById('machine-notes').value = machine.notes || '';
  } else {
    if (title) title.textContent = '🚜 Dodaj Maszynę / Ciągnik';
    document.getElementById('machine-edit-id').value = '';
    document.getElementById('machine-oil-interval').value = 250;
  }

  modal.classList.add('active');
}

function closeMachineModal() {
  const modal = document.getElementById('machine-modal');
  if (modal) modal.classList.remove('active');
}

function saveMachineFromModal() {
  const id = document.getElementById('machine-edit-id').value;
  const name = document.getElementById('machine-name').value.trim();
  const type = document.getElementById('machine-type').value;
  const regNo = document.getElementById('machine-reg').value.trim();
  const hours = parseInt(document.getElementById('machine-hours').value) || 0;
  const inspectionDate = document.getElementById('machine-inspection-date').value;
  const lastOilHours = parseInt(document.getElementById('machine-last-oil-hours').value) || 0;
  const oilInterval = parseInt(document.getElementById('machine-oil-interval').value) || 250;
  const notes = document.getElementById('machine-notes').value.trim();

  if (!name) {
    showToast('Wpisz nazwę maszyny!');
    return;
  }

  if (id) {
    const idx = machines.findIndex(m => m.id === id);
    if (idx !== -1) {
      machines[idx] = {
        ...machines[idx],
        name,
        type,
        regNo,
        hours,
        inspectionDate,
        lastOilHours,
        oilInterval,
        notes
      };
      showToast('Zaktualizowano dane maszyny!');
    }
  } else {
    const newMachine = {
      id: 'mach_' + Date.now(),
      name,
      type,
      regNo,
      hours,
      inspectionDate,
      lastOilHours,
      oilInterval,
      notes,
      createdAt: new Date().toISOString()
    };
    machines.push(newMachine);
    showToast('Dodano nową maszynę do bazy!');
  }

  saveMachinesData();
  closeMachineModal();
  renderMachinesStats();
  renderMachinesList();
}

function deleteMachine(id) {
  const m = machines.find(x => x.id === id);
  const name = m ? m.name : 'maszynę';
  if (confirm(`Czy na pewno chcesz usunąć "${name}" wraz z całą jej historią serwisową?`)) {
    machines = machines.filter(x => x.id !== id);
    machineServices = machineServices.filter(s => s.machineId !== id);
    saveMachinesData();
    saveMachineServicesData();
    renderMachinesStats();
    renderMachinesList();
    showToast('Usunięto maszynę z bazy.');
  }
}

function openMachineServiceModal(machineId) {
  const modal = document.getElementById('machine-service-modal');
  const form = document.getElementById('machine-service-form');
  const m = machines.find(x => x.id === machineId);

  if (!modal || !form) return;
  form.reset();

  document.getElementById('service-machine-id').value = machineId;
  document.getElementById('service-date').value = new Date().toISOString().split('T')[0];
  if (m) {
    document.getElementById('service-hours').value = m.hours || '';
  }

  modal.classList.add('active');
}

function closeMachineServiceModal() {
  const modal = document.getElementById('machine-service-modal');
  if (modal) modal.classList.remove('active');
}

function saveMachineServiceFromModal() {
  const machineId = document.getElementById('service-machine-id').value;
  const serviceType = document.getElementById('service-type').value;
  const date = document.getElementById('service-date').value;
  const hours = parseInt(document.getElementById('service-hours').value) || 0;
  const cost = parseFloat(document.getElementById('service-cost').value) || 0;
  const performedBy = document.getElementById('service-performed-by').value.trim();
  const desc = document.getElementById('service-desc').value.trim();

  if (!date || !desc) {
    showToast('Podaj datę i opis wykonanych prac!');
    return;
  }

  const newService = {
    id: 'serv_' + Date.now(),
    machineId,
    serviceType,
    date,
    hours,
    cost,
    performedBy,
    desc,
    createdAt: new Date().toISOString()
  };

  machineServices.unshift(newService);

  // Jeśli to wymiana oleju, automatycznie zaktualizuj lastOilHours maszyny!
  const m = machines.find(x => x.id === machineId);
  if (m) {
    if (hours > (m.hours || 0)) {
      m.hours = hours;
    }
    if (serviceType === 'Wymiana oleju i filtrów' && hours > 0) {
      m.lastOilHours = hours;
    }
    saveMachinesData();
  }

  saveMachineServicesData();
  closeMachineServiceModal();
  renderMachinesStats();
  renderMachinesList();
  showToast('✅ Zapisano wpis serwisowy!');
}

function deleteMachineService(serviceId) {
  if (confirm('Czy na pewno chcesz usunąć ten wpis serwisowy?')) {
    machineServices = machineServices.filter(s => s.id !== serviceId);
    saveMachineServicesData();
    renderMachinesStats();
    renderMachinesList();
    showToast('Usunięto wpis serwisowy.');
  }
}

function openUpdateMthModal(machineId) {
  const modal = document.getElementById('machine-update-mth-modal');
  const form = document.getElementById('machine-update-mth-form');
  const label = document.getElementById('mth-machine-label');
  const input = document.getElementById('mth-input-value');
  const m = machines.find(x => x.id === machineId);

  if (!modal || !m) return;
  if (form) form.reset();

  document.getElementById('mth-machine-id').value = machineId;
  if (label) label.textContent = `${m.name} (Dotychczas: ${m.hours || 0} Mth)`;
  if (input) {
    input.value = m.hours || 0;
    setTimeout(() => {
      input.focus();
      input.select();
    }, 150);
  }

  modal.classList.add('active');
}

function closeUpdateMthModal() {
  const modal = document.getElementById('machine-update-mth-modal');
  if (modal) modal.classList.remove('active');
}

function saveMthFromModal() {
  const machineId = document.getElementById('mth-machine-id').value;
  const newHours = parseInt(document.getElementById('mth-input-value').value);

  if (isNaN(newHours) || newHours < 0) {
    showToast('Wpisz poprawną wartość motogodzin!');
    return;
  }

  const m = machines.find(x => x.id === machineId);
  if (m) {
    m.hours = newHours;
    saveMachinesData();
    renderMachinesStats();
    renderMachinesList();
    showToast(`⏱️ Zaktualizowano licznik: ${newHours} Mth dla ${m.name}`);
  }

  closeUpdateMthModal();
}




