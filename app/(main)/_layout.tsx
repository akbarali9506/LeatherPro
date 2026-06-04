import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors } from '../../constants/theme';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export default function MainLayout() {
  const { role, settings, isSaving } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tabBarActive,
        tabBarInactiveTintColor: Colors.tabBarInactive,
        tabBarStyle: { backgroundColor: Colors.tabBar },
        headerStyle: { backgroundColor: Colors.header },
        headerTintColor: Colors.headerText,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () =>
          isSaving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={Colors.headerText} />
              <Text style={styles.savingText}>{t(lang, 'saving')}</Text>
            </View>
          ) : null,
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
        name="leather"
        options={{
          title: t(lang, 'leather'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="layers-outline" size={size} color={color} />
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
      <Tabs.Screen
        name="buyers"
        options={{
          title: t(lang, 'buyers'),
          href: isDirector ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t(lang, 'reports'),
          href: isDirector ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t(lang, 'settings'),
          href: isDirector ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  savingRow: { flexDirection: 'row', alignItems: 'center', marginRight: 12, gap: 6 },
  savingText: { color: Colors.headerText, fontSize: 12 },
});
