// Preflight for the image pipeline: uploads a 1×1 test pixel, fetches it back
// through the brand-guide transformation, deletes it. Run this before any
// batch — a bad credential should fail here, not mid-import.
//
//   npm run import:check
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import {
  BRAND_TRANSFORM,
  assertCloudinaryConfigured,
  deliveryUrl,
  destroyAsset,
} from "./lib/cloudinary";

const ONE_PX_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  const { cloudName } = assertCloudinaryConfigured();
  console.log(`Cloudinary config OK — cloud "${cloudName}" (secret stays in .env).`);

  const publicId = "secreto/diagnostico/ping";
  const res = await cloudinary.uploader.upload(
    `data:image/png;base64,${ONE_PX_PNG.toString("base64")}`,
    { public_id: publicId, overwrite: true, invalidate: true },
  );
  console.log(`Upload OK — ${res.public_id} (${res.bytes} bytes)`);

  const url = deliveryUrl(publicId);
  if (!url.includes(BRAND_TRANSFORM)) {
    throw new Error(`Delivery URL lost the brand transformation: ${url}`);
  }
  const probe = await fetch(url);
  console.log(
    `Delivery OK — HTTP ${probe.status} ${probe.headers.get("content-type")} — ${url}`,
  );
  if (!probe.ok) {
    throw new Error("Delivery URL did not answer 200 — check cloud name and transformation.");
  }

  await destroyAsset(publicId);
  console.log("Test asset deleted. Cloudinary is ready for the batch.");
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Cloudinary check FAILED: ${msg}`);
  if (/signature|401|authoriz/i.test(msg)) {
    console.error(
      "Looks like an auth problem: the API secret in .env is wrong or was left incomplete. " +
        "Ask for the secret from the Cloudinary dashboard — never commit it.",
    );
  }
  process.exit(1);
});
