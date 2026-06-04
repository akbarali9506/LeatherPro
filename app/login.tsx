import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { Language } from '../types';
import { Colors, FontSize, Radius, Spacing } from '../constants/theme';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
];

export default function LoginScreen() {
  const { login, settings, setLanguage } = useApp();
  const lang = settings.language;
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function handlePin(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    setError('');
    if (next.length === 4) {
      const ok = login(next);
      if (!ok) {
        setError(t(lang, 'wrongPin'));
        setTimeout(() => setPin(''), 300);
      }
    }
  }

  function handleDelete() {
    setPin((p) => p.slice(0, -1));
    setError('');
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Language switcher */}
      <View style={styles.langRow}>
        {LANGUAGES.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[styles.langBtn, lang === l.code && styles.langBtnActive]}
            onPress={() => setLanguage(l.code)}
          >
            <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
              {l.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logo */}
      <View style={styles.logoArea}>
        <View style={styles.logoIcon}>
          <Ionicons name="layers" size={40} color={Colors.surface} />
        </View>
        <Text style={styles.appName}>{t(lang, 'appName')}</Text>
      </View>

      {/* PIN input */}
      <Text style={styles.sectionLabel}>{t(lang, 'enterPin')}</Text>
      <View style={styles.pinDots}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.dot, pin.length > i && styles.dotFilled]} />
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.numpad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.numKey, d === '' && styles.numKeyEmpty]}
            onPress={() => {
              if (d === '⌫') handleDelete();
              else if (d !== '') handlePin(d);
            }}
            disabled={d === ''}
          >
            <Text style={styles.numKeyText}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  langRow: {
    flexDirection: 'row',
    alignSelf: 'flex-end',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  langBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  langBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  langText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  langTextActive: { color: Colors.surface },
  logoArea: { alignItems: 'center', marginTop: Spacing.xxl, marginBottom: Spacing.xl },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  appName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  sectionLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  pinDots: { flexDirection: 'row', gap: Spacing.lg, marginVertical: Spacing.lg },
  dot: {
    width: 16,
    height: 16,
    borderRadius: Radius.full,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary },
  errorText: { color: Colors.error, fontSize: FontSize.sm, marginBottom: Spacing.sm },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    gap: Spacing.md,
    justifyContent: 'center',
  },
  numKey: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numKeyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent' },
  numKeyText: { fontSize: FontSize.xl, fontWeight: '600', color: Colors.text },
});
