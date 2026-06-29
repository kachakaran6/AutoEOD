import { PrismaClient } from '@autoeod/db';

const prisma = new PrismaClient();

async function main() {
  const reports = await prisma.report.findMany({
    where: { status: 'failed' },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log("Failed Reports:", JSON.stringify(reports, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
