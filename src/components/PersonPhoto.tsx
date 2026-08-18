import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { isSafePersonPhotoUrl } from '../services/personPhoto';
import { colors, scene } from '../theme';

type PersonPhotoSize = 'sm' | 'md' | 'lg';

type PersonPhotoProps = {
  uri?: string | null;
  name?: string | null;
  size?: PersonPhotoSize;
  /** When false, render nothing unless a photo exists (tree list). */
  showFallback?: boolean;
  /** Gold ring with a small gap — for identity hero. */
  framed?: boolean;
};

const SIZE = {
  sm: { wrap: 36, letter: 15, border: 1, pad: 0 },
  md: { wrap: 52, letter: 20, border: 1, pad: 0 },
  lg: { wrap: 108, letter: 38, border: 2, pad: 4 },
} as const;

export function PersonPhoto({
  uri,
  name,
  size = 'md',
  showFallback = false,
  framed = false,
}: PersonPhotoProps) {
  const [failed, setFailed] = useState(false);
  const safe = isSafePersonPhotoUrl(uri) && !failed;
  const dim = SIZE[size];
  const framedLook = framed || size === 'lg';
  const pad = framedLook ? dim.pad : 0;
  const border = framedLook ? dim.border : 1;
  const inner = Math.max(24, dim.wrap - border * 2 - pad * 2);
  const imgSize = framedLook && safe ? Math.round(inner * 1.14) : inner;
  const letter = String(name || 'ز').trim().slice(0, 1) || 'ز';

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!safe && !showFallback) return null;

  return (
    <View
      style={[
        styles.wrap,
        {
          borderRadius: dim.wrap / 2,
          borderWidth: border,
          height: dim.wrap,
          padding: pad,
          width: dim.wrap,
        },
        (framedLook) && styles.framed,
      ]}
    >
      <View style={[styles.inner, { borderRadius: inner / 2, height: inner, width: inner }]}>
        {safe ? (
          <Image
            onError={() => setFailed(true)}
            resizeMode="cover"
            source={{ uri: String(uri).trim() }}
            style={{
              height: imgSize,
              marginTop: framedLook && safe ? -Math.round(inner * 0.08) : 0,
              width: imgSize,
            }}
          />
        ) : (
          <Text style={[styles.letter, { fontSize: dim.letter }]}>{letter}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(196,163,90,0.14)',
    borderColor: scene.gold,
    flexShrink: 0,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  framed: {
    backgroundColor: 'rgba(196,163,90,0.18)',
  },
  inner: {
    alignItems: 'center',
    backgroundColor: scene.greenDeep,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: {
    color: colors.accentSoft,
    fontWeight: '800',
  },
});
