export type WeatherSkyKind = 'clear' | 'cloudy' | 'rain';

export type WeatherSky = {
  kind: WeatherSkyKind;
  isNight: boolean;
  from: string;
  to: string;
  text: string;
  muted: string;
};

export function weatherSkyKind(code: number | null): WeatherSkyKind {
  if (code == null) return 'clear';
  if ((code >= 51 && code <= 67) || (code >= 71 && code <= 82) || code >= 95) return 'rain';
  if (code >= 1) return 'cloudy';
  return 'clear';
}

export function weatherSkyMark(kind: WeatherSkyKind, isNight: boolean) {
  if (kind === 'rain') return '🌧️';
  if (kind === 'cloudy') return isNight ? '☁️' : '⛅';
  return isNight ? '🌙' : '☀️';
}

export function weatherSkyAssetKey(kind: WeatherSkyKind, isNight: boolean) {
  if (kind === 'rain') return isNight ? 'nightRain' : 'dayRain';
  if (kind === 'cloudy') return isNight ? 'nightCloudy' : 'dayCloudy';
  return isNight ? 'nightClear' : 'dayClear';
}

export function resolveWeatherSky(code: number | null, isDay: boolean | null): WeatherSky {
  const kind = weatherSkyKind(code);
  const night = isDay === false;
  if (night) {
    if (kind === 'rain') {
      return { kind, isNight: true, from: '#121820', to: '#2C3A4A', text: '#F3EBD9', muted: 'rgba(232,213,168,0.78)' };
    }
    if (kind === 'cloudy') {
      return { kind, isNight: true, from: '#1A2230', to: '#3A4558', text: '#F3EBD9', muted: 'rgba(232,213,168,0.78)' };
    }
    return { kind, isNight: true, from: '#0B1D3A', to: '#1E4A86', text: '#F3EBD9', muted: 'rgba(232,213,168,0.82)' };
  }
  if (kind === 'rain') {
    return { kind, isNight: false, from: '#4A5D73', to: '#8FA3B8', text: '#FFF8EC', muted: 'rgba(255,248,236,0.82)' };
  }
  if (kind === 'cloudy') {
    return { kind, isNight: false, from: '#7B8FA1', to: '#C5D0D8', text: '#1E2925', muted: '#3E4A52' };
  }
  return { kind, isNight: false, from: '#4DA3E0', to: '#B9E4F7', text: '#0F2A24', muted: '#1F4F44' };
}
