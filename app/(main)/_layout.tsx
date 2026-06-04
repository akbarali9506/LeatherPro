import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors } from '../../constants/theme';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';

export default function MainLayout() {
  const { role, settings, isSaving } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarStyle: { backgroundColor: Colors.tabBar },
        headerStyle: { backgroundColor: Colors.header },
        headerTintColor: Colors.headerText,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <View style={styles.headerRight}>
            {isSaving && (
              <>
                <ActivityIndicator size="small" color={Colors.headerText} />
                <Text style={styles.savingText}>{t(lang, 'saving')}</Text>
              </>
            )}
            {isDirector && (
              <TouchableOpacity onPress={() => router.push('/(main)/settings')} style={styles.settingsBtn}>
                <Ionicons name="settings-outline" size={22} color={Colors.headerText} />
              </TouchableOpacity>
            )}
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t(lang, 'dashboard'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: t(lang, 'stock'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="batches"
        options={{
          title: t(lang, 'batches'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="albums-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sales"
        options={{
          title: t(lang, 'sales'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />

      {/* Hidden from tab bar — navigated to from within other screens */}
      <Tabs.Screen name="leather" options={{ href: null, title: t(lang, 'leather') }} />
      <Tabs.Screen name="buyers" options={{ href: null, title: t(lang, 'buyers') }} />
      <Tabs.Screen name="reports" options={{ href: null, title: t(lang, 'reports') }} />
      <Tabs.Screen name="settings" options={{ href: null, title: t(lang, 'settings') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 6 },
  savingText: { color: Colors.headerText, fontSize: 12 },
  settingsBtn: { marginLeft: 4 },
});
