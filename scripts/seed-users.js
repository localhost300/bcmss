require("dotenv").config({ path: ".env" });

const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function hashPassword(plain) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(plain, salt, 64);
  return salt.toString("hex") + ":" + derived.toString("hex");
}

const users = [
  { email: "admin@example.com", firstName: "Ada", lastName: "Admin", role: "admin" },
  { email: "teacher@example.com", firstName: "Tola", lastName: "Teacher", role: "teacher" },
  { email: "student@example.com", firstName: "Seyi", lastName: "Student", role: "student" },
  { email: "parent@example.com", firstName: "Pere", lastName: "Parent", role: "parent" },
];

const password = (process.env.SEED_USER_PASSWORD || "password123").trim();

async function main() {
  const results = [];
  for (const seed of users) {
    const passwordHash = hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: seed.role,
        passwordHash,
      },
      create: {
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: seed.role,
        passwordHash,
      },
    });
    results.push({ email: user.email, role: seed.role });
  }
  console.log("Seeded " + results.length + " users with password \"" + password + "\".");
  console.table(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
