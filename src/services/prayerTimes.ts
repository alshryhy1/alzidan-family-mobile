/** Same Umm al-Qura clock as the widget, so the alert and the widget agree. */

export type PrayerSlot = {
  key: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
  name: string;
  time: Date;
};

const FALLBACK_LATITUDE = 27.5114;
const FALLBACK_LONGITUDE = 41.7208;

function deg2rad(d: number) {
  return (d * Math.PI) / 180;
}

function rad2deg(r: number) {
  return (r * 180) / Math.PI;
}

function julianDate(year: number, month: number, day: number) {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

function sunDeclination(jd: number) {
  const n = jd - 2451545.0;
  const g = deg2rad(357.529 + 0.98560028 * n);
  const q = 280.459 + 0.98564736 * n;
  const l = deg2rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const e = deg2rad(23.439 - 0.00000036 * n);
  return Math.asin(Math.sin(e) * Math.sin(l));
}

function equationOfTime(jd: number) {
  const n = jd - 2451545.0;
  const g = deg2rad(357.529 + 0.98560028 * n);
  const q = 280.459 + 0.98564736 * n;
  const l = deg2rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const e = deg2rad(23.439 - 0.00000036 * n);
  const ra = (Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / Math.PI) * 12;
  const qHours = q / 15;
  let eqt = qHours - ra;
  while (eqt > 12) eqt -= 24;
  while (eqt < -12) eqt += 24;
  return eqt * 60;
}

function hourAngle(angle: number, declination: number, latitude: number) {
  const lat = deg2rad(latitude);
  const zenith = deg2rad(angle);
  const cosH = (Math.cos(zenith) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  return rad2deg(Math.acos(Math.max(-1, Math.min(1, cosH))));
}

function asrHourAngle(declination: number, latitude: number) {
  const lat = deg2rad(latitude);
  const angle = Math.atan(1 / (1 + Math.tan(Math.abs(lat - declination))));
  const cosH = (Math.sin(angle) - Math.sin(lat) * Math.sin(declination)) / (Math.cos(lat) * Math.cos(declination));
  return rad2deg(Math.acos(Math.max(-1, Math.min(1, cosH))));
}

function dateFromHour(hour: number, year: number, month: number, day: number) {
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const totalSeconds = hour * 3600;
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - wholeMinutes * 60;
  const minutes = hour < 11 && seconds >= 30 ? wholeMinutes + 1 : wholeMinutes;
  return new Date(start.getTime() + minutes * 60 * 1000);
}

export function prayerSlotsForDay(
  year: number,
  month: number,
  day: number,
  coordinate?: { latitude: number; longitude: number } | null,
): PrayerSlot[] {
  const latitude = coordinate?.latitude ?? FALLBACK_LATITUDE;
  const longitude = coordinate?.longitude ?? FALLBACK_LONGITUDE;
  const noon = new Date(year, month - 1, day, 12, 0, 0, 0);
  const zone = -noon.getTimezoneOffset() / 60;
  const jd = julianDate(year, month, day);
  const decl = sunDeclination(jd);
  const eqt = equationOfTime(jd);
  const dhuhr = 12 + zone - longitude / 15 - eqt / 60;
  const fajr = dhuhr - hourAngle(108.5, decl, latitude) / 15;
  const asr = dhuhr + asrHourAngle(decl, latitude) / 15;
  const maghrib = dhuhr + hourAngle(90.833, decl, latitude) / 15;
  const isha = maghrib + 1.5;

  return [
    { key: 'fajr', name: 'الفجر', time: dateFromHour(fajr, year, month, day) },
    { key: 'dhuhr', name: 'الظهر', time: dateFromHour(dhuhr, year, month, day) },
    { key: 'asr', name: 'العصر', time: dateFromHour(asr, year, month, day) },
    { key: 'maghrib', name: 'المغرب', time: dateFromHour(maghrib, year, month, day) },
    { key: 'isha', name: 'العشاء', time: dateFromHour(isha, year, month, day) },
  ];
}

/** Enough days to stay inside iOS's 64 pending-notification cap: 5 prayers × 2 alerts × 6 days. */
export function upcomingPrayerSlots(
  now = new Date(),
  days = 6,
  coordinate?: { latitude: number; longitude: number } | null,
) {
  const slots: PrayerSlot[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    slots.push(...prayerSlotsForDay(day.getFullYear(), day.getMonth() + 1, day.getDate(), coordinate));
  }
  return slots;
}
