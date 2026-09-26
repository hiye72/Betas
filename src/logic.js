/* Prayer-board logic. Pure functions, no DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BoardLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BN = '০১২৩৪৫৬৭৮৯';

  const PRAYERS = [
    { id: 'fajr', bn: 'ফজর', en: 'Fajr', poss: 'ফজরের', fard: '২ রাকাত ফরজ', extra: 'আগে ২ রাকাত সুন্নত মুয়াক্কাদা' },
    { id: 'dhuhr', bn: 'যোহর', en: 'Zuhr', poss: 'যোহরের', fard: '৪ রাকাত ফরজ', extra: 'আগে ৪ সুন্নত, পরে ২ সুন্নত' },
    { id: 'asr', bn: 'আসর', en: 'Asr', poss: 'আসরের', fard: '৪ রাকাত ফরজ', extra: 'আগে ৪ রাকাত সুন্নত' },
    { id: 'maghrib', bn: 'মাগরিব', en: 'Maghrib', poss: 'মাগরিবের', fard: '৩ রাকাত ফরজ', extra: 'পরে ২ রাকাত সুন্নত' },
    { id: 'isha', bn: 'এশা', en: 'Isha', poss: 'এশার', fard: '৪ রাকাত ফরজ', extra: 'পরে ২ সুন্নত, তারপর ৩ বিতর' },
    { id: 'jumuah', bn: 'জুমা', en: "Jumu'ah", poss: 'জুমার', fard: 'খুতবার পর ২ রাকাত ফরজ', extra: 'শুধু শুক্রবারের জামাত' }
  ];

  const HIJRI_MONTHS = [
    'মুহাররম', 'সফর', 'রবিউল আউয়াল', 'রবিউস সানি',
    'জমাদিউল আউয়াল', 'জমাদিউস সানি', 'রজব', 'শাবান',
    'রমজান', 'শাওয়াল', 'জিলকদ', 'জিলহজ'
  ];

  const WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

  const CITIES = [
    { id: 'savar', bn: 'সাভার', en: 'Savar', lat: 23.858334, lng: 90.266670 },
    { id: 'dhaka', bn: 'ঢাকা', en: 'Dhaka', lat: 23.8103, lng: 90.4125 },
    { id: 'gazipur', bn: 'গাজীপুর', en: 'Gazipur', lat: 23.9999, lng: 90.4203 },
    { id: 'narayanganj', bn: 'নারায়ণগঞ্জ', en: 'Narayanganj', lat: 23.6238, lng: 90.5 },
    { id: 'chittagong', bn: 'চট্টগ্রাম', en: 'Chattogram', lat: 22.3569, lng: 91.7832 },
    { id: 'sylhet', bn: 'সিলেট', en: 'Sylhet', lat: 24.8949, lng: 91.8687 },
    { id: 'rajshahi', bn: 'রাজশাহী', en: 'Rajshahi', lat: 24.3745, lng: 88.6042 },
    { id: 'khulna', bn: 'খুলনা', en: 'Khulna', lat: 22.8456, lng: 89.5403 },
    { id: 'barishal', bn: 'বরিশাল', en: 'Barishal', lat: 22.701, lng: 90.3535 },
    { id: 'mymensingh', bn: 'ময়মনসিংহ', en: 'Mymensingh', lat: 24.7471, lng: 90.4203 },
    { id: 'rangpur', bn: 'রংপুর', en: 'Rangpur', lat: 25.7439, lng: 89.2752 }
  ];

  const DEFAULTS = {
    mosqueName: '',
    cityId: 'savar',
    customLoc: null,
    madhab: 'Hanafi',
    hour12: true,
    bengaliDigits: false,
    hijriAdj: 0,
    sound: false,
    jamaat: {
      fajr: '05:10',
      dhuhr: '13:16',
      asr: '16:45',
      isha: '20:15',
      jumuah: '13:30'
    },
    maghribMode: 'offset',
    maghribOffset: 7,
    maghribFixed: '18:12'
  };

  const KAABA = { lat: 21.422487, lng: 39.826206 };

  function pad(n) {
    n = Math.floor(Math.abs(n));
    return (n < 10 ? '0' : '') + n;
  }

  function digits(str, bengali) {
    const s = String(str);
    if (!bengali) return s;
    return s.replace(/\d/g, (d) => BN[d]);
  }

  function parseHHMM(str) {
    if (typeof str !== 'string') return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(str.trim());
    if (!m) return null;
    const h = +m[1];
    const min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  function formatHM(mins, opts) {
    opts = opts || {};
    let m = ((mins % 1440) + 1440) % 1440;
    let h = Math.floor(m / 60);
    const min = m % 60;
    if (opts.hour12) {
      h = h % 12;
      if (h === 0) h = 12;
      return digits(h + ':' + pad(min), opts.bengaliDigits);
    }
    return digits(pad(h) + ':' + pad(min), opts.bengaliDigits);
  }

  function formatHMS(totalSeconds, opts) {
    opts = opts || {};
    let s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const m = Math.floor(s / 60);
    s -= m * 60;
    return digits(pad(h) + ':' + pad(m) + ':' + pad(s), opts.bengaliDigits);
  }

  function formatClock(hour, minute, second, opts) {
    opts = opts || {};
    let h = hour;
    let ap = hour >= 12 ? 'PM' : 'AM';
    if (opts.hour12 !== false) {
      h = hour % 12;
      if (h === 0) h = 12;
    }
    const hh = opts.hour12 === false ? pad(hour) : String(h);
    return {
      hh: digits(hh, opts.bengaliDigits),
      mm: digits(pad(minute), opts.bengaliDigits),
      ss: digits(pad(second), opts.bengaliDigits),
      ap: opts.hour12 === false ? '' : ap
    };
  }

  function formatBoardDate(year, month, day, opts) {
    opts = opts || {};
    const yy = String(year).slice(-2);
    return digits(pad(day) + ':' + pad(month) + ':' + yy, opts.bengaliDigits);
  }

  function bnDuration(seconds, opts) {
    opts = opts || {};
    seconds = Math.max(0, Math.floor(seconds));
    if (seconds < 1) return 'এখন';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (h) parts.push(digits(h, opts.bengaliDigits) + ' ঘণ্টা');
    if (m) parts.push(digits(m, opts.bengaliDigits) + ' মিনিট');
    if (!h && (s || !parts.length)) parts.push(digits(s, opts.bengaliDigits) + ' সেকেন্ড');
    return parts.join(' ');
  }

  function prayerById(id) {
    for (let i = 0; i < PRAYERS.length; i++) if (PRAYERS[i].id === id) return PRAYERS[i];
    return null;
  }

  function cityById(id) {
    for (let i = 0; i < CITIES.length; i++) if (CITIES[i].id === id) return CITIES[i];
    return CITIES[0];
  }

  function locationOf(settings) {
    if (settings.customLoc && isFinite(settings.customLoc.lat) && isFinite(settings.customLoc.lng)) {
      return {
        bn: settings.customLoc.bn || 'বর্তমান অবস্থান',
        en: settings.customLoc.en || 'Current location',
        lat: +settings.customLoc.lat,
        lng: +settings.customLoc.lng,
        custom: true
      };
    }
    return cityById(settings.cityId || 'savar');
  }

  function resolveJamaat(azanMins, rawMins, allowNextDay) {
    if (rawMins == null || azanMins == null) return { mins: null, valid: false, reason: 'missing' };
    if (rawMins >= azanMins) return { mins: rawMins, valid: true };
    if (allowNextDay && rawMins < 8 * 60 && azanMins > 12 * 60) {
      return { mins: rawMins + 1440, valid: true, nextDay: true };
    }
    return { mins: rawMins, valid: false, reason: 'before-azan' };
  }

  function listedNow(nowMins, azan) {
    if (nowMins >= azan.isha) return 'isha';
    if (nowMins >= azan.maghrib) return 'maghrib';
    if (nowMins >= azan.asr) return 'asr';
    if (nowMins >= azan.dhuhr) return 'dhuhr';
    if (nowMins >= azan.fajr && nowMins < azan.sunrise) return 'fajr';
    return null;
  }

  function currentWaqt(nowMins, azan) {
    if (nowMins < azan.fajr || nowMins >= azan.isha) return 'isha';
    return listedNow(nowMins, azan);
  }

  function prohibitedNote(nowMins, azan) {
    if (nowMins >= azan.sunrise && nowMins < azan.sunrise + 15) {
      return 'সূর্যোদয়ের সময় — নামাজ থেকে বিরত থাকুন';
    }
    if (nowMins >= azan.dhuhr - 8 && nowMins < azan.dhuhr) {
      return 'জাওয়াল — সূর্য মাথার উপর, যোহরের আগে বিরতি';
    }
    if (nowMins >= azan.maghrib - 12 && nowMins < azan.maghrib) {
      return 'সূর্যাস্ত নিকট — আসর শেষ করে নিন';
    }
    return '';
  }

  function waqtEnd(id, azan, tomorrowFajr) {
    if (id === 'fajr') return azan.sunrise;
    if (id === 'dhuhr') return azan.asr;
    if (id === 'asr') return azan.maghrib;
    if (id === 'maghrib') return azan.isha;
    if (id === 'isha') return tomorrowFajr;
    if (id === 'jumuah') return azan.asr;
    return null;
  }

  /**
   * azan / tomorrowFajr are minutes from today's local midnight.
   * tomorrowFajr is typically 1440 + fajrMinutes.
   * now is {hour, minute, second}.
   * isFriday boolean.
   * isRamadan boolean.
   */
  function buildSchedule(input) {
    const azan = input.azan;
    const settings = input.settings;
    const now = input.now;
    const isFriday = !!input.isFriday;
    const nowMins = now.hour * 60 + now.minute;
    const nowSeconds = now.hour * 3600 + now.minute * 60 + now.second;

    const jRaw = {
      fajr: parseHHMM(settings.jamaat.fajr),
      dhuhr: parseHHMM(settings.jamaat.dhuhr),
      asr: parseHHMM(settings.jamaat.asr),
      isha: parseHHMM(settings.jamaat.isha),
      jumuah: parseHHMM(settings.jamaat.jumuah)
    };

    let maghribJ;
    if (settings.maghribMode === 'fixed') {
      maghribJ = resolveJamaat(azan.maghrib, parseHHMM(settings.maghribFixed), false);
    } else {
      const off = Math.max(0, Math.min(40, settings.maghribOffset | 0));
      maghribJ = { mins: azan.maghrib + off, valid: true, offset: off };
    }

    const jamaat = {
      fajr: resolveJamaat(azan.fajr, jRaw.fajr, false),
      dhuhr: resolveJamaat(azan.dhuhr, jRaw.dhuhr, false),
      asr: resolveJamaat(azan.asr, jRaw.asr, false),
      maghrib: maghribJ,
      isha: resolveJamaat(azan.isha, jRaw.isha, true),
      jumuah: resolveJamaat(azan.dhuhr, jRaw.jumuah, false)
    };

    const events = [];
    function add(ev) { events.push(ev); }

    add({ id: 'fajr-azan', prayer: 'fajr', kind: 'azan', mins: azan.fajr, alert: true, label: 'ফজরের আযান' });
    if (jamaat.fajr.valid && jamaat.fajr.mins !== azan.fajr) {
      add({ id: 'fajr-jamaat', prayer: 'fajr', kind: 'jamaat', mins: jamaat.fajr.mins, alert: true, label: 'ফজরের জামাত' });
    } else if (jamaat.fajr.valid && jamaat.fajr.mins === azan.fajr) {
      events[events.length - 1].label = 'ফজরের আযান ও জামাত';
      events[events.length - 1].kind = 'both';
    }
    add({ id: 'sunrise', prayer: 'fajr', kind: 'sunrise', mins: azan.sunrise, alert: false, label: 'সূর্যোদয়' });
    add({ id: 'dhuhr-azan', prayer: 'dhuhr', kind: 'azan', mins: azan.dhuhr, alert: true, label: 'যোহরের আযান' });

    if (isFriday) {
      if (jamaat.jumuah.valid) {
        const same = jamaat.jumuah.mins === azan.dhuhr;
        if (same) {
          const az = events[events.length - 1];
          az.label = 'জুমার জামাত';
          az.kind = 'jamaat';
          az.prayer = 'jumuah';
          az.id = 'jumuah-jamaat';
        } else {
          add({ id: 'jumuah-jamaat', prayer: 'jumuah', kind: 'jamaat', mins: jamaat.jumuah.mins, alert: true, label: 'জুমার জামাত' });
        }
      }
    } else if (jamaat.dhuhr.valid) {
      if (jamaat.dhuhr.mins === azan.dhuhr) {
        events[events.length - 1].label = 'যোহরের আযান ও জামাত';
        events[events.length - 1].kind = 'both';
      } else {
        add({ id: 'dhuhr-jamaat', prayer: 'dhuhr', kind: 'jamaat', mins: jamaat.dhuhr.mins, alert: true, label: 'যোহরের জামাত' });
      }
    }

    add({ id: 'asr-azan', prayer: 'asr', kind: 'azan', mins: azan.asr, alert: true, label: 'আসরের আযান' });
    if (jamaat.asr.valid && jamaat.asr.mins !== azan.asr) {
      add({ id: 'asr-jamaat', prayer: 'asr', kind: 'jamaat', mins: jamaat.asr.mins, alert: true, label: 'আসরের জামাত' });
    } else if (jamaat.asr.valid && jamaat.asr.mins === azan.asr) {
      events[events.length - 1].label = 'আসরের আযান ও জামাত';
      events[events.length - 1].kind = 'both';
    }

    add({ id: 'maghrib-azan', prayer: 'maghrib', kind: 'azan', mins: azan.maghrib, alert: true, label: input.isRamadan ? 'ইফতার · মাগরিবের আযান' : 'মাগরিবের আযান' });
    if (jamaat.maghrib.valid && jamaat.maghrib.mins !== azan.maghrib) {
      add({ id: 'maghrib-jamaat', prayer: 'maghrib', kind: 'jamaat', mins: jamaat.maghrib.mins, alert: true, label: 'মাগরিবের জামাত' });
    } else if (jamaat.maghrib.valid && jamaat.maghrib.mins === azan.maghrib) {
      events[events.length - 1].label = input.isRamadan ? 'ইফতার · আযান ও জামাত' : 'মাগরিবের আযান ও জামাত';
      events[events.length - 1].kind = 'both';
    }

    add({ id: 'isha-azan', prayer: 'isha', kind: 'azan', mins: azan.isha, alert: true, label: 'এশার আযান' });
    if (jamaat.isha.valid && jamaat.isha.mins !== azan.isha) {
      add({ id: 'isha-jamaat', prayer: 'isha', kind: 'jamaat', mins: jamaat.isha.mins, alert: true, label: 'এশার জামাত' });
    } else if (jamaat.isha.valid && jamaat.isha.mins === azan.isha) {
      events[events.length - 1].label = 'এশার আযান ও জামাত';
      events[events.length - 1].kind = 'both';
    }

    const tomorrowFajr = input.tomorrowFajr;
    add({ id: 'tomorrow-fajr', prayer: 'fajr', kind: 'azan', mins: tomorrowFajr, alert: false, label: 'ফজরের আযান' });

    events.sort((a, b) => a.mins - b.mins || a.id.localeCompare(b.id));

    const waqt = currentWaqt(nowMins, azan);
    const rowNow = listedNow(nowMins, azan);
    const next = events.find((e) => e.mins * 60 > nowSeconds) || events[events.length - 1];
    const prev = [...events].reverse().find((e) => e.mins * 60 <= nowSeconds) || null;

    const rows = PRAYERS.map((p) => {
      let azanMins = null;
      let jam = null;
      let end = null;
      if (p.id === 'jumuah') {
        azanMins = azan.dhuhr;
        jam = jamaat.jumuah;
        end = azan.asr;
      } else {
        azanMins = azan[p.id];
        jam = jamaat[p.id];
        end = waqtEnd(p.id, azan, tomorrowFajr);
      }
      const passedAzan = azanMins != null && nowSeconds >= azanMins * 60 && !(p.id === 'isha' && nowMins < azan.fajr);
      const passedJam = jam && jam.valid && nowSeconds >= jam.mins * 60 && jam.mins < 1440;
      return {
        id: p.id,
        bn: p.bn,
        en: p.en,
        poss: p.poss,
        fard: p.fard,
        extra: p.extra,
        azanMins,
        jamaatMins: jam && jam.valid ? jam.mins : null,
        jamaatValid: !!(jam && jam.valid),
        jamaatWarning: jam && !jam.valid,
        endMins: end,
        isNow: rowNow === p.id,
        isFridayOnly: p.id === 'jumuah',
        quiet: p.id === 'jumuah' && !isFriday,
        today: p.id === 'jumuah' && isFriday,
        passedAzan,
        passedJam,
        ramadanTag: input.isRamadan && p.id === 'fajr' ? 'সেহরি' : input.isRamadan && p.id === 'maghrib' ? 'ইফতার' : ''
      };
    });

    if (isFriday && waqt === 'dhuhr') {
      const j = rows.find((r) => r.id === 'jumuah');
      if (j && j.jamaatValid && nowSeconds < j.jamaatMins * 60) j.soon = true;
    }

    return {
      rows,
      events,
      jamaat,
      waqt,
      next,
      prev,
      nowMins,
      nowSeconds,
      note: prohibitedNote(nowMins, azan),
      isFriday,
      isRamadan: !!input.isRamadan
    };
  }

  function viewSignature(schedule) {
    if (!schedule) return '';
    const n = schedule.next ? schedule.next.id : '';
    return schedule.waqt + '|' + n + '|' + (schedule.isFriday ? 'F' : '') + '|' + (schedule.note || '');
  }

  function countdown(schedule, nowSeconds) {
    if (!schedule || !schedule.next) return { seconds: 0, label: '', progress: 0 };
    const target = schedule.next.mins * 60;
    const seconds = Math.max(0, target - nowSeconds);
    let progress = 0;
    if (schedule.prev) {
      const start = schedule.prev.mins * 60;
      const span = Math.max(1, target - start);
      progress = Math.min(1, Math.max(0, (nowSeconds - start) / span));
    }
    return { seconds, label: schedule.next.label, id: schedule.next.id, prayer: schedule.next.prayer, kind: schedule.next.kind, progress };
  }

  function qiblaBearing(lat, lng) {
    const toR = Math.PI / 180;
    const phi1 = lat * toR;
    const phi2 = KAABA.lat * toR;
    const dLng = (KAABA.lng - lng) * toR;
    const y = Math.sin(dLng);
    const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLng);
    let deg = Math.atan2(y, x) / toR;
    deg = (deg + 360) % 360;
    return deg;
  }

  function qiblaDistanceKm(lat, lng) {
    const toR = Math.PI / 180;
    const R = 6371;
    const dPhi = (KAABA.lat - lat) * toR;
    const dLng = (KAABA.lng - lng) * toR;
    const a = Math.sin(dPhi / 2) ** 2 + Math.cos(lat * toR) * Math.cos(KAABA.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function bearingName(deg) {
    const dirs = ['উত্তর', 'উত্তর-পূর্ব', 'পূর্ব', 'দক্ষিণ-পূর্ব', 'দক্ষিণ', 'দক্ষিণ-পশ্চিম', 'পশ্চিম', 'উত্তর-পশ্চিম'];
    return dirs[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  }

  function mergeSettings(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    const j = Object.assign({}, DEFAULTS.jamaat, s.jamaat || {});
    return {
      mosqueName: typeof s.mosqueName === 'string' ? s.mosqueName.slice(0, 42) : '',
      cityId: cityById(s.cityId).id,
      customLoc: s.customLoc && isFinite(+s.customLoc.lat) ? {
        lat: +s.customLoc.lat,
        lng: +s.customLoc.lng,
        bn: s.customLoc.bn || 'বর্তমান অবস্থান',
        en: 'Current location'
      } : null,
      madhab: s.madhab === 'Standard' ? 'Standard' : 'Hanafi',
      hour12: s.hour12 !== false,
      bengaliDigits: !!s.bengaliDigits,
      hijriAdj: Math.max(-2, Math.min(2, s.hijriAdj | 0)),
      sound: !!s.sound,
      jamaat: {
        fajr: parseHHMM(j.fajr) != null ? j.fajr : DEFAULTS.jamaat.fajr,
        dhuhr: parseHHMM(j.dhuhr) != null ? j.dhuhr : DEFAULTS.jamaat.dhuhr,
        asr: parseHHMM(j.asr) != null ? j.asr : DEFAULTS.jamaat.asr,
        isha: parseHHMM(j.isha) != null ? j.isha : DEFAULTS.jamaat.isha,
        jumuah: parseHHMM(j.jumuah) != null ? j.jumuah : DEFAULTS.jamaat.jumuah
      },
      maghribMode: s.maghribMode === 'fixed' ? 'fixed' : 'offset',
      maghribOffset: Math.max(0, Math.min(40, s.maghribOffset == null ? 7 : s.maghribOffset | 0)),
      maghribFixed: parseHHMM(s.maghribFixed) != null ? s.maghribFixed : DEFAULTS.maghribFixed
    };
  }

  function cloneDefaults() {
    return mergeSettings(JSON.parse(JSON.stringify(DEFAULTS)));
  }

  return {
    BN, PRAYERS, HIJRI_MONTHS, WEEKDAYS, CITIES, DEFAULTS, KAABA,
    pad, digits, parseHHMM, formatHM, formatHMS, formatClock, formatBoardDate, bnDuration,
    prayerById, cityById, locationOf, resolveJamaat, currentWaqt, listedNow, prohibitedNote,
    buildSchedule, viewSignature, countdown, qiblaBearing, qiblaDistanceKm, bearingName,
    mergeSettings, cloneDefaults
  };
});
