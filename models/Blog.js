import mongoose from "mongoose";

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    excerpt: {
      type: String,
      required: true,
    },
    content: {
      type: String, // HTML or Markdown
      required: true,
    },
    thumbnail: {
      type: String, // URL to image
    },
    bannerImage: {
      type: String, // URL to high-res banner
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlogCategory",
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Author",
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    publishedAt: {
      type: Date,
    },
    readingTime: {
      type: Number, // in minutes
      default: 0,
    },
    showToc: {
      type: Boolean,
      default: true,
    },
    metaTitle: String,
    metaDescription: String,
    ogImage: String,
  },
  { timestamps: true },
);

// Pre-save hook to calculate reading time roughly based on content length
blogSchema.pre("save", function () {
  if (this.isModified("content") && this.content) {
    const wordsPerMinute = 200;
    // Strip HTML tags roughly before splitting for word count, or just split raw content
    const plainText = this.content.replace(/<[^>]+>/g, "");
    const textLength = plainText.split(/\s+/).length;
    this.readingTime = Math.max(1, Math.ceil(textLength / wordsPerMinute));
  }
});

export default mongoose.model("Blog", blogSchema);
