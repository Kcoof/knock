/** GitHub context for a builder's room (spec §14) — public repos only. */

export interface RepoSnapshot {
  repo: string;
  latestCommitMessage: string | null;
  latestCommitTime: string | null;
}

/**
 * Fetches the latest commit of a public repository. No token needed;
 * GitHub's anonymous rate limit (60/h per IP) is plenty for this.
 */
export async function fetchRepoSnapshot(
  username: string,
  repo: string,
): Promise<RepoSnapshot | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/commits?per_page=1`,
      { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" },
    );
    if (!res.ok) return null;
    const commits = (await res.json()) as Array<{
      commit: { message: string; author: { date: string } };
    }>;
    const latest = commits?.[0];
    return {
      repo,
      latestCommitMessage: latest?.commit?.message?.split("\n")[0] ?? null,
      latestCommitTime: latest?.commit?.author?.date
        ? new Date(latest.commit.author.date).toLocaleString()
        : null,
    };
  } catch {
    return null;
  }
}
