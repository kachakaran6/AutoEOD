import { prisma } from '@autoeod/db';

async function main() {
  await prisma.userSettings.updateMany({
    data: { workEndTime: '20:00' }
  });
  console.log("Updated workEndTime to 20:00");
}
main().finally(() => prisma.$disconnect());
