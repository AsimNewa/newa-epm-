# Shared Types and DTOs for NEWA EPM

This package contains all shared types, DTOs, constants, and utilities used across the NEWA EPM platform.

## Directory Structure

```
src/
├── dtos/              # Data Transfer Objects
├── types/             # TypeScript interfaces and types
├── constants/         # Application constants
├── utils/             # Utility functions
└── index.ts           # Barrel export
```

## Key Exports

### DTOs
- `UserDto`, `RoleDto` - Authentication
- `TenantDto`, `PeriodDto` - Tenant and Period management
- `EntityDto`, `ChartOfAccountDto` - Master data
- `TrialBalanceDto` - Financial data

### Types
- `User`, `Role`, `Tenant` - Core entity types
- `JwtPayload` - JWT token structure
- `ApiResponse<T>` - Standard API response

### Constants
- `ROLES` - Application roles
- `PERMISSIONS` - Permission definitions
- `ACCOUNT_TYPES` - Chart of Accounts types
