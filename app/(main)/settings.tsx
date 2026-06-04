import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { Language } from '../../types';

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'uz', label: 'Uzbek', native: "O'zbek" },
  { code: 'ru', label: 'Russian', native: 'Русский' },
];

export default function SettingsScreen() {
  const { settings, updateSettings, setLanguage, logout } = useApp();
  const lang = settings.language;
  const rates = settings.exchangeRates;

  const [eurRate, setEurRate] = useState(String(rates.EUR));
  const [uzsRate, setUzsRate] = useState(String(rates.UZS));
  const [threshold, setThreshold] = useState(String(settings.lowStockThreshold));

  function saveRates() {
    const EUR = parseFloat(eurRate);
    const UZS = parseFloat(uzsRate);
    if (isNaN(EUR) || isNaN(UZS)) return;
    updateSettings({ exchangeRates: { USD: 1, EUR, UZS } });
    Alert.alert('', 'Saved');
  }

  function saveThreshold() {
    const val = parseInt(threshold, 10);
    if (isNaN(val)) return;
    updateSettings({ lowStockThreshold: val });
    Alert.alert('', 'Saved');
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Language */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.cardTitle}>{t(lang, 'language')}</Text>
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langBtn, lang === l.code && styles.langBtnActive]}
                onPress={() => setLanguage(l.code)}
              >
                <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                  {l.native}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exchange rates */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.cardTitle}>{t(lang, 'exchangeRates')}</Text>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>1 USD =</Text>
            <Text style={styles.rateLabel}>1.00</Text>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>{t(lang, 'eurRate')}</Text>
            <TextInput
              style={styles.rateInput}
              value={eurRate}
              onChangeText={setEurRate}
              keyboardType="decimal-pad"
              placeholder="1.08"
            />
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>{t(lang, 'uzsRate')}</Text>
            <TextInput
              style={styles.rateInput}
              value={uzsRate}
              onChangeText={setUzsRate}
              keyboardType="decimal-pad"
              placeholder="0.000078"
            />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={saveRates}>
            <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
          </TouchableOpacity>
        </View>

        {/* Low stock threshold */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.cardTitle}>{t(lang, 'lowStockThreshold')}</Text>
          <View style={styles.rateRow}>
            <TextInput
              style={[styles.rateInput, { flex: 1 }]}
              value={threshold}
              onChangeText={setThreshold}
              keyboardType="number-pad"
              placeholder="50"
            />
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={saveThreshold}>
            <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() =>
            Alert.alert(t(lang, 'logout'), t(lang, 'logoutConfirm'), [
              { text: t(lang, 'no'), style: 'cancel' },
              { text: t(lang, 'yes'), style: 'destructive', onPress: logout },
            ])
          }
        >
          <Text style={styles.logoutText}>{t(lang, 'logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  langRow: { flexDirection: 'row', gap: Spacing.sm },
  langBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  langBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  langText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  langTextActive: { color: Colors.primary },
  rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  rateLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1 },
  rateInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.text,
    minWidth: 120,
    textAlign: 'right',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.md },
});
