# HRMS - Human Resource Management System

## Overview
A production-ready HRMS with geo-restricted attendance tracking, role-based access control, invite-based employee registration, leave management, payroll calculation, and audit logging.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui, served on port 5000
- **Backend**: Express.js with session-based auth (passport-local)
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: Password-based sessions (NOT Replit Auth)

## Key Features
- Geo-restricted attendance (Haversine formula, configurable radius)
- Role-based access: SUPER_ADMIN, HR, MANAGER, EMPLOYEE
- Auto-generated credentials sent via Gmail on employee creation
- Mandatory password reset on first login (mustResetPassword flag on users table)
- Super Admin can reset any employee's password (new temp password emailed)
- Leave management with approval workflows
- Pro-rated payroll: (monthlySalary / workingDays) * daysPresent
- Payslip generation and download
- Comprehensive audit logging
- Gmail integration via Replit connector for sending credentials/reset emails

## Project Structure
- `shared/schema.ts` - Drizzle schema, Zod validation, types
- `server/auth.ts` - Passport session auth, password hashing, generateRandomPassword
- `server/email.ts` - Gmail integration for sending credentials/reset emails
- `server/storage.ts` - DatabaseStorage class (IStorage interface)
- `server/routes.ts` - All API endpoints with role middleware
- `server/seed.ts` - Demo data seeder
- `client/src/App.tsx` - Router + sidebar layout
- `client/src/pages/` - All page components
- `client/src/components/app-sidebar.tsx` - Navigation sidebar

## Demo Credentials
- Admin: admin / admin123
- HR: sarah.hr / hr12345
- Manager: john.manager / manager1
- Employee: alice.dev / employee1

## Default Office Location
- NYC: 40.7128, -74.006, 500m radius

## Recent Changes
- 2026-02-14: Replaced invite token system with auto-generated credentials via Gmail
  - Employee creation now auto-creates user account with random 12-char password
  - Credentials emailed via Gmail integration (Replit connector)
  - mustResetPassword flag forces password change on first login
  - Super Admin can reset any employee's password (POST /api/admin/password/reset)
  - Employee can self-reset password (POST /api/password/reset)
  - Removed invite_tokens table dependency, register route, and invite UI
- 2026-02-13: Initial build complete with all core features
- Fixed getEmployees query to use AND conditions for search + isActive filter
- Updated queryKey format to URL-based with query parameters
- Fixed cache invalidation to use predicate-based matching
