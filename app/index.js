/*
* Primary file for the API
*
*
*/

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

// App
const app = {};

app.init = () => {
    // Start the server
    server.init();

    // Start the workers
    workers.init();
}

app.init();

// Export the module
module.exports = app;