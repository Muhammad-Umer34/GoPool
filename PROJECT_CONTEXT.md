# GoPooL — Project Architecture & Context

This document provides complete context on the GoPooL project setup, backend architecture, authentication mechanisms, database schema, and design decisions.

---

## Technical Overview

- **Backend Framework:** NestJS (TypeScript)
- **Database & ORM:** PostgreSQL + Prisma ORM (`prisma/schema.prisma`)
- **Authentication & Security:**
  - JWT Access Tokens (15 min) + Refresh Tokens (7 days) with **Refresh Token Rotation (RTR)**
  - Password hashing with **bcrypt** (12 rounds)
  - Hashed refresh tokens stored in database (`refreshTokenHash`)
- **Authorization (RBAC):**
  - Roles: `rider`, `driver`, `both`, `admin`
  - Enforced using `@Roles(...)` decorator and global `RolesGuard`
  - Global `JwtAuthGuard` applied with `@Public()` decorator exception for unauthenticated routes

---

## Authentication Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Public | Register with mandatory `email`, password, `firstName`, `lastName`, and optional `phoneNumber` & `role`. Creates User + Profile atomically. |
| `POST` | `/auth/login` | Public (LocalAuthGuard) | Authenticate via email or phone + password. Returns `access_token` and `refresh_token`. |
| `POST` | `/auth/refresh` | Public (JwtRefreshGuard) | Validates refresh token, rotates tokens, and updates DB hash. |
| `POST` | `/auth/logout` | JWT (JwtAuthGuard) | Clears `refreshTokenHash` in DB. |
| `GET` | `/auth/me` | JWT (JwtAuthGuard) | Returns current authenticated user profile. |

---

## File Structure Reference

- **[schema.prisma](file:///e:/My%20Projects/Ride%20Polling/app/backend/prisma/schema.prisma)**: Database schema defining `User`, `Profile`, `Vehicle`, `Ride`, `RideRequest`, `RidePassenger`, etc.
- **[auth.service.ts](file:///e:/My%20Projects/Ride%20Polling/app/backend/src/auth/auth.service.ts)**: Core logic for password verification, token generation, token rotation, and revocation.
- **[auth.controller.ts](file:///e:/My%20Projects/Ride%20Polling/app/backend/src/auth/auth.controller.ts)**: REST controller exposing auth endpoints.
- **[users.service.ts](file:///e:/My%20Projects/Ride%20Polling/app/backend/src/users/users.service.ts)**: User CRUD and atomic User+Profile Prisma transactions.
