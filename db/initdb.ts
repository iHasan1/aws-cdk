const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const AWS = require('aws-sdk');
const mysql = require('mysql2');


exports.handler = async function(event: any, context: any) {
    const secret_name = "orderDBSecret9E787992-cU0F4xMroIDB";

    const client = new SecretsManagerClient({
    region: "us-east-1",
    });

    let response;

    try {
    response = await client.send(
        new GetSecretValueCommand({
        SecretId: secret_name,
        VersionStage: "AWSCURRENT",
        })
    );
    } catch (error) {
        
    throw error;
    }

    const secret = response.SecretString;

    const secretDB = JSON.parse(secret);

    const username = secretDB.username;
    const host = secretDB.host;
    const password = secretDB.password;
    const databaseName = secretDB.dbname;
    const port = secretDB.port;

    const sqlScript = `
        SELECT VERSION() AS MySQLVersion;
    `;

    const connection = mysql.createConnection({
        host: host,
        user: username,
        password: password,
        database: databaseName,
        port: port
    })

    
    connection.connect(function(err: any) {  
        if (err) {    
            console.error('error connecting: ' + err.stack);
            return;
        }   
        console.log('connected as id ' + connection.threadId);
    });

    // console.log("Connection Started");

    connection.query(sqlScript, (error: any, results: any, fields: any) => {
        if (error) throw error;
        console.log('Schema initialized successfully');
    });

    connection.end();

    // console.log("Connection Endded")
}
