import { router, protectedProcedure } from "../../trpc/trpc";
import { updateProfileSchema } from "@sts/shared-types";
import { IdentityService } from "./identity.service";

export const identityRouter = router({
  updateProfile: protectedProcedure.input(updateProfileSchema).mutation(async ({ ctx, input }) => {
    const svc = await ctx.resolve(IdentityService);
    return svc.updateProfile(ctx.user!.id, input);
  }),
});
