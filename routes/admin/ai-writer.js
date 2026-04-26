import { PutObjectCommand } from "@aws-sdk/client-s3";
import { Router } from "express";
import OpenAI from "openai";
import sharp from "sharp";
import MediaAsset from "../../models/MediaAsset.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import {
  getPublicUrl,
  isR2Configured,
  r2Client,
  R2_BUCKET,
} from "../../config/cloudflare-r2.js";

const router = Router();
router.use(requireAdmin);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Ban la SEO content writer cho local brand streetwear "From the Stress".

Muc tieu: viet bai blog SEO bang tieng Viet tu nhien, giong giong mot editor thoi trang hien dai tai TP.HCM, khong khoa truong, khong sales-y.

BAT BUOC:
- Chi tra ve JSON hop le.
- Bai viet phai la HTML thuan, khong Markdown.
- Giong van: toi gian, that, co hinh anh doi song, hop Gen Z va Millennials.
- Khong nhoi keyword.
- Khong mo dau bang "Ban co biet" hay "Trong thoi dai".
- Moi than bai chinh can co 1 marker anh dung vi tri chen trong HTML.

JSON format:
{
  "seoTitle": "H1 title, keyword o gan dau",
  "metaDescription": "150-160 ky tu",
  "slug": "url-slug-ngan",
  "focusKeyword": "keyword chinh",
  "secondaryKeywords": ["keyword phu 1", "keyword phu 2", "keyword phu 3"],
  "featuredImageAlt": "alt text cho anh chinh",
  "content": "HTML thuan",
  "wordCount": 1000,
  "keywordDensity": "1.5%",
  "internalLinksCount": 2
}

YEU CAU HTML:
- Bat dau bang <h1>.
- Intro 100-150 tu, co focus keyword trong 100 tu dau.
- It nhat 3 section <h2>, moi section 200-350 tu.
- Moi section <h2> phai co dung 1 marker anh HTML comment theo dung format:
  <!-- IMAGE: landscape | alt text ngan gon | mo ta canh chup chi tiet, phu hop noi dung section -->
  Hoac portrait / square o vi tri dau tien neu bo cuc can doc / vuong.
- Khong dung ky tu "|" ben trong alt text hoac mo ta.
- Dung <strong> cho keyword quan trong.
- Co 1 <blockquote> key takeaway.
- Cuoi bai co FAQ voi it nhat 3 cau hoi dang <strong>Cau hoi</strong><p>Tra loi...</p>
- Ket bai bang CTA nhe co link san pham.
`;

const IMAGE_PLACEHOLDER_PREFIX = "__AI_WRITER_IMAGE_";
const MAX_IMAGE_COUNT = 4;

function clampWordCountTarget(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1000;
  return Math.min(3000, Math.max(600, Math.round(parsed)));
}

function slugifyName(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeOrientation(value) {
  if (value === "portrait" || value === "square") return value;
  return "landscape";
}

function getImageSizeSpec(orientation) {
  if (orientation === "portrait") {
    return {
      size: "1024x1536",
      aspectRatio: "4 / 5",
      width: 1024,
      height: 1280,
      className: "fts-ai-image--portrait",
    };
  }

  if (orientation === "square") {
    return {
      size: "1024x1024",
      aspectRatio: "1 / 1",
      width: 1024,
      height: 1024,
      className: "fts-ai-image--square",
    };
  }

  return {
    size: "1536x1024",
    aspectRatio: "16 / 9",
    width: 1536,
    height: 864,
    className: "fts-ai-image--landscape",
  };
}

function buildArticlePrompt({
  keyword,
  searchIntent,
  targetReader,
  productToLink,
  relatedBlogsText,
  wordCount,
  specialNotes,
}) {
  return `Viet bai blog SEO cho website "From the Stress".

FOCUS_KEYWORD: ${keyword}
SEARCH_INTENT: ${searchIntent || "informational"}
TARGET_READER: ${targetReader || "Gen Z tai TP.HCM, uu tien comfort va style toi gian"}
PRODUCT_TO_LINK: ${productToLink || "/collections/all"}
RELATED_BLOGS:
${relatedBlogsText || "Khong co"}
WORD_COUNT_TARGET: ${wordCount}
SPECIAL_NOTES: ${specialNotes || "Khong co"}

Moi internal link dung dang <a href="/duong-dan">anchor text</a>.
CTA cuoi bai dung dang <a href="${productToLink || "/collections/all"}">xem san pham</a>.
`;
}

function extractImageDirectives(content) {
  const directives = [];
  let index = 0;

  const contentWithPlaceholders = content.replace(
    /<!--\s*IMAGE:\s*([\s\S]*?)-->/gi,
    (_match, rawDirective) => {
      if (index >= MAX_IMAGE_COUNT) {
        return "";
      }

      const parts = String(rawDirective)
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean);

      const orientation = normalizeOrientation(parts[0]);
      const alt = (parts[1] || parts[0] || "Anh minh hoa").slice(0, 140);
      const prompt = (parts.slice(2).join(" |") || parts[1] || parts[0] || "Streetwear editorial image")
        .replace(/\s+/g, " ")
        .trim();

      const placeholder = `${IMAGE_PLACEHOLDER_PREFIX}${index}__`;
      directives.push({
        index,
        placeholder,
        orientation,
        alt,
        prompt,
      });
      index += 1;
      return placeholder;
    },
  );

  return { directives, contentWithPlaceholders };
}

function buildImagePrompt({ keyword, targetReader, directive, sectionIndex }) {
  return `Create a photorealistic editorial image for a Vietnamese streetwear blog article.

Section number: ${sectionIndex + 1}
Focus keyword: ${keyword}
Target reader: ${targetReader || "Gen Z and Millennials in Ho Chi Minh City"}
Requested orientation: ${directive.orientation}
Visual brief: ${directive.prompt}

Requirements:
- modern local brand / streetwear mood
- realistic photography, not illustration
- no text, no watermark, no logo, no collage
- natural lighting or cinematic editorial lighting
- composition suitable for a fashion or lifestyle blog section image
- clothing, setting, and props must match the brief closely
- keep the image clean enough to crop responsively for web content
`;
}

async function generateArticle(payload) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildArticlePrompt(payload) },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 3500,
    frequency_penalty: 0.3,
    presence_penalty: 0.2,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty AI response");
  }

  return JSON.parse(text);
}

async function uploadGeneratedAsset({ keyword, index, imageBuffer, orientation, alt }) {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured");
  }

  const processed = await sharp(imageBuffer)
    .rotate()
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const baseName = slugifyName(`${keyword}-${orientation}-${index + 1}`) || "ai-writer";
  const uniqueSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const filename = `${baseName}-${uniqueSuffix}.webp`;
  const key = `blogs/${filename}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: processed.data,
      ContentType: "image/webp",
    }),
  );

  const url = getPublicUrl(key);
  if (!url) {
    throw new Error("CLOUDFLARE_R2_PUBLIC_URL is not configured");
  }

  const asset = await MediaAsset.create({
    key,
    url,
    folder: "blogs",
    originalName: `${baseName}.webp`,
    customName: alt || baseName,
    size: processed.data.length,
    width: processed.info.width,
    height: processed.info.height,
  });

  return {
    assetId: asset._id,
    url,
    width: processed.info.width,
    height: processed.info.height,
  };
}

async function generateAndUploadImage({ keyword, targetReader, directive }) {
  const sizeSpec = getImageSizeSpec(directive.orientation);
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: buildImagePrompt({
      keyword,
      targetReader,
      directive,
      sectionIndex: directive.index,
    }),
    size: sizeSpec.size,
    quality: "medium",
    output_format: "webp",
    output_compression: 85,
  });

  const base64Image = response.data?.[0]?.b64_json;
  if (!base64Image) {
    throw new Error("Image generation returned no image data");
  }

  const imageBuffer = Buffer.from(base64Image, "base64");
  const uploaded = await uploadGeneratedAsset({
    keyword,
    index: directive.index,
    imageBuffer,
    orientation: directive.orientation,
    alt: directive.alt,
  });

  return {
    ...directive,
    ...uploaded,
    aspectRatio: sizeSpec.aspectRatio,
    className: sizeSpec.className,
  };
}

function buildFigureHtml(image) {
  const alt = escapeHtml(image.alt);
  const src = escapeHtml(image.url);
  return [
    `<figure class="fts-ai-image ${image.className}" data-ai-image="true" style="margin:1.75rem 0;aspect-ratio:${image.aspectRatio};overflow:hidden;border-radius:12px;">`,
    `<img src="${src}" alt="${alt}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" />`,
    "</figure>",
  ].join("");
}

function injectImagesIntoContent(content, images) {
  let nextContent = content;

  for (const image of images) {
    nextContent = nextContent.replace(image.placeholder, buildFigureHtml(image));
  }

  return nextContent.replace(new RegExp(`${IMAGE_PLACEHOLDER_PREFIX}\\d+__`, "g"), "");
}

function pickPrimaryImage(images) {
  if (!images.length) return null;
  return (
    images.find((image) => image.orientation === "landscape") ||
    images[0]
  );
}

router.post("/generate", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: "OPENAI_API_KEY is not configured" });
    }

    const {
      keyword,
      searchIntent,
      targetReader,
      productToLink,
      relatedBlogs,
      wordCountTarget,
      specialNotes,
    } = req.body || {};

    if (!keyword || !String(keyword).trim()) {
      return res.status(400).json({ message: "Keyword is required" });
    }

    const wordCount = clampWordCountTarget(wordCountTarget);
    const relatedBlogsText = Array.isArray(relatedBlogs)
      ? relatedBlogs
          .filter((blog) => blog?.anchor && blog?.path)
          .map((blog) => `"${blog.anchor}" | ${blog.path}`)
          .join("\n")
      : "";

    const article = await generateArticle({
      keyword: String(keyword).trim(),
      searchIntent,
      targetReader,
      productToLink,
      relatedBlogsText,
      wordCount,
      specialNotes,
    });

    const { directives, contentWithPlaceholders } = extractImageDirectives(
      article.content || "",
    );

    const generatedImages = [];
    const imageWarnings = [];

    for (const directive of directives) {
      try {
        const generatedImage = await generateAndUploadImage({
          keyword: article.focusKeyword || keyword,
          targetReader,
          directive,
        });
        generatedImages.push(generatedImage);
      } catch (error) {
        imageWarnings.push(
          `Image ${directive.index + 1}: ${error.message || "generation failed"}`,
        );
      }
    }

    const content = injectImagesIntoContent(
      contentWithPlaceholders,
      generatedImages,
    );
    const primaryImage = pickPrimaryImage(generatedImages);

    res.json({
      ...article,
      wordCount,
      content,
      generatedImages: generatedImages.map((image) => ({
        assetId: image.assetId,
        url: image.url,
        alt: image.alt,
        orientation: image.orientation,
        width: image.width,
        height: image.height,
      })),
      imageWarnings,
      thumbnail: primaryImage?.url || "",
      bannerImage: primaryImage?.url || "",
      ogImage: primaryImage?.url || "",
      featuredImageAlt: primaryImage?.alt || article.featuredImageAlt,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(500).json({ message: "AI returned invalid JSON, please retry" });
    }

    res.status(500).json({ message: err.message || "AI writer failed" });
  }
});

export default router;
