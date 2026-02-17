import { S3Client } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "").trim();
const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "").trim();
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
// URL public để xem ảnh: phải là https://pub-xxxxx.r2.dev (bật Public Development URL trong bucket).
// KHÔNG dùng https://<account_id>.r2.cloudflarestorage.com — đó là endpoint API, browser vào sẽ lỗi Authorization.
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";

// AWS SDK (R2/S3) yêu cầu Access Key ID 32 ký tự. Nếu bạn dùng Cloudflare API Token (40 ký tự),
// sẽ báo "Credential access key has length 40, should be 32" (từ @smithy/signature-v4 khi ký request).
const validAccessKeyId =
  accessKeyId && accessKeyId.length === 32 ? accessKeyId : null;

const endpoint = accountId
  ? `https://${accountId}.r2.cloudflarestorage.com`
  : null;

export const r2Client =
  endpoint && validAccessKeyId && secretAccessKey && bucketName
    ? new S3Client({
        region: "auto",
        endpoint,
        credentials: {
          accessKeyId: validAccessKeyId,
          secretAccessKey,
        },
      })
    : null;

export const R2_BUCKET = bucketName || "";
export const R2_PUBLIC_URL = publicUrl.replace(/\/$/, "");
export const R2_DIRECTORY = "products";

export function isR2Configured() {
  return Boolean(r2Client && R2_BUCKET);
}

export function getPublicUrl(key) {
  if (!R2_PUBLIC_URL) return null;
  return `${R2_PUBLIC_URL}/${key}`;
}
