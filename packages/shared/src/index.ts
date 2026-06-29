// Shared types and DTOs for NEWA EPM

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
}

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  permissions: string[];
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
