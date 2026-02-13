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
- Invite-based registration with 24-hour expiring tokens
- Leave management with approval workflows
- Pro-rated payroll: (monthlySalary / workingDays) * daysPresent
- Payslip generation and download
- Comprehensive audit logging

## Project Structure
- `shared/schema.ts` - Drizzle schema, Zod validation, types
- `server/auth.ts` - Passport session auth, password hashing
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
- 2026-02-13: Initial build complete with all core features
- Fixed getEmployees query to use AND conditions for search + isActive filter
- Updated queryKey format to URL-based with query parameters
- Fixed cache invalidation to use predicate-based matching
