import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { t } from '../../i18n';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';
import { formatUSD } from '../../utils/currency';
import { downloadBatchPDF } from '../../utils/pdf';
import { Batch, BatchChemical, BatchMaterial, BatchStatus, Grade, GradeOutput, OtherCost } from '../../types';
import { GRADES, calcBatchCosts } from '../../utils/calc';

const DEFAULT_OUTPUT: Record<Grade, GradeOutput> = {
  'Grade 1': { qty: 0, price: 0, currency: 'USD' },
  'Grade 2': { qty: 0, price: 0, currency: 'USD' },
  'Grade 3': { qty: 0, price: 0, currency: 'USD' },
};

export default function BatchesScreen() {
  const { batches, inventory, settings, role, saveBatch, deleteBatch } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';
  const insets = useSafeAreaInsets();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function openNew() { setEditBatch(null); setWizardOpen(true); }
  function openEdit(batch: Batch) { setEditBatch(batch); setWizardOpen(true); }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {batches.length === 0 && (
          <Text style={styles.emptyText}>{t(lang, 'noBatches')}</Text>
        )}
        {batches.slice().reverse().map((batch) => (
          <View key={batch.id} style={[styles.batchCard, Shadow.sm]}>
            <TouchableOpacity
              style={styles.batchHeader}
              onPress={() => setExpandedId(expandedId === batch.id ? null : batch.id)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.batchTitleRow}>
                  <View style={styles.idBadge}>
                    <Text style={styles.idBadgeText}>{batch.id}</Text>
                  </View>
                  <Text style={styles.batchName}>{batch.name}</Text>
                </View>
                <Text style={styles.batchDate}>{batch.date}</Text>
              </View>
              <View style={styles.batchRight}>
                <View style={[styles.statusBadge, batch.status === 'finished' ? styles.badgeGreen : styles.badgeYellow]}>
                  <Text style={styles.badgeText}>{t(lang, batch.status === 'finished' ? 'finished' : 'inProgress')}</Text>
                </View>
                {isDirector && (
                  <Text style={[styles.profitText, { color: batch.profit >= 0 ? Colors.success : Colors.error }]}>
                    {formatUSD(batch.profit)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            {expandedId === batch.id && (
              <View style={styles.expandedArea}>
                {batch.wetBlue.length > 0 && (
                  <>
                    <Text style={styles.detailLabel}>{t(lang, 'rawMaterial')}</Text>
                    {batch.wetBlue.map((w, i) => (
                      <Text key={i} style={styles.detailItem}>• {w.name}: {w.qty} pcs</Text>
                    ))}
                  </>
                )}
                {batch.chemicals.length > 0 && (
                  <>
                    <Text style={styles.detailLabel}>{t(lang, 'chemicals_step')}</Text>
                    {batch.chemicals.map((c, i) => (
                      <Text key={i} style={styles.detailItem}>• {c.name}: {c.usedQty} kg</Text>
                    ))}
                  </>
                )}
                <Text style={styles.detailLabel}>{t(lang, 'output')}</Text>
                {GRADES.map((grade) => {
                  const out = batch.output[grade];
                  if (out.qty <= 0) return null;
                  return (
                    <Text key={grade} style={styles.detailItem}>
                      • {grade}: {out.qty.toLocaleString()} dm²
                    </Text>
                  );
                })}
                {isDirector && (
                  <View style={styles.financials}>
                    <FinRow label={t(lang, 'chemicalCost')} value={formatUSD(batch.chemCost)} />
                    <FinRow label={t(lang, 'rawMaterialCost')} value={formatUSD(batch.rawCost)} />
                    <FinRow label={t(lang, 'otherCost')} value={formatUSD(batch.otherCost)} />
                    <FinRow label={t(lang, 'totalCost')} value={formatUSD(batch.totalCost)} bold />
                    <FinRow label={t(lang, 'revenue')} value={formatUSD(batch.revenue)} color={Colors.success} bold />
                    <FinRow label={t(lang, 'profit')} value={formatUSD(batch.profit)} color={batch.profit >= 0 ? Colors.success : Colors.error} bold />
                  </View>
                )}

                {/* Inline delete confirm */}
                {confirmDeleteId === batch.id ? (
                  <View style={styles.confirmRow}>
                    <Text style={styles.confirmText}>{t(lang, 'confirmDeleteBatch')}</Text>
                    <View style={styles.confirmBtns}>
                      <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmDeleteId(null)}>
                        <Text style={styles.confirmCancelText}>{t(lang, 'no')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.confirmDelete}
                        onPress={() => { deleteBatch(batch.id); setConfirmDeleteId(null); setExpandedId(null); }}
                      >
                        <Text style={styles.confirmDeleteText}>{t(lang, 'yes')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(batch)}>
                      <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.actionBtnText, { color: Colors.primary }]}>{t(lang, 'edit')}</Text>
                    </TouchableOpacity>
                    {isDirector && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => downloadBatchPDF(batch, inventory, settings)}
                      >
                        <Ionicons name="download-outline" size={16} color={Colors.success} />
                        <Text style={[styles.actionBtnText, { color: Colors.success }]}>{t(lang, 'downloadPdf')}</Text>
                      </TouchableOpacity>
                    )}
                    {isDirector && (
                      <TouchableOpacity style={styles.actionBtn} onPress={() => setConfirmDeleteId(batch.id)}>
                        <Ionicons name="trash-outline" size={16} color={Colors.error} />
                        <Text style={[styles.actionBtnText, { color: Colors.error }]}>{t(lang, 'delete')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: Spacing.xl + insets.bottom }]} onPress={openNew}>
        <Ionicons name="add" size={22} color={Colors.surface} />
        <Text style={styles.fabText}>{t(lang, 'newBatch')}</Text>
      </TouchableOpacity>

      <BatchWizard
        visible={wizardOpen}
        editBatch={editBatch}
        onClose={() => setWizardOpen(false)}
        onSave={(data) => {
          saveBatch(data, editBatch?.id);
          setWizardOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function FinRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.finRow}>
      <Text style={[styles.finLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.finValue, bold && { fontWeight: '700' }, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// BATCH WIZARD
// ─────────────────────────────────────────────

type WizardData = {
  name: string;
  date: string;
  hides: string;
  wetBlue: BatchMaterial[];
  chemicals: BatchChemical[];
  otherCosts: OtherCost[];
  output: Record<Grade, GradeOutput>;
  status: BatchStatus;
};

const EMPTY_WIZARD: WizardData = {
  name: '',
  date: new Date().toISOString().split('T')[0],
  hides: '',
  wetBlue: [],
  chemicals: [],
  otherCosts: [],
  output: { ...DEFAULT_OUTPUT },
  status: 'in_progress',
};

function BatchWizard({ visible, editBatch, onClose, onSave }: {
  visible: boolean;
  editBatch: Batch | null;
  onClose: () => void;
  onSave: (data: Omit<Batch, 'id' | 'chemCost' | 'rawCost' | 'otherCost' | 'totalCost' | 'revenue' | 'profit'>) => void;
}) {
  const { inventory, settings, role } = useApp();
  const lang = settings.language;
  const isDirector = role === 'director';

  const STEPS = isDirector
    ? ['info', 'rawMaterial', 'chemicals_step', 'otherCosts', 'output', 'summary'] as const
    : ['info', 'rawMaterial', 'chemicals_step', 'output', 'summary'] as const;

  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD);
  const [chemSearch, setChemSearch] = useState('');
  const [chemQtyRaw, setChemQtyRaw] = useState<Record<string, string>>({});

  // Properly reset wizard state when opening or switching between new/edit
  useEffect(() => {
    if (visible) {
      setStep(0);
      setChemSearch('');
      setChemQtyRaw({});
      if (editBatch) {
        setData({
          name: editBatch.name,
          date: editBatch.date,
          hides: String(editBatch.hides),
          wetBlue: editBatch.wetBlue,
          chemicals: editBatch.chemicals,
          otherCosts: editBatch.otherCosts,
          output: { ...editBatch.output },
          status: editBatch.status,
        });
      } else {
        setData({ ...EMPTY_WIZARD, date: new Date().toISOString().split('T')[0] });
      }
    }
  }, [visible, editBatch]);

  const wetBlueItems = inventory.filter((i) => i.type === 'Wet Blue' && i.qty > 0);
  const chemItems = inventory.filter((i) => i.type === 'Chemical' && i.qty > 0);

  const currentStep = STEPS[step];

  function getWetBlueAvail(itemId: string): number {
    const item = wetBlueItems.find((i) => i.id === itemId);
    if (!item) return 0;
    if (!editBatch) return item.qty;
    const prev = editBatch.wetBlue.find((w) => w.id === itemId);
    return item.qty + (prev?.qty ?? 0);
  }

  function getChemAvail(itemId: string): number {
    const item = chemItems.find((i) => i.id === itemId);
    if (!item) return 0;
    if (!editBatch) return item.qty;
    const prev = editBatch.chemicals.find((c) => c.id === itemId);
    return item.qty + (prev?.usedQty ?? 0);
  }

  const wetBlueOverage = data.wetBlue.some((w) => w.qty > getWetBlueAvail(w.id));
  const wetBlueZeroSelected = data.wetBlue.some((w) => w.qty <= 0);
  const chemOverage = data.chemicals.some((c) => c.usedQty > getChemAvail(c.id));
  const chemZeroSelected = data.chemicals.some((c) => c.usedQty <= 0);

  function goNext() {
    if (currentStep === 'rawMaterial' && (wetBlueOverage || wetBlueZeroSelected)) return;
    if (currentStep === 'chemicals_step' && (chemOverage || chemZeroSelected)) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }
  function goBack() { if (step > 0) setStep(s => s - 1); }

  function handleSave() {
    onSave({
      name: data.name,
      date: data.date,
      hides: parseInt(data.hides) || 0,
      wetBlue: data.wetBlue,
      chemicals: data.chemicals,
      otherCosts: data.otherCosts,
      output: data.output,
      status: data.status,
    });
  }

  const costs = calcBatchCosts(data.chemicals, data.wetBlue, data.otherCosts, data.output, settings.exchangeRates);

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={wStyles.container}>
        <View style={wStyles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.headerText} />
          </TouchableOpacity>
          <Text style={wStyles.headerTitle}>
            {editBatch ? t(lang, 'editBatch') : t(lang, 'newBatch')}
          </Text>
          <Text style={wStyles.stepCount}>{step + 1}/{STEPS.length}</Text>
        </View>

        <View style={wStyles.stepRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[wStyles.stepDot, i <= step && wStyles.stepDotActive, i < step && wStyles.stepDotDone]} />
          ))}
        </View>

        <Text style={wStyles.stepTitle}>{t(lang, currentStep as any)}</Text>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={wStyles.scroll} keyboardShouldPersistTaps="handled">

          {/* Step 1: Info */}
          {currentStep === 'info' && (
            <View style={wStyles.fields}>
              <WLabel label={t(lang, 'batchName')} />
              <TextInput style={wStyles.input} value={data.name} onChangeText={(v) => setData(d => ({ ...d, name: v }))} placeholder={t(lang, 'batchName')} />
              <WLabel label={t(lang, 'date')} />
              <TextInput style={wStyles.input} value={data.date} onChangeText={(v) => setData(d => ({ ...d, date: v }))} placeholder="YYYY-MM-DD" />
            </View>
          )}

          {/* Step 2: Raw Material */}
          {currentStep === 'rawMaterial' && (
            <View style={wStyles.fields}>
              <Text style={wStyles.helpText}>{t(lang, 'selectMaterial')}</Text>
              {wetBlueItems.map((item) => {
                const sel = data.wetBlue.find((w) => w.id === item.id);
                return (
                  <View key={item.id} style={wStyles.checkRow}>
                    <TouchableOpacity
                      style={[wStyles.checkbox, sel && wStyles.checkboxChecked]}
                      onPress={() => {
                        if (sel) {
                          setData(d => ({ ...d, wetBlue: d.wetBlue.filter(w => w.id !== item.id) }));
                        } else {
                          setData(d => ({
                            ...d,
                            wetBlue: [...d.wetBlue, { id: item.id, name: item.name, qty: 0, price: item.price, currency: item.currency }],
                          }));
                        }
                      }}
                    >
                      {sel && <Ionicons name="checkmark" size={14} color={Colors.surface} />}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={wStyles.checkLabel}>{item.name}</Text>
                      <Text style={wStyles.checkSub}>{t(lang, 'qtyAvailable')}: {item.qty} {item.unit}</Text>
                    </View>
                    {sel && (() => {
                      const avail = getWetBlueAvail(item.id);
                      const over = sel.qty > avail;
                      const zero = sel.qty <= 0;
                      return (
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <TextInput
                            style={[wStyles.smallInput, (over || zero) && wStyles.inputError]}
                            value={String(sel.qty || '')}
                            onChangeText={(v) => {
                              setData(d => ({
                                ...d,
                                wetBlue: d.wetBlue.map(w => w.id === item.id ? { ...w, qty: parseFloat(v) || 0 } : w),
                              }));
                            }}
                            keyboardType="decimal-pad"
                            placeholder="qty"
                          />
                          {over && <Text style={wStyles.errorText}>{t(lang, 'qtyAvailable')}: {avail}</Text>}
                          {!over && zero && <Text style={wStyles.errorText}>{t(lang, 'enterQty')}</Text>}
                        </View>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          )}

          {/* Step 3: Chemicals */}
          {currentStep === 'chemicals_step' && (
            <View style={wStyles.fields}>
              <Text style={wStyles.helpText}>{t(lang, 'selectChemicals')}</Text>
              <View style={wStyles.searchRow}>
                <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
                <TextInput
                  style={wStyles.searchInput}
                  value={chemSearch}
                  onChangeText={setChemSearch}
                  placeholder={t(lang, 'search')}
                  placeholderTextColor={Colors.textMuted}
                  autoCorrect={false}
                />
                {chemSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setChemSearch('')}>
                    <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {chemItems.filter(i => i.name.toLowerCase().includes(chemSearch.toLowerCase())).map((item) => {
                const sel = data.chemicals.find((c) => c.id === item.id);
                const cost = sel ? sel.usedQty * item.price : 0;
                return (
                  <View key={item.id} style={wStyles.checkRow}>
                    <TouchableOpacity
                      style={[wStyles.checkbox, sel && wStyles.checkboxChecked]}
                      onPress={() => {
                        if (sel) {
                          setData(d => ({ ...d, chemicals: d.chemicals.filter(c => c.id !== item.id) }));
                          setChemQtyRaw(r => { const n = { ...r }; delete n[item.id]; return n; });
                        } else {
                          setData(d => ({
                            ...d,
                            chemicals: [...d.chemicals, { id: item.id, name: item.name, usedQty: 0, price: item.price, currency: item.currency }],
                          }));
                        }
                      }}
                    >
                      {sel && <Ionicons name="checkmark" size={14} color={Colors.surface} />}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={wStyles.checkLabel}>{item.name}</Text>
                      <Text style={wStyles.checkSub}>{t(lang, 'qtyAvailable')}: {item.qty} {item.unit}</Text>
                      {isDirector && sel && cost > 0 && (
                        <Text style={wStyles.checkCost}>{t(lang, 'estimatedCost')}: {formatUSD(cost)}</Text>
                      )}
                    </View>
                    {sel && (() => {
                      const avail = getChemAvail(item.id);
                      const over = sel.usedQty > avail;
                      const zero = sel.usedQty <= 0;
                      return (
                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                          <TextInput
                            style={[wStyles.smallInput, (over || zero) && wStyles.inputError]}
                            value={chemQtyRaw[item.id] ?? (sel.usedQty ? String(sel.usedQty) : '')}
                            onChangeText={(v) => {
                              const normalized = v.replace(',', '.');
                              setChemQtyRaw(r => ({ ...r, [item.id]: normalized }));
                              setData(d => ({
                                ...d,
                                chemicals: d.chemicals.map(c => c.id === item.id ? { ...c, usedQty: parseFloat(normalized) || 0 } : c),
                              }));
                            }}
                            keyboardType="decimal-pad"
                            placeholder="kg"
                          />
                          {over && <Text style={wStyles.errorText}>{t(lang, 'qtyAvailable')}: {avail}</Text>}
                          {!over && zero && <Text style={wStyles.errorText}>{t(lang, 'enterQty')}</Text>}
                        </View>
                      );
                    })()}
                  </View>
                );
              })}
            </View>
          )}

          {/* Step 4: Other Costs (director only) */}
          {currentStep === 'otherCosts' && (
            <View style={wStyles.fields}>
              {data.otherCosts.map((cost, i) => (
                <View key={i} style={wStyles.costRow}>
                  <TextInput
                    style={[wStyles.input, { flex: 1 }]}
                    value={cost.label}
                    onChangeText={(v) => setData(d => ({ ...d, otherCosts: d.otherCosts.map((c, j) => j === i ? { ...c, label: v } : c) }))}
                    placeholder={t(lang, 'costLabel')}
                  />
                  <TextInput
                    style={wStyles.smallInput}
                    value={String(cost.amount || '')}
                    onChangeText={(v) => setData(d => ({ ...d, otherCosts: d.otherCosts.map((c, j) => j === i ? { ...c, amount: parseFloat(v) || 0 } : c) }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                  <TouchableOpacity onPress={() => setData(d => ({ ...d, otherCosts: d.otherCosts.filter((_, j) => j !== i) }))}>
                    <Ionicons name="close-circle" size={22} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={wStyles.addCostBtn}
                onPress={() => setData(d => ({ ...d, otherCosts: [...d.otherCosts, { label: '', amount: 0, currency: 'USD' }] }))}
              >
                <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                <Text style={wStyles.addCostText}>{t(lang, 'addCost')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 5: Output — quantity only, no price (price set later via Leather screen) */}
          {currentStep === 'output' && (
            <View style={wStyles.fields}>
              {GRADES.map((grade) => {
                const out = data.output[grade];
                const color = grade === 'Grade 1' ? Colors.grade1 : grade === 'Grade 2' ? Colors.grade2 : Colors.grade3;
                return (
                  <View key={grade} style={[wStyles.gradeBlock, { borderLeftColor: color }]}>
                    <Text style={[wStyles.gradeTitle, { color }]}>{grade}</Text>
                    <WLabel label={t(lang, 'outputDm2')} />
                    <TextInput
                      style={wStyles.input}
                      value={String(out.qty || '')}
                      onChangeText={(v) => setData(d => ({ ...d, output: { ...d.output, [grade]: { ...d.output[grade], qty: parseFloat(v) || 0 } } }))}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Step 6: Summary */}
          {currentStep === 'summary' && (
            <View style={wStyles.fields}>
              <View style={wStyles.summaryCard}>
                <SumRow label={t(lang, 'batchName')} value={data.name} />
                <SumRow label={t(lang, 'date')} value={data.date} />
              </View>

              {isDirector && (
                <View style={[wStyles.summaryCard, { marginTop: Spacing.md }]}>
                  <SumRow label={t(lang, 'chemicalCost')} value={formatUSD(costs.chemCost)} />
                  <SumRow label={t(lang, 'rawMaterialCost')} value={formatUSD(costs.rawCost)} />
                  <SumRow label={t(lang, 'otherCost')} value={formatUSD(costs.otherCost)} />
                  <SumRow label={t(lang, 'totalCost')} value={formatUSD(costs.totalCost)} bold />
                </View>
              )}

              <WLabel label={t(lang, 'batchStatus')} />
              <View style={wStyles.statusRow}>
                {(['finished', 'in_progress'] as BatchStatus[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[wStyles.statusBtn, data.status === s && wStyles.statusBtnActive]}
                    onPress={() => setData(d => ({ ...d, status: s }))}
                  >
                    <Text style={[wStyles.statusBtnText, data.status === s && wStyles.statusBtnTextActive]}>
                      {t(lang, s === 'finished' ? 'finished' : 'inProgress')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

        </ScrollView>
        </KeyboardAvoidingView>

        <View style={wStyles.navRow}>
          <TouchableOpacity
            style={[wStyles.navBtn, step === 0 && wStyles.navBtnDisabled]}
            onPress={goBack}
            disabled={step === 0}
          >
            <Ionicons name="arrow-back" size={18} color={step === 0 ? Colors.textMuted : Colors.primary} />
            <Text style={[wStyles.navBtnText, step === 0 && { color: Colors.textMuted }]}>{t(lang, 'back')}</Text>
          </TouchableOpacity>

          {step < STEPS.length - 1 ? (
            <TouchableOpacity style={wStyles.navBtnPrimary} onPress={goNext}>
              <Text style={wStyles.navBtnPrimaryText}>{t(lang, 'next')}</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.surface} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={wStyles.navBtnPrimary} onPress={handleSave}>
              <Ionicons name="checkmark" size={18} color={Colors.surface} />
              <Text style={wStyles.navBtnPrimaryText}>{t(lang, 'save')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function WLabel({ label }: { label: string }) {
  return <Text style={wStyles.label}>{label}</Text>;
}

function SumRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={wStyles.sumRow}>
      <Text style={[wStyles.sumLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[wStyles.sumValue, bold && { fontWeight: '700' }, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, gap: Spacing.md },
  emptyText: { textAlign: 'center', color: Colors.textMuted, marginTop: Spacing.xxl, fontSize: FontSize.md },
  batchCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg },
  batchHeader: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.sm },
  batchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 2 },
  idBadge: { backgroundColor: Colors.primaryLight, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.sm },
  idBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  batchName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  batchDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  batchRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full },
  badgeGreen: { backgroundColor: Colors.successLight },
  badgeYellow: { backgroundColor: Colors.warningLight },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.text },
  profitText: { fontSize: FontSize.sm, fontWeight: '700' },
  expandedArea: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.lg, gap: Spacing.sm },
  detailLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text, marginTop: Spacing.sm },
  detailItem: { fontSize: FontSize.sm, color: Colors.textSecondary, marginLeft: Spacing.sm },
  financials: { backgroundColor: Colors.background, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.sm },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  finLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  finValue: { fontSize: FontSize.sm, color: Colors.text },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  confirmRow: { marginTop: Spacing.sm, backgroundColor: Colors.errorLight, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  confirmText: { fontSize: FontSize.sm, color: Colors.text },
  confirmBtns: { flexDirection: 'row', gap: Spacing.sm },
  confirmCancel: { flex: 1, padding: Spacing.sm, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  confirmCancelText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  confirmDelete: { flex: 1, padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: Colors.error, alignItems: 'center' },
  confirmDeleteText: { fontSize: FontSize.sm, color: Colors.surface, fontWeight: '700' },
  fab: { position: 'absolute', bottom: Spacing.xl, right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, ...Shadow.md },
  fabText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
});

const wStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.header, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.headerText },
  stepCount: { fontSize: FontSize.sm, color: Colors.headerText + 'AA' },
  stepRow: { flexDirection: 'row', padding: Spacing.lg, gap: Spacing.sm },
  stepDot: { flex: 1, height: 4, borderRadius: Radius.full, backgroundColor: Colors.border },
  stepDotActive: { backgroundColor: Colors.primaryLight },
  stepDotDone: { backgroundColor: Colors.primary },
  stepTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  scroll: { paddingHorizontal: Spacing.lg, paddingBottom: 120 },
  fields: { gap: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.text, backgroundColor: Colors.surface },
  helpText: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text, paddingVertical: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  checkbox: { width: 22, height: 22, borderRadius: Radius.sm, borderWidth: 2, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  checkSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  checkCost: { fontSize: FontSize.xs, color: Colors.primary },
  smallInput: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md, color: Colors.text, minWidth: 72, textAlign: 'right' },
  costRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  addCostBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', justifyContent: 'center' },
  addCostText: { color: Colors.primary, fontWeight: '600', fontSize: FontSize.md },
  gradeBlock: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md, borderLeftWidth: 4, gap: Spacing.sm },
  gradeTitle: { fontSize: FontSize.md, fontWeight: '700' },
  summaryCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sumLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sumValue: { fontSize: FontSize.sm, color: Colors.text },
  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  statusBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  statusBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  statusBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  statusBtnTextActive: { color: Colors.primary },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.surface },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  navBtnDisabled: { borderColor: Colors.border, opacity: 0.5 },
  navBtnText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  navBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radius.md },
  navBtnPrimaryText: { color: Colors.surface, fontWeight: '700', fontSize: FontSize.md },
  inputError: { borderColor: Colors.error, backgroundColor: Colors.errorLight },
  errorText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: '600' },
});
