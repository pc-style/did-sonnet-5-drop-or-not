const SONNET_5_PATTERNS = [
  /\bclaude[-_]?5[-_]?sonnet\b/i,
  /\bsonnet[-_]?5\b/i,
  /\bclaude[-_]?sonnet[-_]?5\b/i,
  /\bclaude[-_]?5\b/i,
];

const EXCLUDE_PATTERNS = [
  /\bclaude[-_]?3[-_.]?5[-_]?sonnet\b/i,
  /\bclaude[-_]?4[-_.]?5[-_]?sonnet\b/i,
  /\bsonnet[-_]?3[-_.]?5\b/i,
  /\bsonnet[-_]?4[-_.]?5\b/i,
  /\b3\.5[-_]?sonnet\b/i,
  /\b4\.5[-_]?sonnet\b/i,
  /\bclaude[-_]?3[-_.]?5\b/i,
];

export function isSonnet5(text: string): boolean {
  for (const exclude of EXCLUDE_PATTERNS) {
    if (exclude.test(text)) {
      return false;
    }
  }
  for (const pattern of SONNET_5_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

export interface CheckResult {
  found: boolean;
  model: string | null;
  source: string | null;
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
let lastEtag: string | null = null;
let lastApiResult: CheckResult = { found: false, model: null, source: null };

export async function checkAnthropicAPI(): Promise<CheckResult> {
  if (!ANTHROPIC_API_KEY) {
    return { found: false, model: null, source: null };
  }

  try {
    const headers: Record<string, string> = {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    };

    if (lastEtag) {
      headers["If-None-Match"] = lastEtag;
    }

    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers,
    });

    if (response.status === 304) {
      return lastApiResult;
    }

    const etag = response.headers.get("etag");
    if (etag) lastEtag = etag;

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: { id?: string; display_name?: string }[];
    };
    const models = data.data || [];

    for (const model of models) {
      const modelId = model.id || "";
      const displayName = model.display_name || "";

      if (isSonnet5(modelId) || isSonnet5(displayName)) {
        lastApiResult = {
          found: true,
          model: modelId,
          source: "https://api.anthropic.com/v1/models",
        };
        return lastApiResult;
      }
    }

    lastApiResult = { found: false, model: null, source: null };
    return lastApiResult;
  } catch (error) {
    console.error("Anthropic API error:", error);
    return { found: false, model: null, source: null };
  }
}

export async function checkAnthropicWebsite(): Promise<CheckResult> {
  const urls = [
    "https://www.anthropic.com/news",
    "https://www.anthropic.com/claude",
    "https://docs.anthropic.com/en/release-notes/overview",
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Sonnet5Checker/1.0)",
        },
      });

      if (!response.ok) continue;

      const html = await response.text();
      const lines = html.split(/[<>]/);

      for (const line of lines) {
        const cleaned = line.replace(/&[^;]+;/g, " ").trim();
        if (cleaned.length < 200 && isSonnet5(cleaned)) {
          return { found: true, model: null, source: url };
        }
      }
    } catch (error) {
      console.error(`Website scrape error (${url}):`, error);
    }
  }

  return { found: false, model: null, source: null };
}

export async function checkHackerNews(): Promise<CheckResult> {
  try {
    const response = await fetch(
      "https://hn.algolia.com/api/v1/search_by_date?query=anthropic%20claude&tags=story&hitsPerPage=20"
    );

    if (!response.ok) {
      throw new Error(`HN API responded with ${response.status}`);
    }

    const data = (await response.json()) as {
      hits?: { title?: string; url?: string; objectID?: string }[];
    };

    for (const hit of data.hits || []) {
      const title = hit.title || "";
      if (isSonnet5(title)) {
        return {
          found: true,
          model: null,
          source: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        };
      }
    }

    return { found: false, model: null, source: null };
  } catch (error) {
    console.error("Hacker News error:", error);
    return { found: false, model: null, source: null };
  }
}

export async function checkGitHubSDK(): Promise<CheckResult> {
  const repos = [
    "anthropics/anthropic-sdk-python",
    "anthropics/anthropic-sdk-typescript",
  ];

  for (const repo of repos) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repo}/releases?per_page=5`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Sonnet5Checker/1.0",
          },
        }
      );

      if (!response.ok) continue;

      const releases = (await response.json()) as {
        tag_name?: string;
        name?: string;
        body?: string;
        html_url?: string;
      }[];

      for (const release of releases) {
        const text = `${release.tag_name} ${release.name} ${release.body}`;
        if (isSonnet5(text)) {
          return {
            found: true,
            model: null,
            source: release.html_url || `https://github.com/${repo}/releases`,
          };
        }
      }

      const commitsResponse = await fetch(
        `https://api.github.com/repos/${repo}/commits?per_page=10`,
        {
          headers: {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Sonnet5Checker/1.0",
          },
        }
      );

      if (commitsResponse.ok) {
        const commits = (await commitsResponse.json()) as {
          commit?: { message?: string };
          html_url?: string;
        }[];

        for (const commit of commits) {
          const message = commit.commit?.message || "";
          if (isSonnet5(message)) {
            return {
              found: true,
              model: null,
              source: commit.html_url || `https://github.com/${repo}`,
            };
          }
        }
      }
    } catch (error) {
      console.error(`GitHub SDK error (${repo}):`, error);
    }
  }

  return { found: false, model: null, source: null };
}

export async function checkAllSources(): Promise<CheckResult> {
  console.log(`[${new Date().toISOString()}] Checking all sources...`);

  const results = await Promise.all([
    checkAnthropicAPI(),
    checkAnthropicWebsite(),
    checkHackerNews(),
    checkGitHubSDK(),
  ]);

  const sourceNames = ["Anthropic API", "Anthropic Website", "Hacker News", "GitHub SDK"];

  for (let i = 0; i < results.length; i++) {
    if (results[i].found) {
      console.log(`[FOUND] ${sourceNames[i]}: ${results[i].source}`);
      return results[i];
    }
  }

  console.log(`[${new Date().toISOString()}] No Sonnet 5 found in any source`);
  return { found: false, model: null, source: null };
}
