import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { formatUSD, toUSD } from '../../utils/currency';
import { Grade, InventoryItem } from '../../types';

const GRADES: Grade[] = ['Grade 1', 'Grade 2', 'Grade 3'];
const GRADE_COLORS = { 'Grade 1': Colors.grade1, 'Grade 2': Colors.grade2, 'Grade 3': Colors.grade3 };
const GRADE_LIGHT = { 'Grade 1': Colors.grade1Light, 'Grade 2': Colors.grade2Light, 'Grade 3': Colors.grade3Light };

export default function LeatherScreen() {
  const { inventory, settings, role, updateItemPrice } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const rates = settings.exchangeRates;

  const [view, setView] = useState<'batch' | 'grade'>('batch');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editPrice, setEditPrice] = useState('');

  const finished = inventory.filter((i) => i.type === 'Finished Leather');
  const totalArea = finished.reduce((s, i) => s + i.qty, 0);
  const totalValue = finished.reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, rates), 0);

  // Group by batch
  const batchMap = new Map<string, InventoryItem[]>();
  const manualItems: InventoryItem[] = [];
  finished.forEach((item) => {
    if (item.batchId) {
      const key = item.batchId;
      batchMap.set(key, [...(batchMap.get(key) ?? []), item]);
    } else {
      manualItems.push(item);
    }
  });

  function savePrice() {
    if (!editItem || !editPrice) return;
    updateItemPrice(editItem.id, parseFloat(editPrice));
    setEditItem(null);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, Shadow.sm]}>
          <Text style={styles.summaryNum}>{totalArea.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>{t(lang, 'totalArea')} (dm²)</Text>
        </View>
        {isDirector && (
          <View style={[styles.summaryCard, Shadow.sm]}>
            <Text style={styles.summaryNum}>{formatUSD(totalValue)}</Text>
            <Text style={styles.summaryLabel}>{t(lang, 'estimatedValue')}</Text>
          </View>
        )}
      </View>

      {/* Toggle */}
      <View style={styles.toggle}>
        {(['batch', 'grade'] as const).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>
              {t(lang, v === 'batch' ? 'byBatch' : 'byGrade')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {finished.length === 0 && (
          <Text style={styles.emptyText}>{t(lang, 'noData')}</Text>
        )}

        {view === 'batch' ? (
          <>
            {Array.from(batchMap.entries()).map(([batchId, items]) => (
              <View key={batchId} style={[styles.batchCard, Shadow.sm]}>
                <Text style={styles.batchName}>{items[0].batchName ?? batchId}</Text>
                {items.map((item) => (
                  <GradeRow
                    key={item.id}
                    item={item}
                    isDirector={isDirector}
                    onEdit={() => { setEditItem(item); setEditPrice(String(item.price)); }}
                  />
                ))}
              </View>
            ))}
            {manualItems.length > 0 && (
              <View style={[styles.batchCard, Shadow.sm]}>
                <Text style={styles.batchName}>{t(lang, 'manualEntries')}</Text>
                {manualItems.map((item) => (
                  <GradeRow
                    key={item.id}
                    item={item}
                    isDirector={isDirector}
                    onEdit={() => { setEditItem(item); setEditPrice(String(item.price)); }}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          GRADES.map((grade) => {
            const items = finished.filter((i) => i.grade === grade);
            if (items.length === 0) return null;
            const gradeTotal = items.reduce((s, i) => s + i.qty, 0);
            const gradeValue = items.reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, rates), 0);
            return (
              <View key={grade} style={[styles.gradeSection, Shadow.sm, { borderLeftColor: GRADE_COLORS[grade] }]}>
                <View style={styles.gradeHeader}>
                  <View style={[styles.gradeDot, { backgroundColor: GRADE_COLORS[grade] }]} />
                  <Text style={[styles.gradeTitle, { color: GRADE_COLORS[grade] }]}>{grade}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.gradeTotal}>{gradeTotal.toLocaleString()} dm²</Text>
                  {isDirector && <Text style={styles.gradeValue}>{formatUSD(gradeValue)}</Text>}
                </View>
                {items.map((item) => (
                  <GradeRow
                    key={item.id}
                    item={item}
                    isDirector={isDirector}
                    onEdit={() => { setEditItem(item); setEditPrice(String(item.price)); }}
                    showName
                  />
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Edit price modal */}
      <Modal visible={!!editItem} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(lang, 'editPrice')}: {editItem?.name}</Text>
            <Text style={styles.fieldLabel}>{t(lang, 'price')} / dm²</Text>
            <TextInput
              style={styles.input}
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditItem(null)}>
                <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={savePrice}>
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function GradeRow({ item, isDirector, onEdit, showName }: {
  item: InventoryItem; isDirector: boolean; onEdit: () => void; showName?: boolean;
}) {
  const color = item.grade ? GRADE_COLORS[item.grade] : Colors.primary;
  const light = item.grade ? GRADE_LIGHT[item.grade] : Colors.primaryLight;
  return (
    <View style={styles.gradeRow}>
      {showName ? (
        <Text style={styles.gradeItemName} numberOfLines={1}>{item.batchName ?? item.name}</Text>
      ) : (
        <View style={[styles.gradePill, { backgroundColor: light }]}>
          <Text style={[styles.gradePillText, { color }]}>{item.grade ?? item.name}</Text>
        </View>
      )}
      <Text style={styles.gradeQty}>{item.qty.toLocaleString()} dm²</Text>
      {isDirector && <Text style={styles.gradePrice}>${item.price.toFixed(2)}/dm²</Text>}
      {isDirector && (
        <TouchableOpacity onPress={onEdit}>
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: 0 },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  summaryNum: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center' },
  toggle: { flexDirection: 'row', margin: Spacing.lg, marginBottom: Spacing.sm, backgroundColor: Colors.border, borderRadius: Radius.md, padding: 3 },
  toggleBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: Colors.surface },
  toggleText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  toggleTextActive: { color: Colors.primary },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xxl },
  batchCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  batchName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  gradeSection: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderLeftWidth: 4 },
  gradeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  gradeDot: { width: 10, height: 10, borderRadius: Radius.full },
  gradeTitle: { fontSize: FontSize.md, fontWeight: '700' },
  gradeTotal: { fontSize: FontSize.sm, color: Colors.textSecondary, marginRight: Spacing.sm },
  gradeValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  gradePill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  gradePillText: { fontSize: FontSize.xs, fontWeight: '600' },
  gradeItemName: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  gradeQty: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  gradePrice: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnText: { color: Colors.surface, fontWeight: '700' },
});
