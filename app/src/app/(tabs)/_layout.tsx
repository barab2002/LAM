import { BlurView } from 'expo-blur';
import { Redirect, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuth } from '../../auth/AuthContext';
import { motion, useTheme } from '../../theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  const theme = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: motion.duration.base });
  }, [focused, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + progress.value * 0.55,
    transform: [{ scale: 0.92 + progress.value * 0.08 }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  return (
    <View style={styles.iconWrap}>
      <Animated.Text style={[styles.glyph, iconStyle]}>{glyph}</Animated.Text>
      <Animated.View
        style={[styles.dot, { backgroundColor: theme.colors.accent }, dotStyle]}
      />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { email } = useAuth();

  if (email === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }
  if (email === null) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11 },
        tabBarBackground: () => (
          <BlurView
            intensity={theme.dark ? 40 : 60}
            tint={theme.dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabIcon glyph="✨" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Closet',
          tabBarIcon: ({ focused }) => <TabIcon glyph="👗" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          tabBarIcon: ({ focused }) => <TabIcon glyph="📸" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ focused }) => <TabIcon glyph="🗓️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', gap: 3 },
  glyph: { fontSize: 21 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
