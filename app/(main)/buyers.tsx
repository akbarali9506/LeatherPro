import { useEffect, useState } from 'react';
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
import { downloadBuyerPDF } from '../../utils/pdf';
import { Buyer } from '../../types';

export default function BuyersScreen() {
  const { buyers, sales, inventory, settings, role, addBuyer, updateBuyer, deleteBuyer, updateSalePayment } = useApp();
  const lang = settings.language;
  const rates = settings.exchangeRates;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (role !== null && role !== 'director') {
      router.replace('/(main)/dashboard');
    }
  }, [role, router]);

  if (role !== 'director') return null;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editBuyer, setEditBuyer] = useState<Buyer | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');

  function openAdd() {
    setEditBuyer(null);
    setFormName('');
    setFormCompany('');
    setFormPhone('');
    setFormEmail('');
    setFormNotes('');
    setShowForm(true);
  }

  function openEdit(buyer: Buyer) {
    setEditBuyer(buyer);
    setFormName(buyer.name);
    setFormCompany(buyer.company);
    setFormPhone(buyer.phone);
    setFormEmail(buyer.email ?? '');
    setFormNotes(buyer.notes ?? '');
    setShowForm(true);
  }

  function handleSave() {
    if (!formName.trim() || !formCompany.trim() || !formPhone.trim()) return;
    const data = {
      name: formName.trim(),
      company: formCompany.trim(),
      phone: formPhone.trim(),
      email: formEmail.trim() || undefined,
      notes: formNotes.trim() || undefined,
    };
    if (editBuyer) {
      updateBuyer(editBuyer.id, data);
    } else {
      addBuyer(data);
    }
    setShowForm(false);
  }

  function buyerSales(buyer: Buyer) {
    return sales.filter((s) => s.buyer.toLowerCase() === buyer.name.toLowerCase());
  }

  function buyerTotalSpent(buyer: Buyer) {
    return buyerSales(buyer)
      .filter((s) => !s.needsPricing)
      .reduce((sum, s) => sum + toUSD(s.qty * s.price, s.currency, rates), 0);
  }

  function buyerOutstanding(buyer: Buyer) {
    return buyerSales(buyer)
      .filter((s) => s.paymentStatus === 'partial' && !s.needsPricing)
      .reduce((sum, s) => {
        const total = toUSD(s.qty * s.price, s.currency, rates);
        const paid = s.paidAmount ? toUSD(s.paidAmount, s.currency, rates) : 0;
        return sum + Math.max(0, total - paid);
      }, 0);
  }

  const canSave = !!(formName.trim() && formCompany.trim() && formPhone.trim());

  const incompleteBuyers = buyers.filter((b) => !b.company && !b.phone);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {incompleteBuyers.length > 0 && (
        <View style={styles.incompleteBanner}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.warning} />
          <Text style={styles.incompleteBannerText}>{t(lang, 'incompleteBuyersBanner')}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {buyers.length === 0 && (
          <Text style={styles.emptyText}>{t(lang, 'noBuyers')}</Text>
        )}

        {buyers.map((buyer) => {
          const bSales = buyerSales(buyer);
          const outstanding = buyerOutstanding(buyer);
          const totalSpent = buyerTotalSpent(buyer);
          const isExpanded = expandedId === buyer.id;
          const isConfirming = confirmDeleteId === buyer.id;

          return (
            <View key={buyer.id} style={[styles.buyerCard, Shadow.sm]}>
              <TouchableOpacity
                style={styles.buyerHeader}
                onPress={() => setExpandedId(isExpanded ? null : buyer.id)}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{buyer.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.buyerName}>{buyer.name}</Text>
                  <Text style={styles.buyerCompany}>{buyer.company || '—'}</Text>
                </View>
                {!buyer.company && !buyer.phone && (
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.warning} />
                )}
                {outstanding > 0 && (
                  <View style={styles.outstandingBadge}>
                    <Text style={styles.outstandingBadgeText}>{t(lang, 'outstanding')}</Text>
                  </View>
                )}
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.expanded}>
                  {/* Contact info */}
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.contactText}>{buyer.phone}</Text>
                  </View>
                  {buyer.email ? (
                    <View style={styles.contactRow}>
                      <Ionicons name="mail-outline" size={14} color={Colors.textMuted} />
                      <Text style={styles.contactText}>{buyer.email}</Text>
                    </View>
                  ) : null}
                  {buyer.notes ? (
                    <Text style={styles.notesText}>{buyer.notes}</Text>
                  ) : null}

                  {/* Financial summary */}
                  <View style={styles.financialRow}>
                    <View style={styles.financialItem}>
                      <Text style={styles.financialLabel}>{t(lang, 'totalPurchases')}</Text>
                      <Text style={styles.financialValue}>{formatUSD(totalSpent)}</Text>
                    </View>
                    {outstanding > 0 && (
                      <View style={styles.financialItem}>
                        <Text style={styles.financialLabel}>{t(lang, 'totalOwed')}</Text>
                        <Text style={[styles.financialValue, { color: Colors.error }]}>
                          {formatUSD(outstanding)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Purchase history */}
                  <Text style={styles.historyTitle}>
                    {t(lang, 'purchaseHistory')} ({bSales.length})
                  </Text>
                  {bSales.length === 0 ? (
                    <Text style={styles.historyEmpty}>{t(lang, 'noPurchaseHistory')}</Text>
                  ) : (
                    bSales.slice().reverse().map((sale) => {
                      const item = inventory.find((i) => i.id === sale.inventoryId);
                      return (
                        <View key={sale.id} style={styles.historyRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyItem}>{item?.name ?? sale.inventoryId}</Text>
                            <Text style={styles.historyDate}>{sale.date}</Text>
                          </View>
                          <View style={styles.historyRight}>
                            {sale.needsPricing ? (
                              <Text style={styles.pendingText}>{t(lang, 'pendingPricing')}</Text>
                            ) : (
                              <>
                                <Text style={styles.historyAmt}>
                                  {formatUSD(toUSD(sale.qty * sale.price, sale.currency, rates))}
                                </Text>
                                <View style={[
                                  styles.payBadge,
                                  sale.paymentStatus === 'partial' && styles.payBadgePartial,
                                ]}>
                                  <Text style={[
                                    styles.payBadgeText,
                                    sale.paymentStatus === 'partial' && styles.payBadgeTextPartial,
                                  ]}>
                                    {sale.paymentStatus === 'partial'
                                      ? t(lang, 'partial')
                                      : t(lang, 'paid')}
                                  </Text>
                                </View>
                                {sale.paymentStatus === 'partial' && (
                                  <TouchableOpacity
                                    style={styles.markPaidBtn}
                                    onPress={() => updateSalePayment(sale.id, 'paid')}
                                  >
                                    <Text style={styles.markPaidText}>{t(lang, 'markAsPaid')}</Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}

                  {/* Actions */}
                  {!isConfirming ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(buyer)}>
                        <Ionicons name="pencil-outline" size={14} color={Colors.primary} />
                        <Text style={styles.editBtnText}>{t(lang, 'edit')}</Text>
                      </TouchableOpacity>
                      {bSales.length > 0 && (
                        <TouchableOpacity
                          style={styles.pdfBtn}
                          onPress={() => downloadBuyerPDF(buyer, bSales, inventory, settings)}
                        >
                          <Ionicons name="download-outline" size={14} color={Colors.success} />
                          <Text style={styles.pdfBtnText}>{t(lang, 'downloadPdf')}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => setConfirmDeleteId(buyer.id)}
                      >
                        <Ionicons name="trash-outline" size={14} color={Colors.error} />
                        <Text style={styles.deleteBtnText}>{t(lang, 'delete')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.confirmRow}>
                      <Text style={styles.confirmText}>{t(lang, 'confirmDelete')}</Text>
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
                            deleteBuyer(buyer.id);
                            setConfirmDeleteId(null);
                            if (expandedId === buyer.id) setExpandedId(null);
                          }}
                        >
                          <Text style={styles.confirmDeleteText}>{t(lang, 'yes')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: Spacing.xl + insets.bottom }]} onPress={openAdd}>
        <Ionicons name="add" size={22} color={Colors.surface} />
        <Text style={styles.fabText}>{t(lang, 'addBuyer')}</Text>
      </TouchableOpacity>

      {/* Add / Edit Modal */}
      <Modal visible={showForm} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalSheet}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>
              {editBuyer ? t(lang, 'editBuyer') : t(lang, 'addBuyer')}
            </Text>

            <Text style={styles.fieldLabel}>{t(lang, 'buyer')}</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder={t(lang, 'buyer')}
            />

            <Text style={styles.fieldLabel}>{t(lang, 'buyerCompany')}</Text>
            <TextInput
              style={styles.input}
              value={formCompany}
              onChangeText={setFormCompany}
              placeholder={t(lang, 'buyerCompany')}
            />

            <Text style={styles.fieldLabel}>{t(lang, 'buyerPhone')}</Text>
            <TextInput
              style={styles.input}
              value={formPhone}
              onChangeText={setFormPhone}
              placeholder="+1 234 567 8900"
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>{t(lang, 'buyerEmail')}</Text>
            <TextInput
              style={styles.input}
              value={formEmail}
              onChangeText={setFormEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>{t(lang, 'buyerNotes')}</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={formNotes}
              onChangeText={setFormNotes}
              placeholder="..."
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.sm },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xxl },

  incompleteBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, margin: Spacing.lg, marginBottom: 0, padding: Spacing.md, backgroundColor: Colors.warningLight, borderRadius: Radius.md },
  incompleteBannerText: { flex: 1, fontSize: FontSize.sm, color: Colors.warning, fontWeight: '600' },

  buyerCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, overflow: 'hidden' },
  buyerHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  avatar: { width: 44, height: 44, borderRadius: Radius.full, backgroundColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  buyerName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  buyerCompany: { fontSize: FontSize.sm, color: Colors.textSecondary },
  outstandingBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.errorLight },
  outstandingBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.error },

  expanded: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  contactText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  notesText: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic', paddingLeft: Spacing.xl + Spacing.sm },

  financialRow: { flexDirection: 'row', gap: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, borderBottomWidth: 1, borderBottomColor: Colors.border, marginVertical: Spacing.xs },
  financialItem: { flex: 1 },
  financialLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  financialValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },

  historyTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  historyEmpty: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  historyItem: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  historyDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  historyRight: { alignItems: 'flex-end', gap: 4 },
  historyAmt: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.success },
  pendingText: { fontSize: FontSize.xs, color: Colors.warning, fontStyle: 'italic' },
  payBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full, backgroundColor: Colors.successLight },
  payBadgePartial: { backgroundColor: Colors.warningLight },
  payBadgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.success },
  payBadgeTextPartial: { color: Colors.warning },
  markPaidBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.success, marginTop: 2 },
  markPaidText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary },
  editBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  pdfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.success },
  pdfBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.success },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.error },
  deleteBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.error },

  confirmRow: { gap: Spacing.sm, marginTop: Spacing.xs },
  confirmText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  confirmBtns: { flexDirection: 'row', gap: Spacing.sm },
  confirmCancel: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  confirmCancelText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  confirmDelete: { flex: 1, padding: Spacing.sm, borderRadius: Radius.md, alignItems: 'center', backgroundColor: Colors.error },
  confirmDeleteText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '700' },

  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...Shadow.md },
  fabText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '90%' },
  modalContent: { padding: Spacing.xl, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  fieldLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.background },
  notesInput: { height: 80, textAlignVertical: 'top' },
  modalBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 2, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnDisabled: { backgroundColor: Colors.border },
  saveBtnText: { color: Colors.surface, fontWeight: '700' },
});
