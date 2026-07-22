-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schema" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThemeSetting" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "presetName" TEXT NOT NULL DEFAULT 'newa-dark',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#14213D',
    "secondaryColor" TEXT NOT NULL DEFAULT '#8B93A0',
    "accentColor" TEXT NOT NULL DEFAULT '#C9CED6',
    "backgroundColor" TEXT NOT NULL DEFAULT '#0F1B2D',
    "surfaceColor" TEXT NOT NULL DEFAULT '#16213E',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ThemeSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "lastLogin" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "entityScope" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "regularPeriods" INTEGER NOT NULL DEFAULT 12,
    "adjustmentPeriods" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fiscalYearId" UUID,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodNumber" TEXT NOT NULL,
    "isAdjustment" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "openingBalanceSourcePeriodId" UUID,
    "copiedFromPeriodId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "currency" VARCHAR(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidationGroup" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportingCurrency" VARCHAR(3),
    "parentEntityId" UUID,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ConsolidationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupEntity" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "consolidationMethod" TEXT NOT NULL DEFAULT 'FULL',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipPeriod" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "parentEntityId" UUID NOT NULL,
    "subsidiaryEntityId" UUID NOT NULL,
    "directPercentage" DECIMAL(8,4) NOT NULL,
    "effectivePercentage" DECIMAL(8,4),
    "nciPercentage" DECIMAL(8,4),
    "effectiveFromPeriod" TEXT NOT NULL,
    "effectiveToPeriod" TEXT,
    "acquisitionCost" DECIMAL(20,6),
    "acquisitionDate" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnershipPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fromCurrency" VARCHAR(3) NOT NULL,
    "toCurrency" VARCHAR(3) NOT NULL,
    "rateDate" DATE NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "rateType" TEXT NOT NULL DEFAULT 'SPOT',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountNature" TEXT NOT NULL,
    "parentCode" TEXT,
    "rollupWeight" DECIMAL(9,4) NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dimension" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DimensionMember" (
    "id" UUID NOT NULL,
    "dimensionId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "weight" DECIMAL(9,4) NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DimensionMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialBalance" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "entityId" UUID,
    "importId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalDebits" DECIMAL(20,6) NOT NULL,
    "totalCredits" DECIMAL(20,6) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "TrialBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialBalanceRow" (
    "id" UUID NOT NULL,
    "trialBalanceId" UUID NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "debit" DECIMAL(20,6) NOT NULL,
    "credit" DECIMAL(20,6) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialBalanceRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consolidation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Consolidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidationResult" (
    "id" UUID NOT NULL,
    "consolidationId" UUID NOT NULL,
    "accountCode" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,

    CONSTRAINT "ConsolidationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_schema_key" ON "Tenant"("schema");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ThemeSetting_tenantId_key" ON "ThemeSetting"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- CreateIndex
CREATE INDEX "Role_tenantId_idx" ON "Role"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_action_key" ON "Permission"("module", "action");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "FiscalYear_tenantId_idx" ON "FiscalYear"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_tenantId_startYear_startMonth_key" ON "FiscalYear"("tenantId", "startYear", "startMonth");

-- CreateIndex
CREATE INDEX "Period_tenantId_idx" ON "Period"("tenantId");

-- CreateIndex
CREATE INDEX "Period_status_idx" ON "Period"("status");

-- CreateIndex
CREATE INDEX "Period_fiscalYearId_idx" ON "Period"("fiscalYearId");

-- CreateIndex
CREATE UNIQUE INDEX "Period_tenantId_period_key" ON "Period"("tenantId", "period");

-- CreateIndex
CREATE INDEX "Entity_tenantId_idx" ON "Entity"("tenantId");

-- CreateIndex
CREATE INDEX "Entity_periodId_idx" ON "Entity"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_tenantId_periodId_code_key" ON "Entity"("tenantId", "periodId", "code");

-- CreateIndex
CREATE INDEX "ConsolidationGroup_tenantId_idx" ON "ConsolidationGroup"("tenantId");

-- CreateIndex
CREATE INDEX "ConsolidationGroup_periodId_idx" ON "ConsolidationGroup"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidationGroup_tenantId_periodId_code_key" ON "ConsolidationGroup"("tenantId", "periodId", "code");

-- CreateIndex
CREATE INDEX "GroupEntity_groupId_idx" ON "GroupEntity"("groupId");

-- CreateIndex
CREATE INDEX "GroupEntity_entityId_idx" ON "GroupEntity"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupEntity_groupId_entityId_effectiveFrom_key" ON "GroupEntity"("groupId", "entityId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "OwnershipPeriod_tenantId_idx" ON "OwnershipPeriod"("tenantId");

-- CreateIndex
CREATE INDEX "OwnershipPeriod_groupId_idx" ON "OwnershipPeriod"("groupId");

-- CreateIndex
CREATE INDEX "OwnershipPeriod_parentEntityId_idx" ON "OwnershipPeriod"("parentEntityId");

-- CreateIndex
CREATE INDEX "OwnershipPeriod_subsidiaryEntityId_idx" ON "OwnershipPeriod"("subsidiaryEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipPeriod_tenantId_groupId_parentEntityId_subsidiaryE_key" ON "OwnershipPeriod"("tenantId", "groupId", "parentEntityId", "subsidiaryEntityId", "effectiveFromPeriod");

-- CreateIndex
CREATE INDEX "Currency_tenantId_idx" ON "Currency"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_tenantId_code_key" ON "Currency"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ExchangeRate_tenantId_rateDate_idx" ON "ExchangeRate"("tenantId", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_tenantId_fromCurrency_toCurrency_rateDate_rate_key" ON "ExchangeRate"("tenantId", "fromCurrency", "toCurrency", "rateDate", "rateType");

-- CreateIndex
CREATE INDEX "ChartOfAccount_tenantId_idx" ON "ChartOfAccount"("tenantId");

-- CreateIndex
CREATE INDEX "ChartOfAccount_periodId_idx" ON "ChartOfAccount"("periodId");

-- CreateIndex
CREATE INDEX "ChartOfAccount_accountType_idx" ON "ChartOfAccount"("accountType");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_tenantId_periodId_accountCode_key" ON "ChartOfAccount"("tenantId", "periodId", "accountCode");

-- CreateIndex
CREATE INDEX "Dimension_tenantId_idx" ON "Dimension"("tenantId");

-- CreateIndex
CREATE INDEX "Dimension_periodId_idx" ON "Dimension"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "Dimension_tenantId_periodId_name_key" ON "Dimension"("tenantId", "periodId", "name");

-- CreateIndex
CREATE INDEX "DimensionMember_dimensionId_idx" ON "DimensionMember"("dimensionId");

-- CreateIndex
CREATE INDEX "DimensionMember_parentId_idx" ON "DimensionMember"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "DimensionMember_dimensionId_code_key" ON "DimensionMember"("dimensionId", "code");

-- CreateIndex
CREATE INDEX "Scenario_tenantId_idx" ON "Scenario"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_tenantId_code_key" ON "Scenario"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TrialBalance_tenantId_periodId_idx" ON "TrialBalance"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "TrialBalance_status_idx" ON "TrialBalance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrialBalance_tenantId_periodId_entityId_key" ON "TrialBalance"("tenantId", "periodId", "entityId");

-- CreateIndex
CREATE INDEX "TrialBalanceRow_trialBalanceId_idx" ON "TrialBalanceRow"("trialBalanceId");

-- CreateIndex
CREATE INDEX "TrialBalanceRow_accountCode_idx" ON "TrialBalanceRow"("accountCode");

-- CreateIndex
CREATE INDEX "Consolidation_tenantId_periodId_idx" ON "Consolidation"("tenantId", "periodId");

-- CreateIndex
CREATE INDEX "Consolidation_status_idx" ON "Consolidation"("status");

-- CreateIndex
CREATE INDEX "ConsolidationResult_consolidationId_idx" ON "ConsolidationResult"("consolidationId");

-- CreateIndex
CREATE INDEX "ConsolidationResult_accountCode_idx" ON "ConsolidationResult"("accountCode");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ThemeSetting" ADD CONSTRAINT "ThemeSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_openingBalanceSourcePeriodId_fkey" FOREIGN KEY ("openingBalanceSourcePeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Period" ADD CONSTRAINT "Period_copiedFromPeriodId_fkey" FOREIGN KEY ("copiedFromPeriodId") REFERENCES "Period"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationGroup" ADD CONSTRAINT "ConsolidationGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationGroup" ADD CONSTRAINT "ConsolidationGroup_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationGroup" ADD CONSTRAINT "ConsolidationGroup_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEntity" ADD CONSTRAINT "GroupEntity_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ConsolidationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupEntity" ADD CONSTRAINT "GroupEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipPeriod" ADD CONSTRAINT "OwnershipPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipPeriod" ADD CONSTRAINT "OwnershipPeriod_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ConsolidationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipPeriod" ADD CONSTRAINT "OwnershipPeriod_parentEntityId_fkey" FOREIGN KEY ("parentEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnershipPeriod" ADD CONSTRAINT "OwnershipPeriod_subsidiaryEntityId_fkey" FOREIGN KEY ("subsidiaryEntityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Currency" ADD CONSTRAINT "Currency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dimension" ADD CONSTRAINT "Dimension_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dimension" ADD CONSTRAINT "Dimension_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionMember" ADD CONSTRAINT "DimensionMember_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DimensionMember" ADD CONSTRAINT "DimensionMember_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DimensionMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBalance" ADD CONSTRAINT "TrialBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBalance" ADD CONSTRAINT "TrialBalance_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialBalanceRow" ADD CONSTRAINT "TrialBalanceRow_trialBalanceId_fkey" FOREIGN KEY ("trialBalanceId") REFERENCES "TrialBalance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consolidation" ADD CONSTRAINT "Consolidation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consolidation" ADD CONSTRAINT "Consolidation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidationResult" ADD CONSTRAINT "ConsolidationResult_consolidationId_fkey" FOREIGN KEY ("consolidationId") REFERENCES "Consolidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

