import * as cdk from "aws-cdk-lib";
import { Architecture, Runtime, Tracing } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { StateMachine, Wait, WaitTime } from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";

export class CarbonAwareServerlessJobsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const carbonAwareComputingApiKey =
      StringParameter.fromSecureStringParameterAttributes(
        this,
        "CarbonAwareComputingApiKeyString",
        {
          parameterName: "/carbon-aware-computing/api-key",
        },
      );

    const getBestRenewableEnergyTimeWindowLambda = new NodejsFunction(
      this,
      "GetBestTimeWindow",
      {
        entry:
          "lib/carbon/carbon-aware-computing/GetBestRenewableEnergyTimeWindow.ts",
        handler: "handler",
        description:
          "Get the best time window to run a job based on the carbon intensity of the grid using the API of https://www.carbon-aware-computing.com/.",
        runtime: Runtime.NODEJS_18_X,
        tracing: Tracing.ACTIVE,
        memorySize: 512,
        architecture: Architecture.ARM_64,
        environment: {
          CARBON_AWARE_COMPUTING_API_KEY_SECURE_STRING_PARAMETER_NAME:
            carbonAwareComputingApiKey.parameterName,
        },
      },
    );

    carbonAwareComputingApiKey.grantRead(
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
      stateMachineName: "CarbonAwareServerlessCACBatchJobsScheduler",
      tracingEnabled: true,
    });
  }
}
