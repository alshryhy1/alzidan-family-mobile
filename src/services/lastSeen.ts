import AsyncStorage from '@react-native-async-storage/async-storage';

export type LastSeenSurface = 'home' | 'events' | 'profile';

export type LastSeenMap = Record<LastSeenSurface, number>;

const STORAGE_KEY = 'alzidan_last_seen_v1';

const EMPTY: LastSeenMap = {
  home: 0,
  events: 0,
  profile: 0,
};

function asMap(value: unknown): LastSeenMap {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    home: Number(row.home) || 0,
    events: Number(row.events) || 0,
    profile: Number(row.profile) || 0,
  };
}

export async function loadLastSeen(): Promise<LastSeenMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return asMap(JSON.parse(raw));
  } catch {
    return { ...EMPTY };
  }
}

export async function markSurfaceSeen(
  surface: LastSeenSurface,
  at: number = Date.now(),
): Promise<LastSeenMap> {
  const current = await loadLastSeen();
  const next = { ...current, [surface]: at };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* keep in-memory next anyway */
  }
  return next;
}
