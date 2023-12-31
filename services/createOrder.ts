import * as AWS from 'aws-sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

export const handler: APIGatewayProxyHandler = async (event) => {


    console.log("##################### CREATE ORDER EVENT STARTS #########################");
    console.log(event);
    console.log("##################### CREATE ORDER EVENT ENDS #########################");

    try {
        const secret: string = (process.env.JWT) ? process.env.JWT : '';

        console.log("##################### JWT SECRET KEY #########################");
        console.log(secret);
        console.log("##################### JWT SECRET KEY ENDS #########################");

        const token = event.headers.Authorization || event.headers.authorization;

        console.log("##################### JWT TOKEN Starts #########################");
        console.log(token);
        console.log("##################### JWT TOKEN ENDS #########################");

        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ message: 'No token provided.' }) };
        }

        console.log("##################### JWT VERIFICATION #########################");
        jwt.verify(token, secret);
        console.log("##################### JWT VERIFICATION ENDS #########################");

        const body: any = (event.body)? JSON.parse(event.body) : '{}';

        console.log("##################### BODY STARTS #########################");
        console.log(body);
        console.log("##################### BODY ENDS #########################");

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

        const sqsUrl = (process.env.QUEUE_URL) ? process.env.QUEUE_URL : '';

        const params: AWS.SQS.SendMessageRequest = {
            MessageBody: JSON.stringify(body),
            QueueUrl: sqsUrl
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