import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { CONTENT_MAX_WIDTH, fonts, motion, useTheme } from '../theme';

export default function SignInScreen() {
  const theme = useTheme();
  const { email: sessionEmail, devMode, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: motion.duration.slow, easing: motion.easing });
    translateY.value = withTiming(0, { duration: motion.duration.slow, easing: motion.easing });
  }, [opacity, translateY]);
  const heroStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (sessionEmail) return <Redirect href="/" />;

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (err) {
      setError((err as Error).message.replace('Firebase: ', ''));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = (focused: boolean) => [
    styles.input,
    theme.text.body,
    {
      backgroundColor: theme.colors.surfaceSunken,
      borderColor: focused ? theme.colors.accent : theme.colors.border,
      borderWidth: focused ? 1.5 : 1,
      color: theme.colors.text,
      borderRadius: theme.radius.md,
    },
    focused && theme.shadow('sm'),
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <Animated.View style={[styles.card, { maxWidth: CONTENT_MAX_WIDTH }, heroStyle]}>
        <View style={[styles.mark, { backgroundColor: theme.colors.accentMuted }]}>
          <Icon name="sparkles" size={theme.iconSize.xl} color={theme.colors.accent} />
        </View>
        <Text
          style={[
            styles.wordmark,
            { color: theme.colors.text, fontFamily: fonts.extrabold, textAlign: 'center' },
          ]}
        >
          LAM
        </Text>
        <Text
          style={[theme.text.body, { color: theme.colors.textMuted, textAlign: 'center' }]}
        >
          Your AI stylist and digital wardrobe
        </Text>

        <View style={{ height: 8 }} />

        <TextInput
          style={inputStyle(emailFocused)}
          placeholder="Email"
          placeholderTextColor={theme.colors.textFaint}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
        />
        {!devMode && (
          <TextInput
            style={inputStyle(passwordFocused)}
            placeholder="Password"
            placeholderTextColor={theme.colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
        )}

        {devMode && (
          <View style={[styles.badge, { backgroundColor: theme.colors.accentMuted, alignSelf: 'center' }]}>
            <Text style={[theme.text.caption, { color: theme.colors.text }]}>
              Dev mode — any email signs you in locally
            </Text>
          </View>
        )}
        {error && (
          <Text style={[theme.text.caption, { color: theme.colors.danger, textAlign: 'center' }]}>
            {error}
          </Text>
        )}

        <View style={{ height: 4 }} />
        <Button
          title={mode === 'in' ? 'Sign in' : 'Create account'}
          onPress={submit}
          loading={busy}
        />
        {!devMode && (
          <Button
            title={mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
            variant="ghost"
            onPress={() => setMode(mode === 'in' ? 'up' : 'in')}
          />
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', gap: 14, alignItems: 'stretch' },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 4,
  },
  wordmark: { fontSize: 34, letterSpacing: -1 },
  input: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  badge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
