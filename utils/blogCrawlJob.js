import Blog from "../models/Blog.js";
import { fetchRssFeeds } from "./rssCrawler.js";
import { rewriteArticle } from "./aiRewriter.js";

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export async function runBlogCrawl({ limit = 3, status = "draft" } = {}) {
  const results = { created: 0, skipped: 0, errors: [] };

  const rssItems = await fetchRssFeeds(limit);
  if (!rssItems.length) {
    results.errors.push("No RSS items fetched");
    return results;
  }

  for (const item of rssItems) {
    try {
      // Check if already crawled (by source link)
      const existing = await Blog.findOne({
        content: { $regex: item.link, $options: "i" },
      });
      if (existing) {
        results.skipped++;
        continue;
      }

      const rewritten = await rewriteArticle({
        title: item.title,
        content: item.content || item.description,
        source: item.source,
      });

      const slug =
        slugify(rewritten.title) + "-" + Date.now().toString(36);

      await Blog.create({
        title: rewritten.title,
        slug,
        excerpt: rewritten.excerpt,
        content:
          rewritten.content +
          `\n\n---\n*Nguồn tham khảo: [${item.source}](${item.link})*`,
        thumbnail: item.thumbnail || undefined,
        ogImage: item.thumbnail || undefined,
        status,
        metaTitle: rewritten.metaTitle,
        metaDescription: rewritten.metaDescription,
        readingTime: Math.max(
          1,
          Math.ceil(rewritten.content.split(/\s+/).length / 200),
        ),
      });

      results.created++;
    } catch (err) {
      results.errors.push(`${item.title}: ${err.message}`);
    }
  }

  return results;
}
