import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { CarbonAwareServerlessJobsStack } from "../lib/CarbonAwareServerlessJobsStack";

test("step function created", () => {
  const app = new cdk.App();
  // WHEN
  const stack = new CarbonAwareServerlessJobsStack(app, "MyTestStack");
  // THEN
  const template = Template.fromStack(stack);
  template.hasResource("AWS::StepFunctions::StateMachine", {});
});
