import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../constants/theme';

export default function SetupScreen() {
  const { settings, refreshProfile } = useApp();
  const lang = settings.language;

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [orgName, setOrgName] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!orgName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create organization
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .insert({ name: orgName.trim() })
        .select()
        .single();
      if (orgErr) throw orgErr;

      // Assign user as director + link to org
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ organization_id: org.id, role: 'director' })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      // Create default settings row for org
      await supabase.from('org_settings').insert({
        organization_id: org.id,
        language: lang,
        low_stock_threshold: 10,
        exchange_rates: { USD: 1, EUR: 1.1, UZS: 0.000079 },
      });

      // Refresh profile in AppContext so _layout navigates to main
      await refreshProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setLoading(false);
  }

  async function handleJoin() {
    if (!orgCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify org exists
      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', orgCode.trim())
        .single();
      if (orgErr || !org) throw new Error('Organization not found. Check the code and try again.');

      // Link user to org as worker
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ organization_id: org.id, role: 'worker' })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      await refreshProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setLoading(false);
  }

  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Ionicons name="layers" size={40} color={Colors.surface} />
          </View>
          <Text style={styles.title}>{t(lang, 'orgSetup')}</Text>
          <Text style={styles.subtitle}>LeatherPro</Text>
        </View>

        <View style={styles.optionCard} >
          <TouchableOpacity
            style={[styles.option, Shadow.sm]}
            onPress={() => setMode('create')}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="add-circle-outline" size={28} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{t(lang, 'createOrg')}</Text>
              <Text style={styles.optionDesc}>{t(lang, 'createOrgDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, Shadow.sm]}
            onPress={() => setMode('join')}
          >
            <View style={styles.optionIcon}>
              <Ionicons name="people-outline" size={28} color={Colors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{t(lang, 'joinOrg')}</Text>
              <Text style={styles.optionDesc}>{t(lang, 'joinOrgDesc')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => supabase.auth.signOut()}
        >
          <Text style={styles.logoutText}>{t(lang, 'logout')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backBtn} onPress={() => { setMode('choose'); setError(''); }}>
          <Ionicons name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>
          {mode === 'create' ? t(lang, 'createOrg') : t(lang, 'joinOrg')}
        </Text>

        <View style={[styles.formCard, Shadow.sm]}>
          {mode === 'create' ? (
            <>
              <Text style={styles.fieldLabel}>{t(lang, 'orgName')}</Text>
              <TextInput
                style={styles.input}
                value={orgName}
                onChangeText={setOrgName}
                placeholder="e.g. Toshkent Tannery LLC"
                autoCapitalize="words"
              />
              <Text style={styles.hint}>
                You will be assigned as director. Share the organization code with your workers after setup.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>{t(lang, 'orgCode')}</Text>
              <TextInput
                style={styles.input}
                value={orgCode}
                onChangeText={setOrgCode}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hint}>{t(lang, 'orgCodeHint')}</Text>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={mode === 'create' ? handleCreate : handleJoin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={Colors.surface} />
              : <Text style={styles.submitBtnText}>
                  {mode === 'create' ? t(lang, 'creating') : t(lang, 'joining')}
                  {!loading && (mode === 'create' ? ` ${t(lang, 'createOrg')}` : ` ${t(lang, 'joinOrg')}`)}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  logoArea: { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  logoIcon: { width: 72, height: 72, borderRadius: Radius.xl, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 4 },
  optionCard: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md },
  optionIcon: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  optionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  logoutBtn: { alignItems: 'center', marginTop: Spacing.xxl },
  logoutText: { color: Colors.error, fontSize: FontSize.sm, fontWeight: '600' },
  formScroll: { padding: Spacing.xl, gap: Spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  backText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.md },
  formCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.background },
  hint: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },
  errorText: { fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
});
