import { prisma } from '@autoeod/db';

async function main() {
  const settings = await prisma.userSettings.findFirst();
  console.log(JSON.stringify(settings, null, 2));
}
main().finally(() => prisma.$disconnect());
