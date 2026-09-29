(function () {
  'use strict';

  const APP_ID = 'dinlipi';
  const DATA_KEY = 'dinlipi-tracker-v1';
  const THEME_KEY = 'dinlipi-theme-v1';
  const MAX_RECORDS = 10000;
  const MAX_BACKUP_CHARS = 25000000;
  const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';
  const DEFAULT_GOALS = { workMinutes: 8 * 60, sleepMinutes: 8 * 60 };

  const $ = (id) => document.getElementById(id);
  const ui = {
    todayDateLabel: $('todayDateLabel'),
    storageStatus: $('storageStatus'),
    storageStatusText: $('storageStatusText'),
    themeToggle: $('themeToggle'),
    workContext: $('workContext'),
    sleepContext: $('sleepContext'),
    workValue: $('workValue'),
    sleepValue: $('sleepValue'),
    workCaption: $('workCaption'),
    sleepCaption: $('sleepCaption'),
    workProgress: $('workProgress'),
    sleepProgress: $('sleepProgress'),
    workProgressFill: $('workProgressFill'),
    sleepProgressFill: $('sleepProgressFill'),
    workPercent: $('workPercent'),
    sleepPercent: $('sleepPercent'),
    workGoalLabel: $('workGoalLabel'),
    sleepGoalLabel: $('sleepGoalLabel'),
    trendChart: $('trendChart'),
    chartRangeLabel: $('chartRangeLabel'),
    dateContext: $('dateContext'),
    selectedDate: $('selectedDate'),
    todayButton: $('todayButton'),
    entryForm: $('entryForm'),
    workHours: $('workHours'),
    workMinutes: $('workMinutes'),
    sleepHours: $('sleepHours'),
    sleepMinutes: $('sleepMinutes'),
    dayNote: $('dayNote'),
    noteCount: $('noteCount'),
    formMessage: $('formMessage'),
    entrySaveState: $('entrySaveState'),
    saveEntry: $('saveEntry'),
    deleteRecord: $('deleteRecord'),
    averageWork: $('averageWork'),
    averageSleep: $('averageSleep'),
    totalWork: $('totalWork'),
    totalSleep: $('totalSleep'),
    weekCount: $('weekCount'),
    weekCaption: $('weekCaption'),
    goalWorkDisplay: $('goalWorkDisplay'),
    goalSleepDisplay: $('goalSleepDisplay'),
    historyList: $('historyList'),
    recordCount: $('recordCount'),
    historyMore: $('historyMore'),
    goalsDialog: $('goalsDialog'),
    goalsForm: $('goalsForm'),
    goalWorkHours: $('goalWorkHours'),
    goalWorkMinutes: $('goalWorkMinutes'),
    goalSleepHours: $('goalSleepHours'),
    goalSleepMinutes: $('goalSleepMinutes'),
    goalError: $('goalError'),
    backupDialog: $('backupDialog'),
    generateCode: $('generateCode'),
    codeOutput: $('codeOutput'),
    generatedCode: $('generatedCode'),
    codeInfo: $('codeInfo'),
    copyCode: $('copyCode'),
    restoreCode: $('restoreCode'),
    restoreButton: $('restoreButton'),
    downloadBackup: $('downloadBackup'),
    importBackup: $('importBackup'),
    toast: $('toast')
  };

  function localDateToISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function dateFromISO(iso) {
    if (typeof iso !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function isISODate(iso) { return !!dateFromISO(iso); }

  function addDays(iso, amount) {
    const date = dateFromISO(iso);
    if (!date) return iso;
    date.setDate(date.getDate() + amount);
    return localDateToISO(date);
  }

  function dayDifference(fromISO, toISO) {
    const from = dateFromISO(fromISO);
    const to = dateFromISO(toISO);
    if (!from || !to) return 0;
    const fromUTC = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const toUTC = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((toUTC - fromUTC) / 86400000);
  }

  function bengali(value) {
    return String(value).replace(/\d/g, (digit) => BENGALI_DIGITS[Number(digit)]);
  }

  function dateFormat(iso, options) {
    const date = dateFromISO(iso);
    if (!date) return '';
    return new Intl.DateTimeFormat('bn-BD', options).format(date);
  }

  function fullDate(iso) {
    return dateFormat(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function shortDate(iso, includeYear) {
    const options = { day: 'numeric', month: 'short' };
    if (includeYear) options.year = 'numeric';
    return dateFormat(iso, options);
  }

  function durationText(minutes) {
    if (minutes == null) return '—';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const parts = [];
    if (hours) parts.push(bengali(hours) + ' ঘণ্টা');
    if (rest) parts.push(bengali(rest) + ' মিনিট');
    if (!parts.length) parts.push('০ মিনিট');
    return parts.join(' ');
  }

  function compactDuration(minutes) {
    if (minutes == null) return '—';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours && rest) return bengali(hours) + 'ঘ ' + bengali(String(rest).padStart(2, '0')) + 'মি';
    if (hours) return bengali(hours) + 'ঘ';
    return bengali(rest) + 'মি';
  }

  function validStoredMinutes(value) {
    return value === null || (Number.isInteger(value) && value >= 0 && value <= 1440);
  }

  function normalizeGoals(input, strict) {
    const source = input && typeof input === 'object' ? input : {};
    const work = source.workMinutes;
    const sleep = source.sleepMinutes;
    const validWork = Number.isInteger(work) && work > 0 && work <= 1440;
    const validSleep = Number.isInteger(sleep) && sleep > 0 && sleep <= 1440;
    if (strict && (!validWork || !validSleep)) throw new Error('ব্যাকআপে লক্ষ্য-সংক্রান্ত তথ্য সঠিক নয়।');
    return {
      workMinutes: validWork ? work : DEFAULT_GOALS.workMinutes,
      sleepMinutes: validSleep ? sleep : DEFAULT_GOALS.sleepMinutes
    };
  }

  function normalizeRecord(date, raw, strict) {
    if (!isISODate(date) || !raw || typeof raw !== 'object' || Array.isArray(raw)) {
      if (strict) throw new Error('ব্যাকআপে একটি তারিখ বা রেকর্ড সঠিক নয়।');
      return null;
    }
    const workMinutes = raw.workMinutes == null ? null : raw.workMinutes;
    const sleepMinutes = raw.sleepMinutes == null ? null : raw.sleepMinutes;
    if (!validStoredMinutes(workMinutes) || !validStoredMinutes(sleepMinutes)) {
      if (strict) throw new Error('কাজ বা ঘুমের সময় ০ থেকে ২৪ ঘণ্টার মধ্যে হতে হবে।');
      return null;
    }
    if (raw.note != null && typeof raw.note !== 'string') {
      if (strict) throw new Error('ব্যাকআপে একটি নোট সঠিক নয়।');
      return null;
    }
    const note = String(raw.note || '').slice(0, 300);
    const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt.length < 80
      ? raw.updatedAt
      : dateFromISO(date).toISOString();
    if (workMinutes == null && sleepMinutes == null && !note.trim()) return null;
    return { workMinutes, sleepMinutes, note, updatedAt };
  }

  function normalizeRecords(raw, strict) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      if (strict) throw new Error('ব্যাকআপে দিনের তালিকা পাওয়া যায়নি।');
      return {};
    }
    const dates = Object.keys(raw);
    if (dates.length > MAX_RECORDS) throw new Error('এই ব্যাকআপে অনেক বেশি দিনের তথ্য আছে।');
    const records = {};
    dates.forEach((date) => {
      const record = normalizeRecord(date, raw[date], strict);
      if (record) records[date] = record;
    });
    return records;
  }

  function normalizeSnapshot(raw) {
    if (!raw || typeof raw !== 'object' || raw.app !== APP_ID || raw.version !== 1) {
      throw new Error('এই ব্যাকআপ কোডটি চেনা যায়নি বা এর সংস্করণ সমর্থিত নয়।');
    }
    return {
      app: APP_ID,
      version: 1,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
      goals: normalizeGoals(raw.goals, true),
      records: normalizeRecords(raw.records, true)
    };
  }

  function readLocalState() {
    const empty = { records: {}, goals: { ...DEFAULT_GOALS } };
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return empty;
      return {
        records: normalizeRecords(parsed.records || {}, false),
        goals: normalizeGoals(parsed.goals, false)
      };
    } catch (error) {
      return empty;
    }
  }

  const initialStore = readLocalState();
  const state = {
    records: initialStore.records,
    goals: initialStore.goals,
    selectedDate: localDateToISO(new Date()),
    chartRange: 7,
    showAllHistory: false
  };

  let toastTimer = 0;

  function setStorageStatus(text, warning) {
    ui.storageStatusText.textContent = text;
    ui.storageStatus.classList.toggle('is-warning', !!warning);
    ui.storageStatus.title = warning
      ? 'ব্রাউজারের স্টোরেজে সেভ করা যায়নি। অন্যত্র ব্যাকআপ রাখুন।'
      : 'তথ্য এই ব্রাউজারেই থাকে; অন্য ব্রাউজারে নিতে ব্যাকআপ কোড তৈরি করুন।';
  }

  function persistState() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify({
        version: 1,
        goals: state.goals,
        records: state.records
      }));
      setStorageStatus('এই ডিভাইসে সেভ', false);
      return true;
    } catch (error) {
      setStorageStatus('সেভ হয়নি', true);
      showToast('ব্রাউজারে জায়গা না থাকায় সেভ করা যায়নি। JSON ব্যাকআপ ডাউনলোড করে রাখুন।', true);
      return false;
    }
  }

  function showToast(message, isError) {
    window.clearTimeout(toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.toggle('is-error', !!isError);
    ui.toast.hidden = false;
    toastTimer = window.setTimeout(() => { ui.toast.hidden = true; }, 3600);
  }

  function setTheme(theme, save) {
    const next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    ui.themeToggle.setAttribute('aria-label', next === 'dark' ? 'লাইট মোড চালু করুন' : 'ডার্ক মোড চালু করুন');
    ui.themeToggle.title = next === 'dark' ? 'লাইট মোড' : 'ডার্ক মোড';
    if (save) {
      try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* Theme is still active for this page. */ }
    }
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (error) { /* Use the system preference if storage is unavailable. */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function relativeDateText(iso) {
    const difference = dayDifference(localDateToISO(new Date()), iso);
    if (difference === 0) return 'আজকের হিসাব';
    if (difference === 1) return 'আগামীকালের পরিকল্পনা';
    if (difference > 1) return bengali(difference) + ' দিন পরের পরিকল্পনা';
    if (difference === -1) return 'গতকালের হিসাব';
    return bengali(Math.abs(difference)) + ' দিন আগের হিসাব';
  }

  function contextForMetric(iso, type) {
    const difference = dayDifference(localDateToISO(new Date()), iso);
    const label = type === 'work' ? 'কাজ' : 'ঘুম';
    if (difference === 0) return 'আজকের ' + label;
    if (difference > 0) return 'আগাম ' + label + ' পরিকল্পনা';
    return 'আগের দিনের ' + label;
  }

  function currentRecord() { return state.records[state.selectedDate] || null; }

  function paintMetric(type, minutes, goal) {
    const isWork = type === 'work';
    const valueElement = isWork ? ui.workValue : ui.sleepValue;
    const captionElement = isWork ? ui.workCaption : ui.sleepCaption;
    const progressElement = isWork ? ui.workProgress : ui.sleepProgress;
    const fillElement = isWork ? ui.workProgressFill : ui.sleepProgressFill;
    const percentElement = isWork ? ui.workPercent : ui.sleepPercent;
    const goalElement = isWork ? ui.workGoalLabel : ui.sleepGoalLabel;
    const goalText = durationText(goal);
    goalElement.textContent = goalText;
    valueElement.textContent = compactDuration(minutes);

    if (minutes == null) {
      captionElement.textContent = 'এই দিনের জন্য এখনও সময় যোগ করা হয়নি';
      fillElement.style.width = '0%';
      percentElement.textContent = '০%';
      progressElement.setAttribute('aria-valuenow', '0');
      progressElement.setAttribute('aria-valuetext', 'এখনও তথ্য যোগ করা হয়নি');
      return;
    }
    const percent = goal > 0 ? Math.round(minutes * 100 / goal) : 0;
    const visualPercent = Math.max(0, Math.min(100, percent));
    fillElement.style.width = visualPercent + '%';
    percentElement.textContent = bengali(percent) + '%';
    progressElement.setAttribute('aria-valuenow', String(visualPercent));
    progressElement.setAttribute('aria-valuetext', durationText(minutes) + ', লক্ষ্যের ' + bengali(percent) + ' শতাংশ');
    if (percent >= 100) captionElement.textContent = percent === 100 ? 'দৈনিক লক্ষ্য পূরণ হয়েছে' : 'দৈনিক লক্ষ্যের চেয়েও বেশি';
    else captionElement.textContent = 'দৈনিক লক্ষ্যের ' + bengali(percent) + '%';
  }

  function renderOverview() {
    const record = currentRecord();
    ui.workContext.textContent = contextForMetric(state.selectedDate, 'work');
    ui.sleepContext.textContent = contextForMetric(state.selectedDate, 'sleep');
    paintMetric('work', record ? record.workMinutes : null, state.goals.workMinutes);
    paintMetric('sleep', record ? record.sleepMinutes : null, state.goals.sleepMinutes);
    ui.goalWorkDisplay.textContent = durationText(state.goals.workMinutes);
    ui.goalSleepDisplay.textContent = durationText(state.goals.sleepMinutes);
  }

  function readDurationPair(hoursInput, minutesInput) {
    const hoursRaw = hoursInput.value.trim();
    const minutesRaw = minutesInput.value.trim();
    if (!hoursRaw && !minutesRaw) return { valid: true, value: null, provided: false };
    const isInteger = (value) => /^\d+$/.test(value);
    if ((hoursRaw && !isInteger(hoursRaw)) || (minutesRaw && !isInteger(minutesRaw))) {
      return { valid: false, value: null, provided: true, error: 'ঘণ্টা ও মিনিট পূর্ণ সংখ্যা হিসেবে লিখুন।' };
    }
    const hours = hoursRaw ? Number(hoursRaw) : 0;
    const minutes = minutesRaw ? Number(minutesRaw) : 0;
    if (!Number.isSafeInteger(hours) || !Number.isSafeInteger(minutes) || hours > 24 || minutes > 59 || hours < 0 || minutes < 0) {
      return { valid: false, value: null, provided: true, error: 'ঘণ্টা ০–২৪ এবং মিনিট ০–৫৯-এর মধ্যে লিখুন।' };
    }
    const total = hours * 60 + minutes;
    if (total > 1440) return { valid: false, value: null, provided: true, error: 'এক দিনের মোট সময় ২৪ ঘণ্টার বেশি হতে পারে না।' };
    return { valid: true, value: total, provided: true };
  }

  function readForm() {
    const work = readDurationPair(ui.workHours, ui.workMinutes);
    const sleep = readDurationPair(ui.sleepHours, ui.sleepMinutes);
    const note = ui.dayNote.value.trim().slice(0, 300);
    const invalid = !work.valid ? work : (!sleep.valid ? sleep : null);
    return {
      valid: !invalid,
      error: invalid ? invalid.error : '',
      workMinutes: work.value,
      sleepMinutes: sleep.value,
      note,
      hasContent: work.value != null || sleep.value != null || !!note
    };
  }

  function formMatchesRecord(formData, record) {
    const saved = record || { workMinutes: null, sleepMinutes: null, note: '' };
    return formData.workMinutes === saved.workMinutes &&
      formData.sleepMinutes === saved.sleepMinutes &&
      formData.note === (saved.note || '');
  }

  function formIsDirty() {
    const formData = readForm();
    if (!formData.valid) return true;
    return !formMatchesRecord(formData, currentRecord());
  }

  function setDurationInputs(prefix, minutes) {
    const hoursInput = $(prefix + 'Hours');
    const minutesInput = $(prefix + 'Minutes');
    if (minutes == null) {
      hoursInput.value = '';
      minutesInput.value = '';
      return;
    }
    hoursInput.value = String(Math.floor(minutes / 60));
    minutesInput.value = String(minutes % 60);
  }

  function updateNoteCount() {
    ui.noteCount.textContent = bengali(ui.dayNote.value.length) + ' / ৩০০';
  }

  function updateFormState() {
    const result = readForm();
    const record = currentRecord();
    const dirty = result.valid ? !formMatchesRecord(result, record) : true;
    const canSave = dirty && result.valid && result.hasContent;
    ui.saveEntry.disabled = !canSave;
    ui.entrySaveState.classList.toggle('is-dirty', dirty);
    if (dirty) ui.entrySaveState.textContent = 'পরিবর্তন সেভ হয়নি';
    else if (record) ui.entrySaveState.textContent = 'এই দিনের তথ্য সেভ আছে';
    else ui.entrySaveState.textContent = 'এখনও তথ্য সেভ করা হয়নি';

    ui.formMessage.classList.remove('is-ok');
    if (!result.valid) ui.formMessage.textContent = result.error;
    else if (dirty && !result.hasContent && record) ui.formMessage.textContent = 'সব ঘর খালি। তথ্য মুছতে নিচের “এই দিনের তথ্য মুছুন” বাটনটি ব্যবহার করুন।';
    else if (dirty && !result.hasContent) ui.formMessage.textContent = 'সেভ করতে কাজ, ঘুম বা নোট—অন্তত একটি তথ্য দিন।';
    else if (dirty) ui.formMessage.textContent = '';
    else ui.formMessage.textContent = '';
    updateNoteCount();
  }

  function renderDateAndForm() {
    const today = localDateToISO(new Date());
    ui.todayDateLabel.textContent = fullDate(today);
    ui.selectedDate.value = state.selectedDate;
    ui.dateContext.textContent = fullDate(state.selectedDate) + ' · ' + relativeDateText(state.selectedDate);
    const record = currentRecord();
    setDurationInputs('work', record ? record.workMinutes : null);
    setDurationInputs('sleep', record ? record.sleepMinutes : null);
    ui.dayNote.value = record ? record.note : '';
    ui.deleteRecord.hidden = !record;
    updateFormState();
  }

  function chartBar(x, y, width, height, className, tooltip) {
    const safeHeight = Math.max(0, height);
    const drawHeight = safeHeight === 0 ? 1.5 : safeHeight;
    const drawY = safeHeight === 0 ? y - drawHeight : y;
    return '<rect class="' + className + (safeHeight === 0 ? ' is-empty' : '') + '" x="' + x.toFixed(2) + '" y="' + drawY.toFixed(2) + '" width="' + width.toFixed(2) + '" height="' + drawHeight.toFixed(2) + '" rx="' + Math.min(5, width / 2).toFixed(2) + '"><title>' + tooltip + '</title></rect>';
  }

  function renderChart() {
    const count = state.chartRange;
    const start = addDays(state.selectedDate, 1 - count);
    const width = count <= 7 ? 620 : (count <= 14 ? 760 : 900);
    const height = 270;
    const minimumWidth = count <= 7 ? 450 : (count <= 14 ? 600 : 720);
    const left = 43;
    const right = 10;
    const top = 17;
    const bottom = 39;
    const plotHeight = height - top - bottom;
    const plotWidth = width - left - right;
    const groupWidth = plotWidth / count;
    const barWidth = Math.min(18, groupWidth * 0.29);
    const barGap = Math.min(4, groupWidth * 0.055);
    const dates = [];
    for (let index = 0; index < count; index += 1) dates.push(addDays(start, index));

    ui.chartRangeLabel.textContent = 'নির্বাচিত দিনসহ আগের ' + bengali(count) + ' দিন';
    ui.trendChart.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    ui.trendChart.style.minWidth = minimumWidth + 'px';
    document.querySelectorAll('[data-range]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.range === String(count) ? 'true' : 'false');
    });

    const pieces = [
      '<title>' + bengali(count) + ' দিনের কাজ ও ঘুমের সময়</title>',
      '<desc>বারে চাপ দিলে ওই তারিখের হিসাব সম্পাদনা করা যাবে।</desc>'
    ];
    [0, 6, 12, 18, 24].forEach((hours) => {
      const y = top + plotHeight * (1 - hours / 24);
      pieces.push('<line class="chart-gridline" x1="' + left + '" y1="' + y.toFixed(2) + '" x2="' + (width - right) + '" y2="' + y.toFixed(2) + '"/>');
      pieces.push('<text class="chart-y-label" x="' + (left - 11) + '" y="' + (y + 4).toFixed(2) + '" text-anchor="end">' + bengali(hours) + '</text>');
    });

    let anyLoggedDuration = false;
    dates.forEach((date, index) => {
      const xCenter = left + groupWidth * (index + 0.5);
      const iso = date;
      const record = state.records[iso] || null;
      const work = record ? record.workMinutes : null;
      const sleep = record ? record.sleepMinutes : null;
      if (work != null || sleep != null) anyLoggedDuration = true;
      const workDuration = durationText(work);
      const sleepDuration = durationText(sleep);
      const labelDate = fullDate(iso);
      const description = labelDate + '। কাজ: ' + workDuration + '। ঘুম: ' + sleepDuration + '।';
      const isSelected = iso === state.selectedDate;
      const focusY = top - 4;
      const focusHeight = plotHeight + 35;
      const focusWidth = Math.max(1, groupWidth - 2);
      const barY = (value) => top + plotHeight * (1 - (value == null ? 0 : value / 1440));
      const workY = barY(work);
      const sleepY = barY(sleep);
      const workHeight = work == null ? 0 : plotHeight * work / 1440;
      const sleepHeight = sleep == null ? 0 : plotHeight * sleep / 1440;
      const workX = xCenter - barGap / 2 - barWidth;
      const sleepX = xCenter + barGap / 2;
      const dateObj = dateFromISO(iso);
      const showDateLabel = count <= 14 || index % 5 === 0 || index === count - 1;
      const axisLabel = count === 30 && dateObj && (dateObj.getDate() === 1 || index === 0)
        ? bengali(dateObj.getDate()) + '/' + bengali(dateObj.getMonth() + 1)
        : (dateObj ? bengali(dateObj.getDate()) : '');
      let column = '<g class="chart-column' + (isSelected ? ' selected' : '') + '" data-date="' + iso + '" tabindex="0" role="button" aria-label="' + description + '">';
      column += '<title>' + description + '</title>';
      column += '<rect class="column-focus" x="' + (xCenter - focusWidth / 2).toFixed(2) + '" y="' + focusY + '" width="' + focusWidth.toFixed(2) + '" height="' + focusHeight.toFixed(2) + '" rx="7"/>';
      if (work != null) column += chartBar(workX, workY, barWidth, workHeight, 'chart-bar-work', 'কাজ · ' + workDuration);
      if (sleep != null) column += chartBar(sleepX, sleepY, barWidth, sleepHeight, 'chart-bar-sleep', 'ঘুম · ' + sleepDuration);
      if (showDateLabel) column += '<text class="chart-x-label" x="' + xCenter.toFixed(2) + '" y="' + (height - 8) + '" text-anchor="middle">' + axisLabel + '</text>';
      column += '</g>';
      pieces.push(column);
    });

    if (!anyLoggedDuration) {
      pieces.push('<text class="chart-empty-label" x="' + (left + plotWidth / 2) + '" y="' + (top + plotHeight / 2 + 4) + '" text-anchor="middle">এই সময়ের কোনো হিসাব এখনো নেই</text>');
    }
    ui.trendChart.innerHTML = pieces.join('');
    ui.trendChart.setAttribute('aria-label', bengali(count) + ' দিনের কাজ ও ঘুমের গ্রাফ। চার্টের কোনো দিন বেছে নিয়ে তার হিসাব লিখুন।');
  }

  function renderWeek() {
    const start = addDays(state.selectedDate, -6);
    let workTotal = 0;
    let sleepTotal = 0;
    let workDays = 0;
    let sleepDays = 0;
    let daysWithAnyData = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      const record = state.records[addDays(start, offset)];
      if (!record) continue;
      if (record.workMinutes != null) { workTotal += record.workMinutes; workDays += 1; }
      if (record.sleepMinutes != null) { sleepTotal += record.sleepMinutes; sleepDays += 1; }
      if (record.workMinutes != null || record.sleepMinutes != null || record.note) daysWithAnyData += 1;
    }
    ui.weekCount.textContent = bengali(daysWithAnyData) + ' দিন';
    ui.averageWork.textContent = workDays ? compactDuration(Math.round(workTotal / workDays)) : '—';
    ui.averageSleep.textContent = sleepDays ? compactDuration(Math.round(sleepTotal / sleepDays)) : '—';
    ui.totalWork.textContent = 'মোট ' + compactDuration(workDays ? workTotal : null);
    ui.totalSleep.textContent = 'মোট ' + compactDuration(sleepDays ? sleepTotal : null);
    ui.weekCaption.textContent = 'নির্বাচিত দিনসহ আগের ৭ দিনের হিসাব';
  }

  function recordSortTime(record, date) {
    const updated = Date.parse(record.updatedAt || '');
    if (Number.isFinite(updated)) return updated;
    const parsed = dateFromISO(date);
    return parsed ? parsed.getTime() : 0;
  }

  function renderHistory() {
    const dates = Object.keys(state.records).sort((a, b) => {
      const byUpdate = recordSortTime(state.records[b], b) - recordSortTime(state.records[a], a);
      return byUpdate || b.localeCompare(a);
    });
    ui.recordCount.textContent = bengali(dates.length);
    if (!dates.length) {
      ui.historyList.innerHTML = '<div class="history-empty"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 1 4 16.5v-11Z" stroke="currentColor" stroke-width="1.5"/><path d="M4 16.5A2.5 2.5 0 0 1 6.5 14H19M8 7h7m-7 3h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><b>এখনও কোনো রেকর্ড নেই</b><span>প্রথম দিনের হিসাব লিখলে এখানে দেখা যাবে।</span></div>';
      ui.historyMore.hidden = true;
      return;
    }
    const visibleDates = state.showAllHistory ? dates : dates.slice(0, 5);
    ui.historyList.innerHTML = visibleDates.map((date) => {
      const record = state.records[date];
      const withYear = date.slice(0, 4) !== String(new Date().getFullYear());
      const dayText = dateFormat(date, { weekday: 'short' });
      const workText = record.workMinutes == null ? '—' : compactDuration(record.workMinutes);
      const sleepText = record.sleepMinutes == null ? '—' : compactDuration(record.sleepMinutes);
      const selected = date === state.selectedDate;
      const aria = fullDate(date) + '। কাজ ' + (record.workMinutes == null ? 'যোগ করা হয়নি' : durationText(record.workMinutes)) + '। ঘুম ' + (record.sleepMinutes == null ? 'যোগ করা হয়নি' : durationText(record.sleepMinutes));
      return '<button class="history-row' + (selected ? ' is-selected' : '') + '" type="button" data-history-date="' + date + '" aria-label="' + aria + '"' + (selected ? ' aria-current="date"' : '') + '>' +
        '<span class="history-date"><b>' + shortDate(date, withYear) + '</b><small>' + dayText + '</small></span>' +
        '<span class="history-values"><span class="history-value work">' + workText + '</span><span class="history-value sleep">' + sleepText + '</span></span>' +
        '<span class="history-arrow" aria-hidden="true">›</span></button>';
    }).join('');
    if (dates.length > 5) {
      ui.historyMore.hidden = false;
      ui.historyMore.textContent = state.showAllHistory ? 'কম দেখান' : 'সব এন্ট্রি দেখুন · ' + bengali(dates.length);
    } else {
      ui.historyMore.hidden = true;
    }
  }

  function renderAll(reloadForm) {
    if (reloadForm !== false) renderDateAndForm();
    renderOverview();
    renderChart();
    renderWeek();
    renderHistory();
  }

  function changeSelectedDate(nextDate) {
    if (!isISODate(nextDate)) {
      ui.selectedDate.value = state.selectedDate;
      return false;
    }
    if (nextDate === state.selectedDate) return true;
    if (formIsDirty() && !window.confirm('এই দিনের কিছু পরিবর্তন সেভ করা হয়নি। সেগুলো বাদ দিয়ে অন্য তারিখে যাবেন?')) {
      ui.selectedDate.value = state.selectedDate;
      return false;
    }
    state.selectedDate = nextDate;
    renderAll(true);
    return true;
  }

  function saveEntry(event) {
    event.preventDefault();
    const result = readForm();
    if (!result.valid) {
      ui.formMessage.textContent = result.error;
      return;
    }
    if (!result.hasContent) {
      ui.formMessage.textContent = 'সেভ করতে কাজ, ঘুম বা নোট—অন্তত একটি তথ্য দিন।';
      return;
    }
    state.records[state.selectedDate] = {
      workMinutes: result.workMinutes,
      sleepMinutes: result.sleepMinutes,
      note: result.note,
      updatedAt: new Date().toISOString()
    };
    const saved = persistState();
    renderAll(true);
    ui.formMessage.classList.add('is-ok');
    ui.formMessage.textContent = saved ? 'এই দিনের হিসাব সেভ হয়েছে।' : 'তথ্যটি এই পাতায় আছে, তবে ব্রাউজারে সেভ হয়নি।';
    showToast(saved ? 'দিনের হিসাব সেভ হয়েছে' : 'তথ্য ব্রাউজারে সেভ করা যায়নি', !saved);
  }

  function removeEntry() {
    if (!state.records[state.selectedDate]) return;
    if (!window.confirm(fullDate(state.selectedDate) + '–এর কাজ, ঘুম ও নোটের তথ্য মুছে ফেলবেন?')) return;
    delete state.records[state.selectedDate];
    const saved = persistState();
    renderAll(true);
    showToast(saved ? 'এই দিনের তথ্য মুছে ফেলা হয়েছে' : 'তথ্য মুছে গেছে, তবে পরিবর্তন ব্রাউজারে সেভ হয়নি', !saved);
  }

  function fillGoalForm() {
    setDurationInputs('goalWork', state.goals.workMinutes);
    setDurationInputs('goalSleep', state.goals.sleepMinutes);
    ui.goalError.textContent = '';
  }

  function saveGoals(event) {
    event.preventDefault();
    const work = readDurationPair(ui.goalWorkHours, ui.goalWorkMinutes);
    const sleep = readDurationPair(ui.goalSleepHours, ui.goalSleepMinutes);
    if (!work.valid || !sleep.valid || !work.value || !sleep.value) {
      ui.goalError.textContent = 'কাজ ও ঘুম—দুটিরই লক্ষ্য ১ মিনিট থেকে ২৪ ঘণ্টার মধ্যে দিন।';
      return;
    }
    state.goals = { workMinutes: work.value, sleepMinutes: sleep.value };
    const saved = persistState();
    ui.goalsDialog.close();
    renderAll(false);
    showToast(saved ? 'দৈনিক লক্ষ্য আপডেট হয়েছে' : 'লক্ষ্য বদলেছে, তবে ব্রাউজারে সেভ হয়নি', !saved);
  }

  function makeSnapshot() {
    return {
      app: APP_ID,
      version: 1,
      exportedAt: new Date().toISOString(),
      goals: { ...state.goals },
      records: JSON.parse(JSON.stringify(state.records))
    };
  }

  function bytesToBase64URL(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function base64URLToBytes(value) {
    if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('ব্যাকআপ কোডের লেখা সঠিক নয়।');
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    let binary;
    try { binary = atob(padded); } catch (error) { throw new Error('ব্যাকআপ কোড পড়া যায়নি। পুরো কোডটি কপি হয়েছে কি না দেখুন।'); }
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  async function compressBytes(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function decompressBytes(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function createBackupCode() {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(makeSnapshot()));
    if ('CompressionStream' in window && 'DecompressionStream' in window) {
      try {
        return 'DINLIPI1-GZIP:' + bytesToBase64URL(await compressBytes(jsonBytes));
      } catch (error) {
        // Fall back to a plain JSON code if compression is unavailable in the browser.
      }
    }
    return 'DINLIPI1-JSON:' + bytesToBase64URL(jsonBytes);
  }

  async function decodeBackupCode(value) {
    if (typeof value !== 'string' || !value.trim()) throw new Error('আগে একটি ব্যাকআপ কোড পেস্ট করুন।');
    const trimmed = value.trim();
    if (trimmed.length > MAX_BACKUP_CHARS) throw new Error('ব্যাকআপ কোডটি খুব বড় বা সঠিক নয়।');
    if (trimmed[0] === '{') {
      try { return normalizeSnapshot(JSON.parse(trimmed)); }
      catch (error) { throw error instanceof SyntaxError ? new Error('JSON ব্যাকআপটি পড়া যায়নি।') : error; }
    }
    const compact = trimmed.replace(/\s/g, '');
    let prefix;
    let isCompressed = false;
    if (compact.startsWith('DINLIPI1-GZIP:')) {
      prefix = 'DINLIPI1-GZIP:';
      isCompressed = true;
    } else if (compact.startsWith('DINLIPI1-JSON:')) {
      prefix = 'DINLIPI1-JSON:';
    } else {
      throw new Error('এই কোডটি দিনলিপির ব্যাকআপ কোড বলে মনে হচ্ছে না।');
    }
    let bytes = base64URLToBytes(compact.slice(prefix.length));
    if (isCompressed) {
      if (!('DecompressionStream' in window)) throw new Error('এই ব্রাউজারে কোড খোলার সুবিধা নেই। JSON ব্যাকআপ ফাইল ব্যবহার করুন।');
      try { bytes = await decompressBytes(bytes); }
      catch (error) { throw new Error('ব্যাকআপ কোডটি অসম্পূর্ণ বা ক্ষতিগ্রস্ত। পুরো কোডটি আবার কপি করুন।'); }
    }
    let parsed;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch (error) { throw new Error('ব্যাকআপ কোডের তথ্য পড়া যায়নি।'); }
    return normalizeSnapshot(parsed);
  }

  function countOverlap(incoming) {
    return Object.keys(incoming).filter((date) => Object.prototype.hasOwnProperty.call(state.records, date)).length;
  }

  function applySnapshot(snapshot, mode, sourceName) {
    const incoming = normalizeSnapshot(snapshot);
    const incomingCount = Object.keys(incoming.records).length;
    const existingCount = Object.keys(state.records).length;
    const overlap = countOverlap(incoming.records);
    const dirty = formIsDirty();
    if (dirty && !window.confirm('ফর্মে সেভ না করা পরিবর্তন আছে। পুনরুদ্ধারের আগে সেগুলো বাদ যাবে। চালিয়ে যাবেন?')) return false;
    if (mode === 'replace' && existingCount) {
      const proceed = window.confirm('এই ব্রাউজারের ' + bengali(existingCount) + ' দিনের তথ্য মুছে ব্যাকআপের ' + bengali(incomingCount) + ' দিনের তথ্য বসানো হবে। চালিয়ে যাবেন?');
      if (!proceed) return false;
    } else if (mode === 'merge' && overlap) {
      const proceed = window.confirm('ব্যাকআপে ' + bengali(overlap) + 'টি তারিখ এই ব্রাউজারেও আছে। ওই তারিখগুলোতে ব্যাকআপের তথ্য বসবে। চালিয়ে যাবেন?');
      if (!proceed) return false;
    }

    if (mode === 'replace') {
      state.records = incoming.records;
      state.goals = incoming.goals;
    } else {
      state.records = Object.assign({}, state.records, incoming.records);
      if (!existingCount) state.goals = incoming.goals;
    }
    const saved = persistState();
    state.showAllHistory = false;
    renderAll(true);
    if (ui.backupDialog.open) ui.backupDialog.close();
    const action = mode === 'replace' ? 'পুনরুদ্ধার' : 'যোগ করা';
    showToast(saved
      ? bengali(incomingCount) + ' দিনের তথ্য ' + action + ' হয়েছে' + (sourceName ? ' · ' + sourceName : '')
      : 'তথ্য লোড হয়েছে, তবে এই ব্রাউজারে সেভ করা যায়নি', !saved);
    return true;
  }

  async function handleGenerateCode() {
    const originalText = ui.generateCode.innerHTML;
    ui.generateCode.disabled = true;
    ui.generateCode.textContent = 'কোড তৈরি হচ্ছে…';
    try {
      ui.generatedCode.value = await createBackupCode();
      ui.codeOutput.hidden = false;
      ui.codeInfo.textContent = Object.keys(state.records).length
        ? bengali(Object.keys(state.records).length) + ' দিনের তথ্য · অন্য ব্রাউজারে পেস্ট করুন'
        : 'এখনও কোনো দিনের তথ্য নেই—লক্ষ্যসহ খালি ব্যাকআপ কোড তৈরি হয়েছে।';
      showToast('ব্যাকআপ কোড তৈরি হয়েছে');
    } catch (error) {
      showToast('ব্যাকআপ কোড তৈরি করা যায়নি। JSON ফাইল ডাউনলোড করে নিন।', true);
    } finally {
      ui.generateCode.disabled = false;
      ui.generateCode.innerHTML = originalText;
    }
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const temporary = document.createElement('textarea');
        temporary.value = text;
        temporary.setAttribute('readonly', '');
        temporary.style.position = 'fixed';
        temporary.style.opacity = '0';
        document.body.appendChild(temporary);
        temporary.select();
        const copied = document.execCommand('copy');
        temporary.remove();
        if (!copied) throw new Error('Copy command was unavailable.');
      }
      showToast('ব্যাকআপ কোড কপি হয়েছে');
    } catch (error) {
      ui.generatedCode.focus();
      ui.generatedCode.select();
      showToast('কোডটি সিলেক্ট করা হয়েছে—কপি করুন।', true);
    }
  }

  function downloadSnapshot() {
    const blob = new Blob([JSON.stringify(makeSnapshot(), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'dinlipi-backup-' + localDateToISO(new Date()) + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('JSON ব্যাকআপ ডাউনলোড শুরু হয়েছে');
  }

  async function importBackupFile(file) {
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('ফাইলটি ৩০ মেগাবাইটের বেশি।');
      const text = await file.text();
      const snapshot = normalizeSnapshot(JSON.parse(text));
      applySnapshot(snapshot, document.querySelector('input[name="restoreMode"]:checked').value, 'ফাইল');
    } catch (error) {
      showToast(error.message || 'ফাইলটি থেকে ডাটা পড়া যায়নি।', true);
    } finally {
      ui.importBackup.value = '';
    }
  }

  function openBackupDialog() {
    if (formIsDirty() && !window.confirm('ফর্মে সেভ না করা পরিবর্তন আছে। ব্যাকআপে শুধু আগে সেভ করা তথ্য থাকবে। তবু এগোবেন?')) return;
    ui.backupDialog.showModal();
  }

  function initialize() {
    setTheme(loadTheme(), false);
    setStorageStatus('এই ডিভাইসে সেভ', false);
    renderAll(true);

    ui.themeToggle.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      setTheme(current === 'dark' ? 'light' : 'dark', true);
    });
    $('backupOpen').addEventListener('click', openBackupDialog);

    ui.selectedDate.addEventListener('change', () => changeSelectedDate(ui.selectedDate.value));
    $('previousDate').addEventListener('click', () => changeSelectedDate(addDays(state.selectedDate, -1)));
    $('nextDate').addEventListener('click', () => changeSelectedDate(addDays(state.selectedDate, 1)));
    ui.todayButton.addEventListener('click', () => changeSelectedDate(localDateToISO(new Date())));

    ui.entryForm.addEventListener('submit', saveEntry);
    [ui.workHours, ui.workMinutes, ui.sleepHours, ui.sleepMinutes, ui.dayNote].forEach((input) => {
      input.addEventListener('input', updateFormState);
    });
    ui.deleteRecord.addEventListener('click', removeEntry);

    document.querySelectorAll('[data-range]').forEach((button) => {
      button.addEventListener('click', () => {
        state.chartRange = Number(button.dataset.range);
        renderAll(false);
      });
    });
    ui.trendChart.addEventListener('click', (event) => {
      const column = event.target.closest('.chart-column[data-date]');
      if (!column) return;
      if (changeSelectedDate(column.dataset.date)) $('entryPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    ui.trendChart.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const column = event.target.closest('.chart-column[data-date]');
      if (!column) return;
      event.preventDefault();
      if (changeSelectedDate(column.dataset.date)) $('entryPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('editGoals').addEventListener('click', () => {
      fillGoalForm();
      ui.goalsDialog.showModal();
    });
    ui.goalsForm.addEventListener('submit', saveGoals);

    ui.historyList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-history-date]');
      if (!button) return;
      if (changeSelectedDate(button.dataset.historyDate)) $('entryPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    ui.historyMore.addEventListener('click', () => {
      state.showAllHistory = !state.showAllHistory;
      renderHistory();
    });

    document.querySelectorAll('[data-close-dialog]').forEach((button) => {
      button.addEventListener('click', () => $(button.dataset.closeDialog).close());
    });
    [ui.goalsDialog, ui.backupDialog].forEach((dialog) => {
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    });

    ui.generateCode.addEventListener('click', handleGenerateCode);
    ui.copyCode.addEventListener('click', () => copyText(ui.generatedCode.value));
    ui.restoreCode.addEventListener('input', () => { ui.restoreButton.disabled = !ui.restoreCode.value.trim(); });
    ui.restoreButton.addEventListener('click', async () => {
      const originalText = ui.restoreButton.innerHTML;
      ui.restoreButton.disabled = true;
      ui.restoreButton.textContent = 'কোড যাচাই হচ্ছে…';
      try {
        const snapshot = await decodeBackupCode(ui.restoreCode.value);
        const mode = document.querySelector('input[name="restoreMode"]:checked').value;
        applySnapshot(snapshot, mode, 'কোড');
      } catch (error) {
        showToast(error.message || 'ব্যাকআপ কোডটি পড়া যায়নি।', true);
      } finally {
        ui.restoreButton.innerHTML = originalText;
        ui.restoreButton.disabled = !ui.restoreCode.value.trim();
      }
    });
    ui.downloadBackup.addEventListener('click', downloadSnapshot);
    ui.importBackup.addEventListener('change', () => importBackupFile(ui.importBackup.files && ui.importBackup.files[0]));

    window.addEventListener('beforeunload', (event) => {
      if (!formIsDirty()) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  initialize();
})();
