"use client";

/**
 * Client-side barrel for the Material UI icons this app uses.
 *
 * Why this file exists: every module under `@mui/icons-material` calls
 * `createSvgIcon()` at module scope, and `createSvgIcon` is marked
 * `"use client"`. Importing an icon straight into a Server Component therefore
 * *executes* a client-only function during server render and throws
 * "Attempted to call the default export ... from the server".
 *
 * Re-exporting through this `"use client"` module turns each icon into a
 * client reference, which a Server Component may freely render as JSX. So:
 * import icons from here, never from `@mui/icons-material/*` directly.
 */

export { default as AcUnitIcon } from "@mui/icons-material/AcUnit";
export { default as AccountBalanceIcon } from "@mui/icons-material/AccountBalance";
export { default as ApartmentIcon } from "@mui/icons-material/Apartment";
export { default as ArrowForwardIcon } from "@mui/icons-material/ArrowForward";
export { default as ArticleIcon } from "@mui/icons-material/Article";
export { default as BadgeIcon } from "@mui/icons-material/Badge";
export { default as BeachAccessIcon } from "@mui/icons-material/BeachAccess";
export { default as CalendarMonthIcon } from "@mui/icons-material/CalendarMonth";
export { default as CelebrationIcon } from "@mui/icons-material/Celebration";
export { default as ChevronLeftIcon } from "@mui/icons-material/ChevronLeft";
export { default as ChevronRightIcon } from "@mui/icons-material/ChevronRight";
export { default as DashboardIcon } from "@mui/icons-material/Dashboard";
export { default as DescriptionIcon } from "@mui/icons-material/Description";
export { default as Diversity3Icon } from "@mui/icons-material/Diversity3";
export { default as EmailIcon } from "@mui/icons-material/Email";
export { default as EventAvailableIcon } from "@mui/icons-material/EventAvailable";
export { default as ExpandMoreIcon } from "@mui/icons-material/ExpandMore";
export { default as FacebookIcon } from "@mui/icons-material/Facebook";
export { default as FactCheckIcon } from "@mui/icons-material/FactCheck";
export { default as FlightIcon } from "@mui/icons-material/Flight";
export { default as FlightLandIcon } from "@mui/icons-material/FlightLand";
export { default as FlightTakeoffIcon } from "@mui/icons-material/FlightTakeoff";
export { default as GrainIcon } from "@mui/icons-material/Grain";
export { default as HandshakeIcon } from "@mui/icons-material/Handshake";
export { default as HealthAndSafetyIcon } from "@mui/icons-material/HealthAndSafety";
export { default as HotelIcon } from "@mui/icons-material/Hotel";
export { default as InfoOutlinedIcon } from "@mui/icons-material/InfoOutlined";
export { default as InstagramIcon } from "@mui/icons-material/Instagram";
export { default as LinkedInIcon } from "@mui/icons-material/LinkedIn";
export { default as LocalOfferIcon } from "@mui/icons-material/LocalOffer";
export { default as LogoutIcon } from "@mui/icons-material/Logout";
export { default as MenuIcon } from "@mui/icons-material/Menu";
export { default as MosqueIcon } from "@mui/icons-material/Mosque";
export { default as NearMeIcon } from "@mui/icons-material/NearMe";
export { default as PeopleAltIcon } from "@mui/icons-material/PeopleAlt";
export { default as PersonIcon } from "@mui/icons-material/Person";
export { default as PhoneInTalkIcon } from "@mui/icons-material/PhoneInTalk";
export { default as PhotoCameraFrontIcon } from "@mui/icons-material/PhotoCameraFront";
export { default as PlaceIcon } from "@mui/icons-material/Place";
export { default as ReportProblemIcon } from "@mui/icons-material/ReportProblem";
export { default as SearchIcon } from "@mui/icons-material/Search";
export { default as SettingsSuggestIcon } from "@mui/icons-material/SettingsSuggest";
export { default as StorefrontIcon } from "@mui/icons-material/Storefront";
export { default as SupportAgentIcon } from "@mui/icons-material/SupportAgent";
export { default as SwapHorizIcon } from "@mui/icons-material/SwapHoriz";
export { default as TaskAltIcon } from "@mui/icons-material/TaskAlt";
export { default as ThumbUpAltIcon } from "@mui/icons-material/ThumbUpAlt";
export { default as VerifiedIcon } from "@mui/icons-material/Verified";
export { default as WbSunnyIcon } from "@mui/icons-material/WbSunny";
export { default as XIcon } from "@mui/icons-material/X";
export { default as YouTubeIcon } from "@mui/icons-material/YouTube";

// @mui/icons-material ships no TikTok glyph — built the same way MUI builds
// its own icons, via createSvgIcon, so it behaves identically to every
// import above (same sx/fontSize API, same client-boundary reasoning).
import { createSvgIcon } from "@mui/material/utils";
import { createElement } from "react";
export const TikTokIcon = createSvgIcon(
  createElement("path", {
    d: "M16.6 5.82c-.9-.98-1.4-2.26-1.4-3.6h-3.03v13.96c0 1.53-1.24 2.78-2.78 2.78a2.78 2.78 0 0 1 0-5.56c.28 0 .55.04.8.12V10.4a5.8 5.8 0 0 0-.8-.06A5.83 5.83 0 0 0 3.56 16.17 5.83 5.83 0 0 0 9.39 22a5.83 5.83 0 0 0 5.83-5.83V9.3a9.05 9.05 0 0 0 5.22 1.66V7.93a5.7 5.7 0 0 1-3.84-2.1Z",
  }),
  "TikTok"
);

export { default as CloseIcon } from "@mui/icons-material/Close";
export { default as TrendingUpIcon } from "@mui/icons-material/TrendingUp";
export { default as AutoAwesomeIcon } from "@mui/icons-material/AutoAwesome";
export { default as NotificationsActiveIcon } from "@mui/icons-material/NotificationsActive";
export { default as LuggageIcon } from "@mui/icons-material/Luggage";
export { default as ExploreIcon } from "@mui/icons-material/Explore";
export { default as DirectionsCarIcon } from "@mui/icons-material/DirectionsCar";
export { default as BedIcon } from "@mui/icons-material/Bed";

export { default as StarIcon } from "@mui/icons-material/Star";
export { default as TuneIcon } from "@mui/icons-material/Tune";
export { default as MapIcon } from "@mui/icons-material/Map";
export { default as CheckCircleIcon } from "@mui/icons-material/CheckCircle";
export { default as LocationOnIcon } from "@mui/icons-material/LocationOn";
export { default as FormatQuoteIcon } from "@mui/icons-material/FormatQuote";

export { default as BoltIcon } from "@mui/icons-material/Bolt";
export { default as WorkspacePremiumIcon } from "@mui/icons-material/WorkspacePremium";
export { default as PaymentsIcon } from "@mui/icons-material/Payments";
export { default as NightsStayIcon } from "@mui/icons-material/NightsStay";
export { default as PublicIcon } from "@mui/icons-material/Public";

// Hotel/room facility icons — one distinct glyph per amenity, see
// modules/hotels/amenity-icons.ts for the amenity-key -> icon mapping.
export { default as WifiIcon } from "@mui/icons-material/Wifi";
export { default as LocalParkingIcon } from "@mui/icons-material/LocalParking";
export { default as PoolIcon } from "@mui/icons-material/Pool";
export { default as FreeBreakfastIcon } from "@mui/icons-material/FreeBreakfast";
export { default as AirportShuttleIcon } from "@mui/icons-material/AirportShuttle";
export { default as RestaurantIcon } from "@mui/icons-material/Restaurant";
export { default as RoomServiceIcon } from "@mui/icons-material/RoomService";
export { default as FitnessCenterIcon } from "@mui/icons-material/FitnessCenter";
export { default as SpaIcon } from "@mui/icons-material/Spa";
export { default as ElevatorIcon } from "@mui/icons-material/Elevator";
export { default as SmokeFreeIcon } from "@mui/icons-material/SmokeFree";

export type { SvgIconComponent } from "@mui/icons-material";
