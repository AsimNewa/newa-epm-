// Shared types and DTOs for NEWA EPM

export * from './dtos';
import type { CustomFieldEntityType, CustomFieldType } from './dtos';

// ==================== AUTHENTICATION ====================
export interface JwtPayload {
  sub: string; // user ID
  email: string;
  tenantId: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  username: string;
  fullName: string;
  status: 'active' | 'inactive' | 'locked';
  mfaEnabled: boolean;
  lastLogin?: string | null;
  roles?: UserRole[];
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  mfaRequired: boolean;
  status: 'active' | 'inactive';
  permissions?: RolePermission[];
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  description?: string | null;
}

export interface RolePermission {
  roleId: string;
  permissionId: string;
  permission?: Permission;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  entityScope: string[];
  groupScope: string[];
  role?: Role;
}

// ==================== API RESPONSE ====================
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== CALENDAR & PERIOD CONTROL ====================
export interface FiscalYear {
  id: string;
  tenantId: string;
  startYear: number;
  startMonth: number;
  regularPeriods: number;
  adjustmentPeriods: number;
  status: 'active' | 'closed';
  periods?: Period[];
}

export interface Period {
  id: string;
  tenantId: string;
  fiscalYearId?: string | null;
  name: string;
  period: string;
  periodNumber: string;
  isAdjustment: boolean;
  startDate: string;
  endDate: string;
  status: 'draft' | 'open' | 'submitted' | 'locked';
  openingBalanceSourcePeriodId?: string | null;
  copiedFromPeriodId?: string | null;
}

// ==================== BRANDING / THEME ====================
export interface ThemeSetting {
  id: string;
  tenantId: string;
  presetName: string;
  logoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
}

export interface TenantSettings {
  id: string;
  tenantId: string;
  baseCurrencyCode?: string | null;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordExpiryDays?: number | null;
  lockoutThreshold: number;
  mfaRequiredByDefault: boolean;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUsername?: string | null;
  smtpPasswordSet: boolean; // the raw password is never returned by the API
  smtpFromAddress?: string | null;
  smtpFromName?: string | null;
  emailHeaderText?: string | null;
}

// ==================== CUSTOM FIELDS ====================
export interface CustomFieldDefinition {
  id: string;
  tenantId: string;
  entityType: CustomFieldEntityType;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  selectOptions: string[];
  required: boolean;
  displayOrder: number;
}

// ==================== IMPORT ====================
export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  created: number;
  errors: ImportRowError[];
}

// ==================== MASTER DATA ====================
export interface Entity {
  id: string;
  tenantId: string;
  periodId: string;
  code: string;
  name: string;
  country?: string | null;
  currency: string;
  status: 'active' | 'inactive';
  customFields?: Record<string, unknown> | null;
}

export interface ChartOfAccount {
  id: string;
  tenantId: string;
  periodId: string;
  accountCode: string;
  accountName: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  accountNature: 'DEBIT' | 'CREDIT';
  parentCode?: string | null;
  rollupWeight: number;
  status: 'active' | 'inactive';
  statementType?: 'BALANCE_SHEET' | 'PROFIT_AND_LOSS' | 'CASH_FLOW' | 'EQUITY_STATEMENT' | null;
  cashFlowCategory?: 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NON_CASH' | null;
  ifrsReference?: string | null;
  requiresIntercompanyRecon: boolean;
  requiresOtherRecon: boolean;
  rateType?: string | null;
  customFields?: Record<string, unknown> | null;
}

export interface Currency {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  active: boolean;
  customFields?: Record<string, unknown> | null;
}

export interface ExchangeRate {
  id: string;
  tenantId: string;
  fromCurrency: string;
  toCurrency: string;
  rateDate: string;
  rate: number;
  rateType: string;
}

export interface RateType {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  defaultAccountTypes: string[];
}

export interface Dimension {
  id: string;
  tenantId: string;
  periodId: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
  isSystem: boolean;
  customFields?: Record<string, unknown> | null;
}

export interface DimensionMember {
  id: string;
  dimensionId: string;
  code: string;
  name: string;
  parentCode?: string | null;
  weight: number;
  status: 'active' | 'inactive';
}

export interface DimensionRuleCondition {
  id: string;
  ruleId: string;
  /** null/undefined = this condition's source is the Chart of Accounts; otherwise another Dimension's id. */
  sourceDimensionId?: string | null;
  sourceRange: string;
}

export interface DimensionAccountRule {
  id: string;
  tenantId: string;
  periodId: string;
  dimensionId: string;
  applicability: 'MANDATORY' | 'OPTIONAL' | 'PROHIBITED';
  /** Which target-dimension member codes are allowed; null/undefined = any member allowed. */
  memberRange?: string | null;
  defaultMemberCode?: string | null;
  priority: number;
  /** One or more source conditions, ANDed together (e.g. Account range AND Department range). */
  conditions: DimensionRuleCondition[];
}

// DimensionRuleContextEntry lives in dtos.ts (used by the resolve DTOs) and is re-exported via
// `export * from './dtos'` below.

/** Result of resolving a dimension's applicability/default for one specific source code. */
export interface DimensionAccountResolution {
  dimensionId: string;
  applicability: 'MANDATORY' | 'OPTIONAL' | 'PROHIBITED';
  memberRange?: string | null;
  defaultMemberCode?: string | null;
  matchedRuleId?: string | null;
}

// ==================== OWNERSHIP STRUCTURE ====================
export interface ConsolidationGroup {
  id: string;
  tenantId: string;
  periodId: string;
  code: string;
  name: string;
  reportingCurrency?: string | null;
  parentEntityId?: string | null;
  status: 'active' | 'inactive';
  customFields?: Record<string, unknown> | null;
}

export interface GroupMember {
  id: string;
  groupId: string;
  entityId: string;
  consolidationMethod: 'FULL' | 'EQUITY' | 'PROPORTIONATE' | 'COST';
  effectiveFrom: string;
  effectiveTo?: string | null;
  entity?: Entity;
}

export interface OwnershipPeriod {
  id: string;
  tenantId: string;
  groupId: string;
  parentEntityId: string;
  subsidiaryEntityId: string;
  directPercentage: number;
  effectivePercentage?: number | null;
  nciPercentage?: number | null;
  effectiveFromPeriodId: string;
  effectiveToPeriodId?: string | null;
  acquisitionCost?: number | null;
  acquisitionDate?: string | null;
  effectiveFromPeriod?: Period;
  effectiveToPeriod?: Period | null;
}

// Combines an OwnershipPeriod with its associated GroupMember's consolidationMethod
// into one row for the unified Ownership Structure screen.
export interface OwnershipStructureEntry {
  id: string;
  tenantId: string;
  groupId: string;
  parentEntityId: string;
  subsidiaryEntityId: string;
  consolidationMethod: 'FULL' | 'EQUITY' | 'PROPORTIONATE' | 'COST';
  directPercentage: number;
  effectivePercentage?: number | null;
  nciPercentage?: number | null;
  effectiveFromPeriodId: string;
  effectiveToPeriodId?: string | null;
  acquisitionCost?: number | null;
  acquisitionDate?: string | null;
  parentEntity?: Entity;
  subsidiaryEntity?: Entity;
  effectiveFromPeriod?: Period;
  effectiveToPeriod?: Period | null;
}

// ==================== FINANCIAL ====================
export interface TrialBalance {
  id: string;
  periodId: string;
  entityId: string;
  status: 'draft' | 'submitted' | 'approved' | 'locked';
  totalDebits: number;
  totalCredits: number;
  rows: TrialBalanceRow[];
}

export interface TrialBalanceRow {
  id: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

// ==================== CONSTANTS ====================
export const ROLES = {
  SYSTEM_ADMIN: 'System Admin',
  GROUP_CONTROLLER: 'Group Controller',
  ENTITY_FINANCE: 'Entity Finance',
  VIEWER: 'Viewer',
} as const;

export const PERMISSIONS = {
  // User management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',

  // Trial Balance
  TB_CREATE: 'tb:create',
  TB_READ: 'tb:read',
  TB_SUBMIT: 'tb:submit',
  TB_APPROVE: 'tb:approve',
  TB_DELETE: 'tb:delete',

  // Consolidation
  CONSOLIDATION_RUN: 'consolidation:run',
  CONSOLIDATION_READ: 'consolidation:read',

  // Admin
  ADMIN_TENANT: 'admin:tenant',
  ADMIN_CONFIG: 'admin:config',
} as const;

export const ACCOUNT_TYPES = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;
