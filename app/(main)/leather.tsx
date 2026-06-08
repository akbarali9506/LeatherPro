import { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { formatCurrency, formatUSD, toUSD } from '../../utils/currency';
import { downloadLeatherPDF } from '../../utils/pdf';
import { Currency, Grade, InventoryItem } from '../../types';

const GRADES: Grade[] = ['Grade 1', 'Grade 2', 'Grade 3'];
const GRADE_COLORS = { 'Grade 1': Colors.grade1, 'Grade 2': Colors.grade2, 'Grade 3': Colors.grade3 };
const GRADE_LIGHT = { 'Grade 1': Colors.grade1Light, 'Grade 2': Colors.grade2Light, 'Grade 3': Colors.grade3Light };
const GRADE_LABEL: Record<Grade, string> = { 'Grade 1': 'S1', 'Grade 2': 'S2', 'Grade 3': 'S3' };

export default function LeatherScreen() {
  const { inventory, settings, role, updateItemPrice, updateItemName, deleteInventoryItem } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const rates = settings.exchangeRates;

  const [view, setView] = useState<'batch' | 'grade'>('batch');
  const [searchQuery, setSearchQuery] = useState('');
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCurrency, setEditCurrency] = useState<Currency>('USD');
  const [renameItem, setRenameItem] = useState<InventoryItem | null>(null);
  const [renameText, setRenameText] = useState('');

  const finished = inventory.filter((i) => i.type === 'Finished Leather' && i.qty > 0);
  const totalArea = finished.reduce((s, i) => s + i.qty, 0);
  const totalValue = finished.reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, rates), 0);

  const displayFinished = useMemo(() => {
    if (!searchQuery.trim()) return finished;
    const q = searchQuery.toLowerCase();
    return finished.filter((i) => i.name.toLowerCase().includes(q) || (i.batchName ?? '').toLowerCase().includes(q));
  }, [finished, searchQuery]);

  // Group by batch
  const batchMap = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    displayFinished.forEach((item) => {
      if (item.batchId) {
        map.set(item.batchId, [...(map.get(item.batchId) ?? []), item]);
      }
    });
    return map;
  }, [displayFinished]);

  const manualItems = useMemo(() => displayFinished.filter((i) => !i.batchId), [displayFinished]);

  function savePrice() {
    if (!editItem || !editPrice) return;
    updateItemPrice(editItem.id, parseFloat(editPrice), editCurrency);
    setEditItem(null);
  }

  function saveRename() {
    if (!renameItem || !renameText.trim()) return;
    updateItemName(renameItem.id, renameText.trim());
    setRenameItem(null);
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
        {isDirector && finished.length > 0 && (
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => downloadLeatherPDF(inventory, settings)}
          >
            <Ionicons name="download-outline" size={14} color={Colors.primary} />
            <Text style={styles.pdfBtnText}>{t(lang, 'downloadPdf')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t(lang, 'searchPlaceholder')}
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
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
        {displayFinished.length === 0 && (
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
                    onEdit={() => { setEditItem(item); setEditPrice(String(item.price)); setEditCurrency(item.currency); }}
                    onRename={() => { setRenameItem(item); setRenameText(item.name); }}
                    onDelete={() => deleteInventoryItem(item.id)}
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
                    onEdit={() => { setEditItem(item); setEditPrice(String(item.price)); setEditCurrency(item.currency); }}
                    onRename={() => { setRenameItem(item); setRenameText(item.name); }}
                    onDelete={() => deleteInventoryItem(item.id)}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {GRADES.map((grade) => {
              const items = displayFinished.filter((i) => i.grade === grade);
              if (items.length === 0) return null;
              const gradeTotal = items.reduce((s, i) => s + i.qty, 0);
              const gradeValue = items.reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, rates), 0);
              return (
                <View key={grade} style={[styles.gradeSection, Shadow.sm, { borderLeftColor: GRADE_COLORS[grade] }]}>
                  <View style={styles.gradeHeader}>
                    <View style={[styles.gradeDot, { backgroundColor: GRADE_COLORS[grade] }]} />
                    <Text style={[styles.gradeTitle, { color: GRADE_COLORS[grade] }]}>{GRADE_LABEL[grade]}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.gradeTotal}>{gradeTotal.toLocaleString()} dm²</Text>
                    {isDirector && <Text style={styles.gradeValue}>{formatUSD(gradeValue)}</Text>}
                  </View>
                  {items.map((item) => (
                    <GradeRow
                      key={item.id}
                      item={item}
                      isDirector={isDirector}
                      onEdit={() => { setEditItem(item); setEditPrice(String(item.price)); setEditCurrency(item.currency); }}
                      onRename={() => { setRenameItem(item); setRenameText(item.name); }}
                      onDelete={() => deleteInventoryItem(item.id)}
                    />
                  ))}
                </View>
              );
            })}
            {(() => {
              const ungrouped = finished.filter((i) => !i.grade);
              if (ungrouped.length === 0) return null;
              const total = ungrouped.reduce((s, i) => s + i.qty, 0);
              const value = ungrouped.reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, rates), 0);
              return (
                <View style={[styles.gradeSection, Shadow.sm, { borderLeftColor: Colors.textMuted }]}>
                  <View style={styles.gradeHeader}>
                    <View style={[styles.gradeDot, { backgroundColor: Colors.textMuted }]} />
                    <Text style={[styles.gradeTitle, { color: Colors.textMuted }]}>{t(lang, 'manualEntries')}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={styles.gradeTotal}>{total.toLocaleString()} dm²</Text>
                    {isDirector && <Text style={styles.gradeValue}>{formatUSD(value)}</Text>}
                  </View>
                  {ungrouped.map((item) => (
                    <GradeRow
                      key={item.id}
                      item={item}
                      isDirector={isDirector}
                      onEdit={() => { setEditItem(item); setEditPrice(String(item.price)); setEditCurrency(item.currency); }}
                      onRename={() => { setRenameItem(item); setRenameText(item.name); }}
                      onDelete={() => deleteInventoryItem(item.id)}
                    />
                  ))}
                </View>
              );
            })()}
          </>
        )}
      </ScrollView>

      {/* Rename modal */}
      <Modal visible={!!renameItem} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(lang, 'rename')}: {renameItem?.name}</Text>
            <Text style={styles.fieldLabel}>{t(lang, 'name')}</Text>
            <TextInput
              style={styles.input}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRenameItem(null)}>
                <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveRename}>
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit price modal */}
      <Modal visible={!!editItem} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(lang, 'editPrice')}: {editItem?.name}</Text>
            <Text style={styles.fieldLabel}>{t(lang, 'price')} / dm²</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="decimal-pad"
                autoFocus
              />
              <View style={styles.currencyRow}>
                {(['USD', 'UZS'] as Currency[]).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.currBtn, editCurrency === c && styles.currBtnActive]}
                    onPress={() => setEditCurrency(c)}
                  >
                    <Text style={[styles.currText, editCurrency === c && styles.currTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditItem(null)}>
                <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={savePrice}>
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function GradeRow({ item, isDirector, onEdit, onRename, onDelete }: {
  item: InventoryItem; isDirector: boolean; onEdit: () => void; onRename: () => void; onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const color = item.grade ? GRADE_COLORS[item.grade] : Colors.primary;
  const light = item.grade ? GRADE_LIGHT[item.grade] : Colors.primaryLight;

  if (confirming) {
    return (
      <View style={styles.gradeRow}>
        <Text style={styles.confirmQuestion} numberOfLines={1}>{item.name}</Text>
        <View style={styles.confirmInline}>
          <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirming(false)}>
            <Text style={styles.confirmCancelText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmDeleteBtn} onPress={() => { onDelete(); setConfirming(false); }}>
            <Ionicons name="trash-outline" size={14} color={Colors.surface} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.gradeRow}>
      {item.grade && (
        <View style={[styles.gradePill, { backgroundColor: light }]}>
          <Text style={[styles.gradePillText, { color }]}>{GRADE_LABEL[item.grade]}</Text>
        </View>
      )}
      <Text style={styles.gradeItemName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.gradeQty}>{item.qty.toLocaleString()} dm²</Text>
      {isDirector && <Text style={styles.gradePrice}>{formatCurrency(item.price, item.currency)}/dm²</Text>}
      {isDirector && (
        <TouchableOpacity onPress={onRename}>
          <Ionicons name="text-outline" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}
      {isDirector && (
        <TouchableOpacity onPress={onEdit}>
          <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
        </TouchableOpacity>
      )}
      {isDirector && (
        <TouchableOpacity onPress={() => setConfirming(true)}>
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 4 },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: 0, alignItems: 'center', flexWrap: 'wrap' },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary + '50' },
  pdfBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
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
  gradeQty: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right' },
  gradePrice: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  confirmQuestion: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  confirmInline: { flexDirection: 'row', gap: Spacing.xs },
  confirmCancelBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  confirmCancelText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '700' },
  confirmDeleteBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: Colors.error },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  priceRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  currencyRow: { flexDirection: 'row', gap: 4 },
  currBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  currBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  currText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  currTextActive: { color: Colors.primary },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnText: { color: Colors.surface, fontWeight: '700' },
});
