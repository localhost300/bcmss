const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe("ALTER TABLE \"User\" ADD COLUMN IF NOT EXISTS \"passwordHash\" TEXT");
  console.log("Ensured passwordHash column");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
