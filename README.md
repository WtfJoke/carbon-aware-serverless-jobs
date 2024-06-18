# Carbon Aware Serverless Jobs

This projects demonstrates how to decarbonize your batch jobs.
It utilizes API's to find the the best execution time window with minimal grid carbon intensity and combines it with serverless AWS services.

The infrastructure is deployed using [AWS CDK](https://aws.amazon.com/cdk/).

## Architecture

![architecturecarbonawareserverless](https://github.com/WtfJoke/carbon-aware-serverless-jobs/assets/7139697/9e37b43b-3ad2-41da-85bb-0bcdfb4eef47)

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform unit tests
- `npm run cdk deploy` deploy this stack to your default AWS account/region
- `npm run cdk diff` compare deployed stack with current state
- `npm run cdk synth` emits the synthesized CloudFormation template

# What do I need in order to deploy this?

1. An [AWS](https://aws.amazon.com/account/) account.
2. An API key for https://carbon-aware-computing.com, see [API-Docs](https://forecast.carbon-aware-computing.com/swagger/UI)
3. Store API Key from Step 2 in your AWS accounts [Parameter-Store](https://eu-central-1.console.aws.amazon.com/systems-manager/parameters) with `type=SecureString` under the name `/carbon-aware-computing/api-key`

# How do I deploy this?

1. Install the latest LTS [NodeJs](https://nodejs.org/en) or [Nvm](https://github.com/nvm-sh/nvm)
2. Clone this project
3. Install dependencies using `npm install`
4. Login to your AWS Account using the [AWS CLI](https://aws.amazon.com/cli/)
5. Deploy this cdk stack with `npm run cdk deploy`
6. Execute the step function `CarbonAwareServerlessCACBatchJobsScheduler`
