# GoPooL - Project Context & Agent Rules

## Overview
**GoPooL** is a production-grade ride-polling and carpooling application. It provides real-time ride matching, passenger/driver management, authentication, role-based access control, and trip handling.

---

## Tech Stack & Architecture

- **Backend Framework:** NestJS (TypeScript)
- **Database & ORM:** PostgreSQL with Prisma ORM (`prisma/schema.prisma`)
- **Authentication:**
  - JWT Access Tokens (short-lived, default `15m`)
  - JWT Refresh Tokens (long-lived, default `7d`) with **Refresh Token Rotation (RTR)**
  - Passwords hashed using **bcrypt** (12 rounds)
  - Refresh Tokens hashed using **bcrypt** (10 rounds) stored in `User.refreshTokenHash`
- **Authorization & RBAC:**
  - Roles: `rider`, `driver`, `both`, `admin` (defined in `UserRole` enum)
  - Managed via `@Roles(...)` decorator and global `RolesGuard`
  - Global `JwtAuthGuard` applied across all routes unless decorated with `@Public()`
- **Global Pipes & Filters:**
  - `ValidationPipe` with `{ whitelist: true, transform: true, forbidNonWhitelisted: true }`
  - `HttpExceptionFilter` for standardized JSON error responses

---

## Repository Structure

```
Ride Polling/
├── .gitignore                      ← Ignores .env and build artifacts
├── docs/                           
│   └── schema.sql                  ← Original SQL schema backup
├── app/
│   └── backend/                    ← NestJS Backend Workspace
│       ├── .env                    ← Environment variables (Git-ignored)
│       ├── prisma/
│       │   └── schema.prisma       ← Active Prisma schema (User, Profile, Ride, etc.)
│       └── src/
│           ├── common/             ← Enums (UserRole), constants (roles), filters (HttpExceptionFilter)
│           ├── prisma/             ← PrismaModule & PrismaService
│           ├── users/              ← UsersModule, UsersService (user CRUD & transactions)
│           └── auth/               ← AuthModule, AuthService, AuthController
│               ├── decorators/     ← @Public(), @CurrentUser(), @Roles()
│               ├── dto/            ← RegisterDto (mandatory email), LoginDto
│               ├── guards/         ← JwtAuthGuard, JwtRefreshGuard, LocalAuthGuard, RolesGuard
│               ├── strategies/     ← LocalStrategy, JwtStrategy, JwtRefreshStrategy
│               └── types/          ← JwtPayload
```

---

## Authentication Flow & Rules

1. **User Identity:**
   - `email` is **mandatory** during registration (`@IsEmail()`, `@IsNotEmpty()`).
   - `phoneNumber` is **optional** (`@IsOptional()`).
2. **Registration (`POST /auth/register`):**
   - Hashes password (bcrypt, 12 rounds).
   - Atomically creates `User` + `Profile` records in a Prisma transaction.
   - Generates Access & Refresh tokens, hashes Refresh token (bcrypt, 10 rounds), and updates `refreshTokenHash` in DB.
3. **Login (`POST /auth/login`):**
   - Validates email or phone + password using Passport `LocalStrategy`.
   - Generates fresh token pair and updates `refreshTokenHash` & `lastLoginAt`.
4. **Token Refresh (`POST /auth/refresh`):**
   - Validates Refresh token via `JwtRefreshStrategy`.
   - Checks against `refreshTokenHash` in DB.
   - Implements **Refresh Token Rotation (RTR)**: issues a brand new Access Token and a brand new Refresh Token, updating the DB.
5. **Logout (`POST /auth/logout`):**
   - Sets `refreshTokenHash` to `null` in DB, revoking refresh capability instantly.

---

## Environment Variables (`app/backend/.env`)

```env
DATABASE_URL="postgresql://postgres:Umer_Fast321@localhost:5432/gopool_db?schema=public"
JWT_ACCESS_SECRET="gopool_super_secret_access_key_2026_change_in_prod"
JWT_REFRESH_SECRET="gopool_super_secret_refresh_key_2026_change_in_prod"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"
```

> ⚠️ **Note:** `.env` files must NEVER be committed to Git.

---

## Future Roadmap / Next Phases
1. **Driver Management & Verification:** Document upload (CNIC, Driving License), vehicle registration, admin approval.
2. **Ride Management:** Create ride offer/request, location coordinates (PostGIS / latitude-longitude), pricing calculations.
3. **Real-time WebSockets / Gateway:** Driver location tracking, ride polling/matching updates.
