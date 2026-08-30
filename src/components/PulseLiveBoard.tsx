import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { spacing, type ThemePalette } from '../theme';
import { useThemePalette } from '../theme/ThemeContext';
import type { PulseBoardNotice } from '../utils/pulseNotices';
import {
  formatPulseNotice,
  pickPulseTickerItems,
  pulseHourSlot,
  pulseTickerKindLabel,
} from '../utils/pulseNotices';
import type { PulseLiveModel } from '../utils/pulseFocus';
import type { OccasionMotif } from '../utils/pulseOccasionTheme';
import { occasionMark, resolveOccasionTheme } from '../utils/pulseOccasionTheme';
import { daysWord } from '../utils/pulseSeason';
import {
  resolveWeatherSky,
  weatherSkyAssetKey,
} from '../utils/pulseSky';

const SKY = {
  nightClear: require('../../assets/pulse/pulse-sky-night-clear.jpg'),
  nightCloudy: require('../../assets/pulse/pulse-sky-night-cloudy.jpg'),
  nightRain: require('../../assets/pulse/pulse-sky-night-rain.jpg'),
  dayClear: require('../../assets/pulse/pulse-sky-day-clear.jpg'),
  dayCloudy: require('../../assets/pulse/pulse-sky-day-cloudy.jpg'),
  dayRain: require('../../assets/pulse/pulse-sky-rain.jpg'),
} as const;

const FLAG_SA = require('../../assets/pulse/pulse-flag-sa.png');

type PulseLiveBoardProps = {
  model: PulseLiveModel;
  notices?: PulseBoardNotice[];
  delegates?: PulseBoardNotice[];
  tone?: 'hero' | 'stage';
};

function presenceLabel(online: number | null) {
  if (online == null) return 'المتواجدون';
  if (online <= 0) return 'لا أحد الآن';
  if (online === 1) return 'متواجد الآن';
  if (online === 2) return 'متواجدان الآن';
  return 'متواجدون الآن';
}

function presenceValue(online: number | null) {
  if (online == null) return '—';
  if (online <= 0) return '٠';
  return String(online);
}

function useRotatingIndex(length: number, ms = 8000) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    if (length <= 1) return undefined;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % length);
    }, ms);
    return () => clearInterval(id);
  }, [length, ms]);
  return length ? index % length : 0;
}

function usePulseStyles() {
  const p = useThemePalette();
  return useMemo(() => pulseStyles(p), [p]);
}

function WeatherCard({ model }: { model: PulseLiveModel }) {
  const styles = usePulseStyles();
  const weather = model.weather;
  const sky = resolveWeatherSky(weather?.code ?? null, weather?.isDay ?? null);
  const source = SKY[weatherSkyAssetKey(sky.kind, sky.isNight)];
  const temp = weather?.tempC != null ? `${Math.round(weather.tempC)}°` : '—';
  const caption = [weather?.conditionLabel, weather?.placeLabel].filter(Boolean).join(' · ');
  return (
    <ImageBackground
      accessibilityLabel={`${temp} ${caption || 'الجو'}`}
      imageStyle={styles.cover}
      resizeMode="cover"
      source={source}
      style={styles.tile}
    >
      <View style={[styles.scrim, sky.isNight || sky.kind === 'rain' ? styles.scrimDark : styles.scrimLight]}>
        <Text numberOfLines={1} style={[styles.weatherTemp, { color: sky.text }]}>
          {temp}
        </Text>
        <Text numberOfLines={2} style={[styles.weatherCaption, { color: sky.muted }]}>
          {caption || 'الجو'}
        </Text>
      </View>
    </ImageBackground>
  );
}

function occasionSource(motif: OccasionMotif) {
  if (motif === 'national_flag') return FLAG_SA;
  if (motif === 'ramadan') return SKY.nightClear;
  return null;
}

function CountdownCard({ model }: { model: PulseLiveModel }) {
  const styles = usePulseStyles();
  const row = model.season.countdown;
  const theme = resolveOccasionTheme(row?.id);
  const photo = occasionSource(theme.motif);
  const mark = photo ? '' : occasionMark(theme.motif);
  const kicker = row ? (row.days <= 0 ? row.label : `متبقي على ${row.label}`) : '';
  const days = row ? (row.days <= 0 ? 'اليوم' : daysWord(row.days)) : '';
  const copy = (
    <>
      {mark ? <Text style={styles.mark}>{mark}</Text> : null}
      <Text numberOfLines={2} style={[styles.countdownKicker, { color: photo ? '#F3EBD9' : theme.muted }]}>
        {kicker || '—'}
      </Text>
      {days ? (
        <Text numberOfLines={1} style={[styles.countdownDays, { color: photo ? '#FFF8EC' : theme.text }]}>
          {days}
        </Text>
      ) : null}
    </>
  );
  if (photo) {
    return (
      <ImageBackground
        imageStyle={styles.cover}
        resizeMode="cover"
        source={photo}
        style={[styles.tile, styles.tileTop]}
      >
        <View style={[styles.scrim, styles.scrimDark]}>{copy}</View>
      </ImageBackground>
    );
  }
  return (
    <LinearGradient
      colors={[theme.from, theme.to]}
      end={{ x: 0.15, y: 1 }}
      start={{ x: 0.9, y: 0 }}
      style={[styles.tile, styles.tileCenter]}
    >
      <View style={styles.scrim}>{copy}</View>
    </LinearGradient>
  );
}

export function PulseLiveBoard({
  model,
  notices = [],
  delegates = [],
  tone = 'hero',
}: PulseLiveBoardProps) {
  const p = useThemePalette();
  const styles = usePulseStyles();
  const [hourSlot, setHourSlot] = useState(() => pulseHourSlot());
  useEffect(() => {
    const id = setInterval(() => {
      setHourSlot(pulseHourSlot());
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const ticker = useMemo(
    () => pickPulseTickerItems({ notices, delegates, now: Date.now() }),
    [notices, delegates, hourSlot],
  );
  const rotateMs = ticker.length === 1 && ticker[0]?.kind === 'dua' ? 60 * 60 * 1000 : 8000;
  const tickerIndex = useRotatingIndex(ticker.length, rotateMs);
  const current = ticker[tickerIndex];
  const tickerText = current ? formatPulseNotice(current) : '';
  const tickerKind = current && tickerText ? pulseTickerKindLabel(current.kind) : '';
  const online = model.online;

  const body = (
    <>
      <LinearGradient
        accessibilityLabel={`${presenceLabel(online)} ${presenceValue(online)}`}
        colors={[p.greenMid, p.greenDeep]}
        end={{ x: 0.2, y: 1 }}
        start={{ x: 0.8, y: 0 }}
        style={styles.presenceBand}
      >
        <Text style={styles.presenceCaption}>{presenceLabel(online)}</Text>
        <Text style={styles.presenceValue}>{presenceValue(online)}</Text>
      </LinearGradient>
      <View style={styles.tiles}>
        <WeatherCard model={model} />
        <CountdownCard model={model} />
      </View>
      {tickerText ? (
        <LinearGradient
          colors={[p.greenMid, p.greenDeep]}
          end={{ x: 0.15, y: 1 }}
          start={{ x: 0.85, y: 0 }}
          style={styles.notice}
        >
          <Text style={styles.noticeText}>{tickerText}</Text>
          {tickerKind ? <Text style={styles.noticeKind}>{tickerKind}</Text> : null}
        </LinearGradient>
      ) : null}
    </>
  );

  if (tone === 'stage') {
    return <View style={styles.stage}>{body}</View>;
  }

  return <View style={styles.wrap}>{body}</View>;
}

function pulseStyles(p: ThemePalette) {
  return StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  stage: {
    alignItems: 'center',
    flexGrow: 1,
    gap: spacing.md,
    justifyContent: 'flex-start',
    paddingVertical: spacing.sm,
  },
  notice: {
    alignSelf: 'stretch',
    borderColor: 'rgba(196,163,90,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeText: {
    color: p.creamLift,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  noticeKind: {
    color: p.goldSoft,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  tiles: {
    alignSelf: 'stretch',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  tile: {
    borderColor: 'rgba(196,163,90,0.35)',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 156,
    overflow: 'hidden',
  },
  tileTop: {
    justifyContent: 'flex-start',
  },
  tileCenter: {
    justifyContent: 'center',
  },
  cover: {
    borderRadius: 17,
  },
  scrim: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: 12,
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  scrimDark: {
    backgroundColor: 'rgba(8,16,14,0.38)',
  },
  scrimLight: {
    backgroundColor: 'rgba(255,248,236,0.22)',
  },
  mark: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  weatherTemp: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    textAlign: 'center',
  },
  weatherCaption: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  countdownKicker: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  countdownDays: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  presenceBand: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(196,163,90,0.72)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minHeight: 108,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  presenceValue: {
    color: p.goldSoft,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  presenceCaption: {
    color: p.cream,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  });
}
