import { getDecryptedGitHubToken } from '../apps/api/src/routes/integrations';
import { prisma } from '@autoeod/db';

async function main() {
  const userId = 'cmqpcaci30000au9o7zru50lx'; // From the logs
  const integration = await prisma.githubIntegration.findUnique({ where: { userId } });
  
  if (!integration) return console.log('no integration');
  const { decrypt } = await import('../apps/worker/src/lib/crypto');
  const token = decrypt(integration.accessTokenEnc);

  const res = await fetch(`https://api.github.com/users/${integration.githubUsername}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AutoEOD/1.0',
    }
  });

  const events = await res.json();
  const pushes = events.filter(e => e.type === 'PushEvent');
  console.log('Total events:', events.length);
  console.log('Total pushes:', pushes.length);
  if (pushes.length > 0) {
    console.log('Latest push payload:', JSON.stringify(pushes[0].payload, null, 2));
    console.log('Latest push created_at:', pushes[0].created_at);
  }
}

main().finally(() => prisma.$disconnect());
