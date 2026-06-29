# Development Guide

## Local Setup

### Prerequisites
- Node.js 20+ and npm 10+
- Docker & Docker Compose
- Git

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```

3. **Start infrastructure**
   ```bash
   npm run docker:up
   ```

4. **Run migrations**
   ```bash
   npm run db:migrate
   ```

5. **Seed reference data**
   ```bash
   npm run db:seed
   ```

6. **Start all services**
   ```bash
   npm run dev
   ```

## Project Structure

### Services

Each service in `apps/` follows the NestJS pattern:

```
apps/api-gateway/
├── src/
│   ├── app.controller.ts
│   ├── app.module.ts
│   └── main.ts
├── test/
├── Dockerfile
└── package.json
```

### Key Files

- `lerna.json` - Monorepo configuration
- `package.json` - Root workspace config
- `.env.example` - Environment template
- `docker-compose.yml` - Local dev environment

## Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/account-mapping

# Start dev environment
npm run docker:up
npm run dev

# Make changes, test locally
npm run test

# Lint code
npm run lint

# Commit and push
git add .
git commit -m "feat: add account mapping"
git push origin feature/account-mapping
```

### 2. Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### 3. Database Changes

```bash
# Create new migration
npm run db:migrate:dev

# Write migration name: "add_new_table"

# Deploy migrations
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

## API Development

### Creating a New Endpoint

1. **Create DTO** (`src/dtos/user.dto.ts`)
   ```typescript
   import { IsNotEmpty, IsEmail } from 'class-validator';

   export class CreateUserDto {
     @IsNotEmpty()
     @IsEmail()
     email: string;

     @IsNotEmpty()
     fullName: string;
   }
   ```

2. **Create Service** (`src/services/user.service.ts`)
   ```typescript
   import { Injectable } from '@nestjs/common';
   import { PrismaService } from '../prisma.service';

   @Injectable()
   export class UserService {
     constructor(private prisma: PrismaService) {}

     async create(data: CreateUserDto) {
       return this.prisma.user.create({ data });
     }
   }
   ```

3. **Create Controller** (`src/controllers/user.controller.ts`)
   ```typescript
   import { Controller, Post, Body, UseGuards } from '@nestjs/common';
   import { JwtAuthGuard } from '../auth/jwt-auth.guard';
   import { UserService } from '../services/user.service';
   import { CreateUserDto } from '../dtos/user.dto';

   @Controller('users')
   @UseGuards(JwtAuthGuard)
   export class UserController {
     constructor(private userService: UserService) {}

     @Post()
     create(@Body() createUserDto: CreateUserDto) {
       return this.userService.create(createUserDto);
     }
   }
   ```

## Frontend Development

### Component Structure

```
apps/frontend/src/
├── pages/           # Route pages
├── components/      # Reusable components
├── hooks/           # Custom React hooks
├── services/        # API services
├── store/           # Zustand stores
├── types/           # TypeScript types
└── utils/           # Utilities
```

### Creating a Form Component

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  fullName: z.string().min(1, 'Name required'),
});

type FormData = z.infer<typeof schema>;

export function CreateUserForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    // Submit to API
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input {...register('fullName')} />
      {errors.fullName && <span>{errors.fullName.message}</span>}
      
      <button type="submit">Create User</button>
    </form>
  );
}
```

## Debugging

### Backend
```bash
# Enable debug logs
DEBUG=newa-epm:* npm run dev

# Attach debugger in VS Code
# Launch configuration in .vscode/launch.json
```

### Frontend
```bash
# React Dev Tools
# Redux Dev Tools (not used, we use Zustand)
# Use browser DevTools
```

### Database
```bash
# Open Prisma Studio
npm run db:studio

# Check query logs
# Enable in .env: DATABASE_LOGGING=true
```

## Common Tasks

### Add a New Service

1. Create directory: `mkdir apps/new-service`
2. Copy structure from existing service
3. Update `lerna.json` if needed
4. Update root `package.json`

### Add a Dependency

```bash
# Root level
npm install lodash

# Specific workspace
npm install lodash -w @newa-epm/admin-service

# Dev dependency
npm install -D eslint -w @newa-epm/admin-service
```

### Remove a Dependency

```bash
npm uninstall lodash -w @newa-epm/admin-service
```

## Performance Optimization

### Database
- Add indexes for frequently queried columns
- Use Prisma select to limit fields
- Connection pooling (min: 2, max: 10)

### API
- Cache with Redis for expensive operations
- Pagination for large datasets
- Rate limiting for public endpoints

### Frontend
- Code splitting with React.lazy()
- Memoization with useMemo/useCallback
- Virtual scrolling for large lists (AG Grid)

## Monitoring & Logs

### Local Development
- All logs to console
- Check service startup messages
- DB migration logs

### Production
- Structured logging (JSON format)
- Centralized logging (ELK stack)
- Error tracking (Sentry)

## Useful Commands

```bash
# Clean everything
npm run clean

# Rebuild all
npm run build

# Run specific service
npm run dev -w @newa-epm/auth-service

# Check health
curl http://localhost:3000/health
```

---

For questions or issues, create a GitHub Issue or contact the team.
