import type { SocialPlatform } from "@prisma/client";

export type PublishInput = {
  platformAccountId: string;
  accessToken: string;
  caption: string;
  mediaPath: string | null;
  mimeType: string | null;
  fileName: string | null;
};

export type PublishResult = { platformPostId: string };

export interface PublishingAdapter {
  publish(input: PublishInput): Promise<PublishResult>;
}

// Platform adapters are registered here as each provider's publishing flow is implemented
// and verified. An absent adapter is treated as a permanent, visible failure—not a fake publish.
const adapters = new Map<SocialPlatform, PublishingAdapter>();

export function getPublishingAdapter(platform: SocialPlatform) {
  return adapters.get(platform) ?? null;
}
