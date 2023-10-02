import { Logger } from "@aws-lambda-powertools/logger";

import {
  CarbonAwareTimeWindowPayload,
  CarbonAwareTimeWindowPayloadScheme,
  CarbonAwareTimeWindowResponse,
  CarbonAwareTimeWindowResponseScheme,
} from "../models";
import dayjs, { Dayjs } from "dayjs";
import minMax from "dayjs/plugin/minMax";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { fetchOptimalExecutionStartDate } from "./CarbonAwareComputingClient";
dayjs.extend(minMax);
dayjs.extend(duration);
dayjs.extend(relativeTime);

const serviceName = "carbon-aware-serverless-jobs";
export const logger = new Logger({ serviceName });

export const handler = async (
  event: CarbonAwareTimeWindowPayload,
): Promise<CarbonAwareTimeWindowResponse> => {
  logger.info(
    "Start to determine best execution time window with request",
    event,
  );

  const payload: CarbonAwareTimeWindowPayload =
    CarbonAwareTimeWindowPayloadScheme.parse(event);

  const response: CarbonAwareTimeWindowResponse =
    await getCarbonAwareTimeWindow(payload);

  logger.info("Returning best time window", response);
  return response;
};

const getCarbonAwareTimeWindow = async (
  payload: CarbonAwareTimeWindowPayload,
): Promise<CarbonAwareTimeWindowResponse> => {
  const { location, earliestDateTime, latestStartInMinutes } = payload;
  const startDate = dayjs(earliestDateTime);
  const latestStartDate = startDate.add(latestStartInMinutes, "minutes");

  const optimalExecutionDateTime: Dayjs = await fetchOptimalExecutionStartDate({
    location,
    dataStartAt: startDate.toISOString(),
    dataEndAt: latestStartDate.toISOString(),
  });

  const waitTimeInSecondsForOptimalExecution =
    getWaitTimeInSecondsForOptimalExecution(optimalExecutionDateTime);

  const response: CarbonAwareTimeWindowResponse =
    CarbonAwareTimeWindowResponseScheme.parse({
      waitTimeInSecondsForOptimalExecution,
      optimalExecutionDateTime: optimalExecutionDateTime.toISOString(),
    });

  return response;
};

const getWaitTimeInSecondsForOptimalExecution = (
  optimalExecutionDateTime: Dayjs,
): number => {
  const now = dayjs();
  let waitTimeInSecondsForOptimalExecution: number;

  if (optimalExecutionDateTime.isBefore(now)) {
    waitTimeInSecondsForOptimalExecution = 0;
  } else {
    waitTimeInSecondsForOptimalExecution = optimalExecutionDateTime.diff(
      now,
      "seconds",
    );
  }

  logger.info(
    `Waiting for ${dayjs
      .duration(waitTimeInSecondsForOptimalExecution, "seconds")
      .humanize()} for optimal execution`,
  );
  return waitTimeInSecondsForOptimalExecution;
};
