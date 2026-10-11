// Bikin assets/stats.svg (kartu GitHub Stats ala github-readme-stats, tema Tokyo Night).
// Dijalankan harian oleh nasaq-id/profile-stats (Actions akun pribadi terkunci billing).
// Dibuat sendiri karena instance publik github-readme-stats sering 503.
// Jalan: GH_TOKEN=... GH_USER=nohypelabs node .github/scripts/stats-card.mjs
import { writeFileSync } from "node:fs";

const login = process.env.GH_USER || "nohypelabs";
const token = process.env.GH_TOKEN;
if (!token) throw new Error("GH_TOKEN wajib diisi");

const query = `query($login: String!) {
  user(login: $login) {
    name
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
    contributionsCollection { totalCommitContributions restrictedContributionsCount totalPullRequestReviewContributions }
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) { nodes { stargazerCount } }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login } }),
});
const { data, errors } = await res.json();
if (errors) throw new Error(JSON.stringify(errors));
const u = data.user;
const cc = u.contributionsCollection;

const s = {
  stars: u.repositories.nodes.reduce((n, r) => n + r.stargazerCount, 0),
  commits: cc.totalCommitContributions + cc.restrictedContributionsCount,
  prs: u.pullRequests.totalCount,
  issues: u.issues.totalCount,
  reviews: cc.totalPullRequestReviewContributions,
  contributed: u.repositoriesContributedTo.totalCount,
  followers: u.followers.totalCount,
};

// Rumus rank sama dengan github-readme-stats (src/calculateRank.js).
const expCdf = (x) => 1 - 2 ** -x;
const logNormCdf = (x) => x / (1 + x);
const parts = [
  [2, expCdf(s.commits / 250)],
  [3, expCdf(s.prs / 50)],
  [1, expCdf(s.issues / 25)],
  [1, expCdf(s.reviews / 2)],
  [4, logNormCdf(s.stars / 50)],
  [1, logNormCdf(s.followers / 10)],
];
const total = parts.reduce((n, [w]) => n + w, 0);
const percentile = (1 - parts.reduce((n, [w, v]) => n + w * v, 0) / total) * 100;
const levels = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];
const cutoffs = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
const level = levels[cutoffs.findIndex((c) => percentile <= c)];

const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));
const rows = [
  ["Total Stars Earned", s.stars],
  ["Total Commits (last year)", s.commits],
  ["Total PRs", s.prs],
  ["Total Issues", s.issues],
  ["Contributed to (last year)", s.contributed],
];

const r = 40;
const circ = 2 * Math.PI * r;
const progress = Math.max(0, Math.min(100, 100 - percentile));
const title = `${u.name || login}'s GitHub Stats`;
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="467" height="195" viewBox="0 0 467 195" role="img" aria-label="${esc(title)}">
  <style>
    .t { font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: #70a5fd; }
    .l { font: 600 14px 'Segoe UI', Ubuntu, sans-serif; fill: #a9b1d6; }
    .v { font: 700 14px 'Segoe UI', Ubuntu, sans-serif; fill: #38bdae; }
    .g { font: 800 24px 'Segoe UI', Ubuntu, sans-serif; fill: #c0caf5; }
    .row { opacity: 0; animation: in .4s ease-out forwards; }
    .ring { stroke-dasharray: ${circ}; stroke-dashoffset: ${circ}; animation: fill 1s ease-out .2s forwards; }
    @keyframes in { to { opacity: 1; } }
    @keyframes fill { to { stroke-dashoffset: ${circ * (1 - progress / 100)}; } }
  </style>
  <rect x="0.5" y="0.5" width="466" height="194" rx="6" fill="#1a1b26" stroke="#414868"/>
  <text x="25" y="35" class="t">${esc(title)}</text>
  ${rows
    .map(
      ([label, val], i) => `<g class="row" transform="translate(25, ${70 + i * 25})" style="animation-delay:${150 + i * 120}ms">
    <circle cx="6" cy="-5" r="4" fill="#bb9af7"/>
    <text x="20" y="0" class="l">${label}:</text>
    <text x="215" y="0" class="v">${fmt(val)}</text>
  </g>`,
    )
    .join("\n  ")}
  <g transform="translate(385, 108)">
    <circle r="${r}" fill="none" stroke="#70a5fd" stroke-opacity=".2" stroke-width="6"/>
    <circle r="${r}" fill="none" stroke="#70a5fd" stroke-width="6" stroke-linecap="round" class="ring" transform="rotate(-90)"/>
    <text y="9" text-anchor="middle" class="g">${level}</text>
  </g>
</svg>
`;

writeFileSync(new URL("../../assets/stats.svg", import.meta.url), svg);
console.log({ ...s, percentile: percentile.toFixed(1), level });
