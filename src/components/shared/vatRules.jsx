/**
 * EU VAT rule engine (practical MVP)
 * ────────────────────────────────────
 * Determines: reverse_charge, effective vat_rate, footer legal text
 */

/**
 * Compute VAT parameters for an invoice.
 *
 * @param {object} params
 * @param {string} params.tenantCountry   - ISO-2 e.g. "SI"
 * @param {string|null} params.buyerCountry
 * @param {string|null} params.buyerVatId
 * @param {number}      params.defaultVatRate - e.g. 0.095
 * @param {string}      params.lang           - "sl" | "en"
 * @returns {{ reverseCharge: boolean, vatRate: number, footerText: string }}
 */
export function computeVatParams({ tenantCountry, buyerCountry, buyerVatId, defaultVatRate, lang = 'sl' }) {
  const isB2B = !!buyerVatId;
  const isCrossBorder = isB2B && buyerCountry && buyerCountry !== tenantCountry;

  if (isCrossBorder) {
    return {
      reverseCharge: true,
      vatRate: 0,
      footerText: lang === 'sl'
        ? 'DDV ni obračunan – obrnjena davčna obveznost (člen 196 Direktive 2006/112/ES).'
        : 'VAT not charged – reverse charge applies (Article 196 of Directive 2006/112/EC).',
    };
  }

  return {
    reverseCharge: false,
    vatRate: defaultVatRate,
    footerText: lang === 'sl'
      ? `DDV ${(defaultVatRate * 100).toFixed(1)} % je vključen v ceno.`
      : `VAT at ${(defaultVatRate * 100).toFixed(1)} % is included in the price.`,
  };
}

/**
 * Apply VAT params to invoice lines.
 */
export function applyVatToLines(lines, vatRate) {
  return lines.map(line => {
    const net = (line.unit_price_net || 0) * (line.qty || 1);
    const vat = net * vatRate;
    return {
      ...line,
      vat_rate: vatRate,
      vat_amount: parseFloat(vat.toFixed(4)),
      line_total_gross: parseFloat((net + vat).toFixed(4)),
    };
  });
}

/**
 * Sum invoice totals from lines.
 */
export function sumInvoiceTotals(lines) {
  const net_total   = lines.reduce((s, l) => s + (l.unit_price_net || 0) * (l.qty || 1), 0);
  const vat_total   = lines.reduce((s, l) => s + (l.vat_amount || 0), 0);
  const gross_total = lines.reduce((s, l) => s + (l.line_total_gross || 0), 0);
  return {
    net_total:   parseFloat(net_total.toFixed(2)),
    vat_total:   parseFloat(vat_total.toFixed(2)),
    gross_total: parseFloat(gross_total.toFixed(2)),
  };
}

/**
 * Generate next invoice number.
 */
export function buildInvoiceNumber(prefix, seq) {
  return `${prefix || ''}${String(seq + 1).padStart(6, '0')}`;
}