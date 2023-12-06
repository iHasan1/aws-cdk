import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class BeamAiStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Getting Default VPC to host RDS Instance in.
    const defaultVPC = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
      isDefault: true
    });

    // Creating Secret Key For Database.
    const dbSecret = new secretmanager.Secret(this, 'orderDBSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'dbuser' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        includeSpace: false
      }
    });

    // Creating Lambda Function for CreatOrder Service
    const createOrder = new lambda.Function(this, 'createOrder', {
      runtime: lambda.Runtime.NODEJS_18_X,
      //Handler refers to the file stored in local files.
      handler: 'createOrder.handler',
      //fromAsset used to load local files as Lambda Handler.
      code: lambda.Code.fromAsset('./services'),
      description: 'This Create Order Function is Creating New Order, Code from Local Storage.'
    });

    const processOrder = new lambda.Function(this, 'processOrder', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'processOrder.handler',
      code: lambda.Code.fromAsset('./services'),
      description: 'This Process Order Function is Processing Order, Code from Local storage.'
    });

    const updateStock = new lambda.Function(this, 'updateStock', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'updateStock.handler',
      code: lambda.Code.fromAsset('./services'),
      description: 'This Update Stock Function is Updating Database Stock, Code from Local storage'
    });

    const getOrder = new lambda.Function(this, 'getOrder', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'getOrder.handler',
      code: lambda.Code.fromAsset('./services'),
      description: 'This Gets the Customer Orders from the Database, Code from Local Storage'
    });

    // Defining RDS Instance - MySQL
    const orderDBInstance = new rds.DatabaseInstance(this, 'orderDB', {
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0
      }),
      vpc: defaultVPC,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC
      },
      databaseName: 'orderManagmentDB',
      credentials: rds.Credentials.fromSecret(dbSecret)
    });

    // Creating New Layer to Attach to Init Lambda Function
    const layer = new lambda.LayerVersion(this, 'initDBLayer', {
      removalPolicy: RemovalPolicy.DESTROY,
      code: lambda.Code.fromAsset('./layers')
    });

    // Defining MySQL Schema Using Lambda Functions
    const dbInItLambda = new lambda.SingletonFunction(this, 'dbInitLambda', {
      uuid: 'ff97bb46-28ea-4375-ba35-07529a8ec462',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'initdb.handler',
      code: lambda.Code.fromAsset('./db'),
      timeout: Duration.minutes(5),
      layers: [layer]
    });

    // Give the Lambda function permissions to read the secret
    dbSecret.grantRead(dbInItLambda);

    // Define a Custom Resource that will invoke the SingletonFunction
    const dbSchemaInitCustomResource = new customResources.AwsCustomResource(this, 'DbSchemaInitCustomResource', {
      onCreate: { // You can also use onUpdate or onDelete if needed
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: dbInItLambda.functionName,
          // Include additional parameters if needed
        },
        physicalResourceId: customResources.PhysicalResourceId.of('ff97bb4628ea4375ba35075-xsHoGPdFl4Js') // Use the log result as the ID
      },
      policy: customResources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [dbInItLambda.functionArn]
        })
      ]),
      installLatestAwsSdk: true
    });

    // Make sure the Lambda is invoked only after being created
    dbSchemaInitCustomResource.node.addDependency(dbInItLambda);




    //Creating Queues using SQS
    const orderQueue = new sqs.Queue(this, 'orderQueue', {
      queueName: 'orderQueue'
    });

    const processQueue = new sqs.Queue(this, 'processQueue', {
      queueName: 'processQueue'
    });

    // Creating REST API Gateway.
    const orderAPIGateway = new apigateway.RestApi(this, 'orderAPIGateway', {
      restApiName: 'orderAPIGateway',
      description: 'This is the API Gateway for Order Managment System'
    });

    // Define Resource and Methods
    const items = orderAPIGateway.root.addResource('items');
    items.addMethod('GET');
    items.addMethod('POST');

    // Giving RDS the Permission to Get Secret from Secret Manager
    // dbSecret.grantRead(new iam.ServicePrincipal('rds.amazonaws.com'));
  }
}
