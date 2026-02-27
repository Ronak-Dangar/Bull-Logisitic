import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 10);

  // ─── Users ──────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { phone: "9000000001" },
    update: {},
    create: { name: "Admin User", phone: "9000000001", passwordHash: hash, role: "ADMIN" },
  });

  const lm = await prisma.user.upsert({
    where: { phone: "9000000002" },
    update: {},
    create: { name: "Ramesh Patel", phone: "9000000002", passwordHash: hash, role: "LM" },
  });

  const cm1 = await prisma.user.upsert({
    where: { phone: "9000000003" },
    update: {},
    create: { name: "Suresh Kumar", phone: "9000000003", passwordHash: hash, role: "CM" },
  });

  const cm2 = await prisma.user.upsert({
    where: { phone: "9000000004" },
    update: {},
    create: { name: "Vijay Singh", phone: "9000000004", passwordHash: hash, role: "CM" },
  });

  // ─── Centers ────────────────────────────────────────────
  const c1 = await prisma.center.upsert({
    where: { id: "center-1" },
    update: {},
    create: { id: "center-1", centerName: "Dhrangadhra Center", locationType: "CENTER", address: "Dhrangadhra, Gujarat" },
  });

  const c2 = await prisma.center.upsert({
    where: { id: "center-2" },
    update: {},
    create: { id: "center-2", centerName: "Patdi Village", locationType: "VILLAGE", address: "Patdi, Gujarat" },
  });

  const c3 = await prisma.center.upsert({
    where: { id: "center-3" },
    update: {},
    create: { id: "center-3", centerName: "Limbdi Center", locationType: "CENTER", address: "Limbdi, Gujarat" },
  });

  const c4 = await prisma.center.upsert({
    where: { id: "center-4" },
    update: {},
    create: { id: "center-4", centerName: "Wadhwan Village", locationType: "VILLAGE", address: "Wadhwan, Gujarat" },
  });

  const c5 = await prisma.center.upsert({
    where: { id: "center-5" },
    update: {},
    create: { id: "center-5", centerName: "Surendranagar Center", locationType: "CENTER", address: "Surendranagar, Gujarat" },
  });

  // ─── Factories ──────────────────────────────────────────
  const f1 = await prisma.factory.upsert({
    where: { id: "factory-1" },
    update: {},
    create: { id: "factory-1", factoryName: "Ambuja Oil Mill", location: "Ahmedabad, Gujarat" },
  });

  const f2 = await prisma.factory.upsert({
    where: { id: "factory-2" },
    update: {},
    create: { id: "factory-2", factoryName: "Gujarat Castor Industries", location: "Rajkot, Gujarat" },
  });

  const f3 = await prisma.factory.upsert({
    where: { id: "factory-3" },
    update: {},
    create: { id: "factory-3", factoryName: "Shree Ram Oil Exports", location: "Bhavnagar, Gujarat" },
  });

  // ─── User-Center Mappings ───────────────────────────────
  for (const [userId, centerId] of [
    [cm1.id, c1.id], [cm1.id, c2.id], [cm1.id, c3.id],
    [cm2.id, c4.id], [cm2.id, c5.id],
  ]) {
    await prisma.userCenterMapping.upsert({
      where: { userId_centerId: { userId, centerId } },
      update: {},
      create: { userId, centerId },
    });
  }

  console.log("✅ Seeded:");
  console.log("   Users:", admin.name, lm.name, cm1.name, cm2.name);
  console.log("   Centers:", c1.centerName, c2.centerName, c3.centerName, c4.centerName, c5.centerName);
  console.log("   Factories:", f1.factoryName, f2.factoryName, f3.factoryName);
  console.log("   All passwords: admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
