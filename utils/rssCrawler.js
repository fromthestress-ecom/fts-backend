const RSS_FEEDS = [
  {
    name: "Hypebeast",
    url: "https://hypebeast.com/feed",
    category: "streetwear",
  },
  {
    name: "Highsnobiety",
    url: "https://www.highsnobiety.com/feed/",
    category: "fashion",
  },
];

function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function extractImageFromContent(content) {
  const match = content?.match(/<img[^>]+src=["']([^"']+)["']/);
  return match ? match[1] : null;
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decodeHtmlEntities(m[1]) : "";
    };

    const getCData = (tag) => {
      const m = block.match(
        new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`),
      );
      return m ? decodeHtmlEntities(m[1]) : get(tag);
    };

    const title = getCData("title");
    const link = get("link");
    const description = getCData("description");
    const pubDate = get("pubDate");
    const contentEncoded = block.match(
      /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/,
    );
    const fullContent = contentEncoded
      ? decodeHtmlEntities(contentEncoded[1])
      : description;

    const thumbnail =
      extractImageFromContent(
        contentEncoded ? contentEncoded[1] : block,
      ) ||
      (() => {
        const mediaMatch = block.match(
          /<media:content[^>]+url=["']([^"']+)["']/,
        );
        return mediaMatch ? mediaMatch[1] : null;
      })();

    if (title && link) {
      items.push({
        title,
        link,
        description: description.slice(0, 500),
        content: fullContent.slice(0, 2000),
        thumbnail,
        pubDate,
      });
    }
  }

  return items;
}

export async function fetchRssFeeds(limit = 5) {
  const allItems = [];

  for (const feed of RSS_FEEDS) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "FTS-Blog-Bot/1.0" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = parseRssItems(xml).slice(0, limit);
      allItems.push(
        ...items.map((item) => ({
          ...item,
          source: feed.name,
          category: feed.category,
        })),
      );
    } catch (err) {
      console.error(`[RSS] Failed to fetch ${feed.name}:`, err.message);
    }
  }

  return allItems;
}
