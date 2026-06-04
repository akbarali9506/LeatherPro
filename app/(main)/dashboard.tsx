import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { formatUSD, toUSD } from '../../utils/currency';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const { batches, inventory, sales, settings, pendingReviews, resolvePriceReview, logout, role } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const router = useRouter();
  const [panels, setPanels] = useState({ recentBatches: true, leatherSummary: true, lowStock: true });
  const [showCustomize, setShowCustomize] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const rates = settings.exchangeRates;
  const pendingSales = sales.filter((s) => s.needsPricing);
  const totalBatches = batches.length;
  const totalRevenue = batches.reduce((s, b) => s + b.revenue, 0);
  const totalProfit = batches.reduce((s, b) => s + b.profit, 0);
  const inventoryValue = inventory
    .filter((i) => i.type !== 'Finished Leather')
    .reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, rates), 0);

  const threshold = settings.lowStockThreshold;
  const lowStockItems = inventory.filter(
    (i) => i.type !== 'Finished Leather' && i.qty <= threshold,
  );

  const finishedLeather = inventory.filter((i) => i.type === 'Finished Leather');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Price review banner — director only */}
        {isDirector && pendingReviews.map((review) => (
          <View key={review.itemId} style={styles.reviewBanner}>
            <Text style={styles.reviewTitle}>{t(lang, 'priceReview')}: {review.itemName}</Text>
            <View style={styles.reviewPrices}>
              <Text style={styles.reviewLabel}>{t(lang, 'oldPrice')}: ${review.oldPrice.toFixed(2)}</Text>
              <Text style={styles.reviewLabel}>{t(lang, 'newPrice')}: ${review.newPrice.toFixed(2)}</Text>
              <Text style={styles.reviewLabel}>{t(lang, 'weightedAvg')}: ${review.weightedAvg.toFixed(2)}</Text>
            </View>
            <View style={styles.reviewActions}>
              <TouchableOpacity style={styles.reviewBtn} onPress={() => resolvePriceReview(review.itemId, 'new')}>
                <Text style={styles.reviewBtnText}>{t(lang, 'useNew')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reviewBtn} onPress={() => resolvePriceReview(review.itemId, 'avg')}>
                <Text style={styles.reviewBtnText}>{t(lang, 'useAverage')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reviewBtn} onPress={() => resolvePriceReview(review.itemId, 'old')}>
                <Text style={styles.reviewBtnText}>{t(lang, 'keepOld')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {/* Pending sale pricing banner — director only */}
        {isDirector && pendingSales.length > 0 && (
          <TouchableOpacity
            style={styles.pendingBanner}
            onPress={() => router.push('/(main)/sales')}
          >
            <Ionicons name="pricetag-outline" size={16} color={Colors.warning} />
            <Text style={styles.pendingBannerText}>
              {pendingSales.length} {t(lang, 'pendingPricing')} — {t(lang, 'setPrice')}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* Stat cards */}
        <View style={styles.statsGrid}>
          <StatCard label={t(lang, 'totalBatches')} value={String(totalBatches)} icon="albums" color={Colors.secondary} />
          {isDirector && <StatCard label={t(lang, 'totalRevenue')} value={formatUSD(totalRevenue)} icon="trending-up" color={Colors.success} />}
          {isDirector && <StatCard label={t(lang, 'totalProfit')} value={formatUSD(totalProfit)} icon="cash" color={totalProfit >= 0 ? Colors.success : Colors.error} />}
          {isDirector && <StatCard label={t(lang, 'inventoryValue')} value={formatUSD(inventoryValue)} icon="cube" color={Colors.primary} />}
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.newBatchBtn, { flex: 1 }]} onPress={() => router.push('/(main)/batches')}>
            <Ionicons name="add-circle" size={20} color={Colors.surface} />
            <Text style={styles.newBatchText}>{t(lang, 'startNewBatch')}</Text>
          </TouchableOpacity>
          {isDirector && (
            <TouchableOpacity style={styles.reportsBtn} onPress={() => router.push('/(main)/reports')}>
              <Ionicons name="bar-chart-outline" size={20} color={Colors.primary} />
              <Text style={styles.reportsBtnText}>{t(lang, 'reports')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Customize button */}
        <TouchableOpacity style={styles.customizeBtn} onPress={() => setShowCustomize(true)}>
          <Ionicons name="options-outline" size={16} color={Colors.primary} />
          <Text style={styles.customizeBtnText}>{t(lang, 'customizePanels')}</Text>
        </TouchableOpacity>

        {/* Recent Batches */}
        {panels.recentBatches && (
          <Section title={t(lang, 'recentBatches')}>
            {batches.slice(-5).reverse().map((b) => (
              <View key={b.id} style={styles.batchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.batchName}>{b.name}</Text>
                  <Text style={styles.batchDate}>{b.date}</Text>
                </View>
                <View style={[styles.statusBadge, b.status === 'finished' ? styles.badgeGreen : styles.badgeYellow]}>
                  <Text style={styles.badgeText}>{t(lang, b.status === 'finished' ? 'finished' : 'inProgress')}</Text>
                </View>
                {isDirector && (
                  <Text style={[styles.batchProfit, { color: b.profit >= 0 ? Colors.success : Colors.error }]}>
                    {formatUSD(b.profit)}
                  </Text>
                )}
              </View>
            ))}
            {batches.length === 0 && <Text style={styles.emptyText}>{t(lang, 'noBatches')}</Text>}
          </Section>
        )}

        {/* Leather Summary */}
        {panels.leatherSummary && (
          <Section title={t(lang, 'leatherSummary')}>
            {(['Grade 1', 'Grade 2', 'Grade 3'] as const).map((grade) => {
              const items = finishedLeather.filter((i) => i.grade === grade);
              const total = items.reduce((s, i) => s + i.qty, 0);
              const val = items.reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, rates), 0);
              const color = grade === 'Grade 1' ? Colors.grade1 : grade === 'Grade 2' ? Colors.grade2 : Colors.grade3;
              return (
                <View key={grade} style={styles.gradeRow}>
                  <View style={[styles.gradeDot, { backgroundColor: color }]} />
                  <Text style={styles.gradeLabel}>{grade}</Text>
                  <Text style={styles.gradeQty}>{total.toLocaleString()} dm²</Text>
                  {isDirector && <Text style={styles.gradeVal}>{formatUSD(val)}</Text>}
                </View>
              );
            })}
          </Section>
        )}

        {/* Low Stock */}
        {panels.lowStock && lowStockItems.length > 0 && (
          <Section title={t(lang, 'lowStockAlerts')}>
            {lowStockItems.map((item) => (
              <View key={item.id} style={styles.lowStockRow}>
                <Ionicons name="warning" size={16} color={Colors.error} />
                <Text style={styles.lowStockName}>{item.name}</Text>
                <Text style={styles.lowStockQty}>{item.qty} {item.unit}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Logout */}
        {logoutConfirm ? (
          <View style={styles.logoutConfirmCard}>
            <Text style={styles.logoutConfirmText}>{t(lang, 'logoutConfirm')}</Text>
            <View style={styles.logoutConfirmBtns}>
              <TouchableOpacity style={styles.logoutCancelBtn} onPress={() => setLogoutConfirm(false)}>
                <Text style={styles.logoutCancelText}>{t(lang, 'no')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.logoutDoBtn} onPress={logout}>
                <Text style={styles.logoutDoText}>{t(lang, 'logout')}</Text>
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

      {/* Customize modal */}
      <Modal visible={showCustomize} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(lang, 'customizePanels')}</Text>
            {([
              ['recentBatches', t(lang, 'recentBatches')],
              ['leatherSummary', t(lang, 'leatherSummary')],
              ['lowStock', t(lang, 'lowStockAlerts')],
            ] as [keyof typeof panels, string][]).map(([key, label]) => (
              <View key={key} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{label}</Text>
                <Switch
                  value={panels[key]}
                  onValueChange={(v) => setPanels((p) => ({ ...p, [key]: v }))}
                  trackColor={{ true: Colors.primary }}
                />
              </View>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowCustomize(false)}>
              <Text style={styles.closeBtnText}>{t(lang, 'close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <View style={[styles.statCard, Shadow.sm]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={[styles.section, Shadow.sm]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  statIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  quickRow: { flexDirection: 'row', gap: Spacing.sm },
  newBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  newBatchText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
  reportsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary, backgroundColor: Colors.surface },
  reportsBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.md },
  customizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    alignSelf: 'flex-end',
  },
  customizeBtnText: { color: Colors.primary, fontSize: FontSize.sm },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  batchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  batchName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  batchDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  batchProfit: { fontSize: FontSize.sm, fontWeight: '700' },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeGreen: { backgroundColor: Colors.successLight },
  badgeYellow: { backgroundColor: Colors.warningLight },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text },
  gradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  gradeDot: { width: 10, height: 10, borderRadius: Radius.full },
  gradeLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  gradeQty: { fontSize: FontSize.sm, color: Colors.textSecondary, marginRight: Spacing.sm },
  gradeVal: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  lowStockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  lowStockName: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  lowStockQty: { fontSize: FontSize.sm, color: Colors.error, fontWeight: '600' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.sm },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, marginTop: Spacing.sm },
  logoutText: { color: Colors.error, fontWeight: '600', fontSize: FontSize.md },
  logoutConfirmCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1.5, borderColor: Colors.error, gap: Spacing.md, marginTop: Spacing.sm },
  logoutConfirmText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  logoutConfirmBtns: { flexDirection: 'row', gap: Spacing.sm },
  logoutCancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  logoutCancelText: { color: Colors.textSecondary, fontWeight: '600', fontSize: FontSize.md },
  logoutDoBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.error, alignItems: 'center' },
  logoutDoText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.warningLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.warning },
  pendingBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600' },
  reviewBanner: { backgroundColor: Colors.warningLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.warning },
  reviewTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  reviewPrices: { gap: Spacing.xs, marginBottom: Spacing.md },
  reviewLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  reviewActions: { flexDirection: 'row', gap: Spacing.sm },
  reviewBtn: { flex: 1, backgroundColor: Colors.primary, borderRadius: Radius.sm, padding: Spacing.sm, alignItems: 'center' },
  reviewBtnText: { color: Colors.surface, fontSize: FontSize.xs, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: FontSize.md, color: Colors.text },
  closeBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  closeBtnText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
});
