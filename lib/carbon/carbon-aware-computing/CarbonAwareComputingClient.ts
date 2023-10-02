import queryString from "query-string";
import {
  CarbonAwareComputingForecastQueryParams,
  CarbonAwareComputingForecastQueryParamsScheme,
  CarbonAwareComputingForecastResponse,
} from "./models";
import { logger } from "./GetBestRenewableEnergyTimeWindow";
import dayjs, { Dayjs } from "dayjs";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";

export const BASE_API_URL = "https://forecast.carbon-aware-computing.com";

export const fetchOptimalExecutionStartDate = async (
  queryParams: CarbonAwareComputingForecastQueryParams,
) => await fetchForecast(queryParams).then(extractOptimalExecutionDate);

const fetchForecast = async (
  unvalidatedQueryParams: CarbonAwareComputingForecastQueryParams,
): Promise<CarbonAwareComputingForecastResponse> => {
  const apiKey = await getApiKey();

  const queryParams: CarbonAwareComputingForecastQueryParams =
    CarbonAwareComputingForecastQueryParamsScheme.parse(unvalidatedQueryParams);

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
