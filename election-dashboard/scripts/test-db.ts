import { PrismaClient } from "@prisma/client";

async function main() {
  console.log("Connecting to database...");
  const prisma = new PrismaClient();
  try {
    const res = await prisma.$queryRaw`SELECT 1 as result`;
    console.log("Database connected successfully:", res);
  } catch (err) {
    console.error("Database connection failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
