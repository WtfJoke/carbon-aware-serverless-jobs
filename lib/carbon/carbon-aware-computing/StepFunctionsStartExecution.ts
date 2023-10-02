import {
  ScheduleTargetBase,
  ScheduleTargetBaseProps,
} from "@aws-cdk/aws-scheduler-targets-alpha";
import { IScheduleTarget, ISchedule } from "@aws-cdk/aws-scheduler-alpha";
import { IRole } from "aws-cdk-lib/aws-iam";
import { IStateMachine } from "aws-cdk-lib/aws-stepfunctions";
import { Names, Token, TokenComparison } from "aws-cdk-lib";

/**
 * Contribute this back to cdk "@aws-cdk/aws-scheduler-targets-alpha"
 * */
export class StepFunctionsStartExecution
  extends ScheduleTargetBase
  implements IScheduleTarget
{
  constructor(
    private readonly stateMachine: IStateMachine,
    private readonly props: ScheduleTargetBaseProps,
  ) {
    super(props, stateMachine.stateMachineArn);
  }

  protected addTargetActionToRole(schedule: ISchedule, role: IRole): void {
    const stateMachineEnv = this.stateMachine.env;
    if (!sameEnvDimension(stateMachineEnv.region, schedule.env.region)) {
      // prettier-ignore
      throw new Error(`Cannot assign stateMachine in region ${this.stateMachine.env.region} to the schedule ${Names.nodeUniqueId(schedule.node)} in region ${schedule.env.region}. Both the schedule and the stateMachine must be in the same region.`);
    }

    if (!sameEnvDimension(stateMachineEnv.account, schedule.env.account)) {
      // prettier-ignore
      throw new Error(`Cannot assign stateMachine in account ${this.stateMachine.env.account} to the schedule ${Names.nodeUniqueId(schedule.node)} in account ${schedule.env.region}. Both the schedule and the stateMachine must be in the same account.`);
    }

    // prettier-ignore
    if (this.props.role && !sameEnvDimension(this.props.role.env.account, stateMachineEnv.account)) {
        // prettier-ignore
        throw new Error(`Cannot grant permission to execution role in account ${this.props.role.env.account} to invoke target ${Names.nodeUniqueId(this.stateMachine.node)} in account ${this.stateMachine.env.account}. Both the target and the execution role must be in the same account.`);
      }

    this.stateMachine.grantStartExecution(role);
  }
}

function sameEnvDimension(dim1: string, dim2: string) {
  return [TokenComparison.SAME, TokenComparison.BOTH_UNRESOLVED].includes(
    Token.compareStrings(dim1, dim2),
  );
}
