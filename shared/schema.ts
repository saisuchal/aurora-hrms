import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, date, pgEnum, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN", "HR", "MANAGER", "EMPLOYEE"]);
export const leaveStatusEnum = pgEnum("leave_status", ["PENDING", "APPROVED", "REJECTED"]);
export const correctionStatusEnum = pgEnum("correction_status", ["PENDING", "APPROVED", "REJECTED"]);
export const leaveTypeEnum = pgEnum("leave_type", ["SICK", "CASUAL", "EARNED", "UNPAID"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: roleEnum("role").notNull().default("EMPLOYEE"),
  isActive: boolean("is_active").notNull().default(true),
  mustResetPassword: boolean("must_reset_password").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("users_username_idx").on(table.username),
]);

export const employees = pgTable("employees", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  employeeCode: varchar("employee_code", { length: 20 }).notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  department: text("department").notNull(),
  designation: text("designation").notNull(),
  managerId: integer("manager_id"),
  monthlySalary: real("monthly_salary").notNull().default(0),
  dateOfJoining: date("date_of_joining").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [
  index("employees_user_id_idx").on(table.userId),
  index("employees_manager_id_idx").on(table.managerId),
  index("employees_department_idx").on(table.department),
]);

export const attendance = pgTable("attendance", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  date: date("date").notNull(),
  clockIn: timestamp("clock_in"),
  clockOut: timestamp("clock_out"),
  clockInLat: real("clock_in_lat"),
  clockInLng: real("clock_in_lng"),
  clockOutLat: real("clock_out_lat"),
  clockOutLng: real("clock_out_lng"),
  ipAddress: varchar("ip_address", { length: 45 }),
  status: text("status").notNull().default("PRESENT"),
}, (table) => [
  index("attendance_employee_date_idx").on(table.employeeId, table.date),
]);

export const attendanceCorrections = pgTable("attendance_corrections", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  attendanceId: integer("attendance_id").references(() => attendance.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  date: date("date").notNull(),
  reason: text("reason").notNull(),
  requestedClockIn: timestamp("requested_clock_in"),
  requestedClockOut: timestamp("requested_clock_out"),
  status: correctionStatusEnum("status").notNull().default("PENDING"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason").notNull(),
  status: leaveStatusEnum("status").notNull().default("PENDING"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("leave_requests_employee_idx").on(table.employeeId),
  index("leave_requests_status_idx").on(table.status),
]);

export const payrollRecords = pgTable("payroll_records", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  workingDays: integer("working_days").notNull(),
  daysPresent: integer("days_present").notNull(),
  monthlySalary: real("monthly_salary").notNull(),
  payableAmount: real("payable_amount").notNull(),
  generatedBy: integer("generated_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("payroll_employee_month_idx").on(table.employeeId, table.month, table.year),
]);

export const payslips = pgTable("payslips", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  payrollId: integer("payroll_id").notNull().references(() => payrollRecords.id),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("audit_logs_created_idx").on(table.createdAt),
]);

export const inviteTokens = pgTable("invite_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const officeSettings = pgTable("office_settings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  officeName: text("office_name").notNull().default("Main Office"),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  allowedRadiusMeters: real("allowed_radius_meters").notNull().default(200),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  employee: one(employees, { fields: [users.id], references: [employees.userId] }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  manager: one(employees, { fields: [employees.managerId], references: [employees.id], relationName: "managerRelation" }),
  subordinates: many(employees, { relationName: "managerRelation" }),
  attendanceRecords: many(attendance),
  leaveRequests: many(leaveRequests),
  payrollRecords: many(payrollRecords),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  employee: one(employees, { fields: [attendance.employeeId], references: [employees.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
  reviewer: one(users, { fields: [leaveRequests.reviewedBy], references: [users.id] }),
}));

export const payrollRecordsRelations = relations(payrollRecords, ({ one, many }) => ({
  employee: one(employees, { fields: [payrollRecords.employeeId], references: [employees.id] }),
  payslips: many(payslips),
}));

export const payslipsRelations = relations(payslips, ({ one }) => ({
  payroll: one(payrollRecords, { fields: [payslips.payrollId], references: [payrollRecords.id] }),
  employee: one(employees, { fields: [payslips.employeeId], references: [employees.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, status: true, reviewedBy: true, reviewedAt: true, createdAt: true });
export const insertAttendanceCorrectionSchema = createInsertSchema(attendanceCorrections).omit({ id: true, status: true, reviewedBy: true, reviewedAt: true, createdAt: true });
export const insertPayrollRecordSchema = createInsertSchema(payrollRecords).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertInviteTokenSchema = createInsertSchema(inviteTokens).omit({ id: true, createdAt: true });
export const insertOfficeSettingsSchema = createInsertSchema(officeSettings).omit({ id: true });

// Zod schemas for request validation
export const loginSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
});

export const resetPasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

export const adminResetPasswordSchema = z.object({
  employeeId: z.number(),
});

export const clockInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const leaveApplicationSchema = z.object({
  leaveType: z.enum(["SICK", "CASUAL", "EARNED", "UNPAID"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().min(5),
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
  managerId: z.number().optional(),
  monthlySalary: z.number().min(0),
  dateOfJoining: z.string(),
  role: z.enum(["SUPER_ADMIN", "HR", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Attendance = typeof attendance.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type AttendanceCorrection = typeof attendanceCorrections.$inferSelect;
export type PayrollRecord = typeof payrollRecords.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InviteToken = typeof inviteTokens.$inferSelect;
export type OfficeSetting = typeof officeSettings.$inferSelect;
