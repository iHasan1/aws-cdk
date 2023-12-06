const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const mysql = require('mysql2');


exports.handler = async function (event: any, context: any) {
    const secret_name = "orderDBSecret9E787992-wX3P9i5cNcSa";

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

    const customerOrder = `
        CREATE TABLE CustomerOrders (
            order_id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            order_date DATE NOT NULL,
            orderItems JSON NOT NULL,
            status VARCHAR(100),
            amount INT NOT NULL
        );
    `;

    const inventory = `
        CREATE TABLE Inventory (
            item_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            quantity INT NOT NULL,
            unit_price INT NOT NULL,
            description TEXT NOT NULL
        );
    `;


    const connection = mysql.createConnection({
        host: host,
        user: username,
        password: password,
        database: databaseName,
        port: port
    });

    connection.connect(function (err: any) {
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }
        console.log('connected as id ' + connection.threadId);
    });

    // console.log("Connection Started");

    connection.query(customerOrder, (error: any, results: any, fields: any) => {
        if (error) throw error;
        console.log('Customer Order Schema initialized successfully');
    });

    connection.query(inventory, (error: any, results: any, fields: any) => {
        if (error) throw error;
        console.log('Inventory Schema initialized successfully');
    });

    connection.end();

    // console.log("Connection Endded")
};
