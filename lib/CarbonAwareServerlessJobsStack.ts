import * as cdk from "aws-cdk-lib";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import { Pass } from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import { CarbonAwareComputingServerlessJobsConstruct } from "./carbon/carbon-aware-computing/CarbonAwareComputingServleressJobsConstruct";

export class CarbonAwareServerlessJobsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fakeBatchJobTask = new Pass(this, "My long running batch job", {
      comment: "This is my long running batch job",
      resultPath: "$.batchJobOutput",
    });

    const carbonAwareComputingApiKey =
      StringParameter.fromSecureStringParameterAttributes(
        this,
        "CarbonAwareComputingApiKeyString",
        {
          parameterName: "/carbon-aware-computing/api-key",
        },
      );

    new CarbonAwareComputingServerlessJobsConstruct(
      this,
      "CarbonAwareComputing",
      {
        apiKey: carbonAwareComputingApiKey,
        batchJobTask: fakeBatchJobTask,
      },
    );
  }
}
