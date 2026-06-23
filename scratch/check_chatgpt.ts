import { PrismaClient } from '@autoeod/db';

const prisma = new PrismaClient();

async function check() {
  const tokens = await prisma.extensionToken.findMany();
  console.log('Extension Tokens:', tokens.length);
  
  const events = await prisma.activityEvent.findMany({
    where: { source: 'chatgpt' }
  });
  console.log('ChatGPT Events:', events.length);
}

check().catch(console.error).finally(() => prisma.$disconnect());
