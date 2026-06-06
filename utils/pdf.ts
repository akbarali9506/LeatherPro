import { Platform } from 'react-native';
import { AppSettings, Batch, Buyer, Grade, GradeOutput, InventoryItem, Sale } from '../types';
import { toUSD } from './currency';

const GRADE_LABEL: Record<string, string> = {
  'Grade 1': 'S1',
  'Grade 2': 'S2',
  'Grade 3': 'S3',
};

const GREEN: [number, number, number] = [39, 105, 73];
const FOOT_BG: [number, number, number] = [230, 230, 230];

async function getPDF() {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
}

function docHeader(doc: any, title: string, subtitle?: string): number {
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  doc.text(`Generated: ${date}`, 14, 28);
  if (subtitle) { doc.text(subtitle, 14, 35); }
  doc.setTextColor(0);
  return subtitle ? 42 : 35;
}

export async function downloadChemicalPDF(
  inventory: InventoryItem[],
  settings: AppSettings,
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const { jsPDF, autoTable } = await getPDF();
  const doc = new jsPDF();
  const rates = settings.exchangeRates;
  const items = inventory.filter((i) => i.type === 'Chemical');

  const y = docHeader(doc, 'Chemical Inventory Report');

  const body = items.map((item, idx) => {
    const value = toUSD(item.price * item.qty, item.currency, rates);
    return [
      idx + 1,
      item.name,
      item.qty.toLocaleString(),
      item.unit,
      `${item.price.toFixed(2)} ${item.currency}`,
      `$${value.toFixed(2)}`,
    ];
  });

  const totalUSD = items.reduce(
    (s, i) => s + toUSD(i.price * i.qty, i.currency, rates), 0,
  );

  autoTable(doc, {
    startY: y,
    head: [['#', 'Name', 'Qty', 'Unit', 'Price / Unit', 'Value (USD)']],
    body,
    foot: [['', '', '', '', 'Total', `$${totalUSD.toFixed(2)}`]],
    theme: 'striped',
    headStyles: { fillColor: GREEN },
    footStyles: { fillColor: FOOT_BG, textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8 } },
  });

  doc.save(`chemical-inventory-${today()}.pdf`);
}

export async function downloadLeatherPDF(
  inventory: InventoryItem[],
  settings: AppSettings,
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const { jsPDF, autoTable } = await getPDF();
  const doc = new jsPDF();
  const rates = settings.exchangeRates;
  const items = inventory.filter((i) => i.type === 'Finished Leather' && i.qty > 0);
  const totalArea = items.reduce((s, i) => s + i.qty, 0);
  const totalUSD = items.reduce(
    (s, i) => s + (i.price > 0 ? toUSD(i.price * i.qty, i.currency, rates) : 0), 0,
  );

  const y = docHeader(
    doc,
    'Leather Warehouse Report',
    `Items: ${items.length}  |  Total area: ${totalArea.toLocaleString()} dm²  |  Est. value: $${totalUSD.toFixed(2)}`,
  );

  const body = items.map((item, idx) => {
    const value = item.price > 0
      ? `$${toUSD(item.price * item.qty, item.currency, rates).toFixed(2)}`
      : '—';
    return [
      idx + 1,
      item.name,
      item.batchName ?? '—',
      GRADE_LABEL[item.grade ?? ''] ?? item.grade ?? '—',
      item.qty.toLocaleString(),
      item.unit,
      item.price > 0 ? `${item.price.toFixed(2)} ${item.currency}` : 'Not set',
      value,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Name', 'Batch', 'Grade', 'Qty', 'Unit', 'Price / Unit', 'Value (USD)']],
    body,
    foot: [['', '', '', '', '', '', 'Total', `$${totalUSD.toFixed(2)}`]],
    theme: 'striped',
    headStyles: { fillColor: GREEN },
    footStyles: { fillColor: FOOT_BG, textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8 }, 3: { cellWidth: 14 } },
  });

  doc.save(`leather-warehouse-${today()}.pdf`);
}

export async function downloadBatchPDF(
  batch: Batch,
  inventory: InventoryItem[],
  settings: AppSettings,
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const { jsPDF, autoTable } = await getPDF();
  const doc = new jsPDF();
  const rates = settings.exchangeRates;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Batch Report: ${batch.name}`, 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(
    `ID: ${batch.id}   Date: ${batch.date}   Status: ${batch.status === 'finished' ? 'Finished' : 'In Progress'}`,
    14, 28,
  );
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    14, 34,
  );
  doc.setTextColor(0);
  let y = 42;

  function sectionTitle(title: string) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 4;
  }

  function advanceY() {
    const finalY = (doc as any).lastAutoTable?.finalY;
    y = (finalY ?? y) + 10;
    if (y > 265) { doc.addPage(); y = 20; }
  }

  if (batch.wetBlue.length > 0) {
    sectionTitle('Raw Materials (Wet Blue)');
    autoTable(doc, {
      startY: y,
      head: [['Name', 'Qty', 'Unit', 'Price', 'Currency', 'Total (USD)']],
      body: batch.wetBlue.map((m) => [
        m.name,
        m.qty.toLocaleString(),
        'pcs',
        m.price.toFixed(2),
        m.currency,
        `$${toUSD(m.price * m.qty, m.currency, rates).toFixed(2)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: GREEN },
    });
    advanceY();
  }

  if (batch.chemicals.length > 0) {
    sectionTitle('Chemicals Used');
    autoTable(doc, {
      startY: y,
      head: [['Name', 'Qty Used', 'Unit', 'Price / Unit', 'Currency', 'Total (USD)']],
      body: batch.chemicals.map((c) => {
        const inv = inventory.find((i) => i.id === c.id);
        return [
          c.name,
          c.usedQty.toLocaleString(),
          inv?.unit ?? 'kg',
          c.price.toFixed(2),
          c.currency,
          `$${toUSD(c.price * c.usedQty, c.currency, rates).toFixed(2)}`,
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: GREEN },
    });
    advanceY();
  }

  if (batch.otherCosts.length > 0) {
    sectionTitle('Other Costs');
    autoTable(doc, {
      startY: y,
      head: [['Description', 'Amount', 'Currency', 'Total (USD)']],
      body: batch.otherCosts.map((c) => [
        c.label,
        c.amount.toFixed(2),
        c.currency,
        `$${toUSD(c.amount, c.currency, rates).toFixed(2)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: GREEN },
    });
    advanceY();
  }

  const gradeOutputs = (
    Object.entries(batch.output) as [Grade, GradeOutput][]
  ).filter(([, v]) => v.qty > 0);

  if (gradeOutputs.length > 0) {
    sectionTitle('Output (Finished Leather)');
    autoTable(doc, {
      startY: y,
      head: [['Grade', 'Qty (dm²)', 'Price / dm²', 'Currency', 'Value (USD)']],
      body: gradeOutputs.map(([grade, out]) => [
        GRADE_LABEL[grade] ?? grade,
        out.qty.toLocaleString(),
        out.price.toFixed(2),
        out.currency,
        `$${toUSD(out.price * out.qty, out.currency, rates).toFixed(2)}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: GREEN },
    });
    advanceY();
  }

  sectionTitle('Financials');
  autoTable(doc, {
    startY: y,
    head: [['', 'Amount (USD)']],
    body: [
      ['Raw Material Cost', `$${batch.rawCost.toFixed(2)}`],
      ['Chemical Cost', `$${batch.chemCost.toFixed(2)}`],
      ['Other Costs', `$${batch.otherCost.toFixed(2)}`],
      ['Total Cost', `$${batch.totalCost.toFixed(2)}`],
      ['Revenue', `$${batch.revenue.toFixed(2)}`],
      ['Profit / (Loss)', `$${batch.profit.toFixed(2)}`],
    ],
    theme: 'plain',
    headStyles: { fillColor: GREEN },
    alternateRowStyles: { fillColor: [248, 248, 248] },
  });

  doc.save(`batch-${batch.id}-${batch.name.replace(/\s+/g, '-')}.pdf`);
}

export async function downloadSalesPDF(
  sales: Sale[],
  inventory: InventoryItem[],
  settings: AppSettings,
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const { jsPDF, autoTable } = await getPDF();
  const doc = new jsPDF({ orientation: 'landscape' });
  const rates = settings.exchangeRates;

  const pricedSales = sales.filter((s) => !s.needsPricing);
  const totalRevenue = pricedSales.reduce(
    (s, sale) => s + toUSD(sale.price * sale.qty, sale.currency, rates), 0,
  );
  const outstanding = pricedSales
    .filter((s) => s.paymentStatus === 'partial')
    .reduce((s, sale) => {
      const total = toUSD(sale.price * sale.qty, sale.currency, rates);
      const paid = toUSD(sale.paidAmount ?? 0, sale.currency, rates);
      return s + (total - paid);
    }, 0);

  const y = docHeader(
    doc,
    'Sales Report',
    `Total revenue: $${totalRevenue.toFixed(2)}  |  Outstanding: $${outstanding.toFixed(2)}`,
  );

  const body = [...sales].reverse().map((sale, idx) => {
    const item = inventory.find((i) => i.id === sale.inventoryId);
    const total = toUSD(sale.price * sale.qty, sale.currency, rates);
    const statusLabel =
      sale.needsPricing ? 'Pending price'
      : sale.paymentStatus === 'partial' ? 'Partial'
      : 'Paid';
    return [
      idx + 1,
      sale.date,
      sale.buyer,
      item?.name ?? sale.inventoryId,
      GRADE_LABEL[sale.grade] ?? sale.grade ?? '—',
      sale.qty.toLocaleString(),
      sale.price > 0 ? `${sale.price.toFixed(2)} ${sale.currency}` : '—',
      sale.price > 0 ? `$${total.toFixed(2)}` : '—',
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Date', 'Buyer', 'Item', 'Grade', 'Qty', 'Price / Unit', 'Total (USD)', 'Status']],
    body,
    theme: 'striped',
    headStyles: { fillColor: GREEN },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      8: { cellWidth: 24 },
    },
  });

  doc.save(`sales-report-${today()}.pdf`);
}

export async function downloadBuyerPDF(
  buyer: Buyer,
  bSales: Sale[],
  inventory: InventoryItem[],
  settings: AppSettings,
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const { jsPDF, autoTable } = await getPDF();
  const doc = new jsPDF();
  const rates = settings.exchangeRates;

  const pricedSales = bSales.filter((s) => !s.needsPricing);
  const totalSpent = pricedSales.reduce(
    (s, sale) => s + toUSD(sale.price * sale.qty, sale.currency, rates), 0,
  );
  const outstanding = pricedSales
    .filter((s) => s.paymentStatus === 'partial')
    .reduce((s, sale) => {
      const total = toUSD(sale.price * sale.qty, sale.currency, rates);
      const paid = toUSD(sale.paidAmount ?? 0, sale.currency, rates);
      return s + (total - paid);
    }, 0);

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`Buyer Statement: ${buyer.name}`, 14, 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  if (buyer.company) doc.text(`Company: ${buyer.company}`, 14, 28);
  if (buyer.phone) doc.text(`Phone: ${buyer.phone}`, 14, buyer.company ? 34 : 28);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    14, buyer.company && buyer.phone ? 40 : buyer.company || buyer.phone ? 34 : 28,
  );
  doc.setTextColor(0);

  const startY = buyer.company && buyer.phone ? 48 : buyer.company || buyer.phone ? 42 : 36;

  // Summary row
  autoTable(doc, {
    startY,
    head: [['Total Spent (USD)', 'Outstanding (USD)', 'Transactions']],
    body: [[
      `$${totalSpent.toFixed(2)}`,
      outstanding > 0 ? `$${outstanding.toFixed(2)}` : '—',
      bSales.length.toString(),
    ]],
    theme: 'plain',
    headStyles: { fillColor: GREEN, fontSize: 10 },
    bodyStyles: { fontStyle: 'bold', fontSize: 11 },
  });

  const afterSummary = (doc as any).lastAutoTable?.finalY ?? startY + 20;

  // Purchase history
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Purchase History', 14, afterSummary + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const body = [...bSales].reverse().map((sale, idx) => {
    const item = inventory.find((i) => i.id === sale.inventoryId);
    const total = toUSD(sale.price * sale.qty, sale.currency, rates);
    const statusLabel =
      sale.needsPricing ? 'Pending price'
      : sale.paymentStatus === 'partial' ? 'Partial'
      : 'Paid';
    return [
      idx + 1,
      sale.date,
      item?.name ?? sale.inventoryId,
      GRADE_LABEL[sale.grade] ?? sale.grade ?? '—',
      sale.qty.toLocaleString(),
      sale.price > 0 ? `${sale.price.toFixed(2)} ${sale.currency}` : '—',
      sale.price > 0 ? `$${total.toFixed(2)}` : '—',
      statusLabel,
    ];
  });

  autoTable(doc, {
    startY: afterSummary + 14,
    head: [['#', 'Date', 'Item', 'Grade', 'Qty', 'Price / Unit', 'Total (USD)', 'Status']],
    body,
    foot: [['', '', '', '', '', '', `$${totalSpent.toFixed(2)}`, '']],
    theme: 'striped',
    headStyles: { fillColor: GREEN },
    footStyles: { fillColor: FOOT_BG, textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 22 }, 7: { cellWidth: 22 } },
  });

  const safeName = buyer.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  doc.save(`buyer-${safeName}-${today()}.pdf`);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
