import * as cdk from "aws-cdk-lib";
import { SfnStateMachine } from "aws-cdk-lib/aws-events-targets";
import { Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import { StateMachine, Wait, WaitTime } from "aws-cdk-lib/aws-stepfunctions";
import {
  CallAwsService,
  LambdaInvoke,
} from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CarbonAwareServerlessJobsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const carbonAwareComputingApiKeySecret = new Secret(
      this,
      "CarbonAwareComputingApiKey",
      {
        description:
          "API key for Carbon Aware Computing Forecast API (https://forecast.carbon-aware-computing.com/swagger/UI)",
      },
    );

    const getBestRenewableEnergyTimeWindowLambda = new NodejsFunction(
      this,
      "GetBestTimeWindow",
      {
        entry: "lib/carbon/GetBestRenewableEnergyTimeWindow.ts",
        handler: "handler",
        description:
          "Get the best time window to run a job based on the carbon intensity of the grid.",
        runtime: Runtime.NODEJS_18_X,
        tracing: Tracing.ACTIVE,
        memorySize: 512,
        environment: {
          CARBON_AWARE_COMPUTING_API_KEY_SECRET_NAME:
            carbonAwareComputingApiKeySecret.secretName,
        },
      },
    );

    carbonAwareComputingApiKeySecret.grantRead(
      getBestRenewableEnergyTimeWindowLambda,
    );

    const getStatus = new LambdaInvoke(
      this,
      "Get time window for best energy mix",
      {
        lambdaFunction: getBestRenewableEnergyTimeWindowLambda,
        resultPath: "$.bestTimeWindowOutput",
      },
    );

    const waitStep = new Wait(this, "Wait for time Window", {
      time: WaitTime.secondsPath(
        "$.bestTimeWindowOutput.Payload.waitTimeInSecondsForOptimalExecution",
      ),
    });

    const definition = getStatus.next(waitStep);

    new StateMachine(this, "Scheduler", {
      definition,
      stateMachineName: "CarbonAwareServerlessBatchJobsScheduler",
      tracingEnabled: true,
    });
  }
}
