# GoPooL 🚗💨

> **Go Together, Pay Less.**  
> GoPooL is a modern ride-pooling & carpooling platform designed for community-driven commuting, fare sharing, and route matching.

---

## 🏗️ Project Architecture

This workspace is structured as a monorepo containing:

- **`app/backend`**: NestJS backend service built with TypeScript and PostgreSQL.
- **`app/mobile`**: Mobile client application.
- **`docs/`**: Core database schema design (`schema.sql`).
- **`packages/`**: Shared TypeScript types, utilities, constants, and validation schemas.

---

## ⚡ Backend Quick Start (`app/backend`)

1. **Install Dependencies:**
   ```bash
   cd app/backend
   npm install
   ```

2. **Database Migrations:**
   Initial schema setup is located at [`app/backend/migrations/0001_init_schema.sql`](file:///e:/My%20Projects/Ride%20Polling/app/backend/migrations/0001_init_schema.sql).

3. **Development Server:**
   ```bash
   npm run start:dev
   ```

4. **Testing & Build:**
   ```bash
   npm run test
   npm run build
   ```
