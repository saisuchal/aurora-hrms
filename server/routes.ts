import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, hashPassword, comparePasswords, generateRandomPassword } from "./auth";
import {
  clockInSchema, leaveApplicationSchema, correctionRequestSchema,
  createEmployeeSchema, resetPasswordSchema, adminResetPasswordSchema,
} from "@shared/schema";
import { sendCredentialsEmail, sendPasswordResetNotification } from "./email";
import { db } from "./db";
import { users, employees } from "@shared/schema";
import { eq } from "drizzle-orm";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
  if (req.user!.mustResetPassword) return res.status(403).json({ message: "Password reset required", mustResetPassword: true });
  next();
}

function requireRole(...roles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    if (req.user!.mustResetPassword) return res.status(403).json({ message: "Password reset required", mustResetPassword: true });
    if (!roles.includes(req.user!.role)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}

function getClientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || "unknown";
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Dashboard
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const data = await storage.getDashboardData();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Today's attendance for logged-in user
  app.get("/api/attendance/today", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.json(null);
      const record = await storage.getTodayAttendance(employee.id);
      res.json(record || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Clock in
  app.post("/api/attendance/clock-in", requireAuth, async (req, res) => {
    try {
      const parsed = clockInSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid location data" });

      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.status(400).json({ message: "Employee record not found" });

      const existing = await storage.getTodayAttendance(employee.id);
      if (existing?.clockIn) return res.status(400).json({ message: "Already clocked in today" });

      const officeConfig = await storage.getOfficeSettings();
      if (officeConfig) {
        const distance = haversineDistance(
          parsed.data.latitude, parsed.data.longitude,
          officeConfig.latitude, officeConfig.longitude
        );
        if (distance > officeConfig.allowedRadiusMeters) {
          return res.status(400).json({
            message: `You are ${Math.round(distance)}m from the office. Must be within ${officeConfig.allowedRadiusMeters}m.`
          });
        }
      }

      const today = new Date().toISOString().split("T")[0];
      const record = await storage.createAttendance({
        employeeId: employee.id,
        date: today,
        clockIn: new Date(),
        clockInLat: parsed.data.latitude,
        clockInLng: parsed.data.longitude,
        ipAddress: getClientIp(req),
        status: "PRESENT",
      });

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CLOCK_IN",
        entity: "attendance",
        entityId: record.id,
        details: `Clock in at ${parsed.data.latitude}, ${parsed.data.longitude}`,
        ipAddress: getClientIp(req),
      });

      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Clock out
  app.post("/api/attendance/clock-out", requireAuth, async (req, res) => {
    try {
      const parsed = clockInSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid location data" });

      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.status(400).json({ message: "Employee record not found" });

      const existing = await storage.getTodayAttendance(employee.id);
      if (!existing?.clockIn) return res.status(400).json({ message: "Not clocked in yet" });
      if (existing.clockOut) return res.status(400).json({ message: "Already clocked out" });

      const record = await storage.updateAttendance(existing.id, {
        clockOut: new Date(),
        clockOutLat: parsed.data.latitude,
        clockOutLng: parsed.data.longitude,
      });

      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Attendance history
  // app.get("/api/attendance/history", requireAuth, async (req, res) => {
  //   try {
  //     const employee = await storage.getEmployeeByUserId(req.user!.id);
  //     if (!employee) return res.json({ records: [], total: 0, totalPages: 0 });

  //     const page = parseInt(req.query.page as string) || 1;
  //     const limit = 10;
  //     const { records, total } = await storage.getAttendanceHistory(employee.id, page, limit);
  //     res.json({ records, total, totalPages: Math.ceil(total / limit) });
  //   } catch (err: any) {
  //     res.status(500).json({ message: err.message });
  //   }
  // });

  app.get("/api/attendance/history", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) {
        return res.json({ records: [], total: 0, totalPages: 0 });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = 10;

      const month = Number(req.query.month);
      const year = Number(req.query.year);

      const { records, total } =
        await storage.getAttendanceHistory(
          employee.id,
          page,
          limit,
          month,
          year
        );

      res.json({
        records,
        total,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  // Attendance correction request
  app.post("/api/attendance/correction", requireAuth, async (req, res) => {
    try {
      const parsed = correctionRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.status(400).json({ message: "Employee record not found" });

      const record = await storage.createAttendanceCorrection({
        employeeId: employee.id,
        date: parsed.data.date,
        reason: parsed.data.reason,
        requestedClockIn: parsed.data.requestedClockIn ? new Date(parsed.data.requestedClockIn) : null,
        requestedClockOut: parsed.data.requestedClockOut ? new Date(parsed.data.requestedClockOut) : null,
      });

      res.json(record);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  app.post(
    "/api/attendance/correction/:id/review",
    requireRole("HR", "MANAGER", "SUPER_ADMIN"),
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const { status } = req.body;

        if (!["APPROVED", "REJECTED"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        const correction = await storage.getCorrectionById(id);
        if (!correction) {
          return res.status(404).json({ message: "Correction not found" });
        }

        if (status === "APPROVED") {
          await storage.updateAttendanceByEmployeeAndDate(
            correction.employeeId,
            correction.date,
            {
              clockIn: correction.requestedClockIn,
              clockOut: correction.requestedClockOut,
            }
          );
        }

        await storage.updateCorrectionStatus(id, status, req.user!.id);

        await storage.createAuditLog({
          userId: req.user!.id,
          action: `CORRECTION_${status}`,
          entity: "attendance_correction",
          entityId: id,
          ipAddress: getClientIp(req),
        });

        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );


  app.get(
    "/api/attendance/summary",
    requireRole("EMPLOYEE", "MANAGER", "HR", "SUPER_ADMIN"),
    async (req, res) => {
      try {
        const month = Number(req.query.month);
        const year = Number(req.query.year);

        const user = req.user!;
        const employee = await storage.getEmployeeByUserId(user.id);

        if (!employee) {
          return res.status(404).json({ message: "Employee not found" });
        }

        const summary = await storage.getMonthlyAttendanceSummary(
          employee.id,
          month,
          year
        );

        res.json(summary);
      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );



  app.post("/api/leave", requireAuth, async (req, res) => {
    try {
      const parsed = leaveApplicationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) {
        return res.status(400).json({ message: "Employee record not found" });
      }

      const { leaveType, startDate, endDate } = parsed.data;

      const start = new Date(startDate);
      const end = new Date(endDate);

      // ✅ Validate date order
      const diffDays =
        Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 0) {
        return res.status(400).json({ message: "Invalid leave dates" });
      }

      // ✅ Allow only current month and next month
      const now = new Date();

      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
      const nextMonth = nextMonthDate.getMonth();
      const nextMonthYear = nextMonthDate.getFullYear();

      const isStartValid =
        (start.getMonth() === currentMonth &&
          start.getFullYear() === currentYear) ||
        (start.getMonth() === nextMonth &&
          start.getFullYear() === nextMonthYear);

      const isEndValid =
        (end.getMonth() === currentMonth &&
          end.getFullYear() === currentYear) ||
        (end.getMonth() === nextMonth &&
          end.getFullYear() === nextMonthYear);

      if (!isStartValid || !isEndValid) {
        return res.status(400).json({
          message:
            "Leave can only be applied for the current or next month",
        });
      }

      // ✅ Balance checks
      if (leaveType === "CASUAL") {
        if ((employee.casualLeaveBalance || 0) < diffDays) {
          return res.status(400).json({
            message: "Insufficient casual leave balance",
          });
        }
      }

      if (leaveType === "MEDICAL") {
        if ((employee.medicalLeaveBalance || 0) < diffDays) {
          return res.status(400).json({
            message: "Insufficient medical leave balance",
          });
        }
      }

      // ✅ Overlapping check
      const overlapping = await storage.hasOverlappingLeave(
        employee.id,
        startDate,
        endDate
      );

      if (overlapping) {
        return res.status(400).json({
          message: "Leave overlaps with an existing request",
        });
      }

      const record = await storage.createLeaveRequest({
        employeeId: employee.id,
        leaveType,
        startDate,
        endDate,
        reason: parsed.data.reason,
        days: diffDays,
        status: "PENDING",
      });

      res.json(record);

    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });




  app.get("/api/leave", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.json({ records: [], total: 0, totalPages: 0 });

      const page = parseInt(req.query.page as string) || 1;
      const limit = 10;
      const { records, total } = await storage.getLeaveRequests(employee.id, page, limit);
      res.json({ records, total, totalPages: Math.ceil(total / limit) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // app.post("/api/leave/:id/review", requireRole("HR", "SUPER_ADMIN", "MANAGER"), async (req: Request<{ id: string }>, res: Response) => {
  //   try {
  //     const id = parseInt(req.params.id);
  //     const { status } = req.body;
  //     if (!["APPROVED", "REJECTED"].includes(status)) {
  //       return res.status(400).json({ message: "Invalid status" });
  //     }

  //     await storage.updateLeaveStatus(id, status, req.user!.id);

  //     await storage.createAuditLog({
  //       userId: req.user!.id,
  //       action: `LEAVE_${status}`,
  //       entity: "leave_request",
  //       entityId: id,
  //       ipAddress: getClientIp(req),
  //     });

  //     res.json({ success: true });
  //   } catch (err: any) {
  //     res.status(500).json({ message: err.message });
  //   }
  // });

  // Team endpoints

  app.post(
    "/api/leave/:id/review",
    requireRole("HR", "SUPER_ADMIN", "MANAGER"),
    async (req: Request<{ id: string }>, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const { status } = req.body;

        if (!["APPROVED", "REJECTED"].includes(status)) {
          return res.status(400).json({ message: "Invalid status" });
        }

        await storage.reviewLeaveWithTransaction(
          id,
          status,
          req.user!.id
        );

        await storage.createAuditLog({
          userId: req.user!.id,
          action: `LEAVE_${status}`,
          entity: "leave_request",
          entityId: id,
          ipAddress: getClientIp(req),
        });

        res.json({ success: true });
      } catch (err: any) {
        res.status(400).json({ message: err.message });
      }
    }
  );


  app.get("/api/leave/balance", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      res.json({
        casual: employee.casualLeaveBalance || 0,
        medical: employee.medicalLeaveBalance || 0,
        earned: employee.earnedLeaveBalance || 0,
        unpaid: "-"
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });





  app.get("/api/team/attendance", requireRole("MANAGER", "HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.json([]);
      const data = await storage.getTeamAttendanceToday(employee.id);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/team/leaves", requireRole("MANAGER", "HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.json([]);
      const data = await storage.getTeamLeaves(employee.id);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Employee management (HR/Admin)
  app.get("/api/employees", requireRole("HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const search = req.query.search as string || "";
      const limit = 10;
      const { records, total } = await storage.getEmployees(page, limit, search, false);
      res.json({ records, total, totalPages: Math.ceil(total / limit) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/employees/managers", requireRole("HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const managers = await storage.getManagers();
      res.json(managers);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/employees", requireRole("HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const parsed = createEmployeeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const existing = await storage.getEmployeeByEmail(parsed.data.email);
      if (existing) {
        return res.status(400).json({ message: "Employee with this email already exists" });
      }

      const tempPassword = generateRandomPassword(12);
      const baseUsername = parsed.data.email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      const result = await db.transaction(async (tx) => {

        // 🔹 Ensure unique username (safe inside transaction)
        let finalUsername = baseUsername;
        let counter = 1;

        while (true) {
          const [existingUser] = await tx
            .select()
            .from(users)
            .where(eq(users.username, finalUsername));

          if (!existingUser) break;

          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }

        const hashedPassword = await hashPassword(tempPassword);

        // 🔹 Create User
        const [user] = await tx
          .insert(users)
          .values({
            username: finalUsername,
            password: hashedPassword,
            role: parsed.data.role || "EMPLOYEE",
            isActive: true,
            mustResetPassword: true,
          })
          .returning();

        // 🔹 Create Employee (temporary code first)
        const [employee] = await tx
          .insert(employees)
          .values({
            ...parsed.data,
            userId: user.id,
            employeeCode: "TEMP", // will update below
          })
          .returning();

        // 🔹 Safe employeeCode derived from ID
        const generatedCode = `EMP${String(employee.id).padStart(4, "0")}`;

        await tx
          .update(employees)
          .set({ employeeCode: generatedCode })
          .where(eq(employees.id, employee.id));

        return {
          user,
          employee: { ...employee, employeeCode: generatedCode },
          username: finalUsername,
        };
      });

      const appUrl = `${req.protocol}://${req.get("host")}`;

      try {
        await sendCredentialsEmail(
          parsed.data.email,
          parsed.data.firstName,
          result.username,
          tempPassword,
          appUrl
        );
      } catch (emailErr: any) {
        console.error("Failed to send credentials email:", emailErr.message);
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "CREATE_EMPLOYEE",
        entity: "employee",
        entityId: result.employee.id,
        details: `Created employee ${parsed.data.firstName} ${parsed.data.lastName} with username ${result.username}`,
        ipAddress: getClientIp(req),
      });

      res.status(201).json(result.employee);

    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  app.post("/api/employees/:id/toggle-active", requireRole("HR", "SUPER_ADMIN"), async (req: Request<{ id: string }>, res: Response) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployee(employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });

      const newStatus = !employee.isActive;
      await storage.setEmployeeActive(employeeId, newStatus);

      if (employee.userId) {
        await storage.setUserActive(employee.userId, newStatus);
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: newStatus ? "ACTIVATE_EMPLOYEE" : "DEACTIVATE_EMPLOYEE",
        entity: "employee",
        entityId: employeeId,
        details: `${newStatus ? "Activated" : "Deactivated"} employee ${employee.firstName} ${employee.lastName}`,
        ipAddress: getClientIp(req),
      });

      res.json({ success: true, isActive: newStatus });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/password/reset", (req, res, next) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Unauthorized" });
    next();
  }, async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const user = await storage.getUser(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await comparePasswords(parsed.data.currentPassword, user.password);
      if (!valid) return res.status(400).json({ message: "Current password is incorrect" });

      const hashedNew = await hashPassword(parsed.data.newPassword);
      await storage.updateUserPassword(user.id, hashedNew);
      await storage.setMustResetPassword(user.id, false);

      await storage.createAuditLog({
        userId: user.id,
        action: "PASSWORD_RESET",
        entity: "user",
        entityId: user.id,
        details: "User reset their own password",
        ipAddress: getClientIp(req),
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/password/reset", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const parsed = adminResetPasswordSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0].message });

      const employee = await storage.getEmployee(parsed.data.employeeId);
      if (!employee) return res.status(404).json({ message: "Employee not found" });
      if (!employee.userId) return res.status(400).json({ message: "Employee has no user account" });

      const newPassword = generateRandomPassword(12);
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(employee.userId, hashedPassword);
      await storage.setMustResetPassword(employee.userId, true);

      const appUrl = `${req.protocol}://${req.get("host")}`;
      try {
        await sendPasswordResetNotification(employee.email, employee.firstName, newPassword, appUrl);
      } catch (emailErr: any) {
        console.error("Failed to send password reset email:", emailErr.message);
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "ADMIN_PASSWORD_RESET",
        entity: "user",
        entityId: employee.userId,
        details: `Super Admin reset password for ${employee.firstName} ${employee.lastName}`,
        ipAddress: getClientIp(req),
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/password/forgot", async (req, res) => {
    try {
      const { username } = req.body;

      if (!username || typeof username !== "string") {
        return res.status(400).json({ message: "Username is required" });
      }

      const user = await storage.getUserByUsername(username);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const employee = await storage.getEmployeeByUserId(user.id);
      if (!employee) {
        return res.status(400).json({ message: "Employee record not found" });
      }

      const newPassword = generateRandomPassword(12);
      const hashedPassword = await hashPassword(newPassword);

      await storage.updateUserPassword(user.id, hashedPassword);
      await storage.setMustResetPassword(user.id, true);

      const appUrl = `${req.protocol}://${req.get("host")}`;

      await sendPasswordResetNotification(
        employee.email,
        employee.firstName,
        newPassword,
        appUrl
      );

      await storage.createAuditLog({
        userId: null,
        action: "FORGOT_PASSWORD_RESET",
        entity: "user",
        entityId: user.id,
        details: `Password reset requested for username ${username}`,
        ipAddress: getClientIp(req),
      });

      res.json({ success: true });

    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });


  // Admin endpoints
  // app.get("/api/admin/leaves", requireRole("HR", "SUPER_ADMIN"), async (req, res) => {
  //   try {
  //     const status = (req.query.status as string) || "PENDING";
  //     const page = parseInt(req.query.page as string) || 1;
  //     const limit = 10;
  //     const { records, total } = await storage.getAllLeaves(status, page, limit);
  //     res.json({ records, total, totalPages: Math.ceil(total / limit) });
  //   } catch (err: any) {
  //     res.status(500).json({ message: err.message });
  //   }
  // });

  app.get(
    "/api/leaves",
    requireRole("MANAGER", "HR", "SUPER_ADMIN"),
    async (req, res) => {
      try {
        const status = (req.query.status as string) || "PENDING";
        const page = parseInt(req.query.page as string) || 1;
        const limit = 10;

        const user = req.user!;
        const employee = await storage.getEmployeeByUserId(user.id);

        if (!employee) {
          return res.json({ records: [], total: 0, totalPages: 0 });
        }

        let result;

        if (user.role === "MANAGER") {
          // Manager → only their team
          result = await storage.getLeavesByManager(
            employee.id,
            status as "PENDING" | "APPROVED" | "REJECTED",
            page,
            limit
          );
        } else {
          // HR / SUPER_ADMIN → all leaves
          result = await storage.getAllLeaves(
            status,
            page,
            limit
          );
        }

        res.json({
          records: result.records,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        });

      } catch (err: any) {
        res.status(500).json({ message: err.message });
      }
    }
  );


  app.get("/api/admin/corrections", requireRole("HR", "MANAGER", "SUPER_ADMIN"), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 10;
      const { records, total } = await storage.getCorrections(page, limit);
      res.json({ records, total, totalPages: Math.ceil(total / limit) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/audit-logs", requireRole("HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const { records, total } = await storage.getAuditLogs(page, limit);
      res.json({ records, total, totalPages: Math.ceil(total / limit) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Payroll
  app.get("/api/admin/payroll", requireRole("HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const { records, total } = await storage.getPayrollRecords(page, limit);
      res.json({ records, total, totalPages: Math.ceil(total / limit) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/payroll/generate", requireRole("HR", "SUPER_ADMIN"), async (req, res) => {
    try {
      const { month, year, workingDays } = req.body;
      if (!month || !year || !workingDays) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { records: allEmployees } = await storage.getEmployees(1, 500);
      let generatedCount = 0;

      for (const emp of allEmployees) {
        const daysPresent = await storage.getDaysPresent(emp.id, month, year);
        const payable = (emp.monthlySalary / workingDays) * daysPresent;

        const payroll = await storage.createPayrollRecord({
          employeeId: emp.id,
          month,
          year,
          workingDays,
          daysPresent,
          monthlySalary: emp.monthlySalary,
          payableAmount: Math.round(payable * 100) / 100,
          generatedBy: req.user!.id,
        });

        await storage.createPayslip({
          payrollId: payroll.id,
          employeeId: emp.id,
          month,
          year,
        });

        generatedCount++;
      }

      await storage.createAuditLog({
        userId: req.user!.id,
        action: "GENERATE_PAYROLL",
        entity: "payroll",
        details: `Generated payroll for ${month}/${year}, ${generatedCount} employees`,
        ipAddress: getClientIp(req),
      });

      res.json({ success: true, count: generatedCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Payslips
  app.get("/api/payslips", requireAuth, async (req, res) => {
    try {
      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee) return res.json({ records: [], total: 0, totalPages: 0 });

      const page = parseInt(req.query.page as string) || 1;
      const limit = 10;
      const { records, total } = await storage.getEmployeePayslips(employee.id, page, limit);
      res.json({ records, total, totalPages: Math.ceil(total / limit) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/payslips/:id/download", requireAuth, async (req: Request<{ id: string }>, res: Response) => {
    try {
      const payslip = await storage.getPayslip(parseInt(req.params.id));
      if (!payslip) return res.status(404).json({ message: "Payslip not found" });

      const employee = await storage.getEmployeeByUserId(req.user!.id);
      if (!employee || (employee.id !== payslip.employeeId && req.user!.role !== "HR" && req.user!.role !== "SUPER_ADMIN")) {
        return res.status(403).json({ message: "Access denied" });
      }

      const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      const html = `<!DOCTYPE html>
<html><head><title>Payslip - ${payslip.firstName} ${payslip.lastName}</title>
<style>
body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
h1 { color: #333; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
.info { display: flex; justify-content: space-between; margin: 20px 0; }
.info div { flex: 1; }
table { width: 100%; border-collapse: collapse; margin: 20px 0; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
th { background: #f8f9fa; font-weight: 600; }
.total { font-size: 1.2em; font-weight: bold; color: #2563eb; }
.footer { margin-top: 40px; text-align: center; color: #666; font-size: 0.85em; }
</style></head><body>
<h1>Payslip</h1>
<div class="info">
<div><strong>Employee:</strong> ${payslip.firstName} ${payslip.lastName}<br>
<strong>Code:</strong> ${payslip.employeeCode}<br>
<strong>Department:</strong> ${payslip.department}<br>
<strong>Designation:</strong> ${payslip.designation}</div>
<div style="text-align:right"><strong>Period:</strong> ${monthNames[payslip.month]} ${payslip.year}<br>
<strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
</div>
<table>
<tr><th>Description</th><th style="text-align:right">Amount</th></tr>
<tr><td>Monthly Salary</td><td style="text-align:right">$${payslip.monthlySalary?.toLocaleString()}</td></tr>
<tr><td>Working Days</td><td style="text-align:right">${payslip.workingDays}</td></tr>
<tr><td>Days Present</td><td style="text-align:right">${payslip.daysPresent}</td></tr>
<tr><td class="total">Net Payable</td><td style="text-align:right" class="total">$${payslip.payableAmount?.toLocaleString()}</td></tr>
</table>
<div class="footer"><p>This is a system-generated payslip.</p></div>
</body></html>`;

      res.setHeader("Content-Type", "text/html");
      res.setHeader("Content-Disposition", `attachment; filename=payslip-${payslip.month}-${payslip.year}.html`);
      res.send(html);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Office settings
  app.get("/api/admin/office-settings", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const settings = await storage.getOfficeSettings();
      res.json(settings || { officeName: "Main Office", latitude: 0, longitude: 0, allowedRadiusMeters: 200 });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/office-settings", requireRole("SUPER_ADMIN"), async (req, res) => {
    try {
      const { officeName, latitude, longitude, allowedRadiusMeters } = req.body;
      const settings = await storage.upsertOfficeSettings({
        officeName,
        latitude,
        longitude,
        allowedRadiusMeters,
      });
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
