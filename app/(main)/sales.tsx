import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { formatUSD, toUSD } from '../../utils/currency';
import { downloadSalesPDF } from '../../utils/pdf';
import { Currency, InventoryItem, PaymentStatus, Sale, SaleType } from '../../types';

const CURRENCIES: Currency[] = ['USD', 'UZS'];
type SaleFilter = 'all' | SaleType;
type SortMode = 'newest' | 'oldest' | 'az' | 'za';

export default function SalesScreen() {
  const {
    inventory, sales, buyers: allBuyers, settings, role,
    addSale, deleteSale, updateSalePrice, updateSalePayment,
  } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // list state
  const [typeFilter, setTypeFilter] = useState<SaleFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  // new sale modal
  const [showNewSale, setShowNewSale] = useState(false);
  const [saleType, setSaleType] = useState<SaleType>('leather');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [buyer, setBuyer] = useState('');
  const [buyerFocused, setBuyerFocused] = useState(false);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paidAmount, setPaidAmount] = useState('');
  const [showItemPicker, setShowItemPicker] = useState(false);

  // set price modal (director only)
  const [setPriceSale, setSetPriceSale] = useState<Sale | null>(null);
  const [setPriceVal, setSetPriceVal] = useState('');
  const [setPriceCurrency, setSetPriceCurrency] = useState<Currency>('USD');

  // edit payment modal (director only)
  const [editPaySale, setEditPaySale] = useState<Sale | null>(null);
  const [editPayStatus, setEditPayStatus] = useState<PaymentStatus>('paid');
  const [editPaidAmount, setEditPaidAmount] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editSaleCurrency, setEditSaleCurrency] = useState<Currency>('USD');

  const finishedLeather = inventory.filter((i) => i.type === 'Finished Leather' && i.qty > 0);
  const chemicals = inventory.filter((i) => i.type === 'Chemical' && i.qty > 0);
  const pickerItems = saleType === 'leather' ? finishedLeather : chemicals;

  const filteredSales = useMemo(() => {
    let list = typeFilter === 'all' ? sales.slice() : sales.filter((s) => (s.saleType ?? 'leather') === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((s) => s.buyer.toLowerCase().includes(q) || (inventory.find((i) => i.id === s.inventoryId)?.name ?? '').toLowerCase().includes(q));
    }
    switch (sortMode) {
      case 'newest': list.sort((a, b) => b.date.localeCompare(a.date)); break;
      case 'oldest': list.sort((a, b) => a.date.localeCompare(b.date)); break;
      case 'az': list.sort((a, b) => a.buyer.localeCompare(b.buyer)); break;
      case 'za': list.sort((a, b) => b.buyer.localeCompare(a.buyer)); break;
    }
    return list;
  }, [sales, typeFilter, searchQuery, sortMode, inventory]);

  const pendingPricingSales = sales.filter((s) => s.needsPricing);

  const buyerSuggestions = useMemo(() => {
    if (!buyer.trim() || !buyerFocused) return [];
    const q = buyer.toLowerCase();
    return allBuyers.filter((b) => b.name.toLowerCase().includes(q)).slice(0, 5);
  }, [buyer, buyerFocused, allBuyers]);

  const totalRevenue = filteredSales.reduce(
    (sum, s) =>
      sum + (s.needsPricing ? 0 : toUSD(s.qty * s.price, s.currency, settings.exchangeRates)),
    0,
  );

  const SORT_OPTIONS: { key: SortMode; label: string }[] = [
    { key: 'newest', label: t(lang, 'sortNewest') },
    { key: 'oldest', label: t(lang, 'sortOldest') },
    { key: 'az', label: t(lang, 'sortAZ') },
    { key: 'za', label: t(lang, 'sortZA') },
  ];

  function resetForm() {
    setSaleType('leather');
    setSelectedItem(null);
    setQty('');
    setPrice('');
    setCurrency('USD');
    setBuyer('');
    setBuyerFocused(false);
    setSaleDate(new Date().toISOString().split('T')[0]);
    setPaymentStatus('paid');
    setPaidAmount('');
  }

  function handleSave() {
    if (!selectedItem || !qty || !buyer.trim()) return;
    const qtyNum = parseFloat(qty);
    if (isNaN(qtyNum) || qtyNum <= 0 || qtyNum > selectedItem.qty) return;
    if (isDirector && !price) return;

    addSale({
      batchId: selectedItem.batchId ?? null,
      inventoryId: selectedItem.id,
      grade: selectedItem.grade ?? '',
      qty: qtyNum,
      price: isDirector ? parseFloat(price) : 0,
      currency,
      buyer: buyer.trim(),
      date: saleDate,
      saleType,
      paymentStatus: isDirector ? paymentStatus : 'paid',
      paidAmount:
        isDirector && paymentStatus === 'partial' && paidAmount
          ? parseFloat(paidAmount)
          : undefined,
      needsPricing: !isDirector,
    });
    setShowNewSale(false);
    resetForm();
  }

  function handleSetPrice() {
    if (!setPriceSale || !setPriceVal) return;
    updateSalePrice(setPriceSale.id, parseFloat(setPriceVal), setPriceCurrency);
    setSetPriceSale(null);
    setSetPriceVal('');
  }

  function openEditPayment(sale: Sale) {
    setEditPaySale(sale);
    setEditPayStatus(sale.paymentStatus ?? 'paid');
    setEditPaidAmount(sale.paidAmount ? String(sale.paidAmount) : '');
    setEditSalePrice(String(sale.price));
    setEditSaleCurrency(sale.currency);
  }

  function handleEditPayment() {
    if (!editPaySale) return;
    const newPrice = parseFloat(editSalePrice);
    if (!isNaN(newPrice) && (newPrice !== editPaySale.price || editSaleCurrency !== editPaySale.currency)) {
      updateSalePrice(editPaySale.id, newPrice, editSaleCurrency);
    }
    updateSalePayment(
      editPaySale.id,
      editPayStatus,
      editPayStatus === 'partial' && editPaidAmount ? parseFloat(editPaidAmount) : undefined,
    );
    setEditPaySale(null);
  }

  const canSave = !!(selectedItem && qty && buyer.trim() && (!isDirector || price));
  const totalPreview =
    isDirector && qty && price
      ? toUSD(parseFloat(qty) * parseFloat(price), currency, settings.exchangeRates)
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>

      {/* Search + Sort bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchRow}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, sortMode === opt.key && styles.sortChipActive]}
              onPress={() => setSortMode(opt.key)}
            >
              <Text style={[styles.sortChipText, sortMode === opt.key && styles.sortChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Pending pricing banner — director only */}
      {isDirector && pendingPricingSales.length > 0 && (
        <TouchableOpacity
          style={styles.pendingBanner}
          onPress={() => {
            const first = pendingPricingSales[0];
            setSetPriceSale(first);
            setSetPriceCurrency('USD');
            setSetPriceVal('');
          }}
        >
          <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
          <Text style={styles.pendingBannerText}>
            {pendingPricingSales.length} {t(lang, 'pendingPricing')} — {t(lang, 'setPrice')}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.warning} />
        </TouchableOpacity>
      )}

      {/* Buyers link + PDF download — director only */}
      {isDirector && (
        <View style={styles.directorRow}>
          <TouchableOpacity style={styles.buyersLink} onPress={() => router.push('/(main)/buyers')}>
            <Ionicons name="people-outline" size={16} color={Colors.primary} />
            <Text style={styles.buyersLinkText}>{t(lang, 'buyers')}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </TouchableOpacity>
          {sales.length > 0 && (
            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={() => downloadSalesPDF(sales, inventory, settings)}
            >
              <Ionicons name="download-outline" size={14} color={Colors.primary} />
              <Text style={styles.pdfBtnText}>{t(lang, 'downloadPdf')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Type filter tabs */}
      <View style={styles.tabRow}>
        {(['all', 'leather', 'chemical'] as SaleFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, typeFilter === f && styles.tabActive]}
            onPress={() => setTypeFilter(f)}
          >
            <Text style={[styles.tabText, typeFilter === f && styles.tabTextActive]}>
              {f === 'all'
                ? t(lang, 'allSales')
                : f === 'leather'
                  ? t(lang, 'leatherSales')
                  : t(lang, 'chemSales')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Revenue card — director only */}
      {isDirector && (
        <View style={[styles.revenueCard, Shadow.sm]}>
          <Text style={styles.revenueLabel}>{t(lang, 'salesRevenue')}</Text>
          <Text style={styles.revenueValue}>{formatUSD(totalRevenue)}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {filteredSales.length === 0 && (
          <Text style={styles.emptyText}>{t(lang, 'noSales')}</Text>
        )}
        {filteredSales.map((sale) => {
          const item = inventory.find((i) => i.id === sale.inventoryId);
          const isChemSale = (sale.saleType ?? 'leather') === 'chemical';
          const isConfirming = confirmDeleteId === sale.id;

          return (
            <View key={sale.id} style={[styles.saleCard, Shadow.sm]}>
              <View style={styles.saleHeader}>
                <View style={{ flex: 1 }}>
                  <View style={styles.saleNameRow}>
                    <Text style={styles.saleName}>{item?.name ?? sale.inventoryId}</Text>
                    <View style={[styles.typeBadge, isChemSale && styles.typeBadgeChem]}>
                      <Text style={[styles.typeBadgeText, isChemSale && styles.typeBadgeTextChem]}>
                        {isChemSale ? t(lang, 'chemSales') : t(lang, 'leatherSales')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.saleDate}>{sale.date} · {sale.buyer}</Text>
                </View>
                {!isConfirming && isDirector && (
                  <TouchableOpacity onPress={() => setConfirmDeleteId(sale.id)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              {sale.needsPricing ? (
                <>
                  <Text style={styles.saleDetail}>{sale.qty} {item?.unit ?? 'dm²'}</Text>
                  {isDirector && (
                    <>
                      <Text style={styles.needsPricingText}>{t(lang, 'workerSaleNote')}</Text>
                      <TouchableOpacity
                        style={styles.setPriceBtn}
                        onPress={() => {
                          setSetPriceSale(sale);
                          setSetPriceCurrency('USD');
                          setSetPriceVal('');
                        }}
                      >
                        <Ionicons name="pricetag-outline" size={14} color={Colors.primary} />
                        <Text style={styles.setPriceBtnText}>{t(lang, 'setPrice')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.saleDetails}>
                    {isDirector ? (
                      <>
                        <Text style={styles.saleDetail}>
                          {sale.qty} {item?.unit ?? 'dm²'} × {sale.currency} {sale.price.toFixed(2)}
                        </Text>
                        <Text style={styles.saleTotal}>
                          {formatUSD(
                            toUSD(sale.qty * sale.price, sale.currency, settings.exchangeRates),
                          )}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.saleDetail}>{sale.qty} {item?.unit ?? 'dm²'}</Text>
                    )}
                  </View>
                  {isDirector && (
                    <View style={styles.paymentRow}>
                      <View style={[
                        styles.paymentBadge,
                        sale.paymentStatus === 'partial' && styles.paymentBadgePartial,
                      ]}>
                        <Text style={[
                          styles.paymentBadgeText,
                          sale.paymentStatus === 'partial' && styles.paymentBadgeTextPartial,
                        ]}>
                          {sale.paymentStatus === 'partial' ? t(lang, 'partial') : t(lang, 'paid')}
                        </Text>
                      </View>
                      {sale.paymentStatus === 'partial' && sale.paidAmount !== undefined && (
                        <Text style={styles.paidAmountText}>
                          {t(lang, 'paidAmount')}: {formatUSD(
                            toUSD(sale.paidAmount, sale.currency, settings.exchangeRates),
                          )}
                        </Text>
                      )}
                      <TouchableOpacity
                        style={styles.editPayBtn}
                        onPress={() => openEditPayment(sale)}
                      >
                        <Ionicons name="pencil-outline" size={13} color={Colors.primary} />
                        <Text style={styles.editPayBtnText}>{t(lang, 'edit')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* Inline delete confirmation */}
              {isConfirming && (
                <View style={styles.confirmRow}>
                  <Text style={styles.confirmText}>{t(lang, 'confirmDeleteSale')}</Text>
                  <View style={styles.confirmBtns}>
                    <TouchableOpacity
                      style={styles.confirmCancel}
                      onPress={() => setConfirmDeleteId(null)}
                    >
                      <Text style={styles.confirmCancelText}>{t(lang, 'no')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.confirmDelete}
                      onPress={() => {
                        deleteSale(sale.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      <Text style={styles.confirmDeleteText}>{t(lang, 'yes')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: Spacing.xl + insets.bottom }]} onPress={() => setShowNewSale(true)}>
        <Ionicons name="add" size={22} color={Colors.surface} />
        <Text style={styles.fabText}>{t(lang, 'newSale')}</Text>
      </TouchableOpacity>

      {/* ── New Sale Modal ── */}
      <Modal visible={showNewSale} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalSheet}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>{t(lang, 'newSale')}</Text>

            {/* Sale type toggle */}
            <View style={styles.segmentRow}>
              {(['leather', 'chemical'] as SaleType[]).map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[styles.segmentBtn, saleType === st && styles.segmentBtnActive]}
                  onPress={() => { setSaleType(st); setSelectedItem(null); }}
                >
                  <Text style={[styles.segmentText, saleType === st && styles.segmentTextActive]}>
                    {st === 'leather' ? t(lang, 'leatherSales') : t(lang, 'chemSales')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Item picker */}
            <Text style={styles.fieldLabel}>
              {saleType === 'leather' ? t(lang, 'selectLeather') : t(lang, 'selectChemItem')}
            </Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowItemPicker(true)}>
              <Text style={selectedItem ? styles.pickerSelected : styles.pickerPlaceholder} numberOfLines={1}>
                {selectedItem
                  ? `${selectedItem.name} (${selectedItem.qty} ${selectedItem.unit})`
                  : t(lang, 'selectLeather')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Quantity */}
            <Text style={styles.fieldLabel}>
              {t(lang, 'quantity')} ({selectedItem?.unit ?? (saleType === 'leather' ? 'dm²' : 'kg')})
            </Text>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              keyboardType="decimal-pad"
              placeholder="0"
            />

            {/* Price — director only */}
            {isDirector && (
              <>
                <Text style={styles.fieldLabel}>
                  {t(lang, 'price')} / {selectedItem?.unit ?? 'unit'}
                </Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                  />
                  <View style={styles.currencyRow}>
                    {CURRENCIES.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.currBtn, currency === c && styles.currBtnActive]}
                        onPress={() => setCurrency(c)}
                      >
                        <Text style={[styles.currText, currency === c && styles.currTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {totalPreview > 0 && (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>{t(lang, 'totalValue')}</Text>
                    <Text style={styles.previewValue}>{formatUSD(totalPreview)}</Text>
                  </View>
                )}
              </>
            )}

            {/* Buyer with autocomplete */}
            <Text style={styles.fieldLabel}>{t(lang, 'buyerName')}</Text>
            <View>
              <TextInput
                style={styles.input}
                value={buyer}
                onChangeText={setBuyer}
                onFocus={() => setBuyerFocused(true)}
                onBlur={() => setTimeout(() => setBuyerFocused(false), 150)}
                placeholder={t(lang, 'buyerName')}
              />
              {buyerSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {buyerSuggestions.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={styles.suggestionItem}
                      onPress={() => { setBuyer(b.name); setBuyerFocused(false); }}
                    >
                      <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.suggestionText}>{b.name}</Text>
                      {b.company ? <Text style={styles.suggestionSub}>{b.company}</Text> : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Date */}
            <Text style={styles.fieldLabel}>{t(lang, 'date')}</Text>
            <TextInput
              style={styles.input}
              value={saleDate}
              onChangeText={setSaleDate}
              placeholder="YYYY-MM-DD"
            />

            {/* Payment status — director only */}
            {isDirector && (
              <>
                <Text style={styles.fieldLabel}>{t(lang, 'paymentStatus')}</Text>
                <View style={styles.row}>
                  {(['paid', 'partial'] as PaymentStatus[]).map((ps) => (
                    <TouchableOpacity
                      key={ps}
                      style={[styles.segmentBtn, paymentStatus === ps && styles.segmentBtnActive]}
                      onPress={() => setPaymentStatus(ps)}
                    >
                      <Text style={[styles.segmentText, paymentStatus === ps && styles.segmentTextActive]}>
                        {ps === 'paid' ? t(lang, 'paid') : t(lang, 'partial')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {paymentStatus === 'partial' && (
                  <>
                    <Text style={styles.fieldLabel}>{t(lang, 'paidAmount')} ({currency})</Text>
                    <TextInput
                      style={styles.input}
                      value={paidAmount}
                      onChangeText={setPaidAmount}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </>
                )}
              </>
            )}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowNewSale(false); resetForm(); }}
              >
                <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!canSave}
              >
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Item Picker Modal ── */}
      <Modal visible={showItemPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>
              {saleType === 'leather' ? t(lang, 'selectLeather') : t(lang, 'selectChemItem')}
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {pickerItems.length === 0 && (
                <Text style={[styles.emptyText, { marginTop: Spacing.lg }]}>
                  {t(lang, 'noItems')}
                </Text>
              )}
              {pickerItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.pickerItem}
                  onPress={() => { setSelectedItem(item); setShowItemPicker(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemName}>{item.name}</Text>
                    <Text style={styles.pickerItemDetail}>{item.qty} {item.unit}</Text>
                  </View>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={selectedItem?.id === item.id ? Colors.primary : Colors.border}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowItemPicker(false)}>
              <Text style={styles.saveBtnText}>{t(lang, 'close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Edit Payment Modal (director) ── */}
      <Modal visible={!!editPaySale} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>{t(lang, 'paymentStatus')}</Text>
            {editPaySale && (() => {
              const saleItem = inventory.find((i) => i.id === editPaySale.inventoryId);
              return (
                <>
                  <Text style={styles.pickerItemName}>{saleItem?.name ?? editPaySale.inventoryId}</Text>
                  <Text style={styles.pickerItemDetail}>
                    {editPaySale.buyer} · {editPaySale.date}
                  </Text>

                  <Text style={styles.fieldLabel}>
                    {t(lang, 'price')} / {saleItem?.unit ?? 'unit'}
                  </Text>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={editSalePrice}
                      onChangeText={setEditSalePrice}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                    <View style={styles.currencyRow}>
                      {CURRENCIES.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.currBtn, editSaleCurrency === c && styles.currBtnActive]}
                          onPress={() => setEditSaleCurrency(c)}
                        >
                          <Text style={[styles.currText, editSaleCurrency === c && styles.currTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>{t(lang, 'paymentStatus')}</Text>
                  <View style={styles.segmentRow}>
                    {(['paid', 'partial'] as PaymentStatus[]).map((ps) => (
                      <TouchableOpacity
                        key={ps}
                        style={[styles.segmentBtn, editPayStatus === ps && styles.segmentBtnActive]}
                        onPress={() => setEditPayStatus(ps)}
                      >
                        <Text style={[styles.segmentText, editPayStatus === ps && styles.segmentTextActive]}>
                          {ps === 'paid' ? t(lang, 'paid') : t(lang, 'partial')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {editPayStatus === 'partial' && (
                    <>
                      <Text style={styles.fieldLabel}>{t(lang, 'paidAmount')} ({editSaleCurrency})</Text>
                      <TextInput
                        style={styles.input}
                        value={editPaidAmount}
                        onChangeText={setEditPaidAmount}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                      />
                    </>
                  )}
                </>
              );
            })()}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditPaySale(null)}>
                <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleEditPayment}>
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Set Price Modal (director) ── */}
      <Modal visible={!!setPriceSale} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.modalTitle}>{t(lang, 'setPrice')}</Text>
            {setPriceSale && (() => {
              const saleItem = inventory.find((i) => i.id === setPriceSale.inventoryId);
              return (
                <>
                  <Text style={styles.pickerItemName}>{saleItem?.name ?? setPriceSale.inventoryId}</Text>
                  <Text style={styles.pickerItemDetail}>
                    {setPriceSale.qty} {saleItem?.unit ?? 'dm²'} · {setPriceSale.buyer} · {setPriceSale.date}
                  </Text>

                  <Text style={[styles.fieldLabel, { marginTop: Spacing.sm }]}>
                    {t(lang, 'price')} / {saleItem?.unit ?? 'unit'}
                  </Text>
                  <View style={styles.row}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={setPriceVal}
                      onChangeText={setSetPriceVal}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      autoFocus
                    />
                    <View style={styles.currencyRow}>
                      {CURRENCIES.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.currBtn, setPriceCurrency === c && styles.currBtnActive]}
                          onPress={() => setSetPriceCurrency(c)}
                        >
                          <Text style={[styles.currText, setPriceCurrency === c && styles.currTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {pendingPricingSales.length > 1 && (
                    <Text style={styles.pendingMoreText}>
                      +{pendingPricingSales.length - 1} {t(lang, 'pendingPricing')}
                    </Text>
                  )}
                </>
              );
            })()}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setSetPriceSale(null); setSetPriceVal(''); }}
              >
                <Text style={styles.cancelBtnText}>{t(lang, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !setPriceVal && styles.saveBtnDisabled]}
                onPress={handleSetPrice}
                disabled={!setPriceVal}
              >
                <Text style={styles.saveBtnText}>{t(lang, 'save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  searchBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.background, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 2 },
  sortRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.xs },
  sortChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.background },
  sortChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  sortChipText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  sortChipTextActive: { color: Colors.primary },
  suggestions: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, zIndex: 100, ...Shadow.sm },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  suggestionText: { fontSize: FontSize.md, color: Colors.text, flex: 1 },
  suggestionSub: { fontSize: FontSize.xs, color: Colors.textMuted },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.warningLight, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pendingBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600' },

  directorRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  buyersLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  buyersLinkText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, marginRight: Spacing.md, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary + '50' },
  pdfBtnText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600' },

  tabRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, gap: Spacing.sm },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  tabTextActive: { color: Colors.surface },

  revenueCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: Radius.lg, padding: Spacing.lg },
  revenueLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  revenueValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.success },

  scroll: { padding: Spacing.lg, gap: Spacing.sm },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xxl },

  saleCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  saleHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  saleNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  saleName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  typeBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.primaryLight },
  typeBadgeChem: { backgroundColor: Colors.warningLight },
  typeBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  typeBadgeTextChem: { color: Colors.warning },
  saleDate: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  saleDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saleDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  saleTotal: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },
  needsPricingText: { fontSize: FontSize.sm, color: Colors.warning, fontStyle: 'italic' },

  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  paymentBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.successLight },
  paymentBadgePartial: { backgroundColor: Colors.warningLight },
  paymentBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.success },
  paymentBadgeTextPartial: { color: Colors.warning },
  paidAmountText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  setPriceBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary },
  setPriceBtnText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },

  confirmRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, gap: Spacing.sm },
  confirmText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  confirmBtns: { flexDirection: 'row', gap: Spacing.sm },
  confirmCancel: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  confirmCancelText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  confirmDelete: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.error },
  confirmDeleteText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '700' },

  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...Shadow.md },
  fabText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '92%' },
  modalContent: { padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },

  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segmentBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  segmentBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  segmentTextActive: { color: Colors.surface },

  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.background },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  currencyRow: { flexDirection: 'row', gap: 4 },
  currBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border },
  currBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  currText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  currTextActive: { color: Colors.primary },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.successLight, padding: Spacing.md, borderRadius: Radius.md },
  previewLabel: { fontSize: FontSize.sm, color: Colors.success },
  previewValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.success },

  modalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: Colors.surface, fontWeight: '700' },

  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.md, backgroundColor: Colors.background },
  pickerPlaceholder: { fontSize: FontSize.md, color: Colors.textMuted, flex: 1 },
  pickerSelected: { fontSize: FontSize.md, color: Colors.text, flex: 1 },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing.xl },
  pickerCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerItemName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  pickerItemDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  pendingMoreText: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', fontStyle: 'italic' },
  editPayBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.primary, marginLeft: 'auto' },
  editPayBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
});
