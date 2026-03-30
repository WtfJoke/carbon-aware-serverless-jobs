export interface CarbonAwareTimeWindowPayload {
  // Locations like "de", "fr", "at", see all available locations at https://intensity.carbon-aware-computing.com/locations
  location: string;
  earliestDateTime?: string;
  latestStartInMinutes?: number;
}
