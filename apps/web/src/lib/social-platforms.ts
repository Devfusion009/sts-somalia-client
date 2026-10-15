/** Networks an admin can link from the footer, in display order. */
export const SOCIAL_PLATFORMS = {
  instagram: { label: "Instagram", placeholder: "https://www.instagram.com/…" },
  tiktok: { label: "TikTok", placeholder: "https://www.tiktok.com/@…" },
  facebook: { label: "Facebook", placeholder: "https://www.facebook.com/…" },
  x: { label: "X", placeholder: "https://x.com/…" },
  youtube: { label: "YouTube", placeholder: "https://www.youtube.com/@…" },
  linkedin: { label: "LinkedIn", placeholder: "https://www.linkedin.com/company/…" },
} as const;

export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;
export type SocialLink = { platform: SocialPlatform; url: string };
export const SOCIAL_PLATFORM_ORDER = Object.keys(SOCIAL_PLATFORMS) as SocialPlatform[];
