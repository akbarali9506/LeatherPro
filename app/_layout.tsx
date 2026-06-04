import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProvider, useApp } from '../context/AppContext';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/theme';

function RootNavigator() {
  const { role, isLoading } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inMain = segments[0] === '(main)';
    if (!role && inMain) {
      router.replace('/login');
    } else if (role && !inMain) {
      router.replace('/(main)/dashboard');
    }
  }, [role, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(main)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <RootNavigator />
    </AppProvider>
  );
}
