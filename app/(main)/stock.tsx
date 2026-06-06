import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { formatUSD, toUSD } from '../../utils/currency';
import { downloadChemicalPDF } from '../../utils/pdf';
import { Currency, InventoryItem, ItemType, Language } from '../../types';

const CURRENCIES: Currency[] = ['USD', 'UZS'];

export default function StockScreen() {
  const { inventory, settings, role, addInventoryItem, addStock, updateItemPrice, updateItemUnit, deleteInventoryItem } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modal, setModal] = useState<'addItem' | 'addStock' | 'editUnit' | 'editPrice' | 'addLeather' | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<ItemType>('Chemical');
  const [formUnit, setFormUnit] = useState('kg');
  const [formQty, setFormQty] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCurrency, setFormCurrency] = useState<Currency>('USD');

  const filtered = inventory
    .filter((i) => i.type !== 'Finished Leather')
    .filter(
      (i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.id.toLowerCase().includes(search.toLowerCase()),
    );

  const chemicals = filtered.filter((i) => i.type === 'Chemical');
  const wetBlue = filtered.filter((i) => i.type === 'Wet Blue');
  const threshold = settings.lowStockThreshold;

  function openModal(type: typeof modal, item?: InventoryItem) {
    setSelectedItem(item ?? null);
    setFormName(item?.name ?? '');
    setFormUnit(item?.unit ?? 'kg');
    setFormQty('');
    setFormPrice(item?.price ? String(item.price) : '');
    setFormCurrency(item?.currency ?? 'USD');
    setFormType(item?.type === 'Wet Blue' ? 'Wet Blue' : 'Chemical');
    setModal(type);
  }

  function handleAddItem() {
    if (!formName.trim() || !formQty || (isDirector && !formPrice)) return;
    addInventoryItem({
      name: formName.trim(),
      type: formType,
      qty: parseFloat(formQty),
      unit: formUnit,
      price: isDirector ? parseFloat(formPrice) : 0,
      currency: formCurrency,
    });
    setModal(null);
  }

  function handleAddStock() {
    if (!selectedItem || !formQty) return;
    if (isDirector && !formPrice) return;
    const price = isDirector ? parseFloat(formPrice) : selectedItem.price;
    addStock(selectedItem.id, parseFloat(formQty), price, formCurrency);
    setModal(null);
  }

  function handleEditUnit() {
    if (!selectedItem || !formUnit.trim()) return;
    updateItemUnit(selectedItem.id, formUnit.trim());
    setModal(null);
  }

  function handleEditPrice() {
    if (!selectedItem || !formPrice) return;
    updateItemPrice(selectedItem.id, parseFloat(formPrice), formCurrency);
    setModal(null);
  }

  function handleAddLeather() {
    if (!formName.trim() || !formQty) return;
    if (isDirector && !formPrice) return;
    addInventoryItem({
      name: formName.trim(),
      type: 'Finished Leather',
      qty: parseFloat(formQty),
      unit: 'dm²',
      price: isDirector && formPrice ? parseFloat(formPrice) : 0,
      currency: formCurrency,
    });
    setModal(null);
  }


  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t(lang, 'search')}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, Shadow.sm]}>
            <Text style={styles.summaryNum}>{chemicals.length}</Text>
            <Text style={styles.summaryLabel}>{t(lang, 'chemicals')}</Text>
          </View>
          <View style={[styles.summaryCard, Shadow.sm]}>
            <Text style={styles.summaryNum}>{wetBlue.length}</Text>
            <Text style={styles.summaryLabel}>{t(lang, 'wetBlue')}</Text>
          </View>
          {isDirector && (
            <View style={[styles.summaryCard, Shadow.sm]}>
              <Text style={styles.summaryNum}>
                {formatUSD(inventory.filter(i => i.type !== 'Finished Leather').reduce((s, i) => s + toUSD(i.qty * i.price, i.currency, settings.exchangeRates), 0))}
              </Text>
              <Text style={styles.summaryLabel}>{t(lang, 'inventoryValue')}</Text>
            </View>
          )}
        </View>

        {/* Leather Warehouse link */}
        <TouchableOpacity style={[styles.leatherLink, Shadow.sm]} onPress={() => router.push('/(main)/leather')}>
          <Ionicons name="layers-outline" size={20} color={Colors.primary} />
          <Text style={styles.leatherLinkText}>{t(lang, 'leather')}</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.leatherLinkCount}>
            {inventory.filter((i) => i.type === 'Finished Leather' && i.qty > 0).length} items
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Section: Chemicals */}
        {chemicals.length > 0 && (
          <View style={styles.sectionRow}>
            <SectionHeader icon="🧪" title={t(lang, 'chemicals')} />
            {isDirector && (
              <TouchableOpacity
                style={styles.pdfBtn}
                onPress={() => downloadChemicalPDF(inventory, settings)}
              >
                <Ionicons name="download-outline" size={14} color={Colors.primary} />
                <Text style={styles.pdfBtnText}>{t(lang, 'downloadPdf')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {chemicals.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            isEmpty={item.qty === 0}
            isLow={item.qty > 0 && item.qty <= threshold}
            isDirector={isDirector}
            lang={lang}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onAddStock={() => openModal('addStock', item)}
            onEditUnit={() => openModal('editUnit', item)}
            onEditPrice={() => openModal('editPrice', item)}
            onDelete={() => deleteInventoryItem(item.id)}
          />
        ))}

        {/* Section: Wet Blue */}
        {wetBlue.length > 0 && (
          <SectionHeader icon="🐄" title={t(lang, 'wetBlue')} />
        )}
        {wetBlue.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            isEmpty={item.qty === 0}
            isLow={item.qty > 0 && item.qty <= threshold}
            isDirector={isDirector}
            lang={lang}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onAddStock={() => openModal('addStock', item)}
            onEditUnit={() => openModal('editUnit', item)}
            onEditPrice={() => openModal('editPrice', item)}
            onDelete={() => deleteInventoryItem(item.id)}
          />
        ))}

        {filtered.length === 0 && (
          <Text style={styles.emptyText}>{t(lang, 'noItems')}</Text>
        )}
      </ScrollView>

      {/* FAB row */}
      <View style={[styles.fabRow, { bottom: Spacing.xl + insets.bottom }]}>
        <TouchableOpacity style={styles.fabSecondary} onPress={() => openModal('addLeather')}>
          <Ionicons name="layers-outline" size={18} color={Colors.primary} />
          <Text style={styles.fabSecondaryText}>{t(lang, 'addFinishedLeather')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fab} onPress={() => openModal('addItem')}>
          <Ionicons name="add" size={22} color={Colors.surface} />
          <Text style={styles.fabText}>{t(lang, 'addItem')}</Text>
        </TouchableOpacity>
      </View>

      {/* Add Item Modal */}
      <FormModal
        visible={modal === 'addItem'}
        title={t(lang, 'addItem')}
        onClose={() => setModal(null)}
        onSave={handleAddItem}
        saveLabel={t(lang, 'add')}
        lang={lang}
      >
        <FieldLabel label={t(lang, 'itemName')} />
        <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder={t(lang, 'itemName')} />
        <FieldLabel label={t(lang, 'itemType')} />
        <View style={styles.segmentRow}>
          {(['Chemical', 'Wet Blue'] as ItemType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.segment, formType === type && styles.segmentActive]}
              onPress={() => {
                setFormType(type);
                setFormUnit(type === 'Wet Blue' ? 'pcs' : 'kg');
              }}
            >
              <Text style={[styles.segmentText, formType === type && styles.segmentTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FieldLabel label={t(lang, 'unit')} />
        <TextInput style={styles.input} value={formUnit} onChangeText={setFormUnit} placeholder="kg" />
        <FieldLabel label={t(lang, 'quantity')} />
        <TextInput style={styles.input} value={formQty} onChangeText={setFormQty} keyboardType="decimal-pad" placeholder="0" />
        {isDirector && (
          <>
            <FieldLabel label={t(lang, 'price')} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formPrice} onChangeText={setFormPrice} keyboardType="decimal-pad" placeholder="0.00" />
              <CurrencyPicker value={formCurrency} onChange={setFormCurrency} />
            </View>
          </>
        )}
      </FormModal>

      {/* Add Stock Modal */}
      <FormModal
        visible={modal === 'addStock'}
        title={`${t(lang, 'addStock')}: ${selectedItem?.name}`}
        onClose={() => setModal(null)}
        onSave={handleAddStock}
        saveLabel={t(lang, 'add')}
        lang={lang}
      >
        <FieldLabel label={t(lang, 'quantity')} />
        <TextInput style={styles.input} value={formQty} onChangeText={setFormQty} keyboardType="decimal-pad" placeholder="0" autoFocus />
        {isDirector && (
          <>
            <FieldLabel label={t(lang, 'price')} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formPrice} onChangeText={setFormPrice} keyboardType="decimal-pad" placeholder="0.00" />
              <CurrencyPicker value={formCurrency} onChange={setFormCurrency} />
            </View>
          </>
        )}
      </FormModal>

      {/* Edit Unit Modal */}
      <FormModal
        visible={modal === 'editUnit'}
        title={t(lang, 'editUnit')}
        onClose={() => setModal(null)}
        onSave={handleEditUnit}
        saveLabel={t(lang, 'save')}
        lang={lang}
      >
        <FieldLabel label={t(lang, 'unit')} />
        <TextInput style={styles.input} value={formUnit} onChangeText={setFormUnit} autoFocus />
      </FormModal>

      {/* Edit Price Modal */}
      <FormModal
        visible={modal === 'editPrice'}
        title={t(lang, 'editPrice')}
        onClose={() => setModal(null)}
        onSave={handleEditPrice}
        saveLabel={t(lang, 'save')}
        lang={lang}
      >
        <FieldLabel label={t(lang, 'price')} />
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1 }]} value={formPrice} onChangeText={setFormPrice} keyboardType="decimal-pad" autoFocus />
          <CurrencyPicker value={formCurrency} onChange={setFormCurrency} />
        </View>
      </FormModal>

      {/* Add Finished Leather Modal */}
      <FormModal
        visible={modal === 'addLeather'}
        title={t(lang, 'addFinishedLeather')}
        onClose={() => setModal(null)}
        onSave={handleAddLeather}
        saveLabel={t(lang, 'add')}
        lang={lang}
      >
        <FieldLabel label={t(lang, 'itemName')} />
        <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder={t(lang, 'itemName')} />
        <FieldLabel label={`${t(lang, 'quantity')} (dm²)`} />
        <TextInput style={styles.input} value={formQty} onChangeText={setFormQty} keyboardType="decimal-pad" placeholder="0" />
        {isDirector && (
          <>
            <FieldLabel label={t(lang, 'price')} />
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formPrice} onChangeText={setFormPrice} keyboardType="decimal-pad" placeholder="0.00" />
              <CurrencyPicker value={formCurrency} onChange={setFormCurrency} />
            </View>
          </>
        )}
      </FormModal>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ItemCard({
  item, isExpanded, isEmpty, isLow, isDirector, lang,
  onPress, onAddStock, onEditUnit, onEditPrice, onDelete,
}: {
  item: InventoryItem; isExpanded: boolean; isEmpty: boolean; isLow: boolean; isDirector: boolean; lang: Language;
  onPress: () => void; onAddStock: () => void; onEditUnit: () => void; onEditPrice: () => void; onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <TouchableOpacity
      style={[styles.itemCard, Shadow.sm, isEmpty ? styles.itemCardEmpty : isLow && styles.itemCardLow]}
      onPress={() => { setConfirmDelete(false); onPress(); }}
      activeOpacity={0.8}
    >
      <View style={styles.itemRow}>
        <View style={styles.itemIdBadge}>
          <Text style={styles.itemId}>{item.id}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={[styles.itemQty, isEmpty && styles.itemQtyEmpty]}>
            {item.qty} {item.unit}
          </Text>
        </View>
        {isEmpty ? (
          <View style={styles.emptyBadge}>
            <Text style={styles.emptyBadgeText}>{t(lang, 'outOfStock')}</Text>
          </View>
        ) : isLow && (
          <View style={styles.lowBadge}>
            <Text style={styles.lowBadgeText}>{t(lang, 'lowStock')}</Text>
          </View>
        )}
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
      </View>

      {isExpanded && (
        <View style={styles.expandedArea}>
          {isDirector && (
            <Text style={styles.itemDetail}>{t(lang, 'price')}: ${item.price.toFixed(2)} / {item.unit} ({item.currency})</Text>
          )}
          {confirmDelete ? (
            <View style={styles.confirmRow}>
              <Text style={styles.confirmText}>{t(lang, 'confirmDelete')}</Text>
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmDelete(false)}>
                  <Text style={styles.confirmCancelText}>{t(lang, 'no')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmDeleteBtn} onPress={onDelete}>
                  <Text style={styles.confirmDeleteText}>{t(lang, 'yes')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <ActionBtn label={t(lang, 'addStock')} icon="add-circle-outline" onPress={onAddStock} />
              {isDirector && (
                <>
                  <ActionBtn label={t(lang, 'editPrice')} icon="pricetag-outline" onPress={onEditPrice} />
                  <ActionBtn label={t(lang, 'deleteItem')} icon="trash-outline" onPress={() => setConfirmDelete(true)} color={Colors.error} />
                </>
              )}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function ActionBtn({ label, icon, onPress, color = Colors.primary }: { label: string; icon: string; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FormModal({ visible, title, onClose, onSave, saveLabel, lang, children }: {
  visible: boolean; title: string; onClose: () => void; onSave: () => void; saveLabel: string; lang: Language; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <ScrollView style={styles.modalCard} contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveBtnText}>{saveLabel}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function CurrencyPicker({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <View style={styles.currencyRow}>
      {CURRENCIES.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.currBtn, value === c && styles.currBtnActive]}
          onPress={() => onChange(c)}
        >
          <Text style={[styles.currText, value === c && styles.currTextActive]}>{c}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: Spacing.lg, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text },
  scroll: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  summaryNum: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  leatherLink: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: Colors.primary },
  leatherLinkText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  leatherLinkCount: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary + '50' },
  pdfBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },
  sectionIcon: { fontSize: FontSize.md },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  itemCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md },
  itemCardLow: { borderWidth: 1, borderColor: Colors.error + '60' },
  itemCardEmpty: { borderWidth: 1.5, borderColor: Colors.error },
  itemQtyEmpty: { color: Colors.error },
  emptyBadge: { backgroundColor: Colors.error, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  emptyBadgeText: { fontSize: FontSize.xs, color: Colors.surface, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  itemIdBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  itemId: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  itemName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  itemQty: { fontSize: FontSize.sm, color: Colors.textSecondary },
  lowBadge: { backgroundColor: Colors.errorLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  lowBadgeText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
  expandedArea: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm },
  itemDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  actionBtnText: { fontSize: FontSize.xs, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xxl },
  fabRow: { position: 'absolute', bottom: Spacing.xl, right: Spacing.lg, left: Spacing.lg, flexDirection: 'row', gap: Spacing.sm, justifyContent: 'flex-end' },
  fab: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...Shadow.md },
  fabText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
  fabSecondary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.full, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderWidth: 1.5, borderColor: Colors.primary, ...Shadow.sm },
  fabSecondaryText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md, maxHeight: '90%' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.background },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segment: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  segmentActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  segmentText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  segmentTextActive: { color: Colors.primary },
  currencyRow: { flexDirection: 'row', gap: 4 },
  currBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  currBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  currText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  currTextActive: { color: Colors.primary },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
  confirmRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md, gap: Spacing.sm },
  confirmText: { fontSize: FontSize.sm, color: Colors.text },
  confirmBtns: { flexDirection: 'row', gap: Spacing.sm },
  confirmCancel: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  confirmCancelText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  confirmDeleteBtn: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.error },
  confirmDeleteText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '700' },
});
