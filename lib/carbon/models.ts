import { z } from "zod";

export const BestRenewableEnergyTimeWindowPayloadScheme = z.object({
  location: z.enum(["de", "fr", "at"]),
  earliestDateTime: z.string().datetime().optional(),
  latestDateTime: z.string().datetime().optional(),
});

export type BestRenewableEnergyTimeWindowPayload = z.infer<
  typeof BestRenewableEnergyTimeWindowPayloadScheme
>;

export const BestRenewableEnergyTimeWindowResponseScheme = z.object({
  waitTimeInSecondsForOptimalExecution: z.number(),
  optimalExecutionDateTime: z.string().optional(),
});

export type BestRenewableEnergyTimeWindowResponse = z.infer<
  typeof BestRenewableEnergyTimeWindowResponseScheme
>;
