(function () {
  const L = window.BoardLogic;
  const KEY = 'salah-glass-v1';

  const $ = (id) => document.getElementById(id);
  const hhEl = $('hh');
  const mmEl = $('mm');
  const ssEl = $('ss');
  const ampmEl = $('ampm');
  const dateEl = $('date');
  const dateSubEl = $('dateSub');
  const titleEl = $('title');
  const placeEl = $('place');
  const rowsEl = $('rows');
  const statusEl = $('status');
  const kickerEl = $('kicker');
  const chipEl = $('waqtChip');
  const statusMainEl = $('statusMain');
  const countEl = $('count');
  const noteEl = $('note');
  const fillEl = $('fill');
  const toastEl = $('toast');
  const liveEl = $('live');
  const scrim = $('scrim');

  let settings = loadSettings();
  let day = null;
  let schedule = null;
  let lastSecond = -1;
  let lastSig = '';
  let lastLiveMinute = '';
  let alerted = new Set();
  let audioCtx = null;
  let toastTimer = 0;
  let openId = null;
  let sheetGen = 0;
  let heading = null;
  let orientOn = false;
  let resetArmed = false;

  function loadSettings() {
    try {
      return L.mergeSettings(JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch (e) {
      return L.cloneDefaults();
    }
  }

  function saveSettings() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
  }

  function dhakaNow(date) {
    const d = date || new Date();
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      weekday: 'short'
    });
    const parts = {};
    fmt.formatToParts(d).forEach((p) => { if (p.type !== 'literal') parts[p.type] = p.value; });
    let hour = +parts.hour;
    if (hour === 24) hour = 0;
    const year = +parts.year;
    const month = +parts.month;
    const day = +parts.day;
    const utcNoon = new Date(Date.UTC(year, month - 1, day, 6, 0, 0));
    return {
      year, month, day,
      hour,
      minute: +parts.minute,
      second: +parts.second,
      dow: utcNoon.getUTCDay()
    };
  }

  function addDays(year, month, day, n) {
    const dt = new Date(Date.UTC(year, month - 1, day + n, 12));
    return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
  }

  function hijriParts(year, month, day, adj) {
    try {
      const shifted = addDays(year, month, day, adj || 0);
      const utc = new Date(Date.UTC(shifted.year, shifted.month - 1, shifted.day, 12));
      const fmt = new Intl.DateTimeFormat('en-u-ca-islamic', {
        day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC'
      });
      const parts = {};
      fmt.formatToParts(utc).forEach((p) => { parts[p.type] = p.value; });
      const m = +parts.month;
      const d = +parts.day;
      const y = +parts.year;
      if (!m || !d || !y) return null;
      return { day: d, month: m, year: y };
    } catch (e) {
      return null;
    }
  }

  function toMinutes(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + m;
  }

  function azanFor(year, month, day, loc, madhab) {
    const pt = prayTimes;
    pt.setMethod('Karachi');
    pt.adjust({ asr: madhab === 'Standard' ? 'Standard' : 'Hanafi' });
    pt.tune({ imsak: 0, fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, sunset: 0, maghrib: 0, isha: 0, midnight: 0 });
    const t = pt.getTimes([year, month, day], [loc.lat, loc.lng, 0], 6, 0, '24h');
    return {
      fajr: toMinutes(t.fajr),
      sunrise: toMinutes(t.sunrise),
      dhuhr: toMinutes(t.dhuhr),
      asr: toMinutes(t.asr),
      maghrib: toMinutes(t.maghrib),
      isha: toMinutes(t.isha)
    };
  }

  function opts() {
    return { hour12: settings.hour12, bengaliDigits: settings.bengaliDigits };
  }

  function fmtMins(mins) {
    if (mins == null || !isFinite(mins)) return '—';
    return L.formatHM(mins, opts());
  }

  function ensureDay(now) {
    const loc = L.locationOf(settings);
    const key = [
      now.year, now.month, now.day,
      loc.lat.toFixed(4), loc.lng.toFixed(4),
      settings.madhab,
      settings.maghribMode, settings.maghribOffset, settings.maghribFixed,
      settings.jamaat.fajr, settings.jamaat.dhuhr, settings.jamaat.asr,
      settings.jamaat.isha, settings.jamaat.jumuah,
      settings.hijriAdj
    ].join('|');
    if (day && day.key === key) return;
    const azan = azanFor(now.year, now.month, now.day, loc, settings.madhab);
    const next = addDays(now.year, now.month, now.day, 1);
    const tomorrow = azanFor(next.year, next.month, next.day, loc, settings.madhab);
    const hijri = hijriParts(now.year, now.month, now.day, settings.hijriAdj);
    day = {
      key,
      azan,
      tomorrowFajr: 1440 + tomorrow.fajr,
      hijri,
      loc,
      isRamadan: !!(hijri && hijri.month === 9)
    };
    lastSig = '';
  }

  function paintChrome(now) {
    const clock = L.formatClock(now.hour, now.minute, now.second, opts());
    if (hhEl.textContent !== clock.hh) hhEl.textContent = clock.hh;
    if (mmEl.textContent !== clock.mm) mmEl.textContent = clock.mm;
    if (ssEl.textContent !== clock.ss) {
      ssEl.textContent = clock.ss;
      ssEl.classList.remove('tick');
      void ssEl.offsetWidth;
      ssEl.classList.add('tick');
    }
    ampmEl.textContent = clock.ap;
    dateEl.textContent = L.formatBoardDate(now.year, now.month, now.day, opts());
    const weekday = L.WEEKDAYS[now.dow];
    let sub = weekday;
    if (schedule.hijri) {
      const h = schedule.hijri;
      const month = L.HIJRI_MONTHS[h.month - 1] || '';
      sub += '  ·  ' + L.digits(h.day, settings.bengaliDigits) + ' ' + month + ' ' + L.digits(h.year, settings.bengaliDigits);
    }
    dateSubEl.textContent = sub;
    const name = (settings.mosqueName || '').trim();
    titleEl.textContent = name || 'নামাজের সময়';
    placeEl.textContent = schedule.loc.bn;
  }

  function renderRows() {
    const o = opts();
    const nextPrayer = schedule.next ? schedule.next.prayer : '';
    const nextKind = schedule.next ? schedule.next.kind : '';
    rowsEl.innerHTML = schedule.rows.map((r) => {
      const azan = fmtMins(r.azanMins);
      let jam;
      if (schedule.isFriday && r.id === 'dhuhr') jam = 'জুমা';
      else if (!r.jamaatValid) jam = '—';
      else jam = fmtMins(r.jamaatMins);
      const badges = [];
      if (r.isNow) badges.push('<i class="badge">এখন</i>');
      else if (r.today) badges.push('<i class="badge">আজ</i>');
      else if (r.quiet) badges.push('<i class="badge soft">শুক্র</i>');
      const tag = r.ramadanTag ? '<span class="tag">' + r.ramadanTag + '</span>' : '';
      const azanDim = r.passedAzan && !r.isNow ? ' dim' : '';
      const jamDim = (r.passedJam && !r.isNow) || (schedule.isFriday && r.id === 'dhuhr') ? ' dim' : '';
      const jamWarn = !r.jamaatValid && !(schedule.isFriday && r.id === 'dhuhr') ? ' warn' : '';
      const mark = schedule.next && schedule.next.prayer === r.id && (nextKind === 'jamaat' || nextKind === 'both') && r.id === nextPrayer ? ' mark' : '';
      const cls = ['row', r.isNow ? 'is-now' : '', r.quiet ? 'quiet' : '', mark ? 'is-next' : ''].filter(Boolean).join(' ');
      return '<button type="button" class="' + cls + '" data-id="' + r.id + '"' + (r.isNow ? ' aria-current="true"' : '') + '>' +
        '<span class="name"><span class="bn">' + r.bn + badges.join('') + '</span><span class="en">' + r.en + '</span>' + tag + '</span>' +
        '<span class="t azan' + azanDim + '">' + azan + '</span>' +
        '<span class="t jam' + jamDim + jamWarn + mark + '">' + jam + '</span>' +
        '</button>';
    }).join('');
  }

  function paintStatus(now) {
    const nowSeconds = now.hour * 3600 + now.minute * 60 + now.second;
    const cd = L.countdown(schedule, nowSeconds);
    const soon = cd.seconds <= 600 && (cd.kind === 'jamaat' || cd.kind === 'both');
    statusEl.classList.toggle('is-soon', soon);
    kickerEl.textContent = cd.seconds <= 60 ? 'এখনই' : 'পরবর্তী';
    statusMainEl.textContent = cd.label || '—';
    countEl.textContent = L.formatHMS(cd.seconds, opts());
    fillEl.style.width = Math.round(cd.progress * 1000) / 10 + '%';
    if (schedule.waqt) {
      const p = L.prayerById(schedule.waqt);
      chipEl.textContent = 'এখন · ' + (p ? p.bn : '');
    } else {
      chipEl.textContent = '';
    }
    noteEl.textContent = schedule.note || '';

    const minuteKey = now.year + '-' + now.month + '-' + now.day + '-' + now.hour + '-' + now.minute;
    if (minuteKey !== lastLiveMinute) {
      lastLiveMinute = minuteKey;
      const p = schedule.waqt ? L.prayerById(schedule.waqt) : null;
      liveEl.textContent = (p ? p.bn + ' চলছে। ' : '') + (cd.label || '') + ' বাকি ' + L.bnDuration(cd.seconds, opts());
    }
  }

  function checkAlerts(now) {
    const nowAbs = now.hour * 3600 + now.minute * 60 + now.second;
    const dayKey = now.year + '-' + now.month + '-' + now.day + '-';
    schedule.events.forEach((ev) => {
      if (!ev.alert || ev.mins >= 1440) return;
      const delta = nowAbs - ev.mins * 60;
      if (delta < 0 || delta >= 90) return;
      const key = dayKey + ev.id;
      if (alerted.has(key)) return;
      alerted.add(key);
      showToast(ev.label, delta < 8 ? 'এই মুহূর্তে' : L.bnDuration(delta, opts()) + ' আগে');
      if (delta < 20) chime();
    });
  }

  function showToast(title, sub) {
    toastEl.innerHTML = '<b>' + title + '</b><span>' + (sub || '') + '</span>';
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      setTimeout(() => { if (!toastEl.classList.contains('show')) toastEl.hidden = true; }, 400);
    }, 9000);
  }

  function chime() {
    if (!settings.sound) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        const start = t + i * 0.11;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.07, start + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start(start);
        o.stop(start + 0.75);
      });
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } catch (e) {}
  }

  function tick() {
    const now = dhakaNow();
    const sec = now.hour * 3600 + now.minute * 60 + now.second;
    if (sec === lastSecond && schedule && day) return;
    lastSecond = sec;
    ensureDay(now);
    schedule = L.buildSchedule({
      azan: day.azan,
      tomorrowFajr: day.tomorrowFajr,
      settings,
      now,
      isFriday: now.dow === 5,
      isRamadan: day.isRamadan
    });
    schedule.hijri = day.hijri;
    schedule.loc = day.loc;
    paintChrome(now);
    const sig = L.viewSignature(schedule) + '|' + settings.hour12 + '|' + settings.bengaliDigits + '|' + (settings.mosqueName || '');
    if (sig !== lastSig) {
      renderRows();
      lastSig = sig;
    }
    paintStatus(now);
    checkAlerts(now);
    if (openId === 'settings') paintSettingHints();
    if (openId === 'qibla') paintQibla();
  }

  function loop() {
    tick();
    const wait = 1020 - (Date.now() % 1000);
    setTimeout(loop, wait);
  }

  function openSheet(id) {
    sheetGen += 1;
    const gen = sheetGen;
    document.querySelectorAll('.sheet').forEach((s) => {
      s.classList.remove('open');
      s.hidden = true;
    });
    openId = id;
    const sheet = $(id === 'detail' ? 'detailSheet' : id === 'qibla' ? 'qiblaSheet' : 'settingsSheet');
    scrim.hidden = false;
    sheet.hidden = false;
    requestAnimationFrame(() => {
      if (gen !== sheetGen) return;
      scrim.classList.add('show');
      sheet.classList.add('open');
    });
    document.body.style.overflow = 'hidden';
    if (id === 'settings') syncSettingsForm();
    if (id === 'qibla') paintQibla();
  }

  function closeSheet() {
    const gen = ++sheetGen;
    document.querySelectorAll('.sheet').forEach((s) => s.classList.remove('open'));
    scrim.classList.remove('show');
    openId = null;
    document.body.style.overflow = '';
    setTimeout(() => {
      if (gen !== sheetGen) return;
      document.querySelectorAll('.sheet').forEach((s) => { s.hidden = true; });
      scrim.hidden = true;
    }, 420);
  }

  function openDetail(id) {
    const row = schedule.rows.find((r) => r.id === id);
    if (!row) return;
    $('detailTitle').textContent = row.bn;
    const now = dhakaNow();
    const nowSeconds = now.hour * 3600 + now.minute * 60 + now.second;
    let sentence = '';
    if (row.id === 'jumuah' && !schedule.isFriday) {
      sentence = 'জুমার জামাত শুধু শুক্রবার। আজ এই সময়ে যোহরের জামাত।';
    } else if (row.jamaatWarning) {
      sentence = 'জামাতের সময় আযানের আগে পড়েছে, তাই আজ কার্যকর নয়। সেটিংস থেকে সময় ঠিক করুন।';
    } else if (row.isNow && row.jamaatValid && nowSeconds < row.jamaatMins * 60) {
      sentence = 'ওয়াক্ত চলছে। জামাত বাকি ' + L.bnDuration(row.jamaatMins * 60 - nowSeconds, opts()) + '।';
    } else if (row.isNow) {
      sentence = 'এই ওয়াক্ত এখন চলছে।';
      if (row.endMins != null) sentence += ' শেষ হতে বাকি ' + L.bnDuration(row.endMins * 60 - nowSeconds, opts()) + '।';
    } else if (row.azanMins * 60 > nowSeconds) {
      sentence = 'আযান বাকি ' + L.bnDuration(row.azanMins * 60 - nowSeconds, opts()) + '।';
    } else {
      sentence = 'আজকের এই ওয়াক্ত শেষ।';
    }
    if (schedule.isFriday && row.id === 'dhuhr') {
      sentence = 'শুক্রবার যোহরের স্থানে জুমার জামাত। আযানের সময় একই থাকে।';
    }
    const endLabel = row.id === 'fajr' ? 'সূর্যোদয়' : 'শেষ';
    $('detailBody').innerHTML =
      '<p class="detail-lead">' + row.en + ' · ' + row.fard + '</p>' +
      '<div class="stats">' +
        '<div class="stat azan"><em>আযান</em><strong>' + fmtMins(row.azanMins) + '</strong></div>' +
        '<div class="stat jam"><em>জামাত</em><strong>' + (row.jamaatValid ? fmtMins(row.jamaatMins) : '—') + '</strong></div>' +
        '<div class="stat"><em>' + endLabel + '</em><strong>' + fmtMins(row.endMins) + '</strong></div>' +
      '</div>' +
      '<p class="detail-copy">' + sentence + '</p>' +
      '<p class="detail-extra">' + row.extra + (row.ramadanTag ? ' · ' + row.ramadanTag : '') + '</p>';
    openSheet('detail');
  }

  function paintQibla() {
    const loc = L.locationOf(settings);
    const bearing = L.qiblaBearing(loc.lat, loc.lng);
    const km = L.qiblaDistanceKm(loc.lat, loc.lng);
    const name = L.bearingName(bearing);
    $('needle').style.setProperty('--qibla', bearing + 'deg');
    const rose = $('rose');
    if (heading != null && orientOn) {
      rose.style.transform = 'rotate(' + (-heading) + 'deg)';
      let diff = ((bearing - heading + 540) % 360) - 180;
      const aligned = Math.abs(diff) < 8;
      $('qiblaRead').textContent = aligned ? 'কিবলার দিকে' : (diff > 0 ? 'ডানে ঘোরান' : 'বামে ঘোরান');
      $('qiblaRead').classList.toggle('aligned', aligned);
      $('qiblaSub').textContent = loc.bn + ' থেকে কাবা ' + L.digits(Math.round(km).toLocaleString('en-US'), settings.bengaliDigits) + ' কিমি · ' + L.digits(bearing.toFixed(0), settings.bengaliDigits) + '° ' + name;
    } else {
      rose.style.transform = '';
      $('qiblaRead').classList.remove('aligned');
      $('qiblaRead').textContent = L.digits(bearing.toFixed(0), settings.bengaliDigits) + '° ' + name;
      $('qiblaSub').textContent = loc.bn + ' থেকে কাবা শরিফ ' + L.digits(Math.round(km).toLocaleString('en-US'), settings.bengaliDigits) + ' কিলোমিটার। উত্তর থেকে এই কোণে।';
    }
  }

  function onOrient(e) {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) h = e.webkitCompassHeading;
    else if (e.absolute && e.alpha != null) h = (360 - e.alpha) % 360;
    else if (e.alpha != null && e.beta != null && Math.abs(e.beta) > 20) h = (360 - e.alpha) % 360;
    if (h == null) return;
    heading = h;
    orientOn = true;
    if (openId === 'qibla') paintQibla();
  }

  async function enableCompass() {
    try {
      if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') {
          $('qiblaSub').textContent = 'কম্পাসের অনুমতি পাওয়া যায়নি। দিকটি উত্তর থেকে দেখানো হচ্ছে।';
          return;
        }
      }
      window.addEventListener('deviceorientationabsolute', onOrient, true);
      window.addEventListener('deviceorientation', onOrient, true);
      $('compassBtn').textContent = 'কম্পাস চালু';
      setTimeout(() => {
        if (!orientOn) $('qiblaSub').textContent = 'এই ডিভাইসে কম্পাস পাওয়া যায়নি। দিকটি উত্তর থেকে দেখানো হচ্ছে।';
      }, 1500);
    } catch (e) {
      $('qiblaSub').textContent = 'কম্পাস চালু করা যায়নি।';
    }
  }

  function fillCities() {
    const sel = $('citySelect');
    sel.innerHTML = L.CITIES.map((c) => '<option value="' + c.id + '">' + c.bn + '</option>').join('');
    if (settings.customLoc) {
      const opt = document.createElement('option');
      opt.value = 'custom';
      opt.textContent = 'বর্তমান অবস্থান';
      sel.prepend(opt);
    }
  }

  function syncSettingsForm() {
    fillCities();
    $('nameInput').value = settings.mosqueName || '';
    $('citySelect').value = settings.customLoc ? 'custom' : settings.cityId;
    document.querySelectorAll('[data-madhab]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.madhab === settings.madhab));
    });
    document.querySelectorAll('[data-hour]').forEach((b) => {
      b.setAttribute('aria-checked', String((b.dataset.hour === '12') === settings.hour12));
    });
    document.querySelectorAll('[data-digit]').forEach((b) => {
      b.setAttribute('aria-checked', String((b.dataset.digit === 'bn') === settings.bengaliDigits));
    });
    document.querySelectorAll('[data-mag]').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.mag === settings.maghribMode));
    });
    $('hijriVal').textContent = (settings.hijriAdj > 0 ? '+' : '') + settings.hijriAdj;
    $('magVal').textContent = String(settings.maghribOffset);
    $('jam-fajr').value = settings.jamaat.fajr;
    $('jam-dhuhr').value = settings.jamaat.dhuhr;
    $('jam-asr').value = settings.jamaat.asr;
    $('jam-isha').value = settings.jamaat.isha;
    $('jam-jumuah').value = settings.jamaat.jumuah;
    $('jam-maghrib').value = settings.maghribFixed;
    $('magOffsetRow').hidden = settings.maghribMode !== 'offset';
    $('magFixedRow').hidden = settings.maghribMode !== 'fixed';
    $('soundToggle').setAttribute('aria-checked', String(settings.sound));
    $('geoMsg').textContent = settings.customLoc
      ? 'অবস্থান নেওয়া হয়েছে · ' + settings.customLoc.lat.toFixed(3) + ', ' + settings.customLoc.lng.toFixed(3)
      : '';
    paintSettingHints();
  }

  function paintSettingHints() {
    if (!schedule) return;
    const mag = schedule.rows.find((r) => r.id === 'maghrib');
    $('magPreview').textContent = mag && mag.jamaatValid
      ? 'আজকের মাগরিব জামাত ' + fmtMins(mag.jamaatMins) + ' · আযান ' + fmtMins(mag.azanMins)
      : '';
    const warnings = schedule.rows.filter((r) => r.jamaatWarning).map((r) => r.bn + ' জামাত আযানের আগে');
    $('jamWarnings').innerHTML = warnings.length ? '<p class="warn-line">' + warnings.join(' · ') + '</p>' : '';
  }

  function apply(partial) {
    partial = partial || {};
    if (partial.jamaat) {
      settings.jamaat = Object.assign({}, settings.jamaat, partial.jamaat);
      partial = Object.assign({}, partial);
      delete partial.jamaat;
    }
    Object.assign(settings, partial);
    settings = L.mergeSettings(settings);
    saveSettings();
    day = null;
    lastSig = '';
    lastSecond = -1;
    tick();
    if (openId === 'settings') syncSettingsForm();
  }

  function bind() {
    $('settingsBtn').addEventListener('click', () => openSheet('settings'));
    $('qiblaBtn').addEventListener('click', () => openSheet('qibla'));
    $('compassBtn').addEventListener('click', enableCompass);
    scrim.addEventListener('click', () => closeSheet());
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeSheet()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

    rowsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.row');
      if (btn) openDetail(btn.dataset.id);
    });

    $('nameInput').addEventListener('input', () => {
      settings.mosqueName = $('nameInput').value.slice(0, 42);
      saveSettings();
      titleEl.textContent = settings.mosqueName.trim() || 'নামাজের সময়';
    });

    $('citySelect').addEventListener('change', () => {
      const v = $('citySelect').value;
      if (v === 'custom') return;
      settings.cityId = v;
      settings.customLoc = null;
      apply({});
    });

    $('geoBtn').addEventListener('click', () => {
      if (!navigator.geolocation) {
        $('geoMsg').textContent = 'এই ব্রাউজারে অবস্থান পাওয়া যায় না।';
        return;
      }
      $('geoMsg').textContent = 'অবস্থান খোঁজা হচ্ছে…';
      navigator.geolocation.getCurrentPosition((pos) => {
        settings.customLoc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          bn: 'বর্তমান অবস্থান',
          en: 'Current location'
        };
        apply({});
      }, () => {
        $('geoMsg').textContent = 'অবস্থান নেওয়া যায়নি। শহর বেছে নিন।';
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });

    document.querySelectorAll('[data-madhab]').forEach((b) => b.addEventListener('click', () => apply({ madhab: b.dataset.madhab })));
    document.querySelectorAll('[data-hour]').forEach((b) => b.addEventListener('click', () => apply({ hour12: b.dataset.hour === '12' })));
    document.querySelectorAll('[data-digit]').forEach((b) => b.addEventListener('click', () => apply({ bengaliDigits: b.dataset.digit === 'bn' })));
    document.querySelectorAll('[data-mag]').forEach((b) => b.addEventListener('click', () => apply({ maghribMode: b.dataset.mag })));

    $('hijriMinus').addEventListener('click', () => apply({ hijriAdj: settings.hijriAdj - 1 }));
    $('hijriPlus').addEventListener('click', () => apply({ hijriAdj: settings.hijriAdj + 1 }));
    $('magMinus').addEventListener('click', () => apply({ maghribOffset: settings.maghribOffset - 1, maghribMode: 'offset' }));
    $('magPlus').addEventListener('click', () => apply({ maghribOffset: settings.maghribOffset + 1, maghribMode: 'offset' }));

    ['fajr', 'dhuhr', 'asr', 'isha', 'jumuah'].forEach((id) => {
      $('jam-' + id).addEventListener('change', () => {
        const jamaat = {};
        jamaat[id] = $('jam-' + id).value;
        apply({ jamaat });
      });
    });
    $('jam-maghrib').addEventListener('change', () => apply({ maghribFixed: $('jam-maghrib').value, maghribMode: 'fixed' }));

    $('soundToggle').addEventListener('click', () => {
      settings.sound = !settings.sound;
      saveSettings();
      $('soundToggle').setAttribute('aria-checked', String(settings.sound));
      if (settings.sound) chime();
    });

    $('boardPreset').addEventListener('click', () => {
      apply({
        jamaat: { fajr: '05:10', dhuhr: '13:16', asr: '16:45', isha: '20:15', jumuah: '13:30' },
        maghribMode: 'fixed',
        maghribFixed: '18:12'
      });
    });

    $('resetBtn').addEventListener('click', () => {
      if (!resetArmed) {
        resetArmed = true;
        $('resetBtn').textContent = 'নিশ্চিত করতে আবার চাপুন';
        setTimeout(() => {
          resetArmed = false;
          $('resetBtn').textContent = 'সব আগের অবস্থায় ফেরান';
        }, 2800);
        return;
      }
      resetArmed = false;
      settings = L.cloneDefaults();
      saveSettings();
      scheduleKey = '';
      lastSig = '';
      lastSecond = -1;
      tick();
      syncSettingsForm();
      $('resetBtn').textContent = 'সব আগের অবস্থায় ফেরান';
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        lastSecond = -1;
        tick();
      }
    });
  }

  bind();
  tick();
  loop();
})();
