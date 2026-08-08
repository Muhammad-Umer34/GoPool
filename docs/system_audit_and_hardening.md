# 📘 GoPooL — Comprehensive System Audit & Hardening Documentation

This document provides complete technical documentation of all architectural improvements, security enhancements, performance optimizations, and safety features implemented in **GoPooL** following critical system analysis.

---

## 📑 Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Geospatial Search & Database Hardening](#2-geospatial-search--database-hardening)
3. [Upstash Redis Cloud Integration & Token Revocation](#3-upstash-redis-cloud-integration--token-revocation)
4. [API Rate Limiting & WebSockets Authorization](#4-api-rate-limiting--websockets-authorization)
5. [Pickup OTP PIN Verification System](#5-pickup-otp-pin-verification-system)
6. [Dynamic Pricing Bounds & Vehicle Pricing Rules](#6-dynamic-pricing-bounds--vehicle-pricing-rules)
7. [Automated Background Maintenance & Push Notifications](#7-automated-background-maintenance--push-notifications)
8. [Mobile Frontend Hardening & Pull-To-Refresh](#8-mobile-frontend-hardening--pull-to-refresh)

---

## 1. Executive Summary

During system analysis, several key bottlenecks, security risks, and data integrity gaps were identified. Over successive iterations, the codebase was hardened across the backend ([app/backend](../app/backend)), PostgreSQL database schema ([prisma/schema.prisma](../app/backend/prisma/schema.prisma)), and mobile frontend ([app/mobile](../app/mobile)).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GoPooL HARDENED ARCHITECTURE                           │
├───────────────────┬───────────────────┬───────────────────┬─────────────────────┤
│   PostgreSQL DB   │   Upstash Redis   │ WebSockets Gateway│  Expo Push Service  │
│ SQL Bounding Box  │ Token Blacklist   │ Authorized Rooms  │  Background Devices │
└───────────────────┴───────────────────┴───────────────────┴─────────────────────┘
```

---

## 2. Geospatial Search & Database Hardening

### 📍 Problem Identified
Originally, `searchRides` loaded **all** scheduled rides from PostgreSQL into Node.js RAM and ran Haversine distance calculations in the single-threaded event loop. With thousands of rides, this caused severe memory bloat and API latency spikes.

### 🛠️ Solution Implemented ([rides.service.ts](../app/backend/src/rides/rides.service.ts))
We implemented a **PostgreSQL SQL Bounding Box query** that pre-filters candidate coordinates directly in database indexes before returning matching records:

$$\Delta \text{lat} = \frac{\text{radiusKm}}{111}, \quad \Delta \text{lng} = \frac{\text{radiusKm}}{111 \times |\cos(\text{lat} \times \pi / 180)|}$$

```typescript
const minLat = dto.originLat - deltaLat;
const maxLat = dto.originLat + deltaLat;
const minLng = dto.originLng - deltaLng;
const maxLng = dto.originLng + deltaLng;

const rides = await this.prisma.ride.findMany({
  where: {
    status: RideStatus.scheduled,
    availableSeats: { gte: minSeats },
    departureTime: { gte: new Date() },
    originLat: { gte: minLat, lte: maxLat },
    originLng: { gte: minLng, lte: maxLng },
  },
});
```

---

## 3. Upstash Redis Cloud Integration & Token Revocation

### 📍 Problem Identified
Upon `POST /auth/logout`, `refreshTokenHash` was invalidated in the database, but active **JWT Access Tokens (15-minute expiry)** remained valid until natural expiration.

### 🛠️ Solution Implemented ([redis/](../app/backend/src/redis))
1. **Upstash Redis Cloud Connection:** Configured `@Global()` `RedisModule` connecting to Upstash Redis REST API using environment credentials:
   * `UPSTASH_REDIS_REST_URL`
   * `UPSTASH_REDIS_REST_TOKEN`
2. **Access Token Blacklisting ([auth.service.ts](../app/backend/src/auth/auth.service.ts)):** When a user logs out, their Access Token is blacklisted in Redis with a 900-second (15 min) TTL:
   ```typescript
   await this.redisService.blacklistToken(accessToken, 900);
   ```
3. **Guard Enforcement ([jwt-auth.guard.ts](../app/backend/src/auth/guards/jwt-auth.guard.ts)):** Every incoming request performs a sub-millisecond lookup in Redis. If blacklisted, access is denied immediately with `401 Unauthorized`.

---

## 4. API Rate Limiting & WebSockets Authorization

### 📍 Problem Identified
1. **Brute-Force Vulnerability:** No request rate limiting existed on public auth routes.
2. **WebSocket Room Eavesdropping:** Any authenticated user could emit `joinRideRoom` with an arbitrary `rideId` and spy on driver GPS locations or trip chat.

### 🛠️ Solution Implemented
1. **NestJS Throttler Guard ([app.module.ts](../app/backend/src/app.module.ts)):** Bound `@nestjs/throttler` globally to limit API traffic (max 60 requests per minute per IP).
2. **Authorized Room Subscriptions ([tracking.gateway.ts](../app/backend/src/tracking/tracking.gateway.ts)):** Updated `handleJoinRideRoom` to verify that `client.data.user.sub` is either the trip driver or a confirmed passenger before granting access to `ride_<id>` rooms.

---

## 5. Pickup OTP PIN Verification System

### 📍 Problem Identified
Drivers could mark passengers as "picked up" without physical verification, risking disputes where passengers were left behind.

### 🛠️ Solution Implemented ([schema.prisma](../app/backend/prisma/schema.prisma) & [rides.service.ts](../app/backend/src/rides/rides.service.ts))
1. **Schema Field:** Added `pickup_otp_pin` column to `RidePassenger` table.
2. **OTP Generation:** When a driver accepts a booking request, a **random 4-digit PIN** is generated, stored, and sent via push notification to the passenger.
3. **Pickup Verification ([rides.service.ts](../app/backend/src/rides/rides.service.ts)):** `pickupPassenger` requires the driver to provide the passenger's 4-digit PIN (`otpPin`):
   ```typescript
   if (ridePassenger.pickupOtpPin && ridePassenger.pickupOtpPin !== otpPin) {
     throw new BadRequestException('Invalid pickup OTP PIN. Please ask passenger for their 4-digit PIN.');
   }
   ```

---

## 6. Dynamic Pricing Bounds & Vehicle Pricing Rules

### 📍 Problem Identified
Drivers could set arbitrary prices per seat, leading to price gouging or invalid low pricing.

### 🛠️ Solution Implemented ([rides.service.ts](../app/backend/src/rides/rides.service.ts))
When creating a ride offer, the system calculates the recommended trip price based on vehicle category rates (`baseFare` & `perKmRate`) and driving distance:

$$\text{Recommended Fare} = \text{baseFare} + (\text{perKmRate} \times \text{distanceKm})$$
$$\text{Recommended Price Per Seat} = \frac{\text{Recommended Fare}}{\text{Available Seats}}$$

The backend enforces pricing bounds ($0.4\times$ to $3.5\times$ recommended fare) and rejects out-of-bound inputs.

---

## 7. Automated Background Maintenance & Push Notifications

### 🛠️ Solutions Implemented
1. **Automated Request Expiry Cron Worker ([rides.service.ts](../app/backend/src/rides/rides.service.ts)):** `@Cron(CronExpression.EVERY_5_MINUTES)` sweeps past `departureTime` rides and automatically marks unresponded `pending` requests as `expired`.
2. **Expo Push Notification Dispatcher ([notifications.service.ts](../app/backend/src/notifications/notifications.service.ts)):** Connected notification dispatches to Expo HTTP Push API (`https://exp.host/--/api/v2/push/send`) so mobile devices receive push alerts when backgrounded.
3. **Atomic Driver Cancellation:** Driver cancellation updates all child `RidePassenger` records to `cancelled`, broadcasts socket events, and dispatches push alerts to confirmed passengers.
4. **Driver Vehicle Auto-Verification ([admin.service.ts](../app/backend/src/admin/admin.service.ts)):** Approving a driver's CNIC and Driving License automatically updates their registered vehicles to `isVerified: true`.

---

## 8. Mobile Frontend Hardening & Pull-To-Refresh

### 🛠️ Solutions Implemented ([SearchRidesScreen.tsx](../app/mobile/src/screens/SearchRidesScreen.tsx))
Integrated `RefreshControl` into mobile screens to support pull-to-refresh gestures.

---

## ⚙️ Verification Status

* **PostgreSQL Schema Sync:** `npx prisma db push` — **PASSED**
* **NestJS Backend Build:** `npm run build` — **0 ERRORS**
* **Mobile Frontend Compilation:** `npx tsc --noEmit` — **0 ERRORS**
