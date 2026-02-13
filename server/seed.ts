import { storage } from "./storage";
import { hashPassword } from "./auth";
import { db } from "./db";
import { users, employees, officeSettings } from "@shared/schema";
import { count } from "drizzle-orm";

export async function seedDatabase() {
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (userCount > 0) return;

  console.log("Seeding database...");

  const adminPassword = await hashPassword("admin123");
  const hrPassword = await hashPassword("hr12345");
  const managerPassword = await hashPassword("manager1");
  const empPassword = await hashPassword("employee1");

  const admin = await storage.createUser({
    username: "admin",
    password: adminPassword,
    role: "SUPER_ADMIN",
    isActive: true,
  });

  const hrUser = await storage.createUser({
    username: "sarah.hr",
    password: hrPassword,
    role: "HR",
    isActive: true,
  });

  const managerUser = await storage.createUser({
    username: "john.manager",
    password: managerPassword,
    role: "MANAGER",
    isActive: true,
  });

  const empUser = await storage.createUser({
    username: "alice.dev",
    password: empPassword,
    role: "EMPLOYEE",
    isActive: true,
  });

  const adminEmp = await storage.createEmployee({
    firstName: "System",
    lastName: "Admin",
    email: "admin@company.com",
    phone: "+1234567890",
    department: "Administration",
    designation: "System Administrator",
    monthlySalary: 15000,
    dateOfJoining: "2024-01-01",
  });
  await storage.linkEmployeeToUser(adminEmp.id, admin.id);

  const hrEmp = await storage.createEmployee({
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah@company.com",
    phone: "+1234567891",
    department: "Human Resources",
    designation: "HR Manager",
    monthlySalary: 8000,
    dateOfJoining: "2024-02-15",
  });
  await storage.linkEmployeeToUser(hrEmp.id, hrUser.id);

  const managerEmp = await storage.createEmployee({
    firstName: "John",
    lastName: "Smith",
    email: "john@company.com",
    phone: "+1234567892",
    department: "Engineering",
    designation: "Engineering Manager",
    monthlySalary: 12000,
    dateOfJoining: "2024-03-01",
  });
  await storage.linkEmployeeToUser(managerEmp.id, managerUser.id);

  const aliceEmp = await storage.createEmployee({
    firstName: "Alice",
    lastName: "Williams",
    email: "alice@company.com",
    phone: "+1234567893",
    department: "Engineering",
    designation: "Software Developer",
    managerId: managerEmp.id,
    monthlySalary: 7000,
    dateOfJoining: "2024-04-10",
  });
  await storage.linkEmployeeToUser(aliceEmp.id, empUser.id);

  await storage.createEmployee({
    firstName: "Bob",
    lastName: "Davis",
    email: "bob@company.com",
    phone: "+1234567894",
    department: "Engineering",
    designation: "Frontend Developer",
    managerId: managerEmp.id,
    monthlySalary: 6500,
    dateOfJoining: "2024-05-01",
  });

  await storage.createEmployee({
    firstName: "Carol",
    lastName: "Martinez",
    email: "carol@company.com",
    phone: "+1234567895",
    department: "Marketing",
    designation: "Marketing Specialist",
    monthlySalary: 5500,
    dateOfJoining: "2024-06-15",
  });

  await storage.upsertOfficeSettings({
    officeName: "Main Office",
    latitude: 40.7128,
    longitude: -74.006,
    allowedRadiusMeters: 500,
  });

  console.log("Database seeded successfully!");
  console.log("Login credentials:");
  console.log("  Admin: admin / admin123");
  console.log("  HR: sarah.hr / hr12345");
  console.log("  Manager: john.manager / manager1");
  console.log("  Employee: alice.dev / employee1");
}
