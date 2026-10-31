import "server-only";
// Compatibility entry point; manager credentials are delivered by email only.
export { prepareManagerCredentials, deliverManagerCredentials, sendManagerResetLink } from "@/lib/managers/credentials";
