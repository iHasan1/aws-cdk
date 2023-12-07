// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
// Refer to documentation for creating Lambda Function

import * as AWS from 'aws-sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';


const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });
const secretsManager = new AWS.SecretsManager();

interface Secret {
    jwtSecret: string;
    sqsQueueUrl: string;
}

async function getSecret(secretName: string): Promise<Secret> {
    const data: any = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    if ('SecretString' in data) {
        return JSON.parse(data.SecretString);
    }
    throw new Error('Secret not found or is not a string');
}

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        const secret = await getSecret('MySecretName');

        const token = event.headers.Authorization || event.headers.authorization;
        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ message: 'No token provided.' }) };
        }

        jwt.verify(token, secret.jwtSecret);

        const body = JSON.parse(event.body || '{}');
        if (!body.order_id || !body.customer_id || !body.order_date || !body.amount) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Bad request: Missing required fields.' }) };
        }

        if (typeof body.orderItems !== 'object' || Object.keys(body.orderItems).length === 0) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Bad request: orderItems must be a non-empty object.' }) };
        }

        for (const itemId in body.orderItems) {
            if (!body.orderItems[itemId].id || !body.orderItems[itemId].quantity) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Bad request: Each item must have an id and quantity.' }) };
            }
        }

        const params: AWS.SQS.SendMessageRequest = {
            MessageBody: JSON.stringify(body),
            QueueUrl: secret.sqsQueueUrl,
        };

        await sqs.sendMessage(params).promise();

        return { statusCode: 200, body: JSON.stringify({ message: 'Order received successfully.' }) };

    } catch (error: any) {
        console.error('Error processing the request:', error);

        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: invalid or expired token.' }) };
        } else if (error.name === 'SyntaxError') {
            return { statusCode: 400, body: JSON.stringify({ message: 'Bad request: Invalid JSON in the payload.' }) };
        } else if (error.code === 'CredentialsError' || error.code === 'AccessDeniedException') {
            return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error: Unable to access AWS resources.' }) };
        } else if (error.code === 'InvalidParameterException' || error.code === 'MissingRequiredParameter') {
            return { statusCode: 400, body: JSON.stringify({ message: 'Bad request: Missing or invalid parameters.' }) };
        }

        return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error.' }) };
    }
};


// exports.handler = async function (event: any) {
//     return 'Create Order Service Called';
// };