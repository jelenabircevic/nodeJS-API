/*
* Primary file for the API
*
*
*/

// Dependencies
const http = require('http');
const url = require('url');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');

// The server should respond to all requests with a string
const server = http.createServer((req, res) => {

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
            payload : bufferString
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
});

// Starting the server, and have it listen on port 3000
server.listen(config.port, () => {
    console.log(`The server is listening on port ${config.port} in ${config.envName} mode...`);
});

// Define the handlers
const handlers = {}

// Sample handler
handlers.sample = (data, callback) => {
    // Callback a http status code and a payload object
    callback(406, {'name' : 'sample handler'});
}

// Not found handler
handlers.notFound = (data, callback) => {
    callback(404);
};
 
// Define a request router
const router = {
    'sample' : handlers.sample
};