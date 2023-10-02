import { Logger } from "@aws-lambda-powertools/logger";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import queryString from "query-string";

import {
  CarbonAwareTimeWindowPayload,
  CarbonAwareTimeWindowPayloadScheme,
  CarbonAwareTimeWindowResponse,
  CarbonAwareTimeWindowResponseScheme,
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
const logger = new Logger({ serviceName });
const BASE_API_URL = "https://forecast.carbon-aware-computing.com";

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

  const optimalExecutionDateTime = await fetchForecast({
    location,
    dataStartAt: startDate.toISOString(),
    dataEndAt: latestStartDate.toISOString(),
  }).then(extractOptimalExecutionDate);

  const waitTimeInSecondsForOptimalExecution =
    getWaitTimeInSecondsForOptimalExecution(optimalExecutionDateTime);

  const response: CarbonAwareTimeWindowResponse =
    CarbonAwareTimeWindowResponseScheme.parse({
      waitTimeInSecondsForOptimalExecution,
      optimalExecutionDateTime: optimalExecutionDateTime.toISOString(),
    });

  return response;
};

const getApiKey = async (): Promise<string> => {
  const secureStringParameterName = getSecureStringParameterName();
  const maxAge = 60 * 60 * 24; // One day in seconds
  const apiKey = await getParameter<string>(secureStringParameterName, {
    maxAge,
  });

  if (!apiKey) {
    throw new Error(
      `Missing Carbon Aware Computing API key in Parameter ${secureStringParameterName}`,
    );
  }

  return apiKey;
};

const getSecureStringParameterName = (): string => {
  const secureStringParameterName =
    process.env.CARBON_AWARE_COMPUTING_API_KEY_SECURE_STRING_PARAMETER_NAME;
  if (!secureStringParameterName) {
    throw new Error(
      "Missing CARBON_AWARE_COMPUTING_API_KEY_SECURE_STRING_PARAMETER_NAME environment variable",
    );
  }
  return secureStringParameterName;
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

const fetchForecast = async ({
  location,
  dataStartAt,
  dataEndAt,
}: CarbonAwareComputingForecastQueryParams): Promise<CarbonAwareComputingForecastResponse> => {
  const apiKey = await getApiKey();

  const queryParams: CarbonAwareComputingForecastQueryParams =
    CarbonAwareComputingForecastQueryParamsScheme.parse({
      location,
      dataStartAt,
      dataEndAt,
    });

  const apiEndpoint = `${BASE_API_URL}/emissions/forecasts/current`;
  const apiUrl = `${apiEndpoint}?${queryString.stringify(queryParams)}`;
  logger.info("Fetching best time window from apiUrl: " + apiUrl, {
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
      errorResponse: await forecastResponse.text(),
    });
    throw new Error("Failed to fetch forecast data");
  }
  const forecastResponseArray: CarbonAwareComputingForecastResponse =
    await forecastResponse.json();
  return forecastResponseArray;
};
