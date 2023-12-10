import * as AWS from 'aws-sdk';
import { APIGatewayProxyHandler } from 'aws-lambda';
import * as jwt from 'jsonwebtoken';
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const mysql = require('mysql2/promise');

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret(){
    const secretARN = process.env.SECRET_ARN;
    try {
        const response = await client.send(new GetSecretValueCommand({ SecretId: secretARN }));
        return JSON.parse(response.SecretString);
    } catch (error) {
        console.error("Error retriving secret:", error);
        throw error;
    }
}

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

export const handler: APIGatewayProxyHandler =  async (event) => {
    
    const jwtSecret: string = (process.env.JWT) ? process.env.JWT : '';
    const secret = await getSecret();

    // Extract the customer_id from the query string parameters
    const customerId = event.queryStringParameters?.customer_id;

    try {

        const token = event.headers.Authorization || event.headers.authorization;
        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ message: 'No token provided.' }) };
        }

        jwt.verify(token, jwtSecret);

        const connection = await mysql.createConnection({
            host: secret.host,
            user: secret.username,
            password: secret.password,
            database: secret.dbname,
            port: secret.port,
            connectTimeout: 30000
        });

        let getOrderQuery = `Select * from CustomerOrders where customer_id=${customerId}`

        const [result] = await connection.query(getOrderQuery);

        console.log(result);
        

        if(result){
            console.log("Fetched Successfully")
            return { statusCode: 200, body: JSON.stringify({ message: 'Success.', data: result }) };;
        }

        console.log("Fetched Failed")
        return { statusCode: 200, body: JSON.stringify({ message: 'No records found.', data: null }) };;


    } catch (error: any) {
        console.error('Error processing the request:', error);
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: invalid or expired token.' }) };
        } else if (error.code === 'CredentialsError' || error.code === 'AccessDeniedException') {
            return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error: Unable to access AWS resources.' }) };
        } else if (error.code === 'InvalidParameterException' || error.code === 'MissingRequiredParameter') {
            return { statusCode: 400, body: JSON.stringify({ message: 'Bad request: Missing or invalid parameters.' }) };
        }

        return { statusCode: 500, body: JSON.stringify({ message: 'Internal server error.' }) };
    }
}