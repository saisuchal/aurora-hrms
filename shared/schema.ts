import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  real,
  date,
  pgEnum,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* =========================
   ENUMS
========================= */

export const roleEnum = pgEnum("role", [
  "SUPER_ADMIN",
  "HR",
  "MANAGER",
  "EMPLOYEE",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const correctionStatusEnum = pgEnum("correction_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const leaveTypeEnum = pgEnum("leave_type", [
  "MEDICAL",
  "CASUAL",
  "EARNED",
  "UNPAID",
]);

/* =========================
   USERS
========================= */

export const users = pgTable(
  "users",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    role: roleEnum("role").notNull().default("EMPLOYEE"),
    isActive: boolean("is_active").notNull().default(true),
    mustResetPassword: boolean("must_reset_password").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("users_username_idx").on(table.username),
  ]
);

/* =========================
   EMPLOYEES
========================= */

export const employees = pgTable(
  "employees",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: integer("user_id").references(() => users.id),
    employeeCode: varchar("employee_code", { length: 20 }).notNull().unique(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull().unique(),
    phone: varchar("phone", { length: 20 }),
    department: text("department").notNull(),
    designation: text("designation").notNull(),
    managerId: integer("manager_id").notNull(),
    monthlySalary: real("monthly_salary").notNull().default(0),
    dateOfJoining: date("date_of_joining").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    casualLeaveBalance: integer("casual_leave_balance").notNull().default(1),
    medicalLeaveBalance: integer("medical_leave_balance").notNull().default(1),
    earnedLeaveBalance: integer("earned_leave_balance").notNull().default(1),
    lastLeaveAccrual: date("last_leave_accrual"),
  },
  (table) => ({
    userIdx: index("employees_user_id_idx").on(table.userId),
    managerIdx: index("employees_manager_id_idx").on(table.managerId),
    deptIdx: index("employees_department_idx").on(table.department),

    casualNonNegative: check(
      "casual_leave_non_negative",
      sql`${table.casualLeaveBalance} >= 0`
    ),

    medicalNonNegative: check(
      "medical_leave_non_negative",
      sql`${table.medicalLeaveBalance} >= 0`
    ),

    earnedNonNegative: check(
      "earned_leave_non_negative",
      sql`${table.earnedLeaveBalance} >= 0`
    ),
  })
);

/* =========================
   ATTENDANCE
========================= */

export const attendance = pgTable(
  "attendance",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    date: date("date").notNull(),
    clockIn: timestamp("clock_in"),
    clockOut: timestamp("clock_out"),
    clockInLat: real("clock_in_lat"),
    clockInLng: real("clock_in_lng"),
    clockOutLat: real("clock_out_lat"),
    clockOutLng: real("clock_out_lng"),
    ipAddress: varchar("ip_address", { length: 45 }),
    status: text("status").notNull().default("PRESENT"),
  },
  (table) => [
    uniqueIndex("attendance_employee_date_unique")
      .on(table.employeeId, table.date),
  ]
);

/* =========================
   ATTENDANCE CORRECTIONS
========================= */

export const attendanceCorrections = pgTable(
  "attendance_corrections",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    attendanceId: integer("attendance_id").references(() => attendance.id),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    date: date("date").notNull(),
    reason: text("reason").notNull(),
    requestedClockIn: timestamp("requested_clock_in"),
    requestedClockOut: timestamp("requested_clock_out"),
    status: correctionStatusEnum("status").notNull().default("PENDING"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_corrections_employee_date_unique")
      .on(table.employeeId, table.date),
  ]
);

/* =========================
   LEAVE REQUESTS
========================= */

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    leaveType: leaveTypeEnum("leave_type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),

    // 🔥 IMPORTANT: store computed leave days
    days: integer("days").notNull(),

    reason: text("reason").notNull(),
    status: leaveStatusEnum("status").notNull().default("PENDING"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("leave_requests_employee_idx").on(table.employeeId),
    index("leave_requests_status_idx").on(table.status),
  ]
);

/* =========================
   PAYROLL
========================= */

export const payrollRecords = pgTable(
  "payroll_records",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    workingDays: integer("working_days").notNull(),
    daysPresent: integer("days_present").notNull(),
    monthlySalary: real("monthly_salary").notNull(),
    payableAmount: real("payable_amount").notNull(),
    generatedBy: integer("generated_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  }
);

export const payslips = pgTable("payslips", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  payrollId: integer("payroll_id")
    .notNull()
    .references(() => payrollRecords.id),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* =========================
   AUDIT LOGS
========================= */

export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* =========================
   OFFICE SETTINGS
========================= */

export const officeSettings = pgTable("office_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  officeName: text("office_name").notNull().default("Main Office"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  allowedRadiusMeters: real("allowed_radius_meters").notNull().default(200),
});

/* =========================
   ZOD VALIDATION
========================= */

export const leaveApplicationSchema = z.object({
  leaveType: z.enum(["MEDICAL", "CASUAL", "EARNED", "UNPAID"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(5),
});

export const clockInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const correctionRequestSchema = z.object({
  date: z.string(),
  reason: z.string().min(5),
  requestedClockIn: z.string().optional(),
  requestedClockOut: z.string().optional(),
});

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  department: z.string().min(1),
  designation: z.string().min(1),
  managerId: z.number().min(1),
  monthlySalary: z.number().min(0),
  dateOfJoining: z.string(),
  role: z.enum(["SUPER_ADMIN", "HR", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
});

export const resetPasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const adminResetPasswordSchema = z.object({
  employeeId: z.number(),
});

/* =========================
   INSERT SCHEMAS
========================= */

export const insertUserSchema = createInsertSchema(users);

export const insertEmployeeSchema = createInsertSchema(employees);

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance);

export const insertAttendanceCorrectionSchema =
  createInsertSchema(attendanceCorrections).omit({
    status: true,
    reviewedBy: true,
    reviewedAt: true,
    createdAt: true,
  });




/* =========================
   TYPES
========================= */

export type User = typeof users.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type AttendanceCorrection = typeof attendanceCorrections.$inferSelect;
export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type OfficeSetting = typeof officeSettings.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertAttendanceCorrection =
  z.infer<typeof insertAttendanceCorrectionSchema>;

