const FREE_LIMIT = 5;
const APP_VERSION = '1.4.1 Mobile Hotfix';
const DB_NAME = 'coursmemo-ai-media';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const STORAGE_KEY = 'coursmemo_courses_v1';
const ONBOARDING_KEY = 'coursmemo_onboarding_v141_seen';
const DEFAULT_THEMES = ['Danse', 'Formation', 'Sport', 'Musique', 'Coaching', 'École', 'Bien-être', 'Travail', 'Autre'];

const state = {
  courses: [],
  currentId: null,
  selectedTheme: 'Tous',
  search: '',
  activeTab: 'library',
  deferredPrompt: null,
  selectedFile: null,
  mediaUrl: null,
  recognition: null,
  isListening: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const els = {
  installBtn: $('#installBtn'),
  installHeroBtn: $('#installHeroBtn'),
  heroNewBtn: $('#heroNewBtn'),
  courseCount: $('#courseCount'),
  themeCount: $('#themeCount'),
  themeChips: $('#themeChips'),
  courseList: $('#courseList'),
  newCourseBtn: $('#newCourseBtn'),
  searchInput: $('#searchInput'),
  form: $('#courseForm'),
  editorTitle: $('#editorTitle'),
  titleInput: $('#titleInput'),
  themeInput: $('#themeInput'),
  customThemeInput: $('#customThemeInput'),
  dateInput: $('#dateInput'),
  teacherInput: $('#teacherInput'),
  mediaInput: $('#mediaInput'),
  fileLabel: $('#fileLabel'),
  mediaPreview: $('#mediaPreview'),
  transcriptInput: $('#transcriptInput'),
  notesInput: $('#notesInput'),
  deleteBtn: $('#deleteBtn'),
  speechBtn: $('#speechBtn'),
  premiumDialog: $('#premiumDialog'),
  closePremium: $('#closePremium'),
  premiumOkBtn: $('#premiumOkBtn'),
  installDialog: $('#installDialog'),
  closeInstall: $('#closeInstall'),
  installOkBtn: $('#installOkBtn'),
  onboardingDialog: $('#onboardingDialog'),
  closeOnboarding: $('#closeOnboarding'),
  startOnboardingBtn: $('#startOnboardingBtn'),
  exportTxtBtn: $('#exportTxtBtn'),
  themeHelper: $('#themeHelper'),
  toast: $('#toast'),
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return `cm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatDate(value) {
  if (!value) return 'Sans date';
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  } catch {
    return value;
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.setTimeout(() => els.toast.classList.remove('show'), 2300);
}

function saveCourses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.courses));
}

function loadCourses() {
  const raw = localStorage.getItem(STORAGE_KEY);
  state.courses = raw ? JSON.parse(raw) : [];
}

function activateTab(tabName, shouldScroll = true) {
  state.activeTab = tabName;
  $$('.tab-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
  $$('.app-screen').forEach((screen) => screen.classList.toggle('active', screen.dataset.screen === tabName));

  if (shouldScroll && window.matchMedia('(max-width: 760px)').matches) {
    document.querySelector('.section-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function putMedia(id, file) {
  if (!file) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ id, blob: file, name: file.name, type: file.type, size: file.size });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function getMedia(id) {
  const db = await openDb();
  const result = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

async function deleteMedia(id) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function getThemeFromForm() {
  const customTheme = els.customThemeInput.value.trim();
  return customTheme || els.themeInput.value || 'Autre';
}

function courseFromForm(existing = {}) {
  const now = new Date().toISOString();
  return {
    id: existing.id || uid(),
    title: els.titleInput.value.trim(),
    theme: getThemeFromForm(),
    date: els.dateInput.value || today(),
    teacher: els.teacherInput.value.trim(),
    transcript: els.transcriptInput.value.trim(),
    notes: els.notesInput.value.trim(),
    fileName: state.selectedFile?.name || existing.fileName || '',
    fileType: state.selectedFile?.type || existing.fileType || '',
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
}

function resetMediaPreview() {
  if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
  state.mediaUrl = null;
  els.mediaPreview.hidden = true;
  els.mediaPreview.innerHTML = '';
}

function renderMediaPreview(blob, type, name) {
  resetMediaPreview();
  if (!blob) return;
  state.mediaUrl = URL.createObjectURL(blob);
  const isVideo = (type || '').startsWith('video/');
  const safeName = escapeHtml(name || 'Fichier importé');
  els.mediaPreview.hidden = false;
  els.mediaPreview.innerHTML = `
    <p class="course-meta" style="margin-bottom:10px;">${safeName}</p>
    ${isVideo
      ? `<video controls src="${state.mediaUrl}"></video>`
      : `<audio controls src="${state.mediaUrl}"></audio>`}
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function loadCourse(id) {
  const course = state.courses.find((item) => item.id === id);
  if (!course) return;
  state.currentId = id;
  state.selectedFile = null;
  els.editorTitle.textContent = course.title || 'Cours sans titre';
  els.titleInput.value = course.title || '';

  if (DEFAULT_THEMES.includes(course.theme)) {
    els.themeInput.value = course.theme || 'Autre';
    els.customThemeInput.value = '';
  } else {
    els.themeInput.value = 'Autre';
    els.customThemeInput.value = course.theme || '';
  }

  els.dateInput.value = course.date || today();
  els.teacherInput.value = course.teacher || '';
  els.transcriptInput.value = course.transcript || '';
  els.notesInput.value = course.notes || '';
  els.fileLabel.textContent = course.fileName ? `${course.fileName} — fichier déjà enregistré` : 'MP3, WAV, M4A, MP4, MOV — stockage local sur l\'appareil.';
  resetMediaPreview();
  if (course.fileName) {
    try {
      const media = await getMedia(course.id);
      if (media) renderMediaPreview(media.blob, media.type, media.name);
    } catch {
      showToast('Aperçu média indisponible.');
    }
  }
  updateThemeHelper();
  render();
  activateTab('editor');
}

function newCourse() {
  state.currentId = null;
  state.selectedFile = null;
  els.editorTitle.textContent = 'Nouveau cours';
  els.form.reset();
  els.dateInput.value = today();
  els.themeInput.value = 'Danse';
  els.customThemeInput.value = '';
  els.fileLabel.textContent = 'MP3, WAV, M4A, MP4, MOV — stockage local sur l\'appareil.';
  if (els.mediaInput) els.mediaInput.value = '';
  resetMediaPreview();
  updateThemeHelper();
  render();
  activateTab('editor');
  window.setTimeout(() => els.titleInput.focus({ preventScroll: true }), 350);
  showToast('Nouvelle fiche prête.');
}

async function saveCurrentCourse(event) {
  event.preventDefault();

  const editing = state.currentId ? state.courses.find((item) => item.id === state.currentId) : null;
  if (!editing && state.courses.length >= FREE_LIMIT) {
    openPremium();
    showToast(`Limite gratuite : ${FREE_LIMIT} cours.`);
    return;
  }

  const course = courseFromForm(editing || {});
  if (!course.title) {
    showToast('Ajoute un titre pour enregistrer.');
    return;
  }

  if (editing) {
    state.courses = state.courses.map((item) => item.id === course.id ? course : item);
  } else {
    state.courses.unshift(course);
    state.currentId = course.id;
  }

  if (state.selectedFile) {
    try {
      await putMedia(course.id, state.selectedFile);
    } catch {
      showToast('Le média n\'a pas pu être stocké.');
    }
  }

  saveCourses();
  state.selectedFile = null;
  showToast('Cours enregistré.');
  await loadCourse(course.id);
}

async function deleteCurrentCourse() {
  if (!state.currentId) {
    newCourse();
    return;
  }
  const course = state.courses.find((item) => item.id === state.currentId);
  const ok = window.confirm(`Supprimer "${course?.title || 'ce cours'}" ?`);
  if (!ok) return;

  state.courses = state.courses.filter((item) => item.id !== state.currentId);
  await deleteMedia(state.currentId).catch(() => undefined);
  saveCourses();
  showToast('Cours supprimé.');
  newCourse();
  activateTab('library');
}

function getThemes() {
  const themes = new Set(state.courses.map((item) => item.theme || 'Autre'));
  return ['Tous', ...Array.from(themes).sort((a, b) => a.localeCompare(b, 'fr'))];
}

function getFilteredCourses() {
  const q = state.search.trim().toLowerCase();
  return state.courses.filter((course) => {
    const matchesTheme = state.selectedTheme === 'Tous' || course.theme === state.selectedTheme;
    const haystack = [course.title, course.theme, course.teacher, course.transcript, course.notes].join(' ').toLowerCase();
    const matchesSearch = !q || haystack.includes(q);
    return matchesTheme && matchesSearch;
  });
}

function renderThemes() {
  const themes = getThemes();
  if (!themes.includes(state.selectedTheme)) state.selectedTheme = 'Tous';
  els.themeChips.innerHTML = '';
  themes.forEach((theme) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip ${theme === state.selectedTheme ? 'active' : ''}`;
    btn.textContent = theme;
    btn.addEventListener('click', () => {
      state.selectedTheme = theme;
      render();
    });
    els.themeChips.appendChild(btn);
  });
}

function renderList() {
  const courses = getFilteredCourses();
  els.courseList.innerHTML = '';

  if (!courses.length) {
    els.courseList.innerHTML = `<div class="empty-state">Aucun cours trouvé.<br>Crée ton premier cours ou change le filtre.</div>`;
    return;
  }

  courses.forEach((course) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `course-card ${course.id === state.currentId ? 'active' : ''}`;
    btn.innerHTML = `
      <strong>${escapeHtml(course.title || 'Cours sans titre')}</strong>
      <div class="course-meta">
        <span>${escapeHtml(course.theme || 'Autre')}</span>
        <span>•</span>
        <span>${formatDate(course.date)}</span>
        ${course.fileName ? '<span>• média</span>' : ''}
      </div>
    `;
    btn.addEventListener('click', () => loadCourse(course.id));
    els.courseList.appendChild(btn);
  });
}

function renderStats() {
  const themes = new Set(state.courses.map((item) => item.theme || 'Autre'));
  els.courseCount.textContent = state.courses.length;
  els.themeCount.textContent = themes.size;
}

function render() {
  renderStats();
  renderThemes();
  renderList();
}

function exportTxt() {
  const course = courseFromForm(state.courses.find((item) => item.id === state.currentId) || {});
  if (!course.title && !course.transcript && !course.notes) {
    showToast('Rien à exporter pour le moment.');
    return;
  }

  const content = [
    `CoursMemo AI — ${APP_VERSION}`,
    `Titre : ${course.title || 'Sans titre'}`,
    `Thème : ${course.theme}`,
    `Date : ${course.date}`,
    `Prof / coach : ${course.teacher || '-'}`,
    '',
    '--- Transcription ---',
    course.transcript || '-',
    '',
    '--- Notes personnelles ---',
    course.notes || '-',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(course.title || 'coursmemo').toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    els.speechBtn.addEventListener('click', () => showToast('Dictée micro non disponible sur ce navigateur.'));
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.lang = 'fr-FR';
  state.recognition.continuous = true;
  state.recognition.interimResults = true;

  let finalText = '';
  state.recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += `${text.trim()} `;
      else interim += text;
    }
    const base = els.transcriptInput.dataset.base || els.transcriptInput.value;
    els.transcriptInput.value = `${base}${base ? '\n' : ''}${finalText}${interim}`.trim();
  };

  state.recognition.onerror = () => showToast('Erreur micro ou permission refusée.');
  state.recognition.onend = () => {
    state.isListening = false;
    els.speechBtn.textContent = 'Dictée';
    els.transcriptInput.dataset.base = '';
  };

  els.speechBtn.addEventListener('click', () => {
    if (!state.isListening) {
      finalText = '';
      els.transcriptInput.dataset.base = els.transcriptInput.value.trim();
      state.recognition.start();
      state.isListening = true;
      els.speechBtn.textContent = 'Stop';
      showToast('Dictée démarrée.');
    } else {
      state.recognition.stop();
      state.isListening = false;
      els.speechBtn.textContent = 'Dictée';
    }
  });
}

function updateThemeHelper() {
  const theme = getThemeFromForm().toLowerCase();
  const isDance = theme.includes('danse') || theme.includes('kizomba') || theme.includes('urban') || theme.includes('bachata') || theme.includes('salsa');
  if (isDance) {
    els.themeHelper.classList.remove('is-hidden');
    els.themeHelper.innerHTML = '<strong>Mode danse :</strong> note les corrections du prof, mouvements à revoir, musicalité et objectif du prochain cours.';
    return;
  }

  els.themeHelper.classList.remove('is-hidden');
  els.themeHelper.innerHTML = '<strong>Astuce :</strong> note les points importants, les actions à faire et ce que tu veux revoir avant le prochain cours.';
}

function openPremium() {
  if (typeof els.premiumDialog.showModal === 'function') els.premiumDialog.showModal();
  else alert('Premium : résumé IA, PDF, points clés, historique avancé.');
}

function openOnboardingIfNeeded() {
  if (localStorage.getItem(ONBOARDING_KEY)) return;
  window.setTimeout(() => {
    if (typeof els.onboardingDialog.showModal === 'function') els.onboardingDialog.showModal();
  }, 450);
}

function closeOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, '1');
  els.onboardingDialog.close();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function installButtons() {
  return [els.installBtn, els.installHeroBtn].filter(Boolean);
}

function openInstallHelp() {
  if (typeof els.installDialog.showModal === 'function') els.installDialog.showModal();
  else alert('Pour installer : menu du navigateur puis Ajouter à l’écran d’accueil.');
}

function setupInstallPrompt() {
  installButtons().forEach((btn) => {
    btn.hidden = isStandaloneMode();
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    installButtons().forEach((btn) => { btn.hidden = false; });
  });

  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    installButtons().forEach((btn) => { btn.hidden = true; });
    showToast('Application installée.');
  });

  installButtons().forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (isStandaloneMode()) {
        showToast('CoursMemo AI est déjà installée.');
        btn.hidden = true;
        return;
      }

      if (!state.deferredPrompt) {
        openInstallHelp();
        return;
      }

      state.deferredPrompt.prompt();
      await state.deferredPrompt.userChoice;
      state.deferredPrompt = null;
    });
  });
}

function bindEvents() {
  $$('.tab-btn').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));
  $$('[data-tab]:not(.tab-btn)').forEach((btn) => btn.addEventListener('click', () => activateTab(btn.dataset.tab)));

  els.newCourseBtn.addEventListener('click', newCourse);
  els.heroNewBtn.addEventListener('click', newCourse);
  els.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });
  els.form.addEventListener('submit', saveCurrentCourse);
  els.deleteBtn.addEventListener('click', deleteCurrentCourse);
  els.exportTxtBtn.addEventListener('click', exportTxt);
  els.themeInput.addEventListener('change', updateThemeHelper);
  els.customThemeInput.addEventListener('input', updateThemeHelper);

  els.mediaInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.selectedFile = file;
    els.fileLabel.textContent = `${file.name} — ${(file.size / 1024 / 1024).toFixed(1)} Mo`;
    renderMediaPreview(file, file.type, file.name);
  });

  $$('[data-premium]').forEach((btn) => btn.addEventListener('click', openPremium));
  els.closePremium.addEventListener('click', () => els.premiumDialog.close());
  els.premiumOkBtn.addEventListener('click', () => els.premiumDialog.close());
  els.closeInstall.addEventListener('click', () => els.installDialog.close());
  els.installOkBtn.addEventListener('click', () => els.installDialog.close());
  els.closeOnboarding.addEventListener('click', closeOnboarding);
  els.startOnboardingBtn.addEventListener('click', closeOnboarding);
}

function seedDemoIfEmpty() {
  if (state.courses.length) return;
  state.courses = [
    {
      id: uid(),
      title: 'Exemple : Cours de danse',
      theme: 'Danse',
      date: today(),
      teacher: '',
      transcript: 'Colle ici la transcription du cours, ou utilise la dictée micro si disponible.',
      notes: 'À revoir : posture, guidage, musicalité. Objectif : relire avant le prochain cours.',
      fileName: '',
      fileType: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];
  saveCourses();
}

function hydrateFirstCourse() {
  const firstId = state.courses[0]?.id;
  if (!firstId) {
    newCourse();
    return;
  }

  const first = state.courses[0];
  state.currentId = firstId;
  els.editorTitle.textContent = first.title || 'Cours sans titre';
  els.titleInput.value = first.title || '';
  els.themeInput.value = DEFAULT_THEMES.includes(first.theme) ? first.theme : 'Autre';
  els.customThemeInput.value = DEFAULT_THEMES.includes(first.theme) ? '' : first.theme;
  els.dateInput.value = first.date || today();
  els.teacherInput.value = first.teacher || '';
  els.transcriptInput.value = first.transcript || '';
  els.notesInput.value = first.notes || '';
  els.fileLabel.textContent = first.fileName ? `${first.fileName} — fichier déjà enregistré` : 'MP3, WAV, M4A, MP4, MOV — stockage local.';
  updateThemeHelper();
}

function init() {
  loadCourses();
  seedDemoIfEmpty();
  bindEvents();
  setupSpeechRecognition();
  setupInstallPrompt();
  registerServiceWorker();
  hydrateFirstCourse();
  render();
  activateTab('library', false);
  openOnboardingIfNeeded();
}

init();
