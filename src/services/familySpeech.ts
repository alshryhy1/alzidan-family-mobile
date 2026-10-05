import * as FileSystem from 'expo-file-system/legacy';

/** صوت حايلي من السيرفر. إذا تعذر، يرجع صوت الآيفون العربي. */

type SpeechModule = typeof import('expo-speech');

type AudioPlayer = {
  play: () => void;
  pause: () => void;
  release: () => void;
};

type AudioModule = {
  setAudioModeAsync: (mode: { playsInSilentMode: boolean }) => Promise<void>;
  createAudioPlayer: (source: string) => AudioPlayer;
};

let player: AudioPlayer | null = null;
let speakTicket = 0;

/** نطق الأسماء. الشاشة تبقى بالرسم المحفوظ. */
function speechLine(text: string) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/مزيد/g, 'م\u064eز\u0652ي\u0650د')
    .replace(/مسلم(?!ين|ون|ات)/g, 'م\u0650س\u0652ل\u0650م')
    .replace(/حطيان/g, 'ح\u064eط\u0651يان')
    .replace(/ملفي/g, 'م\u0650ل\u0652في')
    .replace(/ملهم/g, 'م\u0650ل\u0652ه\u0650م')
    .replace(/(^|\s)صلال(?=\s|$|[،.])/g, '$1صللال')
    .replace(/(?<!ال)خميس/g, 'خ\u064fم\u064eي\u0651س')
    .replace(/دليميك/g, 'دولايمك')
    .replace(/(^|\s)غريب(?=\s|$|[،.])/g, '$1غ\u064fر\u064eي\u0651ب')
    .replace(/(^|\s)خلف(?=\s|$|[،.])/g, '$1خلاف');
}

function loadSpeech(): SpeechModule | null {
  try {
    return require('expo-speech') as SpeechModule;
  } catch {
    return null;
  }
}

function loadAudio(): AudioModule | null {
  try {
    const { requireOptionalNativeModule } = require('expo-modules-core') as {
      requireOptionalNativeModule: (name: string) => unknown;
    };
    if (!requireOptionalNativeModule('ExpoAudio')) return null;
    return require('expo-audio') as AudioModule;
  } catch {
    return null;
  }
}

function stopPhoneSpeech() {
  const speech = loadSpeech();
  if (!speech) return;
  void speech.stop();
}

function stopHailiPlayer() {
  if (!player) return;
  player.pause();
  player.release();
  player = null;
}

function speakWithPhone(line: string) {
  const speech = loadSpeech();
  if (!speech) return;
  stopPhoneSpeech();
  speech.speak(line, {
    language: 'ar-SA',
    pitch: 1,
    rate: 0.9,
  });
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return globalThis.btoa(binary);
}

async function playHaili(line: string, ticket: number) {
  const audio = loadAudio();
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!audio || !supabaseUrl || !supabaseAnonKey) return false;

  const response = await fetch(`${supabaseUrl}/functions/v1/alzidan-haili-speak`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: line }),
  });
  if (!response.ok || ticket !== speakTicket) return false;

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || ticket !== speakTicket) return false;

  const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!directory) return false;
  const path = `${directory}haili-speak.mp3`;
  await FileSystem.writeAsStringAsync(path, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (ticket !== speakTicket) return false;

  await audio.setAudioModeAsync({ playsInSilentMode: true });
  stopHailiPlayer();
  player = audio.createAudioPlayer(path);
  player.play();
  return true;
}

export function speakArabic(text: string) {
  const line = speechLine(text);
  if (!line) return;
  const ticket = ++speakTicket;
  stopPhoneSpeech();
  stopHailiPlayer();
  void playHaili(line, ticket).then((ok) => {
    if (ticket !== speakTicket || ok) return;
    speakWithPhone(line);
  }).catch(() => {
    if (ticket !== speakTicket) return;
    speakWithPhone(line);
  });
}

export function stopArabicSpeech() {
  speakTicket += 1;
  stopPhoneSpeech();
  stopHailiPlayer();
}
