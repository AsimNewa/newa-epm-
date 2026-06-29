import { IsNotEmpty, IsEmail, IsString, IsUUID, IsOptional } from 'class-validator';

// ==================== AUTHENTICATION DTOs ====================
export class LoginDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  mfaCode?: string;
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  status?: 'active' | 'inactive' | 'locked';
}

// ==================== TENANT DTOs ====================
export class CreateTenantDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  slug: string;
}

export class CreatePeriodDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  period: string; // YYYY-MM format

  @IsNotEmpty()
  startDate: Date;

  @IsNotEmpty()
  endDate: Date;
}

// ==================== MASTER DATA DTOs ====================
export class CreateEntityDto {
  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsNotEmpty()
  @IsString()
  currency: string; // ISO currency code
}

export class CreateChartOfAccountDto {
  @IsNotEmpty()
  @IsString()
  accountCode: string;

  @IsNotEmpty()
  @IsString()
  accountName: string;

  @IsNotEmpty()
  @IsString()
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

  @IsOptional()
  @IsString()
  parentCode?: string;
}

// ==================== TRIAL BALANCE DTOs ====================
export class CreateTrialBalanceDto {
  @IsNotEmpty()
  @IsUUID()
  periodId: string;

  @IsNotEmpty()
  @IsUUID()
  entityId: string;

  @IsNotEmpty()
  rows: TrialBalanceRowDto[];
}

export class TrialBalanceRowDto {
  @IsNotEmpty()
  @IsString()
  accountCode: string;

  @IsNotEmpty()
  @IsString()
  accountName: string;

  @IsNotEmpty()
  debit: number;

  @IsNotEmpty()
  credit: number;
}

// ==================== API RESPONSE DTOs ====================
export class ApiResponseDto<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
