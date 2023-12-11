# This is a Demo Project made using AWS CDK as Infrastructure as Code.

## Prerequisites

1. Have AWS CLI Installed on your Local machine

2. Have node version 18 or greater available on Local machine

3. Have AWS CDK Installed on your local machine

## Steps to Recreate

1. Configure your AWS account by typing the command `aws configure` on command line and providing your secret access key generated through the AWS Console.

2. Open the Project and inside the `layer` & `db` folder find nodejs folder. Run `npm i` inside each folder to create the node modules.

3. On the root directory, run the command `npm run build`. This compiles the typescript files to Javascript.

4. If you are deploying for the first time, you need to run `cdk bootstrap`

5. Run `cdk synth` that creates the CloudFormation template

6. Run `cdk deploy` to deploy your project onto the AWS Cloud.
