import {
  users, employees, attendance, attendanceCorrections,
  leaveRequests, payrollRecords, payslips, auditLogs,
  officeSettings,
  type User, type InsertUser, type Employee, type Attendance,
  type LeaveRequest, type AttendanceCorrection, type PayrollRecord,
  type AuditLog, type OfficeSetting,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, count, ilike, or, gte, lte, lt } from "drizzle-orm";
import { randomBytes } from "crypto";


export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByUserId(userId: number): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  getEmployees(page: number, limit: number, search?: string): Promise<{ records: any[]; total: number }>;
  getManagers(): Promise<Employee[]>;
  createEmployee(data: any): Promise<Employee>;
  updateEmployee(id: number, data: any): Promise<Employee | undefined>;
  linkEmployeeToUser(employeeId: number, userId: number): Promise<void>;
  getTeamMembers(managerId: number): Promise<Employee[]>;

  getTodayAttendance(employeeId: number): Promise<Attendance | undefined>;
  createAttendance(data: any): Promise<Attendance>;
  updateAttendance(id: number, data: any): Promise<Attendance | undefined>;
  getAttendanceHistory(employeeId: number, page: number, limit: number, month?: number, year?: number): Promise<{ records: (Attendance & { correctionStatus: string | null })[]; total: number; }>;
  getTeamAttendanceToday(managerEmployeeId: number): Promise<any[]>;
  getDaysPresent(employeeId: number, month: number, year: number): Promise<number>;
  getMonthlyAttendanceSummary(employeeId: number, month: number, year: number): Promise<{ workingDays: number; presentDays: number; absentDays: number; }>;

  createAttendanceCorrection(data: any): Promise<AttendanceCorrection>;
  getCorrections(page: number, limit: number): Promise<{ records: any[]; total: number }>;
  updateCorrectionStatus(id: number, status: string, reviewedBy: number): Promise<void>;
  getCorrectionById(id: number): Promise<AttendanceCorrection | undefined>;
  updateAttendanceByEmployeeAndDate(employeeId: number, date: string, data: { clockIn?: Date | null; clockOut?: Date | null }): Promise<void>;


  createLeaveRequest(data: any): Promise<LeaveRequest>;
  getLeaveRequests(employeeId: number, page: number, limit: number): Promise<{ records: LeaveRequest[]; total: number }>;
  getAllLeaves(status: string, page: number, limit: number): Promise<{ records: any[]; total: number }>;
  getTeamLeaves(managerEmployeeId: number): Promise<any[]>;
  updateLeaveStatus(id: number, status: string, reviewedBy: number): Promise<void>;
  getLeaveRequest(id: number): Promise<LeaveRequest | undefined>;
  processMonthlyLeaveAccrual(): Promise<void>;
  getEmployeeLeaveBalance(employeeId: number): Promise<{ casualLeaveBalance: number | null; medicalLeaveBalance: number | null; } | null>;
  reviewLeaveWithTransaction(leaveId: number, status: string, reviewedBy: number): Promise<void>;
  hasOverlappingLeave(employeeId: number, startDate: string, endDate: string): Promise<boolean>;
  getLeavesByManager(managerId: number, status: LeaveRequest["status"], page: number, limit: number): Promise<{ records: any[]; total: number }>;


  createPayrollRecord(data: any): Promise<PayrollRecord>;
  getPayrollRecords(page: number, limit: number): Promise<{ records: any[]; total: number }>;
  getEmployeePayslips(employeeId: number, page: number, limit: number): Promise<{ records: any[]; total: number }>;
  createPayslip(data: any): Promise<any>;
  getPayslip(id: number): Promise<any>;

  createAuditLog(data: any): Promise<AuditLog>;
  getAuditLogs(page: number, limit: number): Promise<{ records: any[]; total: number }>;

  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  setMustResetPassword(userId: number, mustReset: boolean): Promise<void>;

  setEmployeeActive(employeeId: number, isActive: boolean): Promise<void>;
  setUserActive(userId: number, isActive: boolean): Promise<void>;

  getOfficeSettings(): Promise<OfficeSetting | undefined>;
  upsertOfficeSettings(data: any): Promise<OfficeSetting>;

  getDashboardData(): Promise<any>;
}

export class DatabaseStorage implements IStorage {

  async backfillAttendance(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const activeEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.isActive, true));

    for (const emp of activeEmployees) {
      if (!emp.dateOfJoining) continue;

      const startDate = new Date(emp.dateOfJoining);
      startDate.setHours(0, 0, 0, 0);

      for (
        let d = new Date(startDate);
        d <= yesterday;
        d.setDate(d.getDate() + 1)
      ) {
        const dateStr = d.toISOString().split("T")[0];

        // Check if attendance already exists
        const existing = await db
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.employeeId, emp.id),
              eq(attendance.date, dateStr)
            )
          )
          .limit(1);

        if (existing.length > 0) continue;

        const isSunday = d.getDay() === 0;

        await db.insert(attendance).values({
          employeeId: emp.id,
          date: dateStr,
          status: isSunday ? "HOLIDAY" : "UNPAID",
          clockIn: null,
          clockOut: null,
        });
      }
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser as any).returning();
    return user;
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.id, id));
    return emp || undefined;
  }

  async getEmployeeByUserId(userId: number): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.userId, userId));
    return emp || undefined;
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    const [emp] = await db.select().from(employees).where(eq(employees.email, email));
    return emp || undefined;
  }

  async getEmployees(page: number, limit: number, search?: string, activeOnly: boolean = true) {
    const offset = (page - 1) * limit;
    const conditions: any[] = [];

    if (activeOnly) {
      conditions.push(eq(employees.isActive, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(employees.firstName, `%${search}%`),
          ilike(employees.lastName, `%${search}%`),
          ilike(employees.email, `%${search}%`),
          ilike(employees.employeeCode, `%${search}%`)
        )!
      );
    }

    const records = await db.select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      firstName: employees.firstName,
      lastName: employees.lastName,
      email: employees.email,
      phone: employees.phone,
      department: employees.department,
      designation: employees.designation,
      monthlySalary: employees.monthlySalary,
      dateOfJoining: employees.dateOfJoining,
      isActive: employees.isActive,
      userId: employees.userId,
      managerId: employees.managerId,
      role: users.role,
      casualLeaveBalance: employees.casualLeaveBalance,
      medicalLeaveBalance: employees.medicalLeaveBalance,
      earnedLeaveBalance: employees.earnedLeaveBalance,
    }).from(employees)
      .leftJoin(users, eq(employees.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(employees.id))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(employees).where(and(...conditions));
    return { records, total };
  }

  async getManagers(): Promise<Employee[]> {
    return db.select().from(employees)
      .innerJoin(users, eq(employees.userId, users.id))
      .where(and(
        eq(employees.isActive, true),
        or(eq(users.role, "MANAGER"), eq(users.role, "HR"), eq(users.role, "SUPER_ADMIN"))
      ))
      .then(rows => rows.map(r => r.employees));
  }

  async createEmployee(data: any): Promise<Employee> {
    return await db.transaction(async (tx) => {
      // 1️⃣ Insert with temporary code
      const [inserted] = await tx
        .insert(employees)
        .values({
          ...data,
          employeeCode: "TEMP",
        })
        .returning();

      // 2️⃣ Generate deterministic code from real ID
      const employeeCode = `EMP${String(inserted.id).padStart(4, "0")}`;

      // 3️⃣ Update row with correct code
      const [updated] = await tx
        .update(employees)
        .set({ employeeCode })
        .where(eq(employees.id, inserted.id))
        .returning();

      return updated;
    });
  }


  async updateEmployee(id: number, data: any): Promise<Employee | undefined> {
    const [emp] = await db.update(employees).set(data).where(eq(employees.id, id)).returning();
    return emp || undefined;
  }

  async linkEmployeeToUser(employeeId: number, userId: number): Promise<void> {
    await db.update(employees).set({ userId }).where(eq(employees.id, employeeId));
  }

  async getTeamMembers(managerId: number): Promise<Employee[]> {
    return db.select().from(employees)
      .where(and(eq(employees.managerId, managerId), eq(employees.isActive, true)));
  }

  async getTodayAttendance(employeeId: number): Promise<Attendance | undefined> {
    const today = new Date().toISOString().split("T")[0];
    const [record] = await db.select().from(attendance)
      .where(and(eq(attendance.employeeId, employeeId), eq(attendance.date, today)));
    return record || undefined;
  }

  async createAttendance(data: any): Promise<Attendance> {
    const [record] = await db.insert(attendance).values(data).returning();
    return record;
  }

  async updateAttendance(id: number, data: any): Promise<Attendance | undefined> {
    const [record] = await db.update(attendance).set(data).where(eq(attendance.id, id)).returning();
    return record || undefined;
  }

  async updateAttendanceByEmployeeAndDate(
    employeeId: number,
    date: string,
    data: { clockIn?: Date | null; clockOut?: Date | null }
  ): Promise<void> {
    await db
      .update(attendance)
      .set({
        clockIn: data.clockIn ?? null,
        clockOut: data.clockOut ?? null,
      })
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          eq(attendance.date, date)
        )
      );
  }

  async getAttendanceHistory(
    employeeId: number,
    page: number,
    limit: number,
    month: number,
    year: number
  ) {
    const offset = (page - 1) * limit;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];

    const recordsRaw = await db
      .select({
        attendance: attendance,
        correctionStatus: attendanceCorrections.status,
      })
      .from(attendance)
      .leftJoin(
        attendanceCorrections,
        and(
          eq(attendance.employeeId, attendanceCorrections.employeeId),
          eq(attendance.date, attendanceCorrections.date)
        )
      )
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          gte(attendance.date, start),
          lte(attendance.date, end)
        )
      )
      .orderBy(desc(attendance.date))
      .limit(limit)
      .offset(offset);

    const records = recordsRaw.map((row) => ({
      ...row.attendance,
      correctionStatus: row.correctionStatus ?? null,
    }));

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          gte(attendance.date, start),
          lte(attendance.date, end)
        )
      );

    return { records, total: Number(total || 0) };
  }





  async getTeamAttendanceToday(managerEmployeeId: number): Promise<any[]> {
    const today = new Date().toISOString().split("T")[0];
    const team = await this.getTeamMembers(managerEmployeeId);
    const results = [];

    for (const member of team) {
      const [att] = await db.select().from(attendance)
        .where(and(eq(attendance.employeeId, member.id), eq(attendance.date, today)));
      results.push({
        employeeId: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        department: member.department,
        clockIn: att?.clockIn || null,
        clockOut: att?.clockOut || null,
      });
    }
    return results;
  }

  async getDaysPresent(employeeId: number, month: number, year: number): Promise<number> {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

    const [{ value }] = await db.select({ value: count() }).from(attendance)
      .where(and(
        eq(attendance.employeeId, employeeId),
        gte(attendance.date, startDate),
        lte(attendance.date, endDate),
        eq(attendance.status, "PRESENT")
      ));
    return value;
  }

  async getMonthlyAttendanceSummary(
    employeeId: number,
    month: number,
    year: number
  ): Promise<{
    workingDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
  }> {

    const today = new Date();

    const startDate = new Date(year, month - 1, 1);

    let endDate: Date;

    if (
      year === today.getFullYear() &&
      month === today.getMonth() + 1
    ) {
      endDate = today;
    } else {
      endDate = new Date(year, month, 0);
    }

    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];

    // 🔹 Count PRESENT
    const [{ value: presentRaw }] = await db
      .select({ value: count() })
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          gte(attendance.date, start),
          lte(attendance.date, end),
          eq(attendance.status, "PRESENT")
        )
      );

    const presentDays = Number(presentRaw || 0);

    // 🔹 Count UNPAID
    const [{ value: unpaidRaw }] = await db
      .select({ value: count() })
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          gte(attendance.date, start),
          lte(attendance.date, end),
          eq(attendance.status, "UNPAID")
        )
      );

    const absentDays = Number(unpaidRaw || 0);

    // 🔹 Count ON_LEAVE
    const [{ value: leaveRaw }] = await db
      .select({ value: count() })
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          gte(attendance.date, start),
          lte(attendance.date, end),
          eq(attendance.status, "ON_LEAVE")
        )
      );

    const leaveDays = Number(leaveRaw || 0);

    // 🔹 Calculate working days (exclude Sundays)
    let workingDays = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (current.getDay() !== 0) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return {
      workingDays,
      presentDays,
      absentDays,
      leaveDays,
    };
  }


  async createAttendanceCorrection(data: any): Promise<AttendanceCorrection> {
    const [record] = await db.insert(attendanceCorrections).values(data).returning();
    return record;
  }

  async getCorrections(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const records = await db.select({
      id: attendanceCorrections.id,
      date: attendanceCorrections.date,
      reason: attendanceCorrections.reason,
      requestedClockIn: attendanceCorrections.requestedClockIn,
      requestedClockOut: attendanceCorrections.requestedClockOut,
      status: attendanceCorrections.status,
      createdAt: attendanceCorrections.createdAt,
      firstName: employees.firstName,
      lastName: employees.lastName,
    }).from(attendanceCorrections)
      .innerJoin(employees, eq(attendanceCorrections.employeeId, employees.id))
      .orderBy(desc(attendanceCorrections.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(attendanceCorrections);
    return { records, total };
  }

  async getCorrectionById(id: number): Promise<AttendanceCorrection | undefined> {
    const [record] = await db
      .select()
      .from(attendanceCorrections)
      .where(eq(attendanceCorrections.id, id));

    return record || undefined;
  }

  async updateCorrectionStatus(
    id: number,
    status: "APPROVED" | "REJECTED",
    reviewedBy: number
  ): Promise<void> {

    await db.transaction(async (tx) => {

      const [correction] = await tx
        .select()
        .from(attendanceCorrections)
        .where(eq(attendanceCorrections.id, id))
        .for("update");

      if (!correction) {
        throw new Error("Correction not found");
      }

      if (correction.status !== "PENDING") {
        throw new Error("Correction already reviewed");
      }

      if (status === "APPROVED") {

        const [attendanceRecord] = await tx
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.employeeId, correction.employeeId),
              eq(attendance.date, correction.date)
            )
          )
          .for("update");

        if (!attendanceRecord) {
          throw new Error("Attendance record not found");
        }

        await tx
          .update(attendance)
          .set({
            clockIn:
              correction.requestedClockIn ?? attendanceRecord.clockIn,
            clockOut:
              correction.requestedClockOut ?? attendanceRecord.clockOut,
            status: "PRESENT", // 🔥 THIS FIXES YOUR SUMMARY
          })
          .where(eq(attendance.id, attendanceRecord.id));
      }

      await tx
        .update(attendanceCorrections)
        .set({
          status,
          reviewedBy,
          reviewedAt: new Date(),
        })
        .where(eq(attendanceCorrections.id, id));
    });
  }


  async createLeaveRequest(data: any): Promise<LeaveRequest> {
    const [record] = await db.insert(leaveRequests).values(data).returning();
    return record;
  }

  async getLeaveRequests(employeeId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const records = await db.select().from(leaveRequests)
      .where(eq(leaveRequests.employeeId, employeeId))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(leaveRequests)
      .where(eq(leaveRequests.employeeId, employeeId));

    return { records, total };
  }

  async getAllLeaves(status: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const records = await db.select({
      id: leaveRequests.id,
      leaveType: leaveRequests.leaveType,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      createdAt: leaveRequests.createdAt,
      firstName: employees.firstName,
      lastName: employees.lastName,
    }).from(leaveRequests)
      .innerJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .where(eq(leaveRequests.status, status as any))
      .orderBy(desc(leaveRequests.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(leaveRequests)
      .where(eq(leaveRequests.status, status as any));

    return { records, total };
  }

  async getTeamLeaves(managerEmployeeId: number): Promise<any[]> {
    const team = await this.getTeamMembers(managerEmployeeId);
    const teamIds = team.map(t => t.id);
    if (teamIds.length === 0) return [];

    const results = [];
    for (const member of team) {
      const leaves = await db.select().from(leaveRequests)
        .where(eq(leaveRequests.employeeId, member.id))
        .orderBy(desc(leaveRequests.createdAt));
      for (const leave of leaves) {
        results.push({
          ...leave,
          firstName: member.firstName,
          lastName: member.lastName,
        });
      }
    }
    return results;
  }

  async updateLeaveStatus(id: number, status: string, reviewedBy: number): Promise<void> {
    await db.update(leaveRequests).set({
      status: status as any,
      reviewedBy,
      reviewedAt: new Date(),
    }).where(eq(leaveRequests.id, id));
  }

  async getLeaveRequest(id: number): Promise<LeaveRequest | undefined> {
    const [record] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id));
    return record || undefined;
  }

  async reviewLeaveWithTransaction(
    leaveId: number,
    status: string,
    reviewedBy: number
  ): Promise<void> {

    await db.transaction(async (tx) => {

      const [leave] = await tx
        .select()
        .from(leaveRequests)
        .where(eq(leaveRequests.id, leaveId))
        .for("update");

      if (!leave) {
        throw new Error("Leave request not found");
      }

      if (leave.status === "APPROVED") {
        throw new Error("Leave already approved");
      }

      if (status === "APPROVED") {

        const [employee] = await tx
          .select()
          .from(employees)
          .where(eq(employees.id, leave.employeeId))
          .for("update");

        if (!employee) {
          throw new Error("Employee not found");
        }

        const days = leave.days;

        // 🔹 Deduct leave balance
        if (leave.leaveType === "CASUAL") {
          if ((employee.casualLeaveBalance || 0) < days) {
            throw new Error("Insufficient casual leave balance");
          }

          await tx.update(employees)
            .set({
              casualLeaveBalance:
                sql`${employees.casualLeaveBalance} - ${days}`,
            })
            .where(eq(employees.id, employee.id));
        }

        if (leave.leaveType === "MEDICAL") {
          if ((employee.medicalLeaveBalance || 0) < days) {
            throw new Error("Insufficient medical leave balance");
          }

          await tx.update(employees)
            .set({
              medicalLeaveBalance:
                sql`${employees.medicalLeaveBalance} - ${days}`,
            })
            .where(eq(employees.id, employee.id));
        }

        if (leave.leaveType === "EARNED") {
          if ((employee.earnedLeaveBalance || 0) < days) {
            throw new Error("Insufficient earned leave balance");
          }

          await tx.update(employees)
            .set({
              earnedLeaveBalance:
                sql`${employees.earnedLeaveBalance} - ${days}`,
            })
            .where(eq(employees.id, employee.id));
        }

        // 🔹 Mark attendance as ON_LEAVE
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);

        for (
          let d = new Date(start);
          d <= end;
          d.setDate(d.getDate() + 1)
        ) {
          const dateStr = d.toISOString().split("T")[0];
          const isSunday = d.getDay() === 0;

          if (isSunday) {
            continue; // keep Sunday as HOLIDAY
          }

          // Check if attendance record exists
          const existing = await tx
            .select()
            .from(attendance)
            .where(
              and(
                eq(attendance.employeeId, employee.id),
                eq(attendance.date, dateStr)
              )
            )
            .limit(1);

          if (existing.length === 0) {
            // Insert new ON_LEAVE record
            await tx.insert(attendance).values({
              employeeId: employee.id,
              date: dateStr,
              status: "ON_LEAVE",
            });
          } else {
            const record = existing[0];

            // Do NOT override PRESENT
            if (record.status !== "PRESENT") {
              await tx.update(attendance)
                .set({ status: "ON_LEAVE" })
                .where(eq(attendance.id, record.id));
            }
          }
        }
      }

      // 🔹 Finally update leave request status
      await tx.update(leaveRequests)
        .set({
          status: status as any,
          reviewedBy,
          reviewedAt: new Date(),
        })
        .where(eq(leaveRequests.id, leaveId));
    });
  }


  async hasOverlappingLeave(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<boolean> {
    const existing = await db
      .select()
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.employeeId, employeeId),
          or(
            eq(leaveRequests.status, "APPROVED"),
            eq(leaveRequests.status, "PENDING")
          ),
          lte(leaveRequests.startDate, endDate),
          gte(leaveRequests.endDate, startDate)
        )
      );

    return existing.length > 0;
  }

  async getLeavesByManager(
    managerId: number,
    status: LeaveRequest["status"],
    page: number,
    limit: number
  ): Promise<{ records: any[]; total: number }> {

    const offset = (page - 1) * limit;

    const baseCondition = and(
      eq(employees.managerId, managerId),
      eq(leaveRequests.status, status)
    );

    const records = await db
      .select({
        id: leaveRequests.id,
        leaveType: leaveRequests.leaveType,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        days: leaveRequests.days,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(leaveRequests)
      .innerJoin(
        employees,
        eq(leaveRequests.employeeId, employees.id)
      )
      .where(baseCondition)
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(leaveRequests)
      .innerJoin(
        employees,
        eq(leaveRequests.employeeId, employees.id)
      )
      .where(baseCondition);

    return { records, total };
  }







  async getEmployeeLeaveBalance(employeeId: number) {
    const [emp] = await db
      .select({
        casualLeaveBalance: employees.casualLeaveBalance,
        medicalLeaveBalance: employees.medicalLeaveBalance,
      })
      .from(employees)
      .where(eq(employees.id, employeeId));

    return emp || null;
  }

  private calculateLeaveDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const diff =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return diff > 0 ? diff : 0;
  }



  async processMonthlyLeaveAccrual(): Promise<void> {
    const today = new Date();

    // 1️⃣ Only execute on the 1st
    if (today.getDate() !== 1) {
      return;
    }

    const firstOfCurrentMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
      0, 0, 0, 0
    );

    const activeEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.isActive, true));

    for (const emp of activeEmployees) {
      const lastAccrual = emp.lastLeaveAccrual
        ? new Date(emp.lastLeaveAccrual)
        : null;

      const alreadyCreditedThisMonth =
        lastAccrual &&
        lastAccrual.getFullYear() === firstOfCurrentMonth.getFullYear() &&
        lastAccrual.getMonth() === firstOfCurrentMonth.getMonth() &&
        lastAccrual.getDate() === 1;

      if (!alreadyCreditedThisMonth) {
        await db
          .update(employees)
          .set({
            casualLeaveBalance: sql`${employees.casualLeaveBalance} + 1`,
            medicalLeaveBalance: sql`${employees.medicalLeaveBalance} + 1`,
            lastLeaveAccrual: firstOfCurrentMonth.toISOString(),
          })
          .where(eq(employees.id, emp.id));
      }
    }
  }

  async markPastIncompleteAsUnpaid(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayStr =
      yesterday.getFullYear() +
      "-" +
      String(yesterday.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(yesterday.getDate()).padStart(2, "0");

    const isSunday = yesterday.getDay() === 0;

    const activeEmployees = await db
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.isActive, true),
          lte(employees.dateOfJoining, yesterdayStr)
        )
      );

    for (const emp of activeEmployees) {
      const existing = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.employeeId, emp.id),
            eq(attendance.date, yesterdayStr)
          )
        )
        .limit(1);

      // 1️⃣ No record → insert
      if (existing.length === 0) {
        await db.insert(attendance).values({
          employeeId: emp.id,
          date: yesterdayStr,
          status: isSunday ? "HOLIDAY" : "UNPAID",
        });
        continue;
      }

      const record = existing[0];

      // 2️⃣ If Sunday and record exists → leave as-is
      if (isSunday) {
        continue;
      }

      // 3️⃣ Incomplete → mark UNPAID
      if (!record.clockIn || !record.clockOut) {
        await db
          .update(attendance)
          .set({ status: "UNPAID" })
          .where(eq(attendance.id, record.id));
      }
    }
  }








  async createPayrollRecord(data: any): Promise<PayrollRecord> {
    const [record] = await db.insert(payrollRecords).values(data).returning();
    return record;
  }

  async getPayrollRecords(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const records = await db.select({
      id: payrollRecords.id,
      month: payrollRecords.month,
      year: payrollRecords.year,
      workingDays: payrollRecords.workingDays,
      daysPresent: payrollRecords.daysPresent,
      monthlySalary: payrollRecords.monthlySalary,
      payableAmount: payrollRecords.payableAmount,
      createdAt: payrollRecords.createdAt,
      firstName: employees.firstName,
      lastName: employees.lastName,
    }).from(payrollRecords)
      .innerJoin(employees, eq(payrollRecords.employeeId, employees.id))
      .orderBy(desc(payrollRecords.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(payrollRecords);
    return { records, total };
  }

  async getEmployeePayslips(employeeId: number, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const records = await db.select({
      id: payrollRecords.id,
      payslipId: payslips.id,
      month: payrollRecords.month,
      year: payrollRecords.year,
      workingDays: payrollRecords.workingDays,
      daysPresent: payrollRecords.daysPresent,
      monthlySalary: payrollRecords.monthlySalary,
      payableAmount: payrollRecords.payableAmount,
    }).from(payslips)
      .innerJoin(payrollRecords, eq(payslips.payrollId, payrollRecords.id))
      .where(eq(payslips.employeeId, employeeId))
      .orderBy(desc(payrollRecords.year), desc(payrollRecords.month))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(payslips)
      .where(eq(payslips.employeeId, employeeId));

    return { records, total };
  }

  async createPayslip(data: any) {
    const [record] = await db.insert(payslips).values(data).returning();
    return record;
  }

  async getPayslip(id: number) {
    const [record] = await db.select({
      id: payslips.id,
      month: payslips.month,
      year: payslips.year,
      payrollId: payslips.payrollId,
      employeeId: payslips.employeeId,
      workingDays: payrollRecords.workingDays,
      daysPresent: payrollRecords.daysPresent,
      monthlySalary: payrollRecords.monthlySalary,
      payableAmount: payrollRecords.payableAmount,
      firstName: employees.firstName,
      lastName: employees.lastName,
      employeeCode: employees.employeeCode,
      department: employees.department,
      designation: employees.designation,
    }).from(payslips)
      .innerJoin(payrollRecords, eq(payslips.payrollId, payrollRecords.id))
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(eq(payslips.id, id));
    return record || undefined;
  }

  async createAuditLog(data: any): Promise<AuditLog> {
    const [record] = await db.insert(auditLogs).values(data).returning();
    return record;
  }

  async getAuditLogs(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const records = await db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      username: users.username,
    }).from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(auditLogs);
    return { records, total };
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  async setMustResetPassword(userId: number, mustReset: boolean): Promise<void> {
    await db.update(users).set({ mustResetPassword: mustReset }).where(eq(users.id, userId));
  }

  async setEmployeeActive(employeeId: number, isActive: boolean): Promise<void> {
    await db.update(employees).set({ isActive }).where(eq(employees.id, employeeId));
  }

  async setUserActive(userId: number, isActive: boolean): Promise<void> {
    await db.update(users).set({ isActive }).where(eq(users.id, userId));
  }

  async getOfficeSettings(): Promise<OfficeSetting | undefined> {
    const [record] = await db.select().from(officeSettings).limit(1);
    return record || undefined;
  }

  async upsertOfficeSettings(data: any): Promise<OfficeSetting> {
    const existing = await this.getOfficeSettings();
    if (existing) {
      const [record] = await db.update(officeSettings).set(data).where(eq(officeSettings.id, existing.id)).returning();
      return record;
    }
    const [record] = await db.insert(officeSettings).values(data).returning();
    return record;
  }

  async getDashboardData() {
    const today = new Date().toISOString().split("T")[0];

    const [{ value: totalEmployees }] = await db.select({ value: count() }).from(employees)
      .where(eq(employees.isActive, true));

    const [{ value: presentToday }] = await db.select({ value: count() }).from(attendance)
      .where(and(eq(attendance.date, today), eq(attendance.status, "PRESENT")));

    const [{ value: onLeaveToday }] = await db.select({ value: count() }).from(leaveRequests)
      .where(and(
        eq(leaveRequests.status, "APPROVED"),
        lte(leaveRequests.startDate, today),
        gte(leaveRequests.endDate, today)
      ));

    const [{ value: pendingLeaves }] = await db.select({ value: count() }).from(leaveRequests)
      .where(eq(leaveRequests.status, "PENDING"));

    const [{ value: pendingCorrections }] = await db.select({ value: count() }).from(attendanceCorrections)
      .where(eq(attendanceCorrections.status, "PENDING"));

    return { totalEmployees, presentToday, onLeaveToday, pendingLeaves, pendingCorrections };
  }
}

export const storage = new DatabaseStorage();
