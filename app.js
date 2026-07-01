const FREE_LIMIT = 5;
const APP_VERSION = '1.5 Groq IA';
const DB_NAME = 'coursmemo-ai-media';
const DB_VERSION = 1;
const STORE_NAME = 'media';
const STORAGE_KEY = 'coursmemo_courses_v1';
const ONBOARDING_KEY = 'coursmemo_onboarding_v15_seen';
const DEFAULT_THEMES = ['Danse', 'Formation', 'Sport', 'Musique', 'Coaching', 'École', 'Bien-être', 'Travail', 'Autre'];
const GROQ_KEY_STORAGE = 'coursmemo_groq_api_key';
const GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo';
const GROQ_CHAT_MODEL = 'llama-3.1-8b-instant';
const GROQ_FILE_LIMIT = 25 * 1024 * 1024;
const AUDIO_EXTRACT_THRESHOLD = 24 * 1024 * 1024;

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
  isTranscribing: false,
  isSummarizing: false,
};

let toastTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const els = {
  installBtn: $('#installBtn'),
  settingsBtn: $('#settingsBtn'),
  heroNewBtn: $('#heroNewBtn'),
  courseCount: $('#courseCount'),
  themeCount: $('#themeCount'),
  courseLabel: $('#courseLabel'),
  themeLabel: $('#themeLabel'),
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
  fileStatus: $('#fileStatus'),
  transcriptInput: $('#transcriptInput'),
  summaryInput: $('#summaryInput'),
  notesInput: $('#notesInput'),
  deleteBtn: $('#deleteBtn'),
  transcribeBtn: $('#transcribeBtn'),
  speechBtn: $('#speechBtn'),
  summaryBtn: $('#summaryBtn'),
  premiumDialog: $('#premiumDialog'),
  closePremium: $('#closePremium'),
  premiumOkBtn: $('#premiumOkBtn'),
  settingsDialog: $('#settingsDialog'),
  closeSettings: $('#closeSettings'),
  groqKeyInput: $('#groqKeyInput'),
  saveGroqKeyBtn: $('#saveGroqKeyBtn'),
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

function showToast(message, sticky = false, duration = 2300) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  if (!sticky) {
    toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), duration);
  }
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
    summary: els.summaryInput.value.trim(),
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
  if (els.fileStatus) {
    els.fileStatus.hidden = true;
    els.fileStatus.textContent = '';
    els.fileStatus.classList.remove('warning');
  }
}

function setFileStatus(message, warning = false) {
  if (!els.fileStatus) return;
  els.fileStatus.hidden = false;
  els.fileStatus.textContent = message;
  els.fileStatus.classList.toggle('warning', warning);
}

function renderMediaPreview(blob, type, name) {
  resetMediaPreview();
  if (!blob) return;
  state.mediaUrl = URL.createObjectURL(blob);
  const isVideo = (type || '').startsWith('video/');
  const safeName = escapeHtml(name || 'Fichier importé');
  const playerId = `mediaPlayer_${Date.now()}`;

  els.mediaPreview.hidden = false;
  els.mediaPreview.innerHTML = `
    <div class="media-preview-head">
      <p>${safeName}</p>
      <a class="media-open-link" href="${state.mediaUrl}" target="_blank" rel="noopener">Ouvrir</a>
    </div>
    ${isVideo
      ? `<video id="${playerId}" controls preload="metadata" playsinline></video>`
      : `<audio id="${playerId}" controls preload="metadata"></audio>`}
    <p class="media-help">Aperçu local uniquement. Pour garder ce fichier dans la fiche, appuie sur “Enregistrer”.</p>
  `;

  const player = document.getElementById(playerId);
  if (player) {
    player.src = state.mediaUrl;
    player.addEventListener('loadedmetadata', () => {
      setFileStatus('Fichier ajouté localement. Appuie sur “Enregistrer” pour le garder dans cette fiche.');
    });
    player.addEventListener('error', () => {
      setFileStatus('Le fichier est ajouté, mais ce navigateur ne sait pas lire son aperçu. Essaie un MP4 H.264/AAC, un MP3 ou enregistre quand même la fiche.', true);
    });
  }

  window.setTimeout(() => {
    if (!els.fileStatus || !els.fileStatus.hidden) return;
    setFileStatus('Fichier ajouté localement. Appuie sur “Enregistrer” pour le garder dans cette fiche.');
  }, 900);
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
  els.summaryInput.value = course.summary || '';
  els.notesInput.value = course.notes || '';
  els.fileLabel.textContent = course.fileName ? `${course.fileName} — enregistré dans cette fiche` : 'Choisis un fichier. Il reste sur ton appareil.';
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
  els.fileLabel.textContent = 'Choisis un fichier. Il reste sur ton appareil.';
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
  const courseTotal = state.courses.length;
  const themeTotal = themes.size;
  els.courseCount.textContent = courseTotal;
  els.themeCount.textContent = themeTotal;
  els.courseLabel.textContent = 'cours';
  els.themeLabel.textContent = themeTotal > 1 ? 'thèmes' : 'thème';
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
    '--- Résumé IA ---',
    course.summary || '-',
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


function getGroqKey() {
  return localStorage.getItem(GROQ_KEY_STORAGE) || '';
}

function openSettings() {
  if (els.groqKeyInput) els.groqKeyInput.value = getGroqKey();
  if (typeof els.settingsDialog?.showModal === 'function') els.settingsDialog.showModal();
  else showToast('Ouvre les réglages pour ajouter ta clé Groq.');
}

function closeSettings() {
  if (els.settingsDialog?.open) els.settingsDialog.close();
}

function saveGroqKey() {
  const key = els.groqKeyInput?.value.trim() || '';
  if (!key) {
    showToast('Colle ta clé Groq pour activer l’IA.');
    return;
  }
  localStorage.setItem(GROQ_KEY_STORAGE, key);
  closeSettings();
  showToast('Clé IA enregistrée.');
}

function ensureGroqKey() {
  const key = getGroqKey();
  if (!key) {
    openSettings();
    showToast('Ajoute ta clé Groq pour utiliser l’IA.');
    return '';
  }
  return key;
}

function setButtonBusy(button, busy, busyText, normalText) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('ai-busy', busy);
  button.textContent = busy ? busyText : normalText;
}

function mediaToFile(media) {
  if (!media?.blob) return null;
  if (media.blob instanceof File) return media.blob;
  return new File([media.blob], media.name || 'coursmemo-media', {
    type: media.type || media.blob.type || 'application/octet-stream'
  });
}

async function getCurrentMediaFile() {
  if (state.selectedFile) return state.selectedFile;
  if (!state.currentId) return null;
  const media = await getMedia(state.currentId).catch(() => null);
  return mediaToFile(media);
}

function cleanBaseName(name) {
  return (name || 'coursmemo-audio').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 64) || 'coursmemo-audio';
}

async function prepareFileForGroq(file) {
  if (!file) throw new Error('Aucun fichier à transcrire.');

  if (file.size <= GROQ_FILE_LIMIT) {
    return file;
  }

  showToast('Gros fichier : extraction audio compressée en cours… Laisse l’app ouverte.', true);

  let extractedAudio = null;
  const errors = [];

  // Méthode principale pour les gros MP4 Android : on lit la vidéo et on enregistre
  // uniquement la piste audio en WebM/Opus. Cette méthode évite de charger les
  // 300/400 Mo du fichier en mémoire d’un seul coup.
  if (file.type.startsWith('video/')) {
    try {
      extractedAudio = await extractAudioByPlayback(file);
    } catch (error) {
      errors.push(`extraction directe: ${error.message}`);
    }
  }

  // Méthode de secours : décodage complet en mémoire. On l’évite sur les très gros
  // fichiers, car Chrome Android peut renvoyer “Unable to decode audio data”.
  if (!extractedAudio && file.size <= 120 * 1024 * 1024) {
    try {
      showToast('Extraction audio classique en cours…', true);
      extractedAudio = await extractAudioToWav(file);
    } catch (error) {
      errors.push(`extraction classique: ${error.message}`);
    }
  }

  if (!extractedAudio) {
    const detail = errors.length ? ` Détail : ${errors.join(' / ')}` : '';
    throw new Error(`Impossible d’extraire l’audio de cette vidéo volumineuse. Essaie une vidéo plus courte, ou convertis-la en MP3/M4A avant import.${detail}`);
  }

  if (extractedAudio.size > GROQ_FILE_LIMIT) {
    const mb = (extractedAudio.size / 1024 / 1024).toFixed(1);
    throw new Error(`L’audio extrait fait ${mb} Mo, au-dessus de la limite Groq de 25 Mo. Coupe la vidéo en plusieurs parties plus courtes.`);
  }

  return extractedAudio;
}


function waitForMediaEvent(element, eventName, timeoutMs, errorMessage) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(errorMessage || `Délai dépassé pendant ${eventName}.`));
    }, timeoutMs);

    const onEvent = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error(element.error?.message || `Erreur média pendant ${eventName}.`));
    };

    function cleanup() {
      clearTimeout(timer);
      element.removeEventListener(eventName, onEvent);
      element.removeEventListener('error', onError);
    }

    element.addEventListener(eventName, onEvent, { once: true });
    element.addEventListener('error', onError, { once: true });
  });
}

function getSupportedRecorderMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'video/webm;codecs=opus',
    'video/webm'
  ];
  return candidates.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

async function extractAudioByPlayback(file) {
  const captureStream = HTMLMediaElement.prototype.captureStream || HTMLMediaElement.prototype.mozCaptureStream;
  if (!captureStream) {
    throw new Error('captureStream non disponible sur ce navigateur');
  }
  if (!window.MediaRecorder) {
    throw new Error('MediaRecorder non disponible sur ce navigateur');
  }

  const mimeType = getSupportedRecorderMimeType();
  if (!mimeType) {
    throw new Error('format audio compressé non supporté par ce navigateur');
  }

  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.preload = 'metadata';
  video.playsInline = true;
  video.muted = false;
  video.volume = 0;
  video.controls = false;
  video.style.position = 'fixed';
  video.style.left = '-10000px';
  video.style.top = '0';
  video.style.width = '1px';
  video.style.height = '1px';
  video.setAttribute('aria-hidden', 'true');
  document.body.appendChild(video);

  let progressTimer = null;

  try {
    await waitForMediaEvent(video, 'loadedmetadata', 15000, 'impossible de lire les métadonnées vidéo');

    if (Number.isFinite(video.duration) && video.duration > 20 * 60) {
      throw new Error('vidéo trop longue pour l’extraction mobile automatique');
    }

    const stream = captureStream.call(video);
    let audioTracks = stream.getAudioTracks();

    // Sur certains Android, les pistes apparaissent seulement après le lancement.
    if (!audioTracks.length) {
      await video.play();
      await new Promise(resolve => setTimeout(resolve, 700));
      video.pause();
      video.currentTime = 0;
      await waitForMediaEvent(video, 'seeked', 8000, 'impossible de préparer la vidéo');
      audioTracks = stream.getAudioTracks();
    }

    if (!audioTracks.length) {
      throw new Error('aucune piste audio détectée dans la vidéo');
    }

    const audioStream = new MediaStream(audioTracks);
    const chunks = [];
    const recorder = new MediaRecorder(audioStream, {
      mimeType,
      audioBitsPerSecond: 48000
    });

    const resultPromise = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onerror = event => reject(new Error(event.error?.message || 'erreur pendant l’enregistrement audio'));
      recorder.onstop = () => {
        if (!chunks.length) {
          reject(new Error('aucun audio extrait'));
          return;
        }
        const blob = new Blob(chunks, { type: mimeType });
        const extension = mimeType.includes('webm') ? 'webm' : 'audio';
        resolve(new File([blob], `${cleanBaseName(file.name)}-audio.${extension}`, { type: mimeType }));
      };
    });

    recorder.start(1000);
    showToast('Extraction audio en cours… Ne verrouille pas le téléphone.', true);

    progressTimer = setInterval(() => {
      const current = Math.floor(video.currentTime || 0);
      const total = Number.isFinite(video.duration) ? Math.floor(video.duration) : 0;
      if (total) {
        showToast(`Extraction audio : ${current}s / ${total}s…`, true);
      }
    }, 3500);

    const stopRecorder = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };

    video.addEventListener('ended', stopRecorder, { once: true });
    await video.play();

    const hardLimit = Number.isFinite(video.duration) ? (video.duration + 30) * 1000 : 20 * 60 * 1000;
    await Promise.race([
      resultPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('extraction trop longue ou vidéo bloquée')), hardLimit))
    ]).finally(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    });

    return await resultPromise;
  } finally {
    clearInterval(progressTimer);
    try { video.pause(); } catch {}
    video.removeAttribute('src');
    video.load?.();
    video.remove();
    URL.revokeObjectURL(url);
  }
}

async function extractAudioToWav(file) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !window.OfflineAudioContext) {
    throw new Error('Extraction audio non disponible sur ce navigateur. Essaie un fichier plus petit ou un MP3/M4A.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContextClass();
  let decoded;
  try {
    decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    audioContext.close?.();
  }

  const targetRate = 16000;
  const monoData = mixToMono(decoded);
  const monoBuffer = new AudioBuffer({ length: monoData.length, numberOfChannels: 1, sampleRate: decoded.sampleRate });
  monoBuffer.copyToChannel(monoData, 0);

  let finalBuffer = monoBuffer;
  if (decoded.sampleRate !== targetRate) {
    const offline = new OfflineAudioContext(1, Math.ceil(monoBuffer.duration * targetRate), targetRate);
    const source = offline.createBufferSource();
    source.buffer = monoBuffer;
    source.connect(offline.destination);
    source.start(0);
    finalBuffer = await offline.startRendering();
  }

  const wavBlob = encodeWav(finalBuffer.getChannelData(0), targetRate);
  return new File([wavBlob], `${cleanBaseName(file.name)}-audio.wav`, { type: 'audio/wav' });
}

function mixToMono(buffer) {
  const length = buffer.length;
  const channels = buffer.numberOfChannels;
  const out = new Float32Array(length);
  for (let ch = 0; ch < channels; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) out[i] += data[i] / channels;
  }
  return out;
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}

async function readApiError(response) {
  const text = await response.text().catch(() => '');
  if (!text) return `Erreur Groq ${response.status}.`;
  try {
    const json = JSON.parse(text);
    return json.error?.message || json.message || text.slice(0, 240);
  } catch {
    return text.slice(0, 240);
  }
}

async function transcribeWithGroq(file, key) {
  const formData = new FormData();
  formData.append('file', file, file.name || 'coursmemo-audio.wav');
  formData.append('model', GROQ_TRANSCRIPTION_MODEL);
  formData.append('language', 'fr');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: formData,
  });

  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  return data.text || data.transcript || '';
}

async function startTranscription() {
  if (state.isTranscribing) return;
  const key = ensureGroqKey();
  if (!key) return;

  const file = await getCurrentMediaFile();
  if (!file) {
    showToast('Ajoute d’abord un audio ou une vidéo.');
    return;
  }

  state.isTranscribing = true;
  setButtonBusy(els.transcribeBtn, true, 'Transcription…', 'Transcrire');
  try {
    const uploadFile = await prepareFileForGroq(file);
    const sizeMb = (uploadFile.size / 1024 / 1024).toFixed(1);
    showToast(`Envoi à Groq : ${sizeMb} Mo…`, true);
    const text = await transcribeWithGroq(uploadFile, key);
    if (!text.trim()) throw new Error('Groq n’a pas retourné de transcription.');
    els.transcriptInput.value = text.trim();
    await persistCurrentCourseSilently();
    hideToastInstant();
    showToast('Transcription terminée.');
  } catch (error) {
    hideToastInstant();
    showToast(`Transcription impossible : ${error.message}`);
  } finally {
    state.isTranscribing = false;
    setButtonBusy(els.transcribeBtn, false, 'Transcription…', 'Transcrire');
  }
}

async function summarizeWithGroq(transcript, course, key) {
  const prompt = `Titre : ${course.title || 'Sans titre'}\nThème : ${course.theme || 'Autre'}\nProf/coach : ${course.teacher || '-'}\n\nTranscription :\n${transcript}`;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_CHAT_MODEL,
      temperature: 0.25,
      messages: [
        {
          role: 'system',
          content: 'Tu es CoursMemo AI. Transforme une transcription de cours en fiche claire en français. Structure la réponse avec : Résumé, Points clés, Corrections ou consignes importantes, À revoir, Objectif pour la prochaine séance. Sois concret, court et utile.'
        },
        { role: 'user', content: prompt }
      ]
    }),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function summarizeCourse() {
  if (state.isSummarizing) return;
  const key = ensureGroqKey();
  if (!key) return;

  const transcript = els.transcriptInput.value.trim();
  if (!transcript) {
    showToast('Ajoute ou génère une transcription avant le résumé.');
    return;
  }

  state.isSummarizing = true;
  setButtonBusy(els.summaryBtn, true, 'Résumé…', 'Résumé IA');
  try {
    showToast('Résumé IA en cours…', true);
    const course = courseFromForm(state.courses.find((item) => item.id === state.currentId) || {});
    const summary = await summarizeWithGroq(transcript, course, key);
    if (!summary) throw new Error('Groq n’a pas retourné de résumé.');
    els.summaryInput.value = summary;
    await persistCurrentCourseSilently();
    hideToastInstant();
    showToast('Résumé IA généré.');
  } catch (error) {
    hideToastInstant();
    showToast(`Résumé impossible : ${error.message}`);
  } finally {
    state.isSummarizing = false;
    setButtonBusy(els.summaryBtn, false, 'Résumé…', 'Résumé IA');
  }
}

function hideToastInstant() {
  window.clearTimeout(toastTimer);
  els.toast.classList.remove('show');
}

async function persistCurrentCourseSilently() {
  const title = els.titleInput.value.trim();
  if (!title) return;
  const editing = state.currentId ? state.courses.find((item) => item.id === state.currentId) : null;
  if (!editing && state.courses.length >= FREE_LIMIT) return;
  const course = courseFromForm(editing || {});
  if (editing) state.courses = state.courses.map((item) => item.id === course.id ? course : item);
  else {
    state.courses.unshift(course);
    state.currentId = course.id;
  }
  if (state.selectedFile) {
    await putMedia(course.id, state.selectedFile).catch(() => undefined);
    state.selectedFile = null;
  }
  saveCourses();
  render();
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
  return [els.installBtn].filter(Boolean);
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
  els.transcribeBtn.addEventListener('click', startTranscription);
  els.summaryBtn.addEventListener('click', summarizeCourse);
  els.exportTxtBtn.addEventListener('click', exportTxt);
  els.settingsBtn.addEventListener('click', openSettings);
  els.closeSettings.addEventListener('click', closeSettings);
  els.saveGroqKeyBtn.addEventListener('click', saveGroqKey);
  els.themeInput.addEventListener('change', updateThemeHelper);
  els.customThemeInput.addEventListener('input', updateThemeHelper);

  els.mediaInput.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.selectedFile = file;
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    els.fileLabel.textContent = `${file.name} — ${sizeMb} Mo`;
    renderMediaPreview(file, file.type, file.name);
    showToast('Fichier ajouté. Appuie sur Enregistrer pour le garder.');
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
      summary: '',
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
  els.summaryInput.value = first.summary || '';
  els.notesInput.value = first.notes || '';
  els.fileLabel.textContent = first.fileName ? `${first.fileName} — fichier déjà enregistré` : 'Choisis un fichier. Il reste sur ton appareil.';
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
