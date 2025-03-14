import {
  Schedule,
  ScheduleExpression,
  ScheduleTargetInput,
} from "@aws-cdk/aws-scheduler-alpha";
import { SecretValue, Stack, StackProps } from "aws-cdk-lib";
import { Pass, Result } from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import { CarbonAwareComputingServerlessJobsConstruct } from "./carbon/carbon-aware-computing/CarbonAwareComputingServerlessJobsConstruct";
import { CarbonAwareTimeWindowPayload } from "./carbon/models/CarbonAwareTimeWindowPayload";
import { StepFunctionsStartExecution } from "@aws-cdk/aws-scheduler-targets-alpha";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";

export class CarbonAwareServerlessJobsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const carbonAwareComputingApiKey = SecretValue.secretsManager(
      "/carbon-aware-computing/api-key",
    );

    const fakeBatchJobTask = new Pass(this, "My long running batch job", {
      comment: "This is my long running batch job",
      inputPath: "$.batchJobInput",
      result: Result.fromObject({
        // This is the fake result of the batch job
        success: true,
      }),
    });

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

    new Schedule(this, "AtSchedule", {
      schedule: ScheduleExpression.at(new Date("2021-10-01T17:45:00Z")),
      target: scheduleTarget,
      scheduleName: "CarbonAwareComputingScheduleAT",
      description: `Onetime Schedule that invokes step function '${stateMachine.stateMachineName}'.`,
    });

    // new Schedule(this, "CronSchedule", {
    //   schedule: ScheduleExpression.cron({
    //     weekDay: "MON",
    //     hour: "19",
    //     minute: "45",
    //     timeZone: TimeZone.EUROPE_BERLIN,
    //   }),
    //   target: scheduleTarget,
    //   scheduleName: "CarbonAwareComputingScheduleCRON",
    //   description: `CRON based Schedule that invokes step function '${stateMachine.stateMachineName}'.`,
    // });
  }
}
