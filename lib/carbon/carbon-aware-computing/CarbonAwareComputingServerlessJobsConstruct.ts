import { SecretValue } from "aws-cdk-lib";
import { Authorization, Connection } from "aws-cdk-lib/aws-events";
import { Policy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import {
	CustomState,
	DefinitionBody,
	IChainable,
	LogOptions,
	StateMachine,
} from "aws-cdk-lib/aws-stepfunctions";
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

		const apiEndpoint =
			"https://forecast.carbon-aware-computing.com/emissions/forecasts/current";

		const connection = new Connection(this, "CarbonAwareComputingConnection", {
			authorization: Authorization.apiKey("x-api-key", apiKey),
			description: "https://www.carbon-aware-computing.com/",
		});
		const connectionSecret = Secret.fromSecretCompleteArn(
			this,
			"CarbonAwareComputingConnectionSecret",
			connection.connectionSecretArn,
		);
		const earliestDateTimeExpression =
			"$fromMillis($toMillis($exists($states.input.earliestDateTime) ? $states.input.earliestDateTime : $now()))";
		const latestStartInMillisecondsExpression =
			"$exists($states.input.latestStartInMinutes) ? $states.input.latestStartInMinutes * 60 * 1000 : 24 * 60 * 60 * 1000";
		const fetchBestTimeWindow = new CustomState(
			this,
			"Fetch Best Time Window",
			{
				stateJson: {
					QueryLanguage: "JSONata",
					Type: "Task",
					Resource: "arn:aws:states:::http:invoke",
					Arguments: {
						ApiEndpoint: apiEndpoint,
						Method: "GET",
						Authentication: {
							ConnectionArn: connection.connectionArn,
						},
						QueryParameters: {
							location: "{% $states.input.location %}",
							dataStartAt: `{% ${earliestDateTimeExpression} %}`,
							dataEndAt: `{% $fromMillis($toMillis(${earliestDateTimeExpression}) + (${latestStartInMillisecondsExpression})) %}`,
						},
					},
					Retry: [
						{
							ErrorEquals: ["States.ALL"],
							BackoffRate: 2,
							IntervalSeconds: 1,
							MaxAttempts: 3,
							JitterStrategy: "FULL",
						},
					],
					Assign: {
						optimalTimeStamp:
							"{% $states.result.ResponseBody[0].optimalDataPoints[0].timestamp %}",
					},
				},
			},
		);

		const waitStep = new CustomState(this, "Wait for time Window", {
			stateJson: {
				QueryLanguage: "JSONata",
				Type: "Wait",
				Timestamp: "{% $optimalTimeStamp %}",
			},
		});

		const definitionBody = DefinitionBody.fromChainable(
			fetchBestTimeWindow.next(waitStep).next(batchJobTask),
		);

		this.stateMachine = new StateMachine(this, "Scheduler", {
			stateMachineName: "CarbonAwareServerlessCACBatchJobsScheduler",
			definitionBody,
			logs: logOptions,
			tracingEnabled: true,
		});

		connectionSecret.grantRead(this.stateMachine);
		this.stateMachine.role.attachInlinePolicy(
			new Policy(this, "InvokeHttpEndpointPolicy", {
				statements: [
					new PolicyStatement({
						sid: "AllowInvokeHttpEndpoint",
						actions: ["states:InvokeHTTPEndpoint"],
						resources: [this.stateMachine.stateMachineArn],
						conditions: {
							StringEquals: {
								"states:HTTPEndpoint": [apiEndpoint],
								"states:HTTPMethod": ["GET"],
							},
						},
					}),
					new PolicyStatement({
						sid: "RetrieveConnectionCredentials",
						actions: ["events:RetrieveConnectionCredentials"],
						resources: [connection.connectionArn],
					}),
				],
			}),
		);
	}
}
