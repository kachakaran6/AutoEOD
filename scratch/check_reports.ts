import { prisma } from './apps/api/node_modules/@autoeod/db';

async function main() {
  const reports = await prisma.report.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(reports[0], null, 2));
}
main().finally(() => prisma.$disconnect());
