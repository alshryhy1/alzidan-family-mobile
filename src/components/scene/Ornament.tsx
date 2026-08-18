import { StyleSheet, Text, View } from 'react-native';

import { scene } from '../../theme';

export function GoldDivider() {
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
  const color = tone === 'cream' ? scene.green : scene.gold;
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

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'center',
    marginVertical: 8,
  },
  line: {
    backgroundColor: scene.gold,
    flex: 1,
    height: 1,
    maxWidth: 88,
    opacity: 0.55,
  },
  mark: {
    color: scene.gold,
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
});
