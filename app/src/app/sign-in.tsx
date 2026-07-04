import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { CONTENT_MAX_WIDTH, useTheme } from '../theme';

export default function SignInScreen() {
  const theme = useTheme();
  const { email: sessionEmail, devMode, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const inputStyle = [
    styles.input,
    theme.text.body,
    {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.border,
      color: theme.colors.text,
      borderRadius: theme.radius.md,
    },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.card, { maxWidth: CONTENT_MAX_WIDTH }]}>
        <Text style={styles.logo}>✨</Text>
        <Text style={[theme.text.title, { color: theme.colors.text, textAlign: 'center' }]}>
          LAM
        </Text>
        <Text
          style={[theme.text.body, { color: theme.colors.textMuted, textAlign: 'center' }]}
        >
          Your AI stylist and digital wardrobe
        </Text>

        <TextInput
          style={inputStyle}
          placeholder="Email"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        {!devMode && (
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}

        {devMode && (
          <Text style={[theme.text.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>
            Dev mode — no Firebase configured, any email signs you in locally.
          </Text>
        )}
        {error && (
          <Text style={[theme.text.caption, { color: theme.colors.danger, textAlign: 'center' }]}>
            {error}
          </Text>
        )}

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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', gap: 14, alignItems: 'stretch' },
  logo: { fontSize: 48, textAlign: 'center' },
  input: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
});
