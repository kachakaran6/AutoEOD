import { prisma } from '@autoeod/db';

async function main() {
  const events = await prisma.activityEvent.findMany({
    orderBy: { occurredAt: 'desc' },
    select: { title: true, occurredAt: true, type: true }
  });
  console.log(JSON.stringify(events, null, 2));
}

main().finally(() => prisma.$disconnect());
