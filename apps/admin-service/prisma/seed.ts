import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { firstDayOfMonthUTC, lastDayOfMonthUTC, monthName } from '../src/periods/period-date.util';

const prisma = new PrismaClient();

const MODULES = ['admin', 'master-data', 'consolidation', 'reporting', 'planning'] as const;
const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'lock'] as const;

// MFA mandatory for admins, optional for users (spec 2.5.1 Authentication)
const SYSTEM_ROLES = [
  {
    name: 'Super Administrator',
    description: 'Full system access. Configure tenants, modules, integrations.',
    mfaRequired: true,
  },
  {
    name: 'Tenant Administrator',
    description: 'Full access within tenant. Manage users, companies, settings.',
    mfaRequired: true,
  },
  { name: 'Group Controller', description: 'Full access to consolidation, journals, reporting. All entities.' },
  { name: 'Entity Finance Manager', description: 'Full access to assigned entities only.' },
  { name: 'FP&A Manager', description: 'Budget and forecast modules. Read-only on actuals.' },
  { name: 'Reporting Analyst', description: 'Read-only access to all reporting. No data entry.' },
  { name: 'Auditor', description: 'Read-only access with drill-through. Cannot modify data.' },
  { name: 'Workflow Approver', description: 'Approve workflow tasks assigned to them.' },
  { name: 'Integration User', description: 'API access only. No UI access. Used for ERP connectors.' },
];

async function seedPermissions() {
  const rows = MODULES.flatMap((module) =>
    ACTIONS.map((action) => ({ module, action, description: `${action} access on ${module}` })),
  );

  await prisma.permission.createMany({ data: rows, skipDuplicates: true });

  return prisma.permission.findMany();
}

async function seedTenant() {
  return prisma.tenant.upsert({
    where: { slug: 'acme-test' },
    update: {},
    create: { name: 'Acme Test Tenant', slug: 'acme-test', schema: 'acme_test' },
  });
}

async function seedCurrencies(tenantId: string) {
  const currencies = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'AED', name: 'UAE Dirham' },
    { code: 'JPY', name: 'Japanese Yen' },
  ];

  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { tenantId_code: { tenantId, code: currency.code } },
      update: {},
      create: { tenantId, ...currency },
    });
  }

  const rates: Array<{ from: string; to: string; rate: number }> = [
    { from: 'EUR', to: 'USD', rate: 1.08 },
    { from: 'GBP', to: 'USD', rate: 1.27 },
    { from: 'AED', to: 'USD', rate: 0.2723 },
    { from: 'JPY', to: 'USD', rate: 0.0067 },
  ];

  for (const rateDate of ['2026-01-31', '2026-02-28']) {
    for (const { from, to, rate } of rates) {
      for (const rateType of ['SPOT', 'CLOSING'] as const) {
        await prisma.exchangeRate.upsert({
          where: {
            tenantId_fromCurrency_toCurrency_rateDate_rateType: {
              tenantId,
              fromCurrency: from,
              toCurrency: to,
              rateDate: new Date(rateDate),
              rateType,
            },
          },
          update: {},
          create: {
            tenantId,
            fromCurrency: from,
            toCurrency: to,
            rateDate: new Date(rateDate),
            rate,
            rateType,
          },
        });
      }
    }
  }
}

async function seedFiscalYear(tenantId: string) {
  const startYear = 2026;
  const regularPeriods = 12;
  const adjustmentPeriods = 1;

  const fiscalYear = await prisma.fiscalYear.upsert({
    where: { tenantId_startYear_startMonth: { tenantId, startYear, startMonth: 1 } },
    update: {},
    create: { tenantId, startYear, startMonth: 1, regularPeriods, adjustmentPeriods },
  });

  const periods: { id: string }[] = [];
  let previousPeriodId: string | undefined;
  let yearEndDate = firstDayOfMonthUTC(startYear, 1);

  for (let i = 1; i <= regularPeriods + adjustmentPeriods; i++) {
    const isAdjustment = i > regularPeriods;
    const periodNumber = String(i).padStart(3, '0');
    const code = `${startYear}-${periodNumber}`;

    let startDate: Date;
    let endDate: Date;
    let name: string;

    if (!isAdjustment) {
      startDate = firstDayOfMonthUTC(startYear, i);
      endDate = lastDayOfMonthUTC(startYear, i);
      name = `${monthName(i)} ${startYear}`;
      yearEndDate = endDate;
    } else {
      startDate = yearEndDate;
      endDate = yearEndDate;
      name = `Adjustment ${i - regularPeriods}`;
    }

    const period = await prisma.period.upsert({
      where: { tenantId_period: { tenantId, period: code } },
      update: {},
      create: {
        tenantId,
        fiscalYearId: fiscalYear.id,
        name,
        period: code,
        periodNumber,
        isAdjustment,
        startDate,
        endDate,
        openingBalanceSourcePeriodId: previousPeriodId,
      },
    });

    periods.push(period);
    previousPeriodId = period.id;
  }

  return periods[0]; // Jan 2026 — the period master data is seeded under
}

async function seedEntities(tenantId: string, periodId: string) {
  const entities = [
    { code: 'HOLD-US', name: 'Acme Holdings Inc.', country: 'USA', currency: 'USD' },
    { code: 'SUB-UK', name: 'Acme UK Ltd.', country: 'GBR', currency: 'GBP' },
    { code: 'SUB-DE', name: 'Acme Germany GmbH', country: 'DEU', currency: 'EUR' },
    { code: 'SUB-AE', name: 'Acme Middle East FZE', country: 'ARE', currency: 'AED' },
    { code: 'SUB-JP', name: 'Acme Japan KK', country: 'JPN', currency: 'JPY' },
  ];

  const created: Record<string, { id: string }> = {};

  for (const entity of entities) {
    created[entity.code] = await prisma.entity.upsert({
      where: { tenantId_periodId_code: { tenantId, periodId, code: entity.code } },
      update: {},
      create: { tenantId, periodId, ...entity },
    });
  }

  return created;
}

async function seedChartOfAccounts(tenantId: string, periodId: string) {
  type Account = {
    accountCode: string;
    accountName: string;
    accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
    accountNature: 'DEBIT' | 'CREDIT';
    parentCode?: string;
    rollupWeight?: number;
    statementType?: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'CASH_FLOW' | 'EQUITY_STATEMENT';
    cashFlowCategory?: 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH';
    ifrsReference?: string;
    requiresIntercompanyRecon?: boolean;
    requiresOtherRecon?: boolean;
  };

  // Shorthand aliases for readability
  const BS = 'BALANCE_SHEET' as const;
  const PL = 'PROFIT_AND_LOSS' as const;
  const ES = 'EQUITY_STATEMENT' as const;
  const OPR = 'OPERATING' as const;
  const INV = 'INVESTING' as const;
  const FIN = 'FINANCING' as const;
  const NCA = 'NON_CASH' as const;

  // IFRS-compliant COA for a manufacturing/holding group (~130 accounts).
  // Array order defines creation order — parents must appear before children.
  const accounts: Account[] = [

    // ═══════════════════════════════════════════════════════════
    // ASSETS (1xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '10000', accountName: 'Total Assets',               accountType: 'ASSET', accountNature: 'DEBIT', statementType: BS, ifrsReference: 'IAS 1' },

    // ── Non-Current Assets ────────────────────────────────────
    { accountCode: '11000', accountName: 'Non-Current Assets',         accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '10000', statementType: BS, ifrsReference: 'IAS 1' },

    // PPE (IAS 16)
    { accountCode: '11100', accountName: 'Property, Plant & Equipment',                accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11000', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 16', requiresOtherRecon: true },
    { accountCode: '11110', accountName: 'Land & Buildings',                           accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11100', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 16', requiresOtherRecon: true },
    { accountCode: '11120', accountName: 'Plant & Machinery',                          accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11100', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 16' },
    { accountCode: '11130', accountName: 'Vehicles & Fleet',                           accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11100', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 16' },
    { accountCode: '11140', accountName: 'Office Equipment & Furniture',               accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11100', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 16' },
    { accountCode: '11190', accountName: 'Accumulated Depreciation - PPE',             accountType: 'ASSET', accountNature: 'CREDIT', parentCode: '11100', rollupWeight: -1, statementType: BS, cashFlowCategory: NCA, ifrsReference: 'IAS 16' },

    // Right-of-Use Assets (IFRS 16)
    { accountCode: '11200', accountName: 'Right-of-Use Assets',                        accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 16' },
    { accountCode: '11210', accountName: 'ROU Assets - Property Leases',               accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11200', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 16' },
    { accountCode: '11220', accountName: 'ROU Assets - Equipment Leases',              accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11200', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 16' },
    { accountCode: '11290', accountName: 'Accumulated Amortisation - ROU Assets',      accountType: 'ASSET', accountNature: 'CREDIT', parentCode: '11200', rollupWeight: -1, statementType: BS, cashFlowCategory: NCA, ifrsReference: 'IFRS 16' },

    // Intangible Assets (IAS 38 / IFRS 3)
    { accountCode: '11300', accountName: 'Intangible Assets',                          accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11000', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 38' },
    { accountCode: '11310', accountName: 'Goodwill',                                   accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11300', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IFRS 3', requiresOtherRecon: true },
    { accountCode: '11320', accountName: 'Customer Relationships',                     accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11300', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IFRS 3' },
    { accountCode: '11330', accountName: 'Patents & Licenses',                         accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11300', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 38' },
    { accountCode: '11340', accountName: 'Capitalised Development Costs',              accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11300', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 38' },
    { accountCode: '11390', accountName: 'Accumulated Amortisation - Intangibles',     accountType: 'ASSET', accountNature: 'CREDIT', parentCode: '11300', rollupWeight: -1, statementType: BS, cashFlowCategory: NCA, ifrsReference: 'IAS 38' },

    { accountCode: '11400', accountName: 'Investments in Associates',                  accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11000', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 28' },
    { accountCode: '11500', accountName: 'Deferred Tax Assets',                        accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11000', statementType: BS, cashFlowCategory: NCA, ifrsReference: 'IAS 12' },
    { accountCode: '11600', accountName: 'Other Non-Current Assets',                   accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '11000', statementType: BS, cashFlowCategory: INV, ifrsReference: 'IAS 1' },

    // ── Current Assets ────────────────────────────────────────
    { accountCode: '12000', accountName: 'Current Assets',                             accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '10000', statementType: BS, ifrsReference: 'IAS 1' },
    { accountCode: '12100', accountName: 'Cash & Cash Equivalents',                    accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 7', requiresOtherRecon: true },

    { accountCode: '12200', accountName: 'Trade Receivables',                          accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9', requiresOtherRecon: true },
    { accountCode: '12210', accountName: 'Trade Receivables - Third Party',            accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12200', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9', requiresOtherRecon: true },
    { accountCode: '12220', accountName: 'Trade Receivables - Intercompany',           accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12200', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9', requiresIntercompanyRecon: true, requiresOtherRecon: true },
    { accountCode: '12230', accountName: 'Allowance for Doubtful Debts',              accountType: 'ASSET', accountNature: 'CREDIT', parentCode: '12200', rollupWeight: -1, statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9' },

    { accountCode: '12300', accountName: 'Contract Assets',                            accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 15' },

    { accountCode: '12400', accountName: 'Inventories',                                accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 2', requiresOtherRecon: true },
    { accountCode: '12410', accountName: 'Raw Materials',                              accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12400', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 2' },
    { accountCode: '12420', accountName: 'Work in Progress',                           accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12400', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 2' },
    { accountCode: '12430', accountName: 'Finished Goods',                             accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12400', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 2' },

    { accountCode: '12500', accountName: 'Prepayments & Other Receivables',            accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 1' },
    { accountCode: '12600', accountName: 'Current Tax Receivable',                     accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 12' },
    { accountCode: '12700', accountName: 'Other Financial Assets - Current',           accountType: 'ASSET', accountNature: 'DEBIT', parentCode: '12000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9' },

    // ═══════════════════════════════════════════════════════════
    // EQUITY (2xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '20000', accountName: 'Total Equity',                               accountType: 'EQUITY', accountNature: 'CREDIT', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 1' },
    { accountCode: '21000', accountName: 'Equity Attributable to Owners',              accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '20000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 1' },
    { accountCode: '21100', accountName: 'Share Capital',                              accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 1' },
    { accountCode: '21200', accountName: 'Share Premium Reserve',                      accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 1' },
    { accountCode: '21300', accountName: 'Retained Earnings',                          accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 1' },
    { accountCode: '21400', accountName: 'Other Reserves',                             accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21000', statementType: BS, ifrsReference: 'IAS 1' },
    { accountCode: '21410', accountName: 'Foreign Currency Translation Reserve',       accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21400', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 21' },
    { accountCode: '21420', accountName: 'Fair Value Reserve - Financial Instruments', accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21400', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 9' },
    { accountCode: '21430', accountName: 'Revaluation Surplus',                        accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21400', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 16' },
    { accountCode: '21440', accountName: 'Hedging Reserve',                            accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '21400', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 9' },
    { accountCode: '22000', accountName: 'Non-Controlling Interests',                  accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '20000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 10' },

    // ═══════════════════════════════════════════════════════════
    // LIABILITIES (3xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '30000', accountName: 'Total Liabilities',                          accountType: 'LIABILITY', accountNature: 'CREDIT', statementType: BS, ifrsReference: 'IAS 1' },

    // ── Non-Current Liabilities ───────────────────────────────
    { accountCode: '31000', accountName: 'Non-Current Liabilities',                    accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '30000', statementType: BS, ifrsReference: 'IAS 1' },
    { accountCode: '31100', accountName: 'Borrowings - Non-Current',                   accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 9', requiresOtherRecon: true },
    { accountCode: '31110', accountName: 'Bank Loans - Non-Current',                   accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31100', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 9', requiresOtherRecon: true },
    { accountCode: '31120', accountName: 'Bonds & Notes Payable',                      accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31100', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 9' },
    { accountCode: '31200', accountName: 'Lease Liabilities - Non-Current',            accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 16' },
    { accountCode: '31300', accountName: 'Deferred Tax Liabilities',                   accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31000', statementType: BS, cashFlowCategory: NCA, ifrsReference: 'IAS 12' },
    { accountCode: '31400', accountName: 'Employee Benefit Obligations',               accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 19' },
    { accountCode: '31500', accountName: 'Provisions - Non-Current',                   accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 37' },
    { accountCode: '31600', accountName: 'Other Non-Current Liabilities',              accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '31000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 1' },

    // ── Current Liabilities ───────────────────────────────────
    { accountCode: '32000', accountName: 'Current Liabilities',                        accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '30000', statementType: BS, ifrsReference: 'IAS 1' },
    { accountCode: '32100', accountName: 'Trade Payables',                             accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9', requiresOtherRecon: true },
    { accountCode: '32110', accountName: 'Trade Payables - Third Party',               accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32100', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9', requiresOtherRecon: true },
    { accountCode: '32120', accountName: 'Trade Payables - Intercompany',              accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32100', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 9', requiresIntercompanyRecon: true, requiresOtherRecon: true },
    { accountCode: '32200', accountName: 'Contract Liabilities',                       accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IFRS 15' },
    { accountCode: '32300', accountName: 'Borrowings - Current',                       accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 9' },
    { accountCode: '32400', accountName: 'Lease Liabilities - Current',                accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IFRS 16' },
    { accountCode: '32500', accountName: 'Accruals & Other Payables',                  accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 1' },
    { accountCode: '32600', accountName: 'Income Tax Payable',                         accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32000', statementType: BS, cashFlowCategory: OPR, ifrsReference: 'IAS 12' },
    { accountCode: '32700', accountName: 'Dividends Payable',                          accountType: 'LIABILITY', accountNature: 'CREDIT', parentCode: '32000', statementType: BS, cashFlowCategory: FIN, ifrsReference: 'IAS 1' },

    // ═══════════════════════════════════════════════════════════
    // REVENUE (4xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '40000', accountName: 'Total Revenue',                              accountType: 'REVENUE', accountNature: 'CREDIT', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 15' },
    { accountCode: '41000', accountName: 'Revenue from Contracts with Customers',      accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '40000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 15' },
    { accountCode: '41100', accountName: 'Product Sales Revenue',                      accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '41000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 15' },
    { accountCode: '41200', accountName: 'Service Revenue',                            accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '41000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 15' },
    { accountCode: '41300', accountName: 'License & Royalty Revenue',                  accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '41000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 15' },
    { accountCode: '42000', accountName: 'Intercompany Revenue',                       accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '40000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 15', requiresIntercompanyRecon: true },
    { accountCode: '43000', accountName: 'Other Operating Income',                     accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '40000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 1' },
    { accountCode: '43100', accountName: 'Rental Income',                              accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '43000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 16' },
    { accountCode: '43200', accountName: 'Government Grants Income',                   accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '43000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 20' },
    { accountCode: '43300', accountName: 'Gain on Disposal of Assets',                 accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '43000', statementType: PL, cashFlowCategory: INV, ifrsReference: 'IAS 16' },

    // ═══════════════════════════════════════════════════════════
    // COST OF SALES (5xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '50000', accountName: 'Total Cost of Sales',                        accountType: 'EXPENSE', accountNature: 'DEBIT', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 2' },
    { accountCode: '51000', accountName: 'Direct Materials',                           accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '50000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 2' },
    { accountCode: '52000', accountName: 'Direct Labour',                              accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '50000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 19' },
    { accountCode: '53000', accountName: 'Manufacturing Overhead',                     accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '50000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '53100', accountName: 'Factory Utilities',                          accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '53000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '53200', accountName: 'Factory Rent & Rates',                       accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '53000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 16' },
    { accountCode: '53300', accountName: 'Depreciation - Production Assets',           accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '53000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IAS 16' },
    { accountCode: '54000', accountName: 'Inventory Write-downs & Provisions',         accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '50000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 2' },
    { accountCode: '55000', accountName: 'Intercompany Purchases',                     accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '50000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 15', requiresIntercompanyRecon: true },

    // ═══════════════════════════════════════════════════════════
    // OPERATING EXPENSES (6xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '60000', accountName: 'Total Operating Expenses',                   accountType: 'EXPENSE', accountNature: 'DEBIT', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '61000', accountName: 'Selling & Distribution Expenses',            accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '60000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '61100', accountName: 'Sales Staff Salaries & Commissions',         accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '61000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 19' },
    { accountCode: '61200', accountName: 'Marketing & Advertising',                    accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '61000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '61300', accountName: 'Freight & Distribution Costs',               accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '61000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '61400', accountName: 'Customer Service Costs',                     accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '61000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '62000', accountName: 'General & Administrative Expenses',          accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '60000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '62100', accountName: 'Management Salaries & Benefits',             accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '62000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 19' },
    { accountCode: '62200', accountName: 'Office Rent & Facilities',                   accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '62000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 16' },
    { accountCode: '62300', accountName: 'IT & Technology Costs',                      accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '62000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '62400', accountName: 'Legal & Professional Fees',                  accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '62000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '62500', accountName: 'Audit Fees',                                 accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '62000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '62600', accountName: 'Insurance Expense',                          accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '62000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '62700', accountName: 'Travel & Entertainment',                     accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '62000', statementType: PL, cashFlowCategory: OPR },
    { accountCode: '63000', accountName: 'Research & Development',                     accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '60000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 38' },
    { accountCode: '64000', accountName: 'Depreciation & Amortisation',                accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '60000', statementType: PL, cashFlowCategory: NCA },
    { accountCode: '64100', accountName: 'Depreciation - Offices & Buildings',         accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '64000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IAS 16' },
    { accountCode: '64200', accountName: 'Amortisation - Intangible Assets',           accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '64000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IAS 38' },
    { accountCode: '64300', accountName: 'Amortisation - ROU Assets',                  accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '64000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IFRS 16' },
    { accountCode: '65000', accountName: 'Share-Based Payment Expense',                accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '60000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IFRS 2' },
    { accountCode: '66000', accountName: 'Impairment Losses',                          accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '60000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IAS 36' },
    { accountCode: '66100', accountName: 'Impairment of Goodwill',                     accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '66000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IAS 36' },
    { accountCode: '66200', accountName: 'Impairment of Trade Receivables',            accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '66000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IFRS 9' },

    // ═══════════════════════════════════════════════════════════
    // FINANCE INCOME & COSTS (7xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '70000', accountName: 'Net Finance Items',                          accountType: 'EXPENSE', accountNature: 'DEBIT', statementType: PL, ifrsReference: 'IFRS 9' },
    { accountCode: '71000', accountName: 'Finance Income',                             accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '70000', statementType: PL, cashFlowCategory: INV, ifrsReference: 'IFRS 9' },
    { accountCode: '71100', accountName: 'Interest Income',                            accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '71000', statementType: PL, cashFlowCategory: INV, ifrsReference: 'IFRS 9' },
    { accountCode: '71200', accountName: 'Dividend Income from Associates',            accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '71000', statementType: PL, cashFlowCategory: INV, ifrsReference: 'IAS 28' },
    { accountCode: '71300', accountName: 'Foreign Exchange Gains',                     accountType: 'REVENUE', accountNature: 'CREDIT', parentCode: '71000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 21' },
    { accountCode: '72000', accountName: 'Finance Costs',                              accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '70000', statementType: PL, cashFlowCategory: FIN, ifrsReference: 'IFRS 9' },
    { accountCode: '72100', accountName: 'Interest Expense - Bank Loans',              accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '72000', statementType: PL, cashFlowCategory: FIN, ifrsReference: 'IFRS 9' },
    { accountCode: '72200', accountName: 'Interest Expense - Lease Liabilities',       accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '72000', statementType: PL, cashFlowCategory: FIN, ifrsReference: 'IFRS 16' },
    { accountCode: '72300', accountName: 'Foreign Exchange Losses',                    accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '72000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 21' },
    { accountCode: '72400', accountName: 'Bank Charges & Other Finance Costs',         accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '72000', statementType: PL, cashFlowCategory: FIN },

    // ═══════════════════════════════════════════════════════════
    // TAX (8xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '80000', accountName: 'Total Tax Expense',                          accountType: 'EXPENSE', accountNature: 'DEBIT', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 12' },
    { accountCode: '81000', accountName: 'Current Tax Expense',                        accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '80000', statementType: PL, cashFlowCategory: OPR, ifrsReference: 'IAS 12' },
    { accountCode: '82000', accountName: 'Deferred Tax Expense / (Credit)',            accountType: 'EXPENSE', accountNature: 'DEBIT', parentCode: '80000', statementType: PL, cashFlowCategory: NCA, ifrsReference: 'IAS 12' },

    // ═══════════════════════════════════════════════════════════
    // OTHER COMPREHENSIVE INCOME (9xxxx)
    // ═══════════════════════════════════════════════════════════
    { accountCode: '90000', accountName: 'Total Other Comprehensive Income',           accountType: 'EQUITY', accountNature: 'CREDIT', statementType: ES, ifrsReference: 'IAS 1' },
    { accountCode: '91000', accountName: 'Items Reclassifiable to P&L',               accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '90000', statementType: ES, ifrsReference: 'IAS 1' },
    { accountCode: '91100', accountName: 'Foreign Currency Translation Differences',   accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '91000', statementType: ES, cashFlowCategory: NCA, ifrsReference: 'IAS 21' },
    { accountCode: '91200', accountName: 'Fair Value Changes on Cash Flow Hedges',     accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '91000', statementType: ES, cashFlowCategory: NCA, ifrsReference: 'IFRS 9' },
    { accountCode: '91300', accountName: 'Share of OCI from Associates',               accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '91000', statementType: ES, cashFlowCategory: NCA, ifrsReference: 'IAS 28' },
    { accountCode: '92000', accountName: 'Items Not Reclassifiable to P&L',            accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '90000', statementType: ES, ifrsReference: 'IAS 1' },
    { accountCode: '92100', accountName: 'Actuarial Gains/(Losses) on Pension',        accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '92000', statementType: ES, cashFlowCategory: NCA, ifrsReference: 'IAS 19' },
    { accountCode: '92200', accountName: 'Revaluation Gain on PPE',                    accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '92000', statementType: ES, cashFlowCategory: NCA, ifrsReference: 'IAS 16' },
    { accountCode: '92300', accountName: 'Fair Value Changes - Equity Instruments',    accountType: 'EQUITY', accountNature: 'CREDIT', parentCode: '92000', statementType: ES, cashFlowCategory: NCA, ifrsReference: 'IFRS 9' },
  ];

  for (const account of accounts) {
    const fields = {
      accountName:               account.accountName,
      accountType:               account.accountType,
      accountNature:             account.accountNature,
      parentCode:                account.parentCode ?? null,
      rollupWeight:              account.rollupWeight ?? 1,
      statementType:             account.statementType ?? null,
      cashFlowCategory:          account.cashFlowCategory ?? null,
      ifrsReference:             account.ifrsReference ?? null,
      requiresIntercompanyRecon: account.requiresIntercompanyRecon ?? false,
      requiresOtherRecon:        account.requiresOtherRecon ?? false,
    };
    await prisma.chartOfAccount.upsert({
      where: { tenantId_periodId_accountCode: { tenantId, periodId, accountCode: account.accountCode } },
      update: fields,
      create: { tenantId, periodId, accountCode: account.accountCode, ...fields },
    });
  }

  console.log(`  Chart of Accounts: ${accounts.length} IFRS accounts seeded`);
}

async function seedDimensions(tenantId: string, periodId: string) {
  const costCenter = await prisma.dimension.upsert({
    where: { tenantId_periodId_name: { tenantId, periodId, name: 'Cost Center' } },
    update: {},
    create: { tenantId, periodId, name: 'Cost Center', type: 'COST_CENTER' },
  });

  type Member = { code: string; name: string; parentCode?: string; weight?: number };

  const members: Member[] = [
    { code: 'CC000', name: 'Total Cost Centers' },
    { code: 'CC100', name: 'Sales', parentCode: 'CC000' },
    { code: 'CC110', name: 'Sales - North America', parentCode: 'CC100' },
    { code: 'CC120', name: 'Sales - EMEA', parentCode: 'CC100' },
    { code: 'CC200', name: 'Operations', parentCode: 'CC000' },
    { code: 'CC210', name: 'Operations - Manufacturing', parentCode: 'CC200' },
    { code: 'CC220', name: 'Operations - Logistics', parentCode: 'CC200' },
    { code: 'CC900', name: 'Intercompany Eliminations', parentCode: 'CC000', weight: -1 },
  ];

  for (const member of members) {
    await prisma.dimensionMember.upsert({
      where: { dimensionId_code: { dimensionId: costCenter.id, code: member.code } },
      update: { name: member.name, parentCode: member.parentCode ?? null, weight: member.weight ?? 1 },
      create: {
        dimensionId: costCenter.id,
        code: member.code,
        name: member.name,
        parentCode: member.parentCode,
        weight: member.weight ?? 1,
      },
    });
  }

  const department = await prisma.dimension.upsert({
    where: { tenantId_periodId_name: { tenantId, periodId, name: 'Department' } },
    update: {},
    create: { tenantId, periodId, name: 'Department', type: 'DEPARTMENT' },
  });

  for (const dept of ['Finance', 'Human Resources', 'IT', 'Sales', 'Operations']) {
    await prisma.dimensionMember.upsert({
      where: { dimensionId_code: { dimensionId: department.id, code: dept.toUpperCase().replace(/\s+/g, '_') } },
      update: {},
      create: { dimensionId: department.id, code: dept.toUpperCase().replace(/\s+/g, '_'), name: dept },
    });
  }

  const project = await prisma.dimension.upsert({
    where: { tenantId_periodId_name: { tenantId, periodId, name: 'Project' } },
    update: {},
    create: { tenantId, periodId, name: 'Project', type: 'PROJECT' },
  });

  for (const proj of ['Project Alpha', 'Project Beta', 'Project Gamma']) {
    const code = proj.toUpperCase().replace(/\s+/g, '_');
    await prisma.dimensionMember.upsert({
      where: { dimensionId_code: { dimensionId: project.id, code } },
      update: {},
      create: { dimensionId: project.id, code, name: proj },
    });
  }
}

async function seedRolesAndPermissions(tenantId: string) {
  const roles: Record<string, { id: string }> = {};

  for (const role of SYSTEM_ROLES) {
    roles[role.name] = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: role.name } },
      update: {},
      create: {
        tenantId,
        name: role.name,
        description: role.description,
        isSystem: true,
        mfaRequired: role.mfaRequired ?? false,
      },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const byModuleAction = (module: string, action: string) =>
    allPermissions.find((p) => p.module === module && p.action === action)!.id;

  const grant = async (roleName: string, permissionIds: string[]) => {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId: roles[roleName].id, permissionId })),
      skipDuplicates: true,
    });
  };

  await grant(
    'Tenant Administrator',
    allPermissions.filter((p) => p.module === 'admin' || p.module === 'master-data').map((p) => p.id),
  );
  await grant(
    'Group Controller',
    allPermissions.filter((p) => p.module !== 'admin').map((p) => p.id),
  );
  await grant(
    'Auditor',
    MODULES.map((module) => byModuleAction(module, 'view')),
  );
  await grant('FP&A Manager', [
    byModuleAction('planning', 'view'),
    byModuleAction('planning', 'create'),
    byModuleAction('planning', 'edit'),
    byModuleAction('reporting', 'view'),
  ]);
  await grant('Reporting Analyst', [byModuleAction('reporting', 'view')]);

  return roles;
}

async function seedUsers(tenantId: string, roles: Record<string, { id: string }>) {
  const passwordHash = await bcrypt.hash('Passw0rd!2026', 12);

  const users = [
    { email: 'admin@acme-test.com', username: 'tenant.admin', fullName: 'Taylor Admin', role: 'Tenant Administrator' },
    { email: 'controller@acme-test.com', username: 'group.controller', fullName: 'Alexandra Chen', role: 'Group Controller' },
    { email: 'finance.uk@acme-test.com', username: 'uk.finance', fullName: 'James Whitfield', role: 'Entity Finance Manager' },
    { email: 'fpa@acme-test.com', username: 'fpa.manager', fullName: 'Priya Sharma', role: 'FP&A Manager' },
    { email: 'analyst@acme-test.com', username: 'reporting.analyst', fullName: 'Daniela Rossi', role: 'Reporting Analyst' },
    { email: 'audit@acme-test.com', username: 'external.auditor', fullName: 'Thomas Weber', role: 'Auditor' },
  ];

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email: user.email } },
      update: {},
      create: {
        tenantId,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        password: passwordHash,
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: created.id, roleId: roles[user.role].id } },
      update: {},
      create: { userId: created.id, roleId: roles[user.role].id },
    });
  }
}

async function seedOwnershipStructure(tenantId: string, periodId: string, entities: Record<string, { id: string }>) {
  const group = await prisma.consolidationGroup.upsert({
    where: { tenantId_periodId_code: { tenantId, periodId, code: 'GRP-GLOBAL' } },
    update: {},
    create: {
      tenantId,
      periodId,
      code: 'GRP-GLOBAL',
      name: 'Acme Global Group',
      reportingCurrency: 'USD',
      parentEntityId: entities['HOLD-US'].id,
    },
  });

  const members: Array<{ code: string; method: 'FULL' | 'EQUITY' | 'PROPORTIONATE'; direct: number }> = [
    { code: 'SUB-UK', method: 'FULL', direct: 100 },
    { code: 'SUB-DE', method: 'FULL', direct: 80 },
    { code: 'SUB-AE', method: 'PROPORTIONATE', direct: 60 },
    { code: 'SUB-JP', method: 'EQUITY', direct: 30 },
  ];

  for (const member of members) {
    await prisma.groupEntity.upsert({
      where: {
        groupId_entityId_effectiveFrom: {
          groupId: group.id,
          entityId: entities[member.code].id,
          effectiveFrom: new Date('2026-01-01'),
        },
      },
      update: {},
      create: {
        groupId: group.id,
        entityId: entities[member.code].id,
        consolidationMethod: member.method,
        effectiveFrom: new Date('2026-01-01'),
      },
    });

    await prisma.ownershipPeriod.upsert({
      where: {
        tenantId_groupId_parentEntityId_subsidiaryEntityId_effectiveFromPeriodId: {
          tenantId,
          groupId: group.id,
          parentEntityId: entities['HOLD-US'].id,
          subsidiaryEntityId: entities[member.code].id,
          effectiveFromPeriodId: periodId,
        },
      },
      update: {},
      create: {
        tenantId,
        groupId: group.id,
        parentEntityId: entities['HOLD-US'].id,
        subsidiaryEntityId: entities[member.code].id,
        directPercentage: member.direct,
        effectivePercentage: member.direct,
        nciPercentage: 100 - member.direct,
        effectiveFromPeriodId: periodId,
        acquisitionDate: new Date('2024-06-01'),
        acquisitionCost: 5_000_000,
      },
    });
  }
}

async function seedTenantSettings(tenantId: string) {
  await prisma.tenantSettings.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      baseCurrencyCode: 'USD',
      passwordMinLength: 12,
      passwordRequireUppercase: true,
      passwordRequireNumber: true,
      passwordRequireSymbol: false,
      lockoutThreshold: 5,
      mfaRequiredByDefault: false,
      smtpHost: 'localhost',
      smtpPort: 1025,
      smtpFromAddress: 'noreply@acme-test.com',
      smtpFromName: 'NEWA EPM',
      emailHeaderText: 'Acme Test Tenant — NEWA EPM',
    },
  });
}

async function main() {
  const tenant = await seedTenant();
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  const period = await seedFiscalYear(tenant.id);
  console.log(`Period: ${period.id} (FY2026, Jan 2026 — all master data seeded under this period)`);

  await seedPermissions();
  await seedCurrencies(tenant.id);
  const entities = await seedEntities(tenant.id, period.id);
  await seedChartOfAccounts(tenant.id, period.id);
  await seedDimensions(tenant.id, period.id);
  const roles = await seedRolesAndPermissions(tenant.id);
  await seedUsers(tenant.id, roles);
  await seedOwnershipStructure(tenant.id, period.id, entities);
  await seedTenantSettings(tenant.id);

  console.log('Seed complete.');
  console.log(`Use this tenant id in the frontend: ${tenant.id}`);
  console.log(`Use this period id in the frontend: ${period.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
