// apps/worker/src/jobs/github-sync.ts
// Fetches GitHub activity for a user and upserts ActivityEvent rows

import { prisma } from '@autoeod/db';
import { decrypt } from '../lib/crypto';
import { logger } from '../lib/logger';

const GITHUB_API = 'https://api.github.com';

interface GitHubEvent {
  id: string;
  type: string;
  actor: { login: string };
  repo: { name: string; url: string };
  payload: Record<string, unknown>;
  created_at: string;
}

interface GitHubCommit {
  sha: string;
  message: string;
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  action: string;
}

async function githubFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'AutoEOD/1.0',
    },
  });
}

export async function syncGitHubActivity(userId: string): Promise<void> {
  const integration = await prisma.githubIntegration.findUnique({ where: { userId } });
  if (!integration) {
    logger.warn({ userId }, 'No GitHub integration found, skipping sync');
    return;
  }

  if (integration.needsReconnect) {
    logger.warn({ userId }, 'GitHub integration needs reconnect, skipping sync');
    return;
  }

  let token: string;
  try {
    token = decrypt(integration.accessTokenEnc);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to decrypt GitHub token');
    return;
  }

  const username = integration.githubUsername;
  const since = integration.lastSyncCursor;

  logger.info({ userId, username, since }, 'Starting GitHub sync');

  try {
    // Fetch user events — paginate up to 3 pages (300 events max per sync)
    let page = 1;
    let newCursor: string | null = null;
    let totalProcessed = 0;

    while (page <= 3) {
      const url = `${GITHUB_API}/users/${username}/events?per_page=100&page=${page}`;
      const res = await githubFetch(url, token);

      if (res.status === 401) {
        logger.error({ userId }, 'GitHub token revoked, marking integration as needs reconnect');
        await prisma.githubIntegration.update({
          where: { userId },
          data: { needsReconnect: true },
        });
        return;
      }

      if (res.status === 403) {
        const remaining = res.headers.get('X-RateLimit-Remaining');
        const reset = res.headers.get('X-RateLimit-Reset');
        logger.warn({ userId, remaining, reset }, 'GitHub rate limit hit');
        break;
      }

      if (!res.ok) {
        logger.error({ userId, status: res.status }, 'GitHub events API error');
        break;
      }

      const events = (await res.json()) as GitHubEvent[];
      if (!events || events.length === 0) break;

      // Process events
      const eventsToUpsert: Array<{
        userId: string;
        source: string;
        type: string;
        externalId: string;
        repo: string;
        title: string;
        url: string;
        occurredAt: Date;
        rawPayload: object;
      }> = [];

      for (const event of events) {
        const occurredAt = new Date(event.created_at);

        // Skip events older than the last sync cursor
        if (since && occurredAt <= new Date(since)) continue;

        // Track newest event timestamp for cursor
        if (!newCursor || occurredAt > new Date(newCursor)) {
          newCursor = event.created_at;
        }

        const repoName = event.repo.name;

        switch (event.type) {
          case 'PushEvent': {
            const commits = (event.payload.commits as GitHubCommit[]) || [];
            if (commits.length > 0) {
              // One ActivityEvent per commit in the push
              for (const commit of commits) {
                eventsToUpsert.push({
                  userId,
                  source: 'github',
                  type: 'commit',
                  externalId: commit.sha,
                  repo: repoName,
                  title: commit.message.split('\n')[0].slice(0, 500), // first line, truncated
                  url: `https://github.com/${repoName}/commit/${commit.sha}`,
                  occurredAt,
                  rawPayload: { event: event.type, commit, eventId: event.id },
                });
              }
            } else {
              // Fallback: create a generic push event if commits array is empty/stripped
              const ref = (event.payload.ref as string) || '';
              const branchName = ref.replace('refs/heads/', '');
              const head = event.payload.head as string;
              
              let commitMessage = branchName ? `Pushed to ${branchName}` : 'Pushed to repository';
              
              if (head) {
                try {
                  const commitRes = await githubFetch(`${GITHUB_API}/repos/${repoName}/commits/${head}`, token);
                  if (commitRes.ok) {
                    const commitData = await commitRes.json() as any;
                    if (commitData.commit?.message) {
                      commitMessage = commitData.commit.message.split('\n')[0].slice(0, 500);
                    }
                  }
                } catch (e) {
                  // ignore error and use fallback
                }
              }
              
              eventsToUpsert.push({
                userId,
                source: 'github',
                type: 'commit',
                externalId: event.id,
                repo: repoName,
                title: commitMessage,
                url: head ? `https://github.com/${repoName}/commit/${head}` : `https://github.com/${repoName}`,
                occurredAt,
                rawPayload: { event: event.type, payload: event.payload, eventId: event.id },
              });
            }
            break;
          }

          case 'PullRequestEvent': {
            const pr = event.payload.pull_request as GitHubPR;
            if (!pr) break;
            const action = event.payload.action as string;
            if (!['opened', 'closed', 'reopened', 'merged'].includes(action)) break;

            eventsToUpsert.push({
              userId,
              source: 'github',
              type: 'pull_request',
              externalId: `pr-${pr.id}-${action}`,
              repo: repoName,
              title: `[${action.toUpperCase()}] ${pr.title || `PR #${pr.number}`}`,
              url: pr.html_url || `https://github.com/${repoName}/pull/${pr.number}`,
              occurredAt,
              rawPayload: { event: event.type, action, pr: { id: pr.id, number: pr.number, title: pr.title || '' } },
            });
            break;
          }

          case 'PullRequestReviewEvent': {
            const pr = event.payload.pull_request as GitHubPR;
            const review = event.payload.review as { id: number; state: string; html_url: string };
            if (!pr || !review) break;

            eventsToUpsert.push({
              userId,
              source: 'github',
              type: 'pr_review',
              externalId: `review-${review.id}`,
              repo: repoName,
              title: `Reviewed PR: ${pr.title} (${review.state})`,
              url: review.html_url || pr.html_url,
              occurredAt,
              rawPayload: { event: event.type, review: { id: review.id, state: review.state }, pr: { title: pr.title } },
            });
            break;
          }

          case 'IssuesEvent': {
            const issue = event.payload.issue as {
              id: number;
              number: number;
              title: string;
              html_url: string;
            };
            const action = event.payload.action as string;
            if (!issue || !['opened', 'closed', 'reopened'].includes(action)) break;

            eventsToUpsert.push({
              userId,
              source: 'github',
              type: 'issue',
              externalId: `issue-${issue.id}-${action}`,
              repo: repoName,
              title: `[${action.toUpperCase()}] Issue: ${issue.title}`,
              url: issue.html_url,
              occurredAt,
              rawPayload: { event: event.type, action, issue: { id: issue.id, number: issue.number, title: issue.title } },
            });
            break;
          }

          case 'IssueCommentEvent': {
            const issue = event.payload.issue as { id: number; title: string; html_url: string };
            const comment = event.payload.comment as { id: number; html_url: string };
            if (!issue || !comment) break;

            eventsToUpsert.push({
              userId,
              source: 'github',
              type: 'issue_comment',
              externalId: `comment-${comment.id}`,
              repo: repoName,
              title: `Commented on: ${issue.title}`,
              url: comment.html_url,
              occurredAt,
              rawPayload: { event: event.type, issue: { id: issue.id, title: issue.title }, commentId: comment.id },
            });
            break;
          }

          default:
            // Skip other event types (WatchEvent, ForkEvent, etc.)
            break;
        }
      }

      // Upsert all events for this page
      if (eventsToUpsert.length > 0) {
        for (const evt of eventsToUpsert) {
          await prisma.activityEvent.upsert({
            where: {
              userId_source_externalId: {
                userId: evt.userId,
                source: evt.source,
                externalId: evt.externalId,
              },
            },
            create: evt,
            update: {
              title: evt.title,
              url: evt.url,
              rawPayload: evt.rawPayload,
            },
          });
        }
        totalProcessed += eventsToUpsert.length;
      }

      // If we got fewer events than a full page, we've exhausted the feed
      if (events.length < 100) break;
      page++;
    }

    // Update sync cursor and lastSyncedAt
    await prisma.githubIntegration.update({
      where: { userId },
      data: {
        lastSyncedAt: new Date(),
        ...(newCursor ? { lastSyncCursor: newCursor } : {}),
      },
    });

    logger.info({ userId, username, totalProcessed }, 'GitHub sync complete');
  } catch (err) {
    logger.error({ err, userId }, 'GitHub sync failed');
    throw err; // Let BullMQ handle retry
  }
}
