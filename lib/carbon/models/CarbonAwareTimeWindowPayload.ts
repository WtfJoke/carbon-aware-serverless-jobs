export interface CarbonAwareTimeWindowPayload {
  location: "de" | "fr" | "at";
  earliestDateTime?: string;
  latestStartInMinutes?: number;
}
