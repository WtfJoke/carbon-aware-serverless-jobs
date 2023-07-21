import { z } from "zod";
import { paths } from "./generated/schema";

export type CarbonAwareComputingForecastResponse =
  paths["/emissions/forecasts/current"]["get"]["responses"]["200"]["content"]["application/json"];

export const CarbonAwareComputingForecastQueryParamsScheme = z.object({
  location: z.enum(["de", "fr", "at"]),
  dataStartAt: z.string().datetime().optional(),
  dataEndAt: z.string().datetime().optional(),
  windowSize: z.number().optional(),
});

export type CarbonAwareComputingForecastQueryParams = z.infer<
  typeof CarbonAwareComputingForecastQueryParamsScheme
>;
