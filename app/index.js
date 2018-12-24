/*
* Primary file for the API
*
*
*/

// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./lib/config');
const fs = require('fs');
const handlers = require('./lib/handlers');
const helpers = require('./lib/helpers');

// Instantiate the HTTP server
const httpServer = http.createServer((req, res) => {
    unifiedServer(req, res);
});

// Starting the HTTP server
httpServer.listen(config.httpPort, () => {
    console.log(`The server is listening on port ${config.httpPort}...`);
});

// Instantiate the HTTPS server
const httpsServerOptions = {
    key: fs.readFileSync('./https/key.pem'),
    cert: fs.readFileSync('./https/cert.pem')
};
const httpsServer = https.createServer(httpsServerOptions, (req, res) => {
    unifiedServer(req, res);
});

// Starting the HTTPS server
httpsServer.listen(config.httpsPort, () => {
    console.log(`The server is listening on port ${config.httpsPort}...`);
});

// All the server logic for both the http and https server
const unifiedServer = (req, res) => {

    // Get the URL and parse it
    let parsedUrl = url.parse(req.url, true);

    // Get the path
    let path = parsedUrl.pathname;
    let trimmedPath = path.replace(/^\/+|\/+$/g, '');

    // Get the query string as an object
    let queryStringObject = parsedUrl.query;

    // Get the HTTP method
    let method = req.method.toLocaleLowerCase();

    // Get the headers as an object
    let headers = req.headers;

    // Get the payload, if any
    let decoder = new StringDecoder('utf-8');
    let bufferString = '';
    req.on('data', (data) => {
        bufferString += decoder.write(data);
    });
    req.on('end', () => {
        bufferString += decoder.end();

        // Chose the handler this request should go to. If one is not found, go to notFound handler
        let chosenHandler = typeof router[trimmedPath] !== 'undefined' ? router[trimmedPath] : handlers.notFound;
        
        // Construct the handler object to send to the handler
        let data = {
            trimmedPath,
            queryStringObject,
            method,
            headers,
            payload : helpers.parseJsonToObject(bufferString)
        };

        // Route the request to the handler specified in the router
        chosenHandler(data, (statusCode, payload) => {
            // Use the status code called back from the handler, or default to 200
            statusCode = typeof statusCode === 'number' ? statusCode : 200;

            // Use the payload called back from the handler, or default to an empty object
            payload = typeof payload === 'object' ? payload : {};

            // Convert the payload to a string
            let payloadString = JSON.stringify(payload);

            // Return the response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);

            // Log the request path
            console.log(`Returning this response:`, statusCode, payloadString);
        });

    
    });    

};
 
// Define a request router
const router = {
    ping : handlers.ping,
    users: handlers.users,
    tokens: handlers.tokens
};