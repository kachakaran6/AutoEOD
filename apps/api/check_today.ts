import { prisma } from '@autoeod/db';
import { DateTime } from 'luxon';

async function main() {
  const events = await prisma.activityEvent.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(events, null, 2));
}
main().finally(() => prisma.$disconnect());
