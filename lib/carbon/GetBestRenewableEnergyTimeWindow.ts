// lambda handler
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import queryString from "query-string";

import {
  BestRenewableEnergyTimeWindowPayload,
  BestRenewableEnergyTimeWindowPayloadScheme,
  BestRenewableEnergyTimeWindowResponse,
  BestRenewableEnergyTimeWindowResponseScheme,
} from "./models";
import {
  CarbonAwareComputingForecastQueryParams,
  CarbonAwareComputingForecastQueryParamsScheme,
  CarbonAwareComputingForecastResponse,
} from "./carbon-aware-computing/models";
import dayjs, { Dayjs } from "dayjs";
import minMax from "dayjs/plugin/minMax";
dayjs.extend(minMax);

const serviceName = "carbon-aware-serverless-jobs";
const logger = new Logger({ serviceName });
new Tracer({ serviceName });

export const handler = async (
  event: BestRenewableEnergyTimeWindowPayload,
): Promise<BestRenewableEnergyTimeWindowResponse> => {
  logger.info(JSON.stringify(event));

  const payload: BestRenewableEnergyTimeWindowPayload =
    BestRenewableEnergyTimeWindowPayloadScheme.parse(event);
  const response: BestRenewableEnergyTimeWindowResponse =
    await getBestRenewableEnergyTimeWindow(payload);

  logger.info(JSON.stringify(response));
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
  const apiUrl =
    "https://forecast.carbon-aware-computing.com/emissions/forecasts/current?" +
    queryString.stringify(queryParams);
  logger.info("Fetch from apiUrl: " + apiUrl);

  const forecastResponse = await fetch(apiUrl, {
    headers: {
      "x-api-key": apiKey,
    },
  });
  if (!forecastResponse.ok) {
    logger.error(forecastResponse.statusText);
    logger.error(await forecastResponse.text());
    throw new Error("Failed to fetch forecast data");
  }
  const forecastResponseArray: CarbonAwareComputingForecastResponse =
    await forecastResponse.json();

  const optimalExecutionDate = await extractOptimalExecutionDate(
    forecastResponseArray,
  );
  const optimalExecutionDateTime = dayjs(optimalExecutionDate);
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
      `Missing Carbon Aware Computing API key in Secret ${secureStringParameterName}`,
    );
  }
  return apiKey;
};

const extractOptimalExecutionDate = async (
  forecastResponse: CarbonAwareComputingForecastResponse,
) => {
  const forecastOptimalDataPoints = forecastResponse[0].optimalDataPoints;
  if (!forecastOptimalDataPoints || forecastOptimalDataPoints.length !== 1) {
    throw new Error(
      `Expected exactly one optimal data point, got ${forecastOptimalDataPoints?.length}`,
    );
  }

  const optimalExecutionDate = forecastOptimalDataPoints[0].timestamp;
  return optimalExecutionDate;
};

const getWaitTimeInSecondsForOptimalExecution = (
  optimalExecutionDateTime: Dayjs,
) => {
  const now = dayjs();

  if (optimalExecutionDateTime.isBefore(now)) {
    return 0;
  } else {
    return optimalExecutionDateTime.diff(now, "seconds");
  }
};
