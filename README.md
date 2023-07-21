# Carbon Aware Serverless Jobs

This projects demonstrates how to decarbonize your batch jobs.
It utilizes API's to find the the best execution time window with minimal grid carbon intensity and combines it with serverless AWS services.

The infrastructure is deployed using [AWS CDK](https://aws.amazon.com/cdk/).

## Useful commands

- `yarn build` compile typescript to js
- `yarn watch` watch for changes and compile
- `yarn test` perform unit tests
- `yarn cdk deploy` deploy this stack to your default AWS account/region
- `yarn cdk diff` compare deployed stack with current state
- `yarn cdk synth` emits the synthesized CloudFormation template
