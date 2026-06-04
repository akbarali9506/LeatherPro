import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoClipboard from 'expo-clipboard';
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
  const { settings, updateSettings, setLanguage, logout, orgId, role } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const rates = settings.exchangeRates;

  const [uzsRate, setUzsRate] = useState(String(rates.UZS));
  const [threshold, setThreshold] = useState(String(settings.lowStockThreshold));
  const [savedSection, setSavedSection] = useState<null | 'rates' | 'threshold'>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  function saveRates() {
    const UZS = parseFloat(uzsRate);
    if (isNaN(UZS)) return;
    updateSettings({ exchangeRates: { USD: 1, EUR: rates.EUR, UZS } });
    setSavedSection('rates');
    setTimeout(() => setSavedSection(null), 2000);
  }

  function saveThreshold() {
    const val = parseInt(threshold, 10);
    if (isNaN(val)) return;
    updateSettings({ lowStockThreshold: val });
    setSavedSection('threshold');
    setTimeout(() => setSavedSection(null), 2000);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Organization code — director only */}
        {isDirector && orgId && (
          <View style={[styles.card, Shadow.sm]}>
            <Text style={styles.cardTitle}>{t(lang, 'orgCode')}</Text>
            <Text style={styles.orgCodeHint}>{t(lang, 'orgCodeHint')}</Text>
            <TouchableOpacity
              style={styles.orgCodeBox}
              onPress={async () => {
                await ExpoClipboard.setStringAsync(orgId);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Text style={styles.orgCodeText} numberOfLines={1}>{orgId}</Text>
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={copied ? Colors.success : Colors.primary}
              />
            </TouchableOpacity>
          </View>
        )}

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
            {savedSection === 'rates' ? (
              <View style={styles.savedRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.surface} />
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
            )}
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
            {savedSection === 'threshold' ? (
              <View style={styles.savedRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.surface} />
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </View>
            ) : (
              <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Logout */}
        {logoutConfirm ? (
          <View style={[styles.card, Shadow.sm, styles.confirmCard]}>
            <Text style={styles.confirmText}>{t(lang, 'logoutConfirm')}</Text>
            <View style={styles.confirmRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLogoutConfirm(false)}>
                <Text style={styles.cancelBtnText}>{t(lang, 'no')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutConfirmBtn} onPress={logout}>
                <Ionicons name="log-out-outline" size={16} color={Colors.surface} />
                <Text style={styles.logoutConfirmText}>{t(lang, 'logout')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutConfirm(true)}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
            <Text style={styles.logoutText}>{t(lang, 'logout')}</Text>
          </TouchableOpacity>
        )}
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
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: FontSize.md },
  orgCodeHint: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  orgCodeBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  orgCodeText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, fontFamily: 'monospace' },
  confirmCard: { borderWidth: 1.5, borderColor: Colors.error },
  confirmText: { fontSize: FontSize.md, color: Colors.text, marginBottom: Spacing.md, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.md },
  logoutConfirmBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.error, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm,
  },
  logoutConfirmText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
});
