import type { PhotoProcessor } from "@root-of-cambodia/backend/media";
import { DomainError } from "@root-of-cambodia/backend/errors";

// The generated binding type follows local Wrangler configuration. No API tokens,
// hosted Images storage, public bucket URL or remote binding is needed here.
export function photoProcessor(
  images: CloudflareEnv["IMAGES"],
): PhotoProcessor {
  if (!images) throw new DomainError("photo_processing_unavailable", 503);
  const stream = (bytes: Uint8Array) =>
    new Blob([new Uint8Array(bytes)]).stream();
  return {
    async inspect(bytes) {
      const info = await images.info(stream(bytes));
      if (!("width" in info) || !("height" in info))
        throw new Error("unsupported_image");
      return { format: info.format, width: info.width, height: info.height };
    },
    async preview(bytes) {
      const output = await images
        .input(stream(bytes))
        .transform({ width: 1600, height: 1600, fit: "scale-down" })
        .output({ format: "image/jpeg", quality: 80, anim: false });
      const response = output.response();
      if (
        !response.ok ||
        response.headers.get("content-type")?.split(";")[0] !== "image/jpeg"
      )
        throw new Error("image_processing_failed");
      // Bound provider output as well as input; never buffer an unlimited stream.
      const reader = response.body?.getReader();
      if (!reader) throw new Error("image_processing_failed");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8 * 1024 * 1024) {
          await reader.cancel();
          throw new Error("image_processing_failed");
        }
        chunks.push(value);
      }
      const result = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    },
  };
}
