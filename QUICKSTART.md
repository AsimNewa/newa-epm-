# NEWA EPM - Quick Start Guide

## What is NEWA EPM?

NEWA Enterprise Performance Management is a cloud-native platform for multi-entity financial consolidation, reporting, and analysis. It's built following the comprehensive specification you provided in `NEWA_EPM_Master_Specification_v2.docx`.

## What's Been Created

### ✅ Phase 1: Foundation Platform (Complete)

```
newa-epm/
├── apps/
│   ├── api-gateway/         # Request routing, authentication
│   ├── auth-service/        # JWT, SSO, MFA
│   ├── admin-service/       # Tenant provisioning, user management
│   └── frontend/            # React 18 SPA
├── packages/shared/         # Shared types, DTOs
├── infra/                   # Docker, Kubernetes configs
├── docs/                    # Architecture, development guides
└── Configuration files      # ESLint, Prettier, Git, GitHub Actions
```

## 🚀 Getting Started (5 minutes)

### 1. Setup Environment

```bash
# Navigate to project
cd d:\NewaDevEnv\NewaPlan\newa-epm

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, MinIO, MailHog in Docker
npm run docker:up

# Wait for all services to be healthy (check Docker Desktop)
```

### 3. Initialize Database

```bash
# Run migrations
npm run db:migrate

# Seed reference data (optional)
npm run db:seed

# Open Prisma Studio (optional - visualize DB)
npm run db:studio
```

### 4. Start Services

```bash
# In new terminal, start all services
npm run dev
```

### 5. Access Application

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:3000/api
- **Auth Service**: http://localhost:3001
- **Admin Service**: http://localhost:3002
- **Database Studio**: http://localhost:5555
- **MailHog**: http://localhost:8025

## 📊 Project Structure

### Monorepo with Lerna
- Workspaces in `apps/` (services) and `packages/` (shared)
- One `node_modules` directory (efficient)
- Unified dependency management

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS 10, Node.js 20 |
| Frontend | React 18, Vite, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Cache | Redis 7 |
| Storage | MinIO (S3-compatible) |
| Container | Docker, Docker Compose |
| Orchestration | Kubernetes (production) |

## 🔑 Key Features (Phase 1)

- ✅ Multi-tenant architecture
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ User management
- ✅ Tenant provisioning
- ✅ Database schema management
- ✅ Development environment setup
- ✅ CI/CD pipeline (GitHub Actions)

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Project overview |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design & data flow |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Development setup & workflow |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Contribution guidelines |
| [GITHUB_SETUP.md](./GITHUB_SETUP.md) | GitHub repository setup |

## 🔄 Development Workflow

### Make Changes
```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes, test locally
npm run test
npm run lint

# Commit
git commit -m "feat: your feature description"
```

### Push to GitHub
```bash
# Add GitHub remote (see GITHUB_SETUP.md)
git remote add origin git@github.com:your-username/newa-epm.git

# Push
git push -u origin feature/your-feature

# Create Pull Request on GitHub
```

## 🗂️ What's Implemented

### Backend Services
- **API Gateway** (3000): Request routing, auth validation
- **Auth Service** (3001): JWT, user login/logout
- **Admin Service** (3002): Tenant & user management

### Database Schema
- **Multi-tenancy**: Schema-per-tenant isolation
- **Authentication**: Users, roles, permissions
- **Master Data**: Entities, COA, currencies, dimensions, periods
- **Financial Data**: Trial balances, consolidations
- **Audit**: Audit logs for compliance

### Frontend Foundation
- **Authentication**: Login/logout flows
- **Routing**: React Router setup
- **State**: Zustand + React Query configured
- **Forms**: React Hook Form + Zod ready
- **UI**: Tailwind CSS ready
- **Grids**: AG Grid configured for financial data

### Infrastructure
- **Docker Compose**: Local development with all services
- **GitHub Actions**: Automated testing and building
- **Kubernetes**: Production deployment manifests

## 📋 Next Steps (Phase 2-3)

The application is ready for:

1. **Entity Management** (Phase 2)
   - Create entities in admin UI
   - Manage chart of accounts
   - Configure currencies and exchange rates

2. **Data Integration** (Phase 3)
   - Build trial balance upload feature
   - Implement file mapping engine
   - Add import monitoring dashboard

3. **Financial Close** (Phase 4)
   - Build workflow engine
   - Implement approval processes
   - Create journal entry module

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Database Connection Issues
```bash
# Check Docker containers
docker ps

# Restart Docker
npm run docker:reset
```

### Dependencies Issues
```bash
# Clean install
rm -r node_modules
npm install
```

## 📞 Support

- Check [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for detailed guides
- Review [CONTRIBUTING.md](./CONTRIBUTING.md) for coding standards
- See GitHub Issues for known issues

## 📝 Implementation Roadmap

### ✅ Completed
- Phase 1: Foundation Platform (Months 1-3)
  - Project structure & setup
  - Authentication & authorization
  - Multi-tenant provisioning
  - Admin UI foundation

### 🔄 Next
- Phase 2: Master Data (Months 3-5)
- Phase 3: Data Integration (Months 5-7)
- Phase 4: Financial Close (Months 7-9)
- Phase 5: Consolidation Engine (Months 9-12)
- Phases 6-10: Advanced features through Month 24

## 🎯 Key Principles

Based on the specification:

1. **Security First**: JWT, RBAC, multi-tenant isolation
2. **Financial Precision**: Decimal(20,6) for all amounts
3. **Auditability**: All changes logged
4. **Scalability**: Microservices, Kubernetes-ready
5. **TypeScript Strict**: No `any` types
6. **Testing**: Unit, integration, E2E tests

## 🚀 Production Deployment

When ready (after Phase 10):

```bash
# Build images
docker build -t newa-epm/api-gateway ./apps/api-gateway

# Deploy to Kubernetes
kubectl apply -f infra/kubernetes/

# Run migrations
kubectl exec -n prod deploy/admin-service -- npx prisma migrate deploy
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm install` | Install all dependencies |
| `npm run dev` | Start all services |
| `npm run test` | Run tests |
| `npm run lint` | Check code quality |
| `npm run docker:up` | Start infrastructure |
| `npm run docker:down` | Stop infrastructure |
| `npm run db:migrate` | Run migrations |
| `npm run build` | Build for production |

---

**Version**: 0.1.0  
**Specification Version**: NEWA EPM Master Specification v2  
**Last Updated**: June 2026

**Ready to develop!** Follow [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) for next steps.
