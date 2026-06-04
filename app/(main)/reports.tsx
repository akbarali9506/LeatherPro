import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { formatUSD, toUSD } from '../../utils/currency';

export default function ReportsScreen() {
  const { batches, sales, settings } = useApp();
  const lang = settings.language;
  const [view, setView] = useState<'overview' | 'batches'>('overview');

  const rates = settings.exchangeRates;
  const totalRevenue = sales
    .filter((s) => !s.needsPricing)
    .reduce((sum, s) => sum + toUSD(s.qty * s.price, s.currency, rates), 0);
  const totalCost = batches.reduce((s, b) => s + b.totalCost, 0);
  const totalProfit = totalRevenue - totalCost;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.toggle}>
        {(['overview', 'batches'] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
              {t(lang, v === 'overview' ? 'overview' : 'perBatch')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {view === 'overview' ? (
          <>
            <MetricCard label={t(lang, 'totalRevenueLbl')} value={formatUSD(totalRevenue)} color={Colors.success} />
            <MetricCard label={t(lang, 'totalCostLbl')} value={formatUSD(totalCost)} color={Colors.error} />
            <MetricCard
              label={t(lang, 'totalProfitLbl')}
              value={formatUSD(totalProfit)}
              color={totalProfit >= 0 ? Colors.success : Colors.error}
            />
          </>
        ) : (
          <>
            {batches.length === 0 && (
              <Text style={styles.emptyText}>{t(lang, 'noReports')}</Text>
            )}
            {batches.slice().reverse().map((batch) => {
              const batchSales = sales.filter((s) => s.batchId === batch.id);
              return (
                <View key={batch.id} style={[styles.batchCard, Shadow.sm]}>
                  <View style={styles.batchHeader}>
                    <View>
                      <Text style={styles.batchName}>{batch.name}</Text>
                      <Text style={styles.batchDate}>{batch.date}</Text>
                    </View>
                    <View style={[styles.badge, batch.status === 'finished' ? styles.badgeGreen : styles.badgeYellow]}>
                      <Text style={styles.badgeText}>{t(lang, batch.status === 'finished' ? 'finished' : 'inProgress')}</Text>
                    </View>
                  </View>

                  <View style={styles.costGrid}>
                    <CostRow label={t(lang, 'chemicalCost')} value={formatUSD(batch.chemCost)} />
                    <CostRow label={t(lang, 'rawMaterialCost')} value={formatUSD(batch.rawCost)} />
                    <CostRow label={t(lang, 'otherCost')} value={formatUSD(batch.otherCost)} />
                    <CostRow label={t(lang, 'totalCost')} value={formatUSD(batch.totalCost)} bold />
                    <CostRow label={t(lang, 'revenue')} value={formatUSD(batch.revenue)} color={Colors.success} bold />
                    <CostRow
                      label={t(lang, 'profit')}
                      value={formatUSD(batch.profit)}
                      color={batch.profit >= 0 ? Colors.success : Colors.error}
                      bold
                    />
                  </View>

                  {batchSales.length > 0 && (
                    <>
                      <Text style={styles.salesTitle}>{t(lang, 'linkedSales')}</Text>
                      {batchSales.map((sale) => (
                        <View key={sale.id} style={styles.saleRow}>
                          <Text style={styles.saleBuyer}>{sale.buyer}</Text>
                          <Text style={styles.saleQty}>{sale.qty} dm²</Text>
                          <Text style={styles.saleAmt}>{formatUSD(toUSD(sale.qty * sale.price, sale.currency, rates))}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.metricCard, Shadow.sm]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function CostRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.costRow}>
      <Text style={[styles.costLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.costValue, bold && styles.bold, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  toggle: { flexDirection: 'row', margin: Spacing.lg, backgroundColor: Colors.border, borderRadius: Radius.md, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.surface },
  toggleText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: Colors.primary },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  metricCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  metricLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  metricValue: { fontSize: FontSize.xxl, fontWeight: '800' },
  batchCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  batchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  batchName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  batchDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeGreen: { backgroundColor: Colors.successLight },
  badgeYellow: { backgroundColor: Colors.warningLight },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text },
  costGrid: { gap: 2 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  costLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  costValue: { fontSize: FontSize.sm, color: Colors.text },
  bold: { fontWeight: '700' },
  salesTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.sm },
  saleRow: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: 2 },
  saleBuyer: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  saleQty: { fontSize: FontSize.sm, color: Colors.textSecondary },
  saleAmt: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.success },
  emptyText: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.md, marginTop: Spacing.xxl },
});
