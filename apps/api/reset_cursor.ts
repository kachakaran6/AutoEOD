import { prisma } from '@autoeod/db';

async function main() {
  await prisma.githubIntegration.updateMany({
    data: { lastSyncCursor: null }
  });
  console.log("Cursor reset to null");
}
main().finally(() => prisma.$disconnect());
