import {
  Schedule,
  ScheduleExpression,
  ScheduleTargetInput,
} from "@aws-cdk/aws-scheduler-alpha";
import * as cdk from "aws-cdk-lib";
import { Duration } from "aws-cdk-lib";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Pass, Result } from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import { CarbonAwareComputingServerlessJobsConstruct } from "./carbon/carbon-aware-computing/CarbonAwareComputingServleressJobsConstruct";
import { StepFunctionsStartExecution } from "./carbon/carbon-aware-computing/StepFunctionsStartExecution";
import { CarbonAwareTimeWindowPayload } from "./carbon/models";

export class CarbonAwareServerlessJobsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fakeBatchJobTask = new Pass(this, "My long running batch job", {
      comment: "This is my long running batch job",
      inputPath: "$.batchJobInput",
      result: Result.fromObject({
        // This is the fake result of the batch job
        success: true,
      }),
    });

    const carbonAwareComputingApiKey =
      StringParameter.fromSecureStringParameterAttributes(
        this,
        "CarbonAwareComputingApiKeyString",
        {
          parameterName: "/carbon-aware-computing/api-key",
        },
      );

    const stateMachine = new CarbonAwareComputingServerlessJobsConstruct(
      this,
      "CarbonAwareComputing",
      {
        apiKey: carbonAwareComputingApiKey,
        batchJobTask: fakeBatchJobTask,
      },
    ).stateMachine;

    const stateMachinePayload: CarbonAwareTimeWindowPayload = {
      location: "de",
      earliestDateTime: "<aws.scheduler.scheduled-time>", // Adds the EventBridge schedule time to the payload, see https://docs.aws.amazon.com/scheduler/latest/UserGuide/managing-schedule-context-attributes.html
      latestStartInMinutes: 120,
    };

    const scheduleTarget = new StepFunctionsStartExecution(stateMachine, {
      input: ScheduleTargetInput.fromObject(stateMachinePayload),
    });

    // new Schedule(this, "RateSchedule", {
    //   scheduleName: "CarbonAwareComputingScheduleRate",
    //   schedule: ScheduleExpression.rate(Duration.minutes(10)),
    //   target: scheduleTarget,
    //   description: `Rate based schedule that invokes step function '${stateMachine.stateMachineName}'.`,
    // });

    new Schedule(this, "CronSchedule", {
      scheduleName: "CarbonAwareComputingScheduleCRON",
      schedule: ScheduleExpression.cron({
        weekDay: "MON",
        hour: "19",
        minute: "45",
        timeZone: cdk.TimeZone.EUROPE_BERLIN,
      }),
      target: scheduleTarget,
      description: `CRON based Schedule that invokes step function '${stateMachine.stateMachineName}'.`,
    });

    new Schedule(this, "AtSchedule", {
      scheduleName: "CarbonAwareComputingScheduleAT",
      schedule: ScheduleExpression.at(new Date("2021-10-01T17:45:00Z")),
      target: scheduleTarget,
      description: `Onetime Schedule that invokes step function '${stateMachine.stateMachineName}'.`,
    });
  }
}
