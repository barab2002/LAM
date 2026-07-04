import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../auth/AuthContext';
import { fonts, useTheme } from '../theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const ready = fontsLoaded || fontError;

  useEffect(() => {
    // Falls back to the system font instantly on error — never a blank screen
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style={theme.dark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.colors.background },
              headerTintColor: theme.colors.text,
              headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: theme.colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
            <Stack.Screen
              name="item/[id]"
              options={{ title: 'Item', presentation: 'modal' }}
            />
            <Stack.Screen
              name="rating/[id]"
              options={{ title: 'Style Jury', presentation: 'modal' }}
            />
            <Stack.Screen
              name="scan"
              options={{ title: 'Scan barcode', presentation: 'modal' }}
            />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
