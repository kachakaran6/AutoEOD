// apps/worker/src/jobs/github-sync.ts
// Fetches GitHub activity for a user and upserts ActivityEvent rows.
// Supports personal events, organization-scoped events, repo events, and branch commits.

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
  url?: string;
  author?: { name?: string; email?: string };
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  action: string;
}

interface UpsertableEvent {
  userId: string;
  source: string;
  type: string;
  externalId: string;
  repo: string;
  title: string;
  url: string;
  occurredAt: Date;
  rawPayload: object;
}

interface GitHubRepo {
  full_name: string;
  pushed_at: string;
  default_branch: string;
}

interface GitHubOrg {
  login: string;
}

interface GitHubBranch {
  name: string;
  commit: { sha: string };
}

interface GitHubApiCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author?: { name: string; email: string; date: string };
    committer?: { name: string; email: string; date: string };
  };
  author?: { login: string };
}

export interface SyncGitHubOptions {
  resetCursor?: boolean;
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

function checkRateLimit(res: Response, userId: string): boolean {
  const remaining = res.headers.get('X-RateLimit-Remaining');
  if (remaining && parseInt(remaining, 10) < 15) {
    const reset = res.headers.get('X-RateLimit-Reset');
    logger.warn({ userId, remaining, reset }, 'GitHub rate limit approaching threshold, pausing further requests');
    return false;
  }
  return true;
}

/**
 * Process a list of GitHub Events into normalized UpsertableEvents.
 */
async function processEventsList(
  events: GitHubEvent[],
  userId: string,
  username: string,
  token: string,
  cutoffDate: Date,
  eventsMap: Map<string, UpsertableEvent>,
  updateCursor: (dateStr: string) => void
): Promise<void> {
  for (const event of events) {
    const occurredAt = new Date(event.created_at);

    // Filter by cutoff window
    if (occurredAt < cutoffDate) continue;

    // Track newest event timestamp for cursor
    updateCursor(event.created_at);

    const repoName = event.repo.name;

    switch (event.type) {
      case 'PushEvent': {
        const commits = (event.payload.commits as GitHubCommit[]) || [];
        if (commits.length > 0) {
          // One ActivityEvent per commit in the push
          for (const commit of commits) {
            eventsMap.set(commit.sha, {
              userId,
              source: 'github',
              type: 'commit',
              externalId: commit.sha,
              repo: repoName,
              title: commit.message.split('\n')[0].slice(0, 500),
              url: `https://github.com/${repoName}/commit/${commit.sha}`,
              occurredAt,
              rawPayload: { event: event.type, commit, eventId: event.id, ref: event.payload.ref },
            });
          }
        } else {
          // Fallback: single push event or fetch head commit
          const ref = (event.payload.ref as string) || '';
          const branchName = ref.replace('refs/heads/', '');
          const head = event.payload.head as string;

          let commitMessage = branchName ? `Pushed to ${branchName}` : 'Pushed to repository';
          let commitUrl = head ? `https://github.com/${repoName}/commit/${head}` : `https://github.com/${repoName}`;

          if (head) {
            try {
              const commitRes = await githubFetch(`${GITHUB_API}/repos/${repoName}/commits/${head}`, token);
              if (commitRes.ok) {
                const commitData = (await commitRes.json()) as any;
                if (commitData.commit?.message) {
                  commitMessage = commitData.commit.message.split('\n')[0].slice(0, 500);
                  if (commitData.html_url) commitUrl = commitData.html_url;
                }
              }
            } catch {
              // ignore error and use fallback
            }
          }

          const externalId = head || event.id;
          eventsMap.set(externalId, {
            userId,
            source: 'github',
            type: 'commit',
            externalId,
            repo: repoName,
            title: commitMessage,
            url: commitUrl,
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

        const externalId = `pr-${pr.id}-${action}`;
        eventsMap.set(externalId, {
          userId,
          source: 'github',
          type: 'pull_request',
          externalId,
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

        const externalId = `review-${review.id}`;
        eventsMap.set(externalId, {
          userId,
          source: 'github',
          type: 'pr_review',
          externalId,
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

        const externalId = `issue-${issue.id}-${action}`;
        eventsMap.set(externalId, {
          userId,
          source: 'github',
          type: 'issue',
          externalId,
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

        const externalId = `comment-${comment.id}`;
        eventsMap.set(externalId, {
          userId,
          source: 'github',
          type: 'issue_comment',
          externalId,
          repo: repoName,
          title: `Commented on: ${issue.title}`,
          url: comment.html_url,
          occurredAt,
          rawPayload: { event: event.type, issue: { id: issue.id, title: issue.title }, commentId: comment.id },
        });
        break;
      }

      default:
        break;
    }
  }
}

export async function syncGitHubActivity(userId: string, options?: SyncGitHubOptions): Promise<void> {
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
  const isReset = options?.resetCursor === true;

  // Window calculation: if resetCursor is true or no cursor exists, scan last 14 days.
  // Otherwise, use the cursor timestamp (guaranteed not older than 14 days).
  const maxHistoryDays = 14;
  const maxHistoryDate = new Date(Date.now() - maxHistoryDays * 24 * 60 * 60 * 1000);
  let cutoffDate = maxHistoryDate;

  if (since && !isReset) {
    const parsedCursor = new Date(since);
    if (!isNaN(parsedCursor.getTime()) && parsedCursor > maxHistoryDate) {
      cutoffDate = parsedCursor;
    }
  }

  logger.info({ userId, username, cutoffDate: cutoffDate.toISOString(), isReset }, 'Starting multi-source GitHub sync');

  const eventsMap = new Map<string, UpsertableEvent>();
  let newestCursorDate: Date = cutoffDate;

  const updateCursor = (dateStr: string) => {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime()) && d > newestCursorDate) {
      newestCursorDate = d;
    }
  };

  try {
    // ── 1. Fetch User Personal Events ──────────────────────────────────────────
    try {
      for (let page = 1; page <= 2; page++) {
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

        if (!checkRateLimit(res, userId)) break;
        if (!res.ok) {
          logger.warn({ userId, status: res.status }, 'GitHub personal events endpoint non-OK response');
          break;
        }

        const events = (await res.json()) as GitHubEvent[];
        if (!events || !Array.isArray(events) || events.length === 0) break;

        await processEventsList(events, userId, username, token, cutoffDate, eventsMap, updateCursor);
        if (events.length < 100) break;
      }
    } catch (err) {
      logger.error({ err, userId }, 'Error fetching personal GitHub events');
    }

    // ── 2. Fetch Organization Events ───────────────────────────────────────────
    // GitHub excludes private org repositories from /users/{username}/events.
    // They must be fetched from /users/{username}/events/orgs/{org}.
    try {
      const orgsRes = await githubFetch(`${GITHUB_API}/user/orgs?per_page=50`, token);
      if (orgsRes.ok) {
        const orgs = (await orgsRes.json()) as GitHubOrg[];
        if (Array.isArray(orgs)) {
          for (const org of orgs) {
            try {
              const orgEventsUrl = `${GITHUB_API}/users/${username}/events/orgs/${org.login}?per_page=100`;
              const orgEventsRes = await githubFetch(orgEventsUrl, token);

              if (!checkRateLimit(orgEventsRes, userId)) break;
              if (orgEventsRes.ok) {
                const orgEvents = (await orgEventsRes.json()) as GitHubEvent[];
                if (Array.isArray(orgEvents) && orgEvents.length > 0) {
                  await processEventsList(orgEvents, userId, username, token, cutoffDate, eventsMap, updateCursor);
                }
              } else {
                logger.info({ userId, org: org.login, status: orgEventsRes.status }, 'Org events endpoint response');
              }
            } catch (orgErr) {
              logger.warn({ orgErr, org: org.login }, 'Failed to fetch events for org');
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, 'Error discovering user organizations');
    }

    // ── 3. Fetch Active Repositories & Branch Commits ──────────────────────────
    // Captures commits on feature branches (e.g. karan/1) or org repos where the user
    // is an outside collaborator or where GitHub event stream has delayed indexing.
    try {
      const reposRes = await githubFetch(
        `${GITHUB_API}/user/repos?sort=pushed&affiliation=owner,collaborator,organization_member&per_page=30`,
        token
      );

      if (reposRes.ok) {
        const repos = (await reposRes.json()) as GitHubRepo[];
        if (Array.isArray(repos)) {
          const activeRepos = repos.filter((r) => r.pushed_at && new Date(r.pushed_at) >= cutoffDate);

          // Check top active repos (limit to 10 to protect rate limit)
          for (const repo of activeRepos.slice(0, 10)) {
            // 3a. Repo Events
            try {
              const repoEventsRes = await githubFetch(
                `${GITHUB_API}/repos/${repo.full_name}/events?per_page=30`,
                token
              );
              if (checkRateLimit(repoEventsRes, userId) && repoEventsRes.ok) {
                const repoEvents = (await repoEventsRes.json()) as GitHubEvent[];
                if (Array.isArray(repoEvents)) {
                  // Only process events triggered by this user
                  const userRepoEvents = repoEvents.filter(
                    (e) => e.actor?.login?.toLowerCase() === username.toLowerCase()
                  );
                  await processEventsList(userRepoEvents, userId, username, token, cutoffDate, eventsMap, updateCursor);
                }
              }
            } catch (repoEventErr) {
              logger.debug({ repoEventErr, repo: repo.full_name }, 'Repo events fetch skipped');
            }

            // 3b. Branch Commits Discovery
            // Look for branches matching user's identity or recently pushed branches
            try {
              const branchesRes = await githubFetch(
                `${GITHUB_API}/repos/${repo.full_name}/branches?per_page=20`,
                token
              );
              if (branchesRes.ok) {
                const branches = (await branchesRes.json()) as GitHubBranch[];
                if (Array.isArray(branches)) {
                  const normalizedUserShort = username.split('-')[0].toLowerCase();
                  // Check default branch + branches matching user identifier (like karan/1)
                  const relevantBranches = branches.filter((b) => {
                    const bName = b.name.toLowerCase();
                    return (
                      b.name === repo.default_branch ||
                      bName.includes(username.toLowerCase()) ||
                      bName.includes(normalizedUserShort)
                    );
                  });

                  for (const branch of relevantBranches.slice(0, 5)) {
                    const commitsUrl = `${GITHUB_API}/repos/${repo.full_name}/commits?sha=${encodeURIComponent(
                      branch.name
                    )}&author=${encodeURIComponent(username)}&since=${cutoffDate.toISOString()}&per_page=30`;

                    const commitsRes = await githubFetch(commitsUrl, token);
                    if (checkRateLimit(commitsRes, userId) && commitsRes.ok) {
                      const branchCommits = (await commitsRes.json()) as GitHubApiCommit[];
                      if (Array.isArray(branchCommits)) {
                        for (const c of branchCommits) {
                          if (!c.sha || !c.commit) continue;
                          const commitDate = new Date(
                            c.commit.author?.date || c.commit.committer?.date || Date.now()
                          );
                          updateCursor(commitDate.toISOString());

                          eventsMap.set(c.sha, {
                            userId,
                            source: 'github',
                            type: 'commit',
                            externalId: c.sha,
                            repo: repo.full_name,
                            title: (c.commit.message || 'Commit').split('\n')[0].slice(0, 500),
                            url: c.html_url || `https://github.com/${repo.full_name}/commit/${c.sha}`,
                            occurredAt: commitDate,
                            rawPayload: { commit: c, branch: branch.name },
                          });
                        }
                      }
                    }
                  }
                }
              }
            } catch (branchErr) {
              logger.debug({ branchErr, repo: repo.full_name }, 'Branch commits fetch skipped');
            }
          }
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, 'Error querying user repositories for active commits');
    }

    // ── 4. Upsert Normalized Events into Database ─────────────────────────────
    const allEvents = Array.from(eventsMap.values());
    let upsertedCount = 0;

    for (const evt of allEvents) {
      try {
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
        upsertedCount++;
      } catch (upsertErr) {
        logger.error({ upsertErr, externalId: evt.externalId }, 'Failed to upsert activity event');
      }
    }

    // ── 5. Update Sync Cursor and LastSyncedAt ─────────────────────────────────
    await prisma.githubIntegration.update({
      where: { userId },
      data: {
        lastSyncedAt: new Date(),
        lastSyncCursor: newestCursorDate.toISOString(),
      },
    });

    logger.info(
      { userId, username, totalEventsFound: allEvents.length, upsertedCount, newestCursor: newestCursorDate.toISOString() },
      'Multi-source GitHub sync complete'
    );
  } catch (err) {
    logger.error({ err, userId }, 'GitHub sync failed unexpectedly');
    throw err;
  }
}
