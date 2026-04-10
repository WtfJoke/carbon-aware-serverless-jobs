import { Duration, SecretValue } from "aws-cdk-lib";
import { Authorization, Connection } from "aws-cdk-lib/aws-events";
import {
  DefinitionBody,
  IChainable,
  JitterType,
  LogOptions,
  StateMachine,
  TaskInput,
  Wait,
  WaitTime,
} from "aws-cdk-lib/aws-stepfunctions";
import { HttpInvoke } from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct } from "constructs";

export interface CarbonAwareComputingServerlessJobsConstructProps {
  apiKey: SecretValue;
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

    const apiRoot = "https://forecast.carbon-aware-computing.com";
    const apiPath = "emissions/forecasts/current";

    const connection = new Connection(this, "CarbonAwareComputingConnection", {
      authorization: Authorization.apiKey("x-api-key", apiKey),
      description: "https://www.carbon-aware-computing.com/",
    });

    const earliestDateTimeExpression =
       "$exists($states.input.earliestDateTime) ? $states.input.earliestDateTime : $now()";
    const latestStartInMillisecondsExpression =
      "$exists($states.input.latestStartInMinutes) ? $states.input.latestStartInMinutes * 60 * 1000 : 24 * 60 * 60 * 1000";

    const fetchBestTimeWindow = HttpInvoke.jsonata(
      this,
      "Fetch Best Time Window",
      {
        connection,
        apiRoot,
        apiEndpoint: TaskInput.fromText(apiPath),
        method: TaskInput.fromText("GET"),
        queryStringParameters: TaskInput.fromObject({
          location: "{% $states.input.location %}",
          dataStartAt: `{% ${earliestDateTimeExpression} %}`,
          dataEndAt: `{% $fromMillis($toMillis(${earliestDateTimeExpression}) + (${latestStartInMillisecondsExpression})) %}`,
        }),
        assign: {
          optimalTimeStamp:
            "{% $states.result.ResponseBody[0].optimalDataPoints[0].timestamp %}",
        },
      },
    );
    const waitStep = Wait.jsonata(this, "Wait for time Window", {
      time: WaitTime.timestamp("{% $optimalTimeStamp %}"),
    });

    const definitionBody = DefinitionBody.fromChainable(
      fetchBestTimeWindow.next(waitStep).next(batchJobTask),
    );

    this.stateMachine = new StateMachine(this, "Scheduler", {
      stateMachineName: "CarbonAwareServerlessBatchJobsScheduler",
      definitionBody,
      logs: logOptions,
      tracingEnabled: true,
    });
  }
}
