import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const PostgresSessionStore = connectPg(session);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({ pool, createTableIfMissing: true }),
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || undefined);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.login(user, async (err) => {
        if (err) return next(err);
        const employee = await storage.getEmployeeByUserId(user.id);
        const { password: _, ...safeUser } = user;
        res.json({ ...safeUser, employee });
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { token, username, password } = req.body;
      if (!token || !username || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const invite = await storage.getInviteByToken(token);
      if (!invite) {
        return res.status(400).json({ message: "Invalid invite token" });
      }
      if (invite.used) {
        return res.status(400).json({ message: "Invite token already used" });
      }
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Invite token has expired" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const employee = await storage.getEmployee(invite.employeeId);
      if (!employee) {
        return res.status(400).json({ message: "Employee record not found" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        role: "EMPLOYEE",
        isActive: true,
      });

      await storage.linkEmployeeToUser(employee.id, user.id);
      await storage.markInviteUsed(invite.id);

      req.login(user, async (err) => {
        if (err) return next(err);
        const emp = await storage.getEmployeeByUserId(user.id);
        const { password: _, ...safeUser } = user;
        res.status(201).json({ ...safeUser, employee: emp });
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const employee = await storage.getEmployeeByUserId(req.user!.id);
    const { password: _, ...safeUser } = req.user as any;
    res.json({ ...safeUser, employee });
  });
}
