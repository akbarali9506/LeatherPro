import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { AppProvider, useApp } from '../context/AppContext';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '../constants/theme';

function RootNavigator() {
  const { role, orgId, isLoading } = useApp();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inMain = segments[0] === '(main)';
    const inSetup = segments[0] === 'setup';
    const inLogin = segments[0] === 'login';

    if (!role) {
      // Not authenticated → login
      if (!inLogin) router.replace('/login');
    } else if (!orgId) {
      // Authenticated but no organization → setup
      if (!inSetup) router.replace('/setup');
    } else {
      // Authenticated + org → main app
      if (!inMain) router.replace('/(main)/dashboard');
    }
  }, [role, orgId, isLoading, segments]);

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
      <Stack.Screen name="setup" />
      <Stack.Screen name="(main)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <RootNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
