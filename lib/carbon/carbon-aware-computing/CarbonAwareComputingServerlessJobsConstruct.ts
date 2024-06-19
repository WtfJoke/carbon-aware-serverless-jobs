import { IStringParameter } from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { Runtime, Tracing, Architecture } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  Wait,
  WaitTime,
  DefinitionBody,
  StateMachine,
  IChainable,
  LogOptions,
} from "aws-cdk-lib/aws-stepfunctions";
import { LambdaInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";

interface CarbonAwareComputingServerlessJobsConstructProps {
  apiKey: IStringParameter;
  batchJobTask: IChainable;
  logOptions?: LogOptions;
}

export class CarbonAwareComputingServerlessJobsConstruct extends Construct {
  readonly stateMachine: StateMachine;
  constructor(
    scope: Construct,
    id: string,
    props: CarbonAwareComputingServerlessJobsConstructProps,
  ) {
    super(scope, id);
    const { apiKey, batchJobTask, logOptions } = props;

    const getBestRenewableEnergyTimeWindowLambda = new NodejsFunction(
      this,
      "GetBestTimeWindow",
      {
        entry:
          "lib/carbon/carbon-aware-computing/GetBestRenewableEnergyTimeWindow.ts",
        handler: "handler",
        description:
          "Get the best time window to run a job based on the carbon intensity of the grid using the API of https://www.carbon-aware-computing.com/.",
        runtime: Runtime.NODEJS_LATEST,
        tracing: Tracing.ACTIVE,
        memorySize: 512,
        architecture: Architecture.ARM_64,
        environment: {
          CARBON_AWARE_COMPUTING_API_KEY_SECURE_STRING_PARAMETER_NAME:
            apiKey.parameterName,
        },
      },
    );

    apiKey.grantRead(getBestRenewableEnergyTimeWindowLambda);

    const getStatus = new LambdaInvoke(
      this,
      "Get time window for best energy mix",
      {
        lambdaFunction: getBestRenewableEnergyTimeWindowLambda,
        outputPath: "$.Payload",
      },
    );

    const waitStep = new Wait(this, "Wait for time Window", {
      time: WaitTime.secondsPath("$.waitTimeInSecondsForOptimalExecution"),
    });

    const definitionBody = DefinitionBody.fromChainable(
      getStatus.next(waitStep).next(batchJobTask),
    );

    this.stateMachine = new StateMachine(this, "Scheduler", {
      stateMachineName: "CarbonAwareServerlessCACBatchJobsScheduler",
      definitionBody,
      logs: logOptions,
      tracingEnabled: true,
    });
  }
}
