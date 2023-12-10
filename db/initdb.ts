const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const mysql = require('mysql2/promise');

const client = new SecretsManagerClient({ region: "us-east-1" });

async function getSecret() {
    const secretARN = process.env.SECRET_ARN;
    try {
        const response = await client.send(new GetSecretValueCommand({ SecretId: secretARN }));
        return JSON.parse(response.SecretString);
    } catch (error) {
        console.error("Error retriving secret:", error);
        throw error;
    }
}

exports.handler = async function (event: any, context: any) {

    const secret = await getSecret();

    const dbusername = secret.username;
    const dbhost = secret.host;
    const dbpassword = secret.password;
    const dbdatabaseName = secret.dbname;
    const dbport = secret.port;

    const customerOrder = `
        CREATE TABLE IF NOT EXISTS CustomerOrders (
            order_id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            order_date DATETIME NOT NULL,
            orderItems JSON NOT NULL,
            status VARCHAR(100),
            amount INT NOT NULL
        );
    `;

    const inventory = `
        CREATE TABLE IF NOT EXISTS Inventory (
            item_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            quantity INT NOT NULL,
            unit_price INT NOT NULL,
            description TEXT NOT NULL
        );
    `;

    // const createInventoryEntries = `INSERT INTO Inventory
    // (name, quantity, unit_price, description)
    // VALUES
    // ('Blue Toy', 100, 10, 'A blue toy'),
    // ('Red Toy', 100, 15, 'A red toy'),
    // ('Yellow Toy', 100, 20, 'A yellow toy')`;

    try {

        const connection = await mysql.createConnection({
            host: dbhost,
            user: dbusername,
            password: dbpassword,
            database: dbdatabaseName,
            port: dbport,
            connectTimeout: 30000
        });

        const customerOrderResult = await connection.query(customerOrder);
        console.log('Customer Order Schema initialized successfully');

        const inventoryResult = await connection.query(inventory);
        console.log('Inventory Schema initialized successfully');

        // const insertInventory = await connection.query(createInventoryEntries);
        // console.log('Inventory inserted successfully');

        connection.end();

        return { statusCode: 200, body: JSON.stringify({ message: 'Success in initializing database' }) };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Error initializing database' }) };
    }
};