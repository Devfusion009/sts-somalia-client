import { FacebookIcon, InstagramIcon, LinkedInIcon, TikTokIcon, XIcon, YouTubeIcon } from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
import type { SocialPlatform } from "@/lib/social-platforms";

export const SOCIAL_ICONS: Record<SocialPlatform, SvgIconComponent> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  facebook: FacebookIcon,
  x: XIcon,
  youtube: YouTubeIcon,
  linkedin: LinkedInIcon,
};
