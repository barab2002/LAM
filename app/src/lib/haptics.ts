import { Platform } from 'react-native';

/**
 * Tactile feedback for primary interactions. expo-haptics is native-only;
 * guarded so web (and any device without a haptics engine) is a silent no-op.
 */
export async function tapHaptic(style: 'light' | 'medium' = 'light'): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Haptics = await import('expo-haptics');
    await Haptics.impactAsync(
      style === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
  } catch {
    // Haptics engine unavailable — never block the interaction on this
  }
}
