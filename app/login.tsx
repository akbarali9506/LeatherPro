import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { Language } from '../types';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../constants/theme';

const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'uz', label: 'UZ' },
  { code: 'ru', label: 'RU' },
];

export default function LoginScreen() {
  const { settings, setLanguage } = useApp();
  const lang = settings.language;

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function handleSignIn() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    setInfo('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) setError(err.message);
    setLoading(false);
  }

  async function handleSignUp() {
    if (!email.trim() || !password || !fullName.trim()) return;
    setLoading(true);
    setError('');
    setInfo('');
    const { error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (err) {
      setError(err.message);
    } else {
      setInfo(t(lang, 'emailConfirmNote'));
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
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

      <View style={styles.logoArea}>
        <View style={styles.logoIcon}>
          <Ionicons name="layers" size={40} color={Colors.surface} />
        </View>
        <Text style={styles.appName}>{t(lang, 'appName')}</Text>
      </View>

      <View style={styles.tabRow}>
        {(['signin', 'signup'] as const).map((tb) => (
          <TouchableOpacity
            key={tb}
            style={[styles.tab, tab === tb && styles.tabActive]}
            onPress={() => { setTab(tb); setError(''); setInfo(''); }}
          >
            <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>
              {tb === 'signin' ? t(lang, 'signIn') : t(lang, 'signUp')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.formCard, Shadow.sm]}>
        {tab === 'signup' && (
          <>
            <Text style={styles.fieldLabel}>{t(lang, 'fullName')}</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t(lang, 'fullName')}
              autoCapitalize="words"
              autoCorrect={false}
            />
          </>
        )}

        <Text style={styles.fieldLabel}>{t(lang, 'emailAddress')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.fieldLabel}>{t(lang, 'password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {info ? <Text style={styles.infoText}>{info}</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={tab === 'signin' ? handleSignIn : handleSignUp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.surface} />
            : <Text style={styles.submitBtnText}>
                {tab === 'signin' ? t(lang, 'signIn') : t(lang, 'signUp')}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', paddingHorizontal: Spacing.xl },
  langRow: { flexDirection: 'row', alignSelf: 'flex-end', marginTop: Spacing.lg, gap: Spacing.sm },
  langBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  langBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  langTextActive: { color: Colors.surface },
  logoArea: { alignItems: 'center', marginTop: Spacing.xxl, marginBottom: Spacing.xl },
  logoIcon: { width: 72, height: 72, borderRadius: Radius.xl, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  appName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text },
  tabRow: { flexDirection: 'row', width: '100%', backgroundColor: Colors.border, borderRadius: Radius.md, padding: 3, marginBottom: Spacing.lg },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.surface },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.primary },
  formCard: { width: '100%', backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.background },
  errorText: { fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  infoText: { fontSize: FontSize.sm, color: Colors.primary, textAlign: 'center' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
});
