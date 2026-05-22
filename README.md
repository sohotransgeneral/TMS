# TMS — Transport Management System

SaaS multi-tenant pentru transport & logistică: dispatch, șoferi, camioane, GPS,
facturare, mentenanță, rapoarte.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 ·
Prisma 6 (MongoDB) · Auth.js v5 · Zod · Recharts.

> Notă Next.js 16: fișierul de protecție rute se numește acum `proxy.ts`
> (înainte `middleware.ts`).

## Plan de livrare

| Parte                                                                  | Status        |
| ---------------------------------------------------------------------- | ------------- |
| 1. Fundație (schema, auth, RBAC, layout, dashboard)                    | ✅ **Inclus** |
| 2. CRUD Companii / Utilizatori / Șoferi / Camioane / Remorci / Clienți | ⏳ următor    |
| 3. Loads (timeline statusuri), Dispatcher cockpit, GPS, Driver app     | ⏳            |
| 4. Accounting (facturi PDF, plăți, cheltuieli, FuelEntry) + Mentenanță | ⏳            |
| 5. Rapoarte, notificări, audit, email/Telegram, seed demo complet      | ⏳            |

## Instalare

### 1. Cerințe

- Node.js ≥ 20
- MongoDB ≥ 6 (Atlas sau replica set local — Prisma cu MongoDB necesită replica set)

### 2. Dependențe

```powershell
npm install
```

### 3. Variabile de mediu

Copiază `.env.example` în `.env.local` și completează:

```powershell
Copy-Item .env.example .env.local
```

Minimul absolut pentru a porni:

```env
DATABASE_URL="mongodb+srv://USER:PASS@cluster.mongodb.net/tms"
NEXTAUTH_SECRET="<generate cu: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
APP_URL="http://localhost:3000"
```

### 4. Inițializare bază de date

```powershell
npx prisma generate
npx prisma db push
npm run db:seed
```

Seed-ul creează:

- `admin@tms.local` / `Admin1234!` — rol `SUPER_ADMIN`

### 5. Pornire dev server

```powershell
npm run dev
```

Aplicația rulează pe http://localhost:3000.

## Fluxuri disponibile în Partea 1

- `/` → redirect la dashboard (dacă ești logat) sau `/login`
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/dashboard` — overview cu statistici (curse, venit, cheltuieli, profit, documente expirate)
- `/driver/dashboard` — vedere mobile-first pentru șofer
- Toate celelalte rute din navigație sunt afișate cu **„În curând”** și se vor implementa în Părțile 2–5.

## RBAC

Roluri: `SUPER_ADMIN`, `COMPANY_ADMIN`, `DISPATCHER`, `DRIVER`,
`ACCOUNTANT`, `FLEET_MANAGER`, `CUSTOMER`.

Permisiunile sunt definite în [lib/permissions.ts](lib/permissions.ts) sub forma
`<resource>:<action>`. Folosește în server actions:

```ts
import { requirePermission } from "@/lib/session";

export async function createLoad(...) {
  const user = await requirePermission("loads:write");
  // ... user.role și user.companyId garantate
}
```

Multi-tenancy: orice query trebuie filtrat prin `companyId` (folosește
`requireCompanyId()`). Excepție: `SUPER_ADMIN` operează cross-tenant.

## Structură proiect

```
app/
  (auth)/            → login, register, forgot, reset
  (app)/             → toate rutele autentificate (sidebar + topbar)
    dashboard/
    dispatch/{loads,map}/
    fleet/{trucks,trailers,maintenance}/
    admin/{users,company,drivers,notifications}/
    accounting/{dashboard,invoices,expenses,fuel}/
    customers/
    reports/
    settings/
    driver/dashboard/
  api/auth/[...nextauth]/route.ts
actions/             → server actions (auth.ts, ...)
components/
  ui/                → primitive (button, input, card, table, badge, ...)
  dashboard/         → sidebar, topbar, shell, stat-card, nav-config
  providers.tsx      → SessionProvider + ThemeProvider + Toaster
lib/
  auth.ts            → Auth.js v5 config (Credentials + JWT)
  prisma.ts          → Prisma client singleton
  permissions.ts     → RBAC
  session.ts         → getCurrentUser, requireUser, requirePermission, requireCompanyId
  audit.ts           → logAudit
  mail.ts            → sendMail
  utils.ts           → cn, formatCurrency, formatDate, ...
  validators/        → Zod schemas
prisma/
  schema.prisma      → toate modelele
  seed.ts            → seed minimal
types/
  next-auth.d.ts
proxy.ts             → Next.js 16 route guard (fost middleware.ts)
```

## Comenzi utile

| Comandă             | Descriere                                              |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | server de dezvoltare                                   |
| `npm run build`     | build de producție (rulează `prisma generate` automat) |
| `npm run start`     | rulează build-ul                                       |
| `npm run db:push`   | sincronizează schema cu MongoDB                        |
| `npm run db:studio` | deschide Prisma Studio                                 |
| `npm run db:seed`   | rulează `prisma/seed.ts`                               |

## Note tehnice

- **Sesiune JWT**, fără DB session — token-ul Auth.js conține `id`, `role`,
  `companyId`. Modelele `Account`, `Session`, `VerificationToken` sunt definite
  în schema pentru integrări OAuth viitoare.
- **Validare**: toate input-urile trec prin Zod în `lib/validators/`.
- **Parole**: hash bcrypt (cost 10).
- **Multi-tenancy**: fiecare entitate de business are `companyId` + index compus;
  query-urile filtrează strict pe `companyId`-ul user-ului curent.
- **Audit logs**: `lib/audit.logAudit(...)` — non-blocking, înregistrează IP +
  user agent.
- **Notificări**: `Notification` (in-app) + `lib/mail.sendMail` (SMTP). Telegram
  va fi adăugat în Partea 5.
- **Dark mode** via `next-themes`, theme tokens HSL în `app/globals.css`
  (Tailwind v4 `@theme`).

## Pași următori

Cere **Partea 2** când ești gata: voi adăuga CRUD-urile complete pentru
Companii, Utilizatori, Șoferi, Camioane, Remorci și Clienți, cu tabele filtrabile,
modaluri de creare/editare, validare Zod end-to-end și server actions.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
