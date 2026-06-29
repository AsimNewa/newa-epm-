# NEWA EPM Architecture Overview

## System Architecture

NEWA EPM is built on a **microservices architecture** with the following key components:

### Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│            React Frontend (Next.js/Vite)             │
│  ├─ Components, Pages, Layouts                       │
│  ├─ State Management (Zustand + React Query)        │
│  └─ Forms (React Hook Form + Zod)                   │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│              API Gateway (Express/Kong)              │
│  ├─ Request Routing                                 │
│  ├─ Rate Limiting & Throttling                      │
│  ├─ JWT Validation                                  │
│  └─ CORS & Security Headers                         │
└───┬──────────┬──────────────┬─────────────────┬────┘
    │          │              │                 │
┌───▼──┐   ┌───▼──┐      ┌────▼───┐        ┌────▼────┐
│Auth  │   │Admin │      │Entity  │        │Close    │
│Svc   │   │Svc   │      │Svc     │        │Svc      │
│(3001)│   │(3002)│      │(3003)  │        │(3004)   │
└───┬──┘   └───┬──┘      └────┬───┘        └────┬────┘
    │          │              │                 │
└───┴──────────┴──────────────┴─────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │  PostgreSQL 16      │
    │  Schema-per-Tenant  │
    │  ├─ Public Schema   │
    │  ├─ Tenant Schema A │
    │  ├─ Tenant Schema B │
    │  └─ ...             │
    └─────────────────────┘
              │
    ┌─────────┼─────────┐
    ▼         ▼         ▼
  Redis    MinIO    Message Queue
  (Cache)  (Files)  (BullMQ)
```

## Multi-Tenancy Architecture

NEWA EPM uses **schema-per-tenant** isolation:

```
PostgreSQL Instance
├── Public Schema (shared)
│   ├── tenants
│   ├── users
│   └── roles
├── Tenant A Schema
│   ├── trial_balances
│   ├── entities
│   ├── chart_of_accounts
│   └── ...
├── Tenant B Schema
│   ├── trial_balances
│   ├── entities
│   ├── chart_of_accounts
│   └── ...
```

**Benefits:**
- Complete data isolation
- Easy schema versioning
- Per-tenant backup/restore
- Separate audit trails

## Microservices

### 1. API Gateway (Port 3000)
- **Purpose**: Single entry point for all client requests
- **Responsibilities**:
  - Request routing
  - Authentication validation
  - Rate limiting
  - Response standardization
  - CORS handling

### 2. Auth Service (Port 3001)
- **Purpose**: Authentication and authorization
- **Responsibilities**:
  - JWT token generation/validation
  - User login/logout
  - MFA management
  - SSO integration
  - Session management

### 3. Admin Service (Port 3002)
- **Purpose**: Tenant and user management
- **Responsibilities**:
  - Tenant provisioning
  - User CRUD operations
  - Role and permission management
  - System configuration
  - Database migrations

### 4. Entity Service (Port 3003) - Phase 2
- **Purpose**: Master data management
- **Responsibilities**:
  - Entity management
  - Chart of Accounts
  - Currency and exchange rates
  - Dimensions and members
  - Consolidation groups

### 5. Close Service (Port 3004) - Phase 4
- **Purpose**: Period-end close workflow
- **Responsibilities**:
  - Close calendar management
  - Workflow automation
  - Journal entry processing
  - Task assignment and tracking
  - Close checklists

### 6. Consolidation Service (Port 3005) - Phase 5
- **Purpose**: Group consolidation engine
- **Responsibilities**:
  - Trial balance consolidation
  - Currency translation (IAS 21)
  - Intercompany elimination
  - Investment elimination
  - NCI calculation

## Data Flow

### Trial Balance Submission Flow
```
1. User uploads TB file (Excel/CSV)
   ↓
2. API Gateway receives request + validates JWT
   ↓
3. Routed to Entity Service
   ↓
4. File uploaded to MinIO (S3)
   ↓
5. Async job queued to BullMQ
   ↓
6. Worker processes file:
   - Parse file
   - Map accounts
   - Validate debits = credits
   - Insert into database
   ↓
7. Status updated + notifications sent
```

### Consolidation Flow
```
1. User clicks "Run Consolidation"
   ↓
2. API Gateway routes to Consolidation Service
   ↓
3. Service fetches all entity TBs (with tenant isolation)
   ↓
4. Applies IAS 21 translation rates
   ↓
5. Eliminates intercompany transactions
   ↓
6. Calculates NCI amounts
   ↓
7. Inserts consolidated TB + audit trail
```

## Database Design Principles

### 1. Multi-Tenancy
- Every table includes `tenant_id` as part of the PK/FK
- All queries filtered by `tenant_id` from JWT context
- Schema isolation at PostgreSQL level

### 2. Financial Precision
- All monetary amounts: `NUMERIC(20, 6)`
- Exchange rates: `NUMERIC(18, 8)`
- Never use `FLOAT` or `DOUBLE`

### 3. Immutability & Audit
- Soft deletes: `is_deleted`, `deleted_at`
- Never delete financial data
- Audit log for all changes

### 4. Performance
- Indexes on `tenant_id` + frequently filtered columns
- Materialized views for complex reports
- Connection pooling (min 2, max 10)

## Security Architecture

### Authentication Flow
```
Client
  ↓ POST /auth/login
API Gateway
  ↓ Forward to Auth Service
Auth Service
  ↓ Validate credentials + generate JWT
Returns JWT (access + refresh tokens)
  ↓ Store in httpOnly cookie
Client includes JWT in requests
  ↓ Every service validates JWT
Services extract tenant_id from JWT
  ↓ Filter all queries by tenant_id
Data isolation guaranteed
```

### Authorization
- Role-based access control (RBAC)
- Permissions tied to roles
- @Roles() decorator on controllers
- Runtime permission checks

### Data Security
- All data in transit: TLS/SSL
- All data at rest: PostgreSQL encryption
- Secrets: Environment variables (AWS Secrets Manager in prod)
- No PII in logs

## Integration Points

### External Systems (Future)
- **ERP Integration**: REST API inbound (Phase 3)
- **SFTP**: File polling (Phase 3)
- **Email**: Notification service (Phase 4)
- **AI Providers**: OpenAI, Claude, Gemini (Phase 9)

### Message Queue
- **BullMQ**: Async job processing
  - TB file processing
  - Consolidation runs
  - Email notifications

## Deployment

### Development
```
docker-compose up  # Starts PostgreSQL, Redis, MinIO
npm run dev        # All services start locally
```

### Production
```
Kubernetes cluster (3+ nodes)
├── API Gateway (3 replicas)
├── Auth Service (2 replicas)
├── Admin Service (2 replicas)
├── Entity Service (2 replicas)
├── Close Service (1 replica)
└── Consolidation Service (1 replica)

External:
├── PostgreSQL RDS (Multi-AZ)
├── Redis Elasticache (Sentinel mode)
└── S3 / CloudFront
```

---

## Phase Roadmap

- **Phase 1-3**: Foundation (Auth, Master Data, Data Integration)
- **Phase 4-6**: Core Features (Close, Consolidation, Statements)
- **Phase 7-9**: Advanced (Planning, Reconciliation, AI)
- **Phase 10+**: Enterprise (Analytics, ESG, Extensions)
