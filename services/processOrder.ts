// https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
// Refer to documentation for creating Lambda Function
import {SQSEvent, Context } from 'aws-lambda'
import * as AWS from 'aws-sdk';
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

exports.handler = async function(event: SQSEvent, context: Context){
    console.log("Event: ", JSON.stringify(event, null, 2));

    const secret = await getSecret();

    const dbusername = secret.username;
    const dbhost = secret.host;
    const dbpassword = secret.password;
    const dbdatabaseName = secret.dbname;
    const dbport = secret.port;

    for (const record of event.Records) {
        const messageBody = JSON.parse(record.body);
        const orderItems = messageBody.orderItems;

        if (orderItems && typeof orderItems === 'object') {
            for (const itemId in orderItems) {
                if (orderItems.hasOwnProperty(itemId)) {
                    const itemDetails = orderItems[itemId];

                    // Construct the payload for each item
                    const itemPayload = {
                        id: itemDetails.id,
                        quantity: itemDetails.quantity
                    };

                    const sqsUrl = (process.env.QUEUE_URL) ? process.env.QUEUE_URL : '';

                    // Send each item to the process queue
                    const params: AWS.SQS.SendMessageRequest = {
                        MessageBody: JSON.stringify(itemPayload),
                        QueueUrl: sqsUrl,
                    };

                    try {
                        await sqs.sendMessage(params).promise();
                        console.log(`Item ${itemId} sent to the process queue.`);

                        const connection = await mysql.createConnection({
                            host: dbhost,
                            user: dbusername,
                            password: dbpassword,
                            database: dbdatabaseName,
                            port: dbport,
                            connectTimeout: 30000
                        });

                        const insertQuery = `INSERT INTO CustomerOrders (order_id, customer_id, order_date, orderItems, status, amount) VALUES (${messageBody.order_id}, ${messageBody.customer_id}, '${new Date().toISOString().slice(0, 19).replace('T', ' ')}', '${JSON.stringify(messageBody.orderItems)}', 'Pending', ${messageBody.amount})`;

                        console.log("Printed Query",insertQuery);
                        

                        // Execute the insert query
                        const [result] = await connection.query(insertQuery);

                        if(result){
                            console.log("Order Created");
                        } else {
                            console.log("Order Failed");                            
                        }

                        connection.end()


                    } catch (error) {
                        console.error(`Error sending item ${itemId} to the process queue:`, error);
                        // Handle the error appropriately
                    }
                }
            }
        }
    }
}