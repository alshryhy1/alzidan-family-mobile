import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../theme';

type Props = {
  visible: boolean;
  uri: string;
  /** Optional a11y label only — never shown as overlay chrome. */
  caption?: string;
  onClose: () => void;
};

export function ImageViewerModal({ visible, uri, caption, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  if (!uri) return null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={[styles.backdrop, { paddingBottom: insets.bottom }]}>
        <Pressable
          accessibilityLabel="إغلاق عارض الصورة"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <Pressable
          accessibilityLabel="إغلاق"
          accessibilityRole="button"
          hitSlop={12}
          onPress={onClose}
          style={[styles.closeButton, { top: insets.top + spacing.sm }]}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <View pointerEvents="box-none" style={styles.content}>
          <ScrollView
            centerContent
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              accessibilityLabel={caption || 'بطاقة التهنئة'}
              resizeMode="contain"
              source={{ uri }}
              style={{ width: width - spacing.md * 2, height: height * 0.82 }}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(8, 12, 10, 0.94)',
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.md,
    width: 40,
    zIndex: 2,
  },
  closeText: {
    color: colors.white,
    fontSize: typography.title,
    fontWeight: '700',
    lineHeight: 22,
  },
});
