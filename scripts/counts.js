const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const [schools, teachers, students] = await Promise.all([
    prisma.school.count(),
    prisma.teacher.count(),
    prisma.student.count(),
  ]);

  console.log(JSON.stringify({ schools, teachers, students }, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to fetch counts", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
