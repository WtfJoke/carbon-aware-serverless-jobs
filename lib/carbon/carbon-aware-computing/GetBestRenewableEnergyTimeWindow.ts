import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import queryString from "query-string";

import {
  BestRenewableEnergyTimeWindowPayload,
  BestRenewableEnergyTimeWindowPayloadScheme,
  BestRenewableEnergyTimeWindowResponse,
  BestRenewableEnergyTimeWindowResponseScheme,
} from "../models";
import {
  CarbonAwareComputingForecastQueryParams,
  CarbonAwareComputingForecastQueryParamsScheme,
  CarbonAwareComputingForecastResponse,
} from "./models";
import dayjs, { Dayjs } from "dayjs";
import minMax from "dayjs/plugin/minMax";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
dayjs.extend(minMax);
dayjs.extend(duration);
dayjs.extend(relativeTime);

const serviceName = "carbon-aware-serverless-jobs";
const logger = new Logger({ serviceName, persistentLogAttributes: {} });
const BASE_API_URL = "https://forecast.carbon-aware-computing.com";

new Tracer({ serviceName });

export const handler = async (
  event: BestRenewableEnergyTimeWindowPayload,
): Promise<BestRenewableEnergyTimeWindowResponse> => {
  logger.info(
    "Start to determine best execution time window with request",
    event,
  );

  const payload: BestRenewableEnergyTimeWindowPayload =
    BestRenewableEnergyTimeWindowPayloadScheme.parse(event);
  const response: BestRenewableEnergyTimeWindowResponse =
    await getBestRenewableEnergyTimeWindow(payload);

  logger.info("Returning best time window", response);
  return response;
};

const getBestRenewableEnergyTimeWindow = async ({
  location,
  earliestDateTime,
  latestDateTime,
}: BestRenewableEnergyTimeWindowPayload): Promise<BestRenewableEnergyTimeWindowResponse> => {
  const apiKey = await getApiKey();
  const queryParams: CarbonAwareComputingForecastQueryParams =
    CarbonAwareComputingForecastQueryParamsScheme.parse({
      location,
      dataStartAt: earliestDateTime,
      dataEndAt: latestDateTime,
    });

  const apiEndpoint = `${BASE_API_URL}/emissions/forecasts/current`;
  const apiUrl = `${apiEndpoint}?${queryString.stringify(queryParams)}`;
  logger.info("Fetching from apiUrl: " + apiUrl, {
    apiEndpoint,
    queryParams,
    apiUrl,
  });

  const forecastResponse = await fetch(apiUrl, {
    headers: {
      "x-api-key": apiKey,
    },
  });
  if (!forecastResponse.ok) {
    logger.error(forecastResponse.statusText, {
      statusCode: forecastResponse.status,
    });
    logger.error(await forecastResponse.text());
    throw new Error("Failed to fetch forecast data");
  }
  const forecastResponseArray: CarbonAwareComputingForecastResponse =
    await forecastResponse.json();

  const optimalExecutionDateTime = await extractOptimalExecutionDate(
    forecastResponseArray,
  );
  const waitTimeInSecondsForOptimalExecution =
    getWaitTimeInSecondsForOptimalExecution(optimalExecutionDateTime);

  const response: BestRenewableEnergyTimeWindowResponse =
    BestRenewableEnergyTimeWindowResponseScheme.parse({
      waitTimeInSecondsForOptimalExecution,
      optimalExecutionDateTime: optimalExecutionDateTime.toISOString(),
    });

  return response;
};

const getApiKey = async () => {
  const secureStringParameterName =
    process.env.CARBON_AWARE_COMPUTING_API_KEY_SECURE_STRING_PARAMETER_NAME;
  if (!secureStringParameterName) {
    throw new Error(
      "Missing CARBON_AWARE_COMPUTING_API_KEY_SECURE_STRING_PARAMETER_NAME environment variable",
    );
  }

  const oneDayInSeconds = 60 * 60 * 24;
  const apiKey = await getParameter<string>(secureStringParameterName, {
    maxAge: oneDayInSeconds,
  });
  if (!apiKey) {
    throw new Error(
      `Missing Carbon Aware Computing API key in Parameter ${secureStringParameterName}`,
    );
  }
  return apiKey;
};

const extractOptimalExecutionDate = async (
  forecastResponse: CarbonAwareComputingForecastResponse,
): Promise<Dayjs> => {
  const forecastOptimalDataPoints = forecastResponse[0].optimalDataPoints;
  if (!forecastOptimalDataPoints || forecastOptimalDataPoints.length !== 1) {
    throw new Error(
      `Expected exactly one optimal data point, got ${forecastOptimalDataPoints?.length}`,
    );
  }

  const optimalExecutionDate = forecastOptimalDataPoints[0].timestamp;
  return dayjs(optimalExecutionDate);
};

const getWaitTimeInSecondsForOptimalExecution = (
  optimalExecutionDateTime: Dayjs,
) => {
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
