"use strict";
/* Ghi chú từ link GitHub: lấy thông tin công khai qua GitHub REST API (không cần đăng nhập; giới hạn 60 lần/giờ/IP)
   rồi soạn ghi chú Markdown gồm Thông tin, Tóm tắt (từ mô tả + README) và Review theo quy tắc cố định
   (phổ biến, độ hoạt động, giấy phép, tài liệu, phát hành). Không dùng AI. Repo riêng tư không đọc được. */
const GH = (() => {
  const MINE = "## My notes";

  /** github.com/owner/repo[...] → {owner, repo}; null nếu không phải link repo. */
  function parse(url) {
    const m = String(url || "").trim().match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
    return m && !["orgs", "users", "topics", "search", "settings", "marketplace"].includes(m[1].toLowerCase()) ? { owner: m[1], repo: m[2] } : null;
  }

  async function get(path, raw) {
    const r = await fetch("https://api.github.com" + path, { headers: { Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" } });
    if (r.status === 404) return null;
    if (r.status === 403 || r.status === 429) throw new Error("GitHub rate limit reached (60 requests/hour without signing in to GitHub). Try again in a few minutes.");
    if (!r.ok) throw new Error(`GitHub returned error ${r.status}`);
    return raw ? r.text() : r.json();
  }

  async function fetchRepo(owner, repo) {
    const info = await get(`/repos/${owner}/${repo}`);
    if (!info) throw new Error("Repo not found (wrong link, or the repo is private).");
    const base = `/repos/${info.full_name}`;
    const [readme, langs, release] = await Promise.all([
      get(`${base}/readme`, true).catch(() => null),
      get(`${base}/languages`).catch(() => null),
      get(`${base}/releases/latest`).catch(() => null),
    ]);
    return { info, readme, langs, release };
  }

  const vnDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso)) / 864e5);
  const num = (n) => Number(n || 0).toLocaleString("en-US");

  /** README → đoạn giới thiệu đầu (bỏ ảnh, huy hiệu, HTML) + dàn ý các mục. */
  function readmeParts(md) {
    if (!md) return { intro: "", outline: [], len: 0, install: false, usage: false };
    const text = md.replace(/<!--[\s\S]*?-->/g, "").replace(/```[\s\S]*?```/g, "");
    const lines = text.split("\n");
    const outline = lines.filter((l) => /^#{1,3}\s+\S/.test(l)).map((l) => l.replace(/^#+\s*/, "").replace(/[*_`]/g, "").trim()).filter(Boolean);
    // Đoạn văn mô tả (bỏ tiêu đề, ảnh/huy hiệu, bảng, danh sách); ưu tiên phần trước mục ## đầu tiên
    const paras = [];
    let cur = [], section = 0;
    const flush = () => { if (cur.length) { paras.push({ text: cur.join(" "), section }); cur = []; } };
    for (const raw of lines) {
      const l = raw.replace(/<[^>]+>/g, "").trim();
      if (/^#{1,6}\s/.test(l)) { flush(); if (!(/^#\s/.test(l) && !paras.length)) section++; continue; } // tên dự án (# đầu tiên) không tính là mục
      const skip = !l || /^#/.test(l) || /^!?\[!\[|^!\[/.test(l) || /^[-=|:\s]+$/.test(l) || /^\|/.test(l) || /^([-*+]|\d+[.)])\s/.test(l) || /^>/.test(l);
      if (skip) { flush(); continue; }
      cur.push(l);
    }
    flush();
    const top = paras.filter((p) => p.section === 0);
    let intro = "";
    for (const p of top.length ? top : paras.slice(0, 1)) { if (intro.length > 450) break; intro += (intro ? "\n\n" : "") + p.text; }
    if (intro.length > 900) intro = intro.slice(0, 900).replace(/\s+\S*$/, "") + "…";
    const heads = outline.join(" ").toLowerCase();
    return {
      intro, outline: outline.slice(0, 12), len: md.length,
      install: /install|cài đặt|getting started|setup|quick ?start|bắt đầu/.test(heads),
      usage: /usage|sử dụng|example|ví dụ|how to|hướng dẫn|tutorial|docs|documentation/.test(heads),
    };
  }

  /** Review theo quy tắc: mỗi mục ✓ (cộng điểm) / ⚠ (trừ điểm) / • (trung tính). */
  function review({ info, release }, rp) {
    const items = [];
    let score = 0;
    const add = (mark, text, d) => { items.push(`${mark} ${text}`); score += d; }; // mỗi ý một dòng (marked breaks: true)
    const s = info.stargazers_count;
    if (s >= 1000) add("✓", `Very popular: ${num(s)} stars, ${num(info.forks_count)} forks.`, 1);
    else if (s >= 100) add("✓", `Fairly popular: ${num(s)} stars, ${num(info.forks_count)} forks.`, 1);
    else if (s >= 10) add("•", `Small user base: ${num(s)} stars, ${num(info.forks_count)} forks.`, 0);
    else add("•", `Small or personal project: ${num(s)} stars.`, 0);
    const d = daysAgo(info.pushed_at);
    if (info.archived) add("⚠", "Archived: no longer maintained by the author.", -2);
    else if (d <= 30) add("✓", `Actively developed: last push ${d} days ago.`, 2);
    else if (d <= 180) add("✓", `Maintained: last push ${d} days ago.`, 1);
    else if (d <= 365) add("•", `Slow updates: last push ${d} days ago.`, 0);
    else add("⚠", `Looks inactive: last push on ${vnDate(info.pushed_at)}.`, -1);
    const lic = info.license?.spdx_id;
    if (!lic || lic === "NOASSERTION") add("⚠", "No clear license: by default you may not freely copy, modify or reuse the code.", -1);
    else if (/^(MIT|Apache-2\.0|BSD|ISC|MPL|Unlicense|0BSD|CC0)/i.test(lic)) add("✓", `${lic} license: permissive, reusable even commercially.`, 1);
    else if (/GPL/i.test(lic)) add("•", `${lic} license (copyleft): if you distribute a product using it, you must release your code under the same terms.`, 0);
    else add("•", `${lic} license: read the terms before reusing.`, 0);
    if (!rp.len) add("⚠", "No README: hard to know how to use it.", -1);
    else if (rp.install && rp.usage) add("✓", "README covers installation and usage.", 1);
    else if (rp.len < 800) add("•", "Short README with little guidance.", 0);
    else add("•", `README has content but no clear ${!rp.install ? "installation" : "usage"} section.`, 0);
    if (release) add("✓", `Has releases: ${release.tag_name} (${vnDate(release.published_at)}).`, 1);
    else add("•", "No official release yet: use it straight from source.", 0);
    if (info.fork && info.parent) add("•", `Fork of [${info.parent.full_name}](${info.parent.html_url}); check the upstream repo too.`, 0);
    if (info.open_issues_count) add("•", `${num(info.open_issues_count)} open issues/pull requests.`, 0);
    const verdict = score >= 3 ? "Worth trying" : score >= 1 ? "Usable, check further" : "Use with caution";
    return { items, score, verdict };
  }

  /** Soạn ghi chú: tiêu đề, nhãn, nội dung Markdown. */
  function build(d) {
    const { info, langs } = d, rp = readmeParts(d.readme), rv = review(d, rp);
    const total = Object.values(langs || {}).reduce((a, b) => a + b, 0);
    const langTxt = total ? Object.entries(langs).filter(([, v]) => v / total >= 0.01).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${Math.round((v / total) * 100)}%`).join(", ") : info.language || "—";
    const body = [
      info.description ? `> ${info.description}` : "> (No description)",
      "",
      `**Link:** ${info.html_url}${info.homepage ? ` · **Homepage:** ${info.homepage}` : ""}`,
      "",
      "## Info",
      "| Item | Value |",
      "|---|---|",
      `| Author | [${info.owner.login}](${info.owner.html_url}) |`,
      `| Languages | ${langTxt} |`,
      `| License | ${info.license?.spdx_id && info.license.spdx_id !== "NOASSERTION" ? info.license.spdx_id : "none"} |`,
      `| Stars / Forks | ${num(info.stargazers_count)} / ${num(info.forks_count)} |`,
      `| Open issues + PRs | ${num(info.open_issues_count)} |`,
      `| Latest release | ${d.release ? `${d.release.tag_name} (${vnDate(d.release.published_at)})` : "none"} |`,
      `| Created / Last push | ${vnDate(info.created_at)} / ${vnDate(info.pushed_at)} |`,
      ...(info.topics?.length ? [`| Topics | ${info.topics.join(", ")} |`] : []),
      "",
      "## Summary",
      rp.intro || info.description || "The README has no introduction.",
      ...(rp.outline.length ? ["", "**README sections:** " + rp.outline.join(" · ")] : []),
      "",
      `## Review: ${rv.verdict}`,
      ...rv.items,
      "",
      `_Automatic rule-based review (popularity, activity, license, docs, releases), data as of ${vnDate(new Date().toISOString())}. Code quality is not assessed._`,
      "",
      MINE,
      "",
    ].join("\n");
    const lang = Object.keys(langs || {})[0] || info.language;
    return { title: info.full_name, body, tags: ["github", ...(lang ? [lang] : [])], verdict: rv.verdict };
  }

  return { MINE, parse, fetchRepo, build, readmeParts, review };
})();
