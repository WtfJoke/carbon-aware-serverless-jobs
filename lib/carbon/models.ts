import { z } from "zod";

const DAY_IN_MINUTES = 24 * 60;

export const CarbonAwareTimeWindowPayloadScheme = z.object({
  location: z.enum(["de", "fr", "at"]),
  earliestDateTime: z.string().datetime().optional(),
  latestStartInMinutes: z.number().optional().default(DAY_IN_MINUTES),
});

export type CarbonAwareTimeWindowPayload = z.infer<
  typeof CarbonAwareTimeWindowPayloadScheme
>;

export const CarbonAwareTimeWindowResponseScheme = z.object({
  waitTimeInSecondsForOptimalExecution: z.number(),
  optimalExecutionDateTime: z.string().optional(),
});

export type CarbonAwareTimeWindowResponse = z.infer<
  typeof CarbonAwareTimeWindowResponseScheme
>;
