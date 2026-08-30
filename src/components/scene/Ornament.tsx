import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { brandCircleSize, type ThemePalette } from '../../theme';
import { useThemePalette } from '../../theme/ThemeContext';

const MARK = brandCircleSize;

function ornamentStyles(p: ThemePalette) {
  return StyleSheet.create({
    row: {
      alignItems: 'center',
      flexDirection: 'row-reverse',
      gap: 10,
      justifyContent: 'center',
      marginVertical: 8,
    },
    line: {
      backgroundColor: p.gold,
      flex: 1,
      height: 1,
      maxWidth: 88,
      opacity: 0.55,
    },
    mark: {
      color: p.gold,
      fontSize: 13,
    },
    field: {
      bottom: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 26,
      justifyContent: 'space-around',
      left: 0,
      padding: 10,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    glyph: {
      fontSize: 20,
    },
    circle: {
      alignItems: 'center',
      backgroundColor: 'rgba(196,163,90,0.16)',
      borderColor: p.gold,
      borderRadius: MARK / 2,
      borderWidth: 1,
      height: MARK,
      justifyContent: 'center',
      overflow: 'hidden',
      width: MARK,
    },
    tree: {
      height: 30,
      width: 26,
    },
    blob: {
      backgroundColor: p.goldSoft,
      borderRadius: 9,
      height: 16,
      position: 'absolute',
      width: 16,
    },
    blobTop: {
      left: 5,
      top: 0,
    },
    blobLeft: {
      left: 0,
      top: 7,
    },
    blobRight: {
      right: 0,
      top: 7,
    },
    trunk: {
      alignSelf: 'center',
      backgroundColor: p.gold,
      borderRadius: 1.5,
      bottom: 0,
      height: 11,
      position: 'absolute',
      width: 3.5,
    },
  });
}

/** Gold family-tree mark — same circle as تبرع in the brand row. */
export function BrandMark() {
  const p = useThemePalette();
  const styles = useMemo(() => ornamentStyles(p), [p]);
  return (
    <View accessibilityLabel="شجرة العائلة" style={styles.circle}>
      <View style={styles.tree}>
        <View style={[styles.blob, styles.blobTop]} />
        <View style={[styles.blob, styles.blobLeft]} />
        <View style={[styles.blob, styles.blobRight]} />
        <View style={styles.trunk} />
      </View>
    </View>
  );
}

export function GoldDivider() {
  const p = useThemePalette();
  const styles = useMemo(() => ornamentStyles(p), [p]);
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.mark}>❖</Text>
      <View style={styles.line} />
    </View>
  );
}

export function OrnamentField({
  count = 14,
  tone = 'gold',
}: {
  count?: number;
  tone?: 'gold' | 'cream';
}) {
  const p = useThemePalette();
  const styles = useMemo(() => ornamentStyles(p), [p]);
  const color = tone === 'cream' ? p.green : p.gold;
  return (
    <View pointerEvents="none" style={styles.field}>
      {Array.from({ length: count }).map((_, index) => (
        <Text
          key={index}
          style={[
            styles.glyph,
            { color, opacity: tone === 'cream' ? 0.06 : 0.045 + (index % 3) * 0.012 },
          ]}
        >
          ❖
        </Text>
      ))}
    </View>
  );
}
