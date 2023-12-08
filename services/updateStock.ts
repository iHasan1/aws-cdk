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

exports.handler = async function(event: SQSEvent, context: Context){
    console.log("Event: ", JSON.stringify(event, null, 2));

    const secret = await getSecret();

    const dbusername = secret.username;
    const dbhost = secret.host;
    const dbpassword = secret.password;
    const dbdatabaseName = secret.dbname;
    const dbport = secret.port;

    let count = 0;

    for(const record of event.Records){

        const messageBody = JSON.parse(record.body);
        console.log("Count: ", count);
        console.log(messageBody);
        count++;

        let itemQuantity = 0;

        try {
            const connection = await mysql.createConnection({
                host: dbhost,
                user: dbusername,
                password: dbpassword,
                database: dbdatabaseName,
                port: dbport,
                connectTimeout: 30000
            });
    
            const [getItem, schema] = await connection.query(`Select * from Inventory where item_id=${messageBody.id}`);
            console.log('Item Details: ', getItem);

            if(getItem[0].quantity > 0){
                itemQuantity = +(+getItem[0].quantity - parseInt(messageBody.quantity))
                const setItem = await connection.query(`Update Inventory SET quantity=${itemQuantity} where item_id=${messageBody.id}`)
                if(setItem){
                    console.log(`Item with ID: ${messageBody.id} has its stock updated`)
                } else {
                    console.log(`Stock update failed for Item_ID: ${messageBody.id}`)
                }
            } else {
                console.log(`Item_ID: ${messageBody.id} has insufficient stocks.`)
            }
        
            connection.end();
        } catch (error) {
            console.log(error)
        }
    }

}