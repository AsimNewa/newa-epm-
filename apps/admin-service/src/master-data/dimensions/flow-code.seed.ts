/**
 * FlowCode is a protected system dimension (see spec §3.10 "Module: Flow Engine") that classifies
 * balance-sheet movements as cash vs non-cash — the split needed to produce the Statement of Cash
 * Flows under the indirect method (net movement = cash change ± non-cash adjustments).
 *
 * Every member's `weight` follows the same rollup-sign convention used elsewhere in this codebase
 * (see ChartOfAccount "Accumulated Depreciation" and Cost Center "Intercompany Eliminations"):
 * +1 for movements that increase the balance, -1 for movements that decrease it.
 */

export const FLOW_CODE_DIMENSION_NAME = 'FlowCode';
export const FLOW_CODE_DIMENSION_TYPE = 'FLOW_CODE';

export interface FlowCodeMemberSeed {
  code: string;
  name: string;
  parentCode?: string;
  weight: number;
}

export const FLOW_CODE_MEMBERS: FlowCodeMemberSeed[] = [
  // ── Top-level split ─────────────────────────────────────────────────────
  { code: '0CA', name: 'Cash Changes', weight: 1 },
  { code: '0NC', name: 'Non-Cash Flow', weight: 1 },

  // ── Cash movements, by spec §3.10.2 Standard Flow Category ─────────────
  { code: 'CA_FA_ADD', name: 'Fixed Asset Additions (Cash)', parentCode: '0CA', weight: 1 },
  { code: 'CA_FA_DISP', name: 'Fixed Asset Disposals (Cash)', parentCode: '0CA', weight: -1 },
  { code: 'CA_IA_ADD', name: 'Intangible Asset Additions (Cash)', parentCode: '0CA', weight: 1 },
  { code: 'CA_IA_DISP', name: 'Intangible Asset Disposals (Cash)', parentCode: '0CA', weight: -1 },
  { code: 'CA_INV_PUR', name: 'Investment Purchases (Cash)', parentCode: '0CA', weight: 1 },
  { code: 'CA_INV_PROC', name: 'Investment Disposal Proceeds (Cash)', parentCode: '0CA', weight: -1 },
  { code: 'CA_DEBT_DRAW', name: 'Debt Drawdowns', parentCode: '0CA', weight: 1 },
  { code: 'CA_DEBT_REPAY', name: 'Debt Repayments', parentCode: '0CA', weight: -1 },
  { code: 'CA_EQ_ISS', name: 'Equity Issuances (Cash)', parentCode: '0CA', weight: 1 },
  { code: 'CA_EQ_DIV', name: 'Dividends Paid (Cash)', parentCode: '0CA', weight: -1 },
  { code: 'CA_WC_CHG', name: 'Working Capital Cash Changes', parentCode: '0CA', weight: 1 },

  // ── Non-cash movements — excluded from the Statement of Cash Flows ──────
  { code: 'NC_DEPR', name: 'Depreciation & Amortisation', parentCode: '0NC', weight: -1 },
  { code: 'NC_IMP', name: 'Impairment Losses', parentCode: '0NC', weight: -1 },
  { code: 'NC_REVAL', name: 'Revaluation / Fair Value Adjustment', parentCode: '0NC', weight: 1 },
  { code: 'NC_FX', name: 'FX Translation Adjustment', parentCode: '0NC', weight: 1 },
  { code: 'NC_RECLASS', name: 'Reclassifications / Transfers', parentCode: '0NC', weight: 1 },
  { code: 'NC_SBP', name: 'Share-Based Payment Expense', parentCode: '0NC', weight: 1 },
  { code: 'NC_ACQ', name: 'Non-Cash Acquisitions', parentCode: '0NC', weight: 1 },
];

export interface FlowCodeAccountRuleSeed {
  sourceRange: string;
  applicability: 'MANDATORY' | 'OPTIONAL' | 'PROHIBITED';
  defaultMemberCode?: string;
}

/**
 * Per-account FlowCode applicability + default member, reviewed account-by-account against the
 * seeded IFRS chart of accounts:
 *  - Header/rollup accounts (never posted to directly — they sum their children) are Optional.
 *  - Genuine balance-sheet movement accounts are Mandatory with a specific Cash/Non-Cash default
 *    matching their nature (additions/disposals/debt/equity/working-capital/depreciation/FX/...).
 *  - Ordinary P&L revenue/COGS/opex/finance/tax lines are Mandatory, defaulting to the generic
 *    Non-Cash bucket (`0NC`) — they're accrual postings, not themselves a cash leg; the cash effect
 *    surfaces through the related balance-sheet movement instead.
 *  - The specific non-cash P&L reconciling items (D&A, impairment/write-downs, share-based payment,
 *    FX gain/loss, deferred tax, gain on disposal) get their specific Non-Cash child instead of the
 *    generic bucket.
 *  - Ranges are split narrower wherever accounts grouped together don't actually share the same
 *    cash/non-cash nature — e.g. Employee Benefit Obligations & Provisions (cash-settled over time)
 *    were split out from Deferred Tax Liabilities (genuinely non-cash) even though the seeded COA's
 *    own `cashFlowCategory` groups them loosely; that field marks SCF *section* only, not cash nature,
 *    so it's a hint, not a substitute for account-by-account judgment.
 * All of these are just presets — the preparer can always override at entry time.
 */
export const FLOW_CODE_ACCOUNT_RULES: FlowCodeAccountRuleSeed[] = [
  // ── Header / rollup accounts — never posted to directly ─────────────────
  {
    sourceRange:
      '10000,11000,12000,20000,21000,21400,30000,31000,32000,40000,41000,43000,50000,53000,60000,61000,62000,64000,66000,70000,71000,72000,80000,90000,91000,92000',
    applicability: 'OPTIONAL',
  },

  // ── Assets ────────────────────────────────────────────────────────────
  { sourceRange: '11100..11140', applicability: 'MANDATORY', defaultMemberCode: 'CA_FA_ADD' }, // PPE + Land/Plant/Vehicles/Office additions
  { sourceRange: '11190', applicability: 'MANDATORY', defaultMemberCode: 'NC_DEPR' }, // Accum. Depreciation - PPE
  { sourceRange: '11200..11220', applicability: 'MANDATORY', defaultMemberCode: 'NC_ACQ' }, // ROU Assets — new-lease recognition is non-cash (IFRS 16)
  { sourceRange: '11290', applicability: 'MANDATORY', defaultMemberCode: 'NC_DEPR' }, // Accum. Amortisation - ROU
  { sourceRange: '11300', applicability: 'MANDATORY', defaultMemberCode: 'CA_IA_ADD' }, // Intangible Assets (catch-all)
  { sourceRange: '11310..11320', applicability: 'MANDATORY', defaultMemberCode: 'NC_ACQ' }, // Goodwill, Customer Relationships — PPA-recognized, non-cash
  { sourceRange: '11330..11340', applicability: 'MANDATORY', defaultMemberCode: 'CA_IA_ADD' }, // Patents/Licenses, Capitalised Development Costs
  { sourceRange: '11390', applicability: 'MANDATORY', defaultMemberCode: 'NC_DEPR' }, // Accum. Amortisation - Intangibles
  { sourceRange: '11400', applicability: 'MANDATORY', defaultMemberCode: 'CA_INV_PUR' }, // Investments in Associates
  { sourceRange: '11500', applicability: 'MANDATORY', defaultMemberCode: 'NC_RECLASS' }, // Deferred Tax Assets
  { sourceRange: '11600', applicability: 'MANDATORY', defaultMemberCode: '0CA' }, // Other Non-Current Assets — Investing-natured catch-all; generic Cash bucket rather than mislabeling as Working Capital
  { sourceRange: '12100', applicability: 'MANDATORY', defaultMemberCode: '0CA' }, // Cash & Cash Equivalents — the reconciliation line itself
  { sourceRange: '12200..12220', applicability: 'MANDATORY', defaultMemberCode: 'CA_WC_CHG' }, // Trade Receivables
  { sourceRange: '12230', applicability: 'MANDATORY', defaultMemberCode: 'NC_IMP' }, // Allowance for Doubtful Debts
  { sourceRange: '12300..12430', applicability: 'MANDATORY', defaultMemberCode: 'CA_WC_CHG' }, // Contract Assets, Inventories
  { sourceRange: '12500..12600', applicability: 'MANDATORY', defaultMemberCode: 'CA_WC_CHG' }, // Prepayments, Current Tax Receivable
  { sourceRange: '12700', applicability: 'MANDATORY', defaultMemberCode: 'CA_INV_PUR' }, // Other Financial Assets - Current

  // ── Equity ────────────────────────────────────────────────────────────
  { sourceRange: '21100..21200', applicability: 'MANDATORY', defaultMemberCode: 'CA_EQ_ISS' }, // Share Capital, Share Premium
  { sourceRange: '21300', applicability: 'MANDATORY', defaultMemberCode: 'NC_RECLASS' }, // Retained Earnings (P&L roll-in; dividends selected manually as CA_EQ_DIV)
  { sourceRange: '21410', applicability: 'MANDATORY', defaultMemberCode: 'NC_FX' }, // FX Translation Reserve
  { sourceRange: '21420..21440', applicability: 'MANDATORY', defaultMemberCode: 'NC_REVAL' }, // FV Reserve, Revaluation Surplus, Hedging Reserve
  { sourceRange: '22000', applicability: 'MANDATORY', defaultMemberCode: 'NC_RECLASS' }, // Non-Controlling Interests

  // ── Liabilities ───────────────────────────────────────────────────────
  { sourceRange: '31100..31120', applicability: 'MANDATORY', defaultMemberCode: 'CA_DEBT_DRAW' }, // Borrowings NC, Bank Loans, Bonds
  { sourceRange: '31200', applicability: 'MANDATORY', defaultMemberCode: 'NC_ACQ' }, // Lease Liabilities NC — mirrors ROU asset
  { sourceRange: '31300', applicability: 'MANDATORY', defaultMemberCode: 'NC_RECLASS' }, // Deferred Tax Liabilities — genuinely non-cash tax accounting entry
  { sourceRange: '31400..31500', applicability: 'MANDATORY', defaultMemberCode: 'CA_WC_CHG' }, // Employee Benefit Obligations, Provisions NC — dominant movement is cash funding/settlement (non-cash actuarial remeasurement is captured separately via OCI account 92100); consistent with Accruals/Other NC Liabilities
  { sourceRange: '31600', applicability: 'MANDATORY', defaultMemberCode: 'CA_WC_CHG' }, // Other NC Liabilities
  { sourceRange: '32100..32200', applicability: 'MANDATORY', defaultMemberCode: 'CA_WC_CHG' }, // Trade Payables, Contract Liabilities
  { sourceRange: '32300..32400', applicability: 'MANDATORY', defaultMemberCode: 'CA_DEBT_REPAY' }, // Borrowings Current, Lease Liabilities Current
  { sourceRange: '32500..32600', applicability: 'MANDATORY', defaultMemberCode: 'CA_WC_CHG' }, // Accruals, Income Tax Payable
  { sourceRange: '32700', applicability: 'MANDATORY', defaultMemberCode: 'CA_EQ_DIV' }, // Dividends Payable

  // ── Revenue ───────────────────────────────────────────────────────────
  { sourceRange: '41100..42000', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Product/Service/License Revenue, Intercompany Revenue
  { sourceRange: '43100..43200', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Rental Income, Government Grants
  { sourceRange: '43300', applicability: 'MANDATORY', defaultMemberCode: 'CA_FA_DISP' }, // Gain on Disposal of Assets — reconciling item

  // ── Cost of Sales ─────────────────────────────────────────────────────
  { sourceRange: '51000..52000', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Direct Materials, Direct Labour
  { sourceRange: '53100..53200', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Factory Utilities, Factory Rent
  { sourceRange: '53300', applicability: 'MANDATORY', defaultMemberCode: 'NC_DEPR' }, // Depreciation - Production Assets
  { sourceRange: '54000', applicability: 'MANDATORY', defaultMemberCode: 'NC_IMP' }, // Inventory Write-downs & Provisions
  { sourceRange: '55000', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Intercompany Purchases

  // ── Operating Expenses ────────────────────────────────────────────────
  { sourceRange: '61100..61400', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Selling & Distribution
  { sourceRange: '62100..63000', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // G&A, R&D
  { sourceRange: '64100..64300', applicability: 'MANDATORY', defaultMemberCode: 'NC_DEPR' }, // Depreciation & Amortisation
  { sourceRange: '65000', applicability: 'MANDATORY', defaultMemberCode: 'NC_SBP' }, // Share-Based Payment Expense
  { sourceRange: '66100..66200', applicability: 'MANDATORY', defaultMemberCode: 'NC_IMP' }, // Impairment of Goodwill / Trade Receivables

  // ── Finance Income & Costs ────────────────────────────────────────────
  { sourceRange: '71100..71200', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Interest Income, Dividend Income
  { sourceRange: '71300', applicability: 'MANDATORY', defaultMemberCode: 'NC_FX' }, // Foreign Exchange Gains
  { sourceRange: '72100..72200', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Interest Expense - Bank Loans / Leases
  { sourceRange: '72300', applicability: 'MANDATORY', defaultMemberCode: 'NC_FX' }, // Foreign Exchange Losses
  { sourceRange: '72400', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Bank Charges & Other Finance Costs

  // ── Tax ───────────────────────────────────────────────────────────────
  { sourceRange: '81000', applicability: 'MANDATORY', defaultMemberCode: '0NC' }, // Current Tax Expense
  { sourceRange: '82000', applicability: 'MANDATORY', defaultMemberCode: 'NC_RECLASS' }, // Deferred Tax Expense/(Credit)

  // ── Other Comprehensive Income ────────────────────────────────────────
  { sourceRange: '91100', applicability: 'MANDATORY', defaultMemberCode: 'NC_FX' }, // FX Translation Differences
  { sourceRange: '91200', applicability: 'MANDATORY', defaultMemberCode: 'NC_REVAL' }, // FV Changes on Cash Flow Hedges
  { sourceRange: '91300', applicability: 'MANDATORY', defaultMemberCode: 'NC_RECLASS' }, // Share of OCI from Associates
  { sourceRange: '92100', applicability: 'MANDATORY', defaultMemberCode: 'NC_RECLASS' }, // Actuarial Gains/(Losses) on Pension
  { sourceRange: '92200..92300', applicability: 'MANDATORY', defaultMemberCode: 'NC_REVAL' }, // Revaluation Gain on PPE, FV Changes - Equity Instruments
];
