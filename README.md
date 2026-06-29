# NEWA Enterprise Performance Management (NEWA EPM)

A cloud-native, multi-tenant Enterprise Performance Management platform for financial consolidation, reporting, and analysis.

## 🎯 Overview

NEWA EPM is a comprehensive financial management system built to support:
- **Multi-entity consolidation** with IFRS compliance (IAS 21, IFRS 10, etc.)
- **Financial statement generation** (Balance Sheet, P&L, Cash Flow, SOCE)
- **Intercompany transaction management** and reconciliation
- **Period-end close workflow** automation
- **Account reconciliation** and certification
- **Planning & budgeting** with driver-based forecasting
- **AI-powered insights** and narrative generation
- **ESG & regulatory reporting** (CSRD, XBRL, etc.)

## 🏗️ Technology Stack

### Backend
- **Framework**: NestJS 10 (Node.js)
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 16 with Prisma ORM
- **Cache**: Redis 7
- **Task Queue**: BullMQ
- **API**: REST + WebSocket (Server-Sent Events for streaming)

### Frontend
- **Framework**: React 18 with TypeScript
- **State Management**: Zustand (client state) + React Query (server state)
- **Forms**: React Hook Form + Zod validation
- **Data Grids**: AG Grid
- **Styling**: Tailwind CSS
- **Build**: Vite

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Cloud**: AWS / Azure / GCP (cloud-agnostic)

## 📋 Project Structure

```
newa-epm/
├── apps/
│   ├── api-gateway/          # API Gateway (Kong/Express-based routing)
│   ├── auth-service/         # Authentication & authorization microservice
│   ├── admin-service/        # Tenant & user management
│   ├── entity-service/       # Entity and master data management
│   ├── close-service/        # Period-end close and workflow
│   ├── consolidation-service/# Consolidation engine
│   └── frontend/             # React SPA
├── packages/
│   ├── shared/               # Shared types, DTOs, constants
│   └── db/                   # Database schemas and migrations
├── infra/
│   ├── kubernetes/           # K8s manifests
│   ├── docker/               # Dockerfile and docker-compose
│   └── terraform/            # IaC for cloud provisioning
├── docs/                     # Architecture docs, ADRs, guides
└── README.md
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ and npm 10+
- Docker & Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

### Installation

1. **Clone and setup**
   ```bash
   git clone https://github.com/newa-consultancy/newa-epm.git
   cd newa-epm
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development environment**
   ```bash
   npm run docker:up       # Start PostgreSQL, Redis, MinIO in Docker
   npm run db:migrate      # Run database migrations
   npm run db:seed         # Seed reference data
   npm run dev             # Start all services in dev mode
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:3000/api
   - Auth Service: http://localhost:3001
   - Admin Service: http://localhost:3002

### First Steps

1. Create a tenant via Admin API
2. Create users with appropriate roles
3. Configure master data (entities, chart of accounts, currencies)
4. Upload trial balance data
5. Run consolidation

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Database Schema](./docs/DATABASE.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🔒 Security

- **Authentication**: JWT-based with optional MFA
- **Authorization**: Role-based access control (RBAC)
- **Multi-tenancy**: Schema-per-tenant isolation
- **Data Protection**: All financial data encrypted in transit and at rest
- **Compliance**: SOC 2, ISO 27001, GDPR-ready, DORACU

See [SECURITY.md](./docs/SECURITY.md) for detailed security guidelines.

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📦 Development Phases

### Phase 1: Foundation Platform (Months 1-3)
- ✅ Authentication & SSO
- ✅ Multi-tenant provisioning
- ✅ Admin UI
- ✅ User management

### Phase 2: Master Data (Months 3-5)
- Entity management
- Chart of Accounts
- Currencies and exchange rates
- Dimensions

### Phase 3: Data Integration (Months 5-7)
- Trial balance upload
- Excel/CSV handling
- Account mapping
- SFTP file processing

### Phase 4-10: Advanced features (Months 7-24)
- Financial close workflow
- Consolidation engine
- Financial statements
- Planning & budgeting
- AI Copilot
- ESG reporting

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make your changes with proper type safety
3. Write tests for your changes
4. Run `npm run lint` to check code quality
5. Create a Pull Request

## 📝 Coding Standards

- **TypeScript**: Strict mode, explicit return types
- **NestJS**: `@Injectable()`, decorators on every route
- **React**: Functional components, hooks, React Query for data
- **Database**: Prisma only, no raw SQL
- **Financial Amounts**: Always `Decimal` type with 6 decimal places
- **Validation**: class-validator on DTOs, Zod on schemas

See [CODING_STANDARDS.md](./docs/CODING_STANDARDS.md) for complete guidelines.

## 📞 Support

For issues, questions, or suggestions:
- GitHub Issues: [newa-epm/issues](https://github.com/newa-consultancy/newa-epm/issues)
- Email: support@newa-consultancy.com
- Documentation: [docs.newa-epm.com](https://docs.newa-epm.com)

## 📄 License

Copyright © 2026 NEWA Consultancy. All rights reserved.

## 🗺️ Roadmap

- **Q3 2026**: Phase 1-3 complete (Foundation, Master Data, Data Integration)
- **Q4 2026**: Phase 4-6 complete (Close, Consolidation, Financial Statements)
- **Q1 2027**: Phase 7-8 complete (Planning, Reconciliation)
- **Q2-Q3 2027**: Phase 9-10 complete (AI Platform, Analytics)
- **Q4 2027+**: Years 2-3 roadmap (ESG, XBRL, Treasury, Tax, Mobile)

---

**Version**: 0.1.0  
**Last Updated**: June 2026  
**Specification**: NEWA EPM Master Specification v2
