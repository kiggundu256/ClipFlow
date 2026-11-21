import type { SocialPlatform } from "@prisma/client";
import { youtubePublishingAdapter } from "./youtube";

export type PublishInput = {
  platformAccountId: string;
  accessToken: string;
  scopes: string[];
  caption: string;
  mediaPath: string | null;
  mimeType: string | null;
  fileName: string | null;
};

export type PublishResult = { platformPostId: string };

export interface PublishingAdapter {
  publish(input: PublishInput): Promise<PublishResult>;
}

// Only verified provider adapters are registered. Unsupported platforms fail visibly.
const adapters = new Map<SocialPlatform, PublishingAdapter>([
  ["YOUTUBE", youtubePublishingAdapter]
]);

export function getPublishingAdapter(platform: SocialPlatform) {
  return adapters.get(platform) ?? null;
}
