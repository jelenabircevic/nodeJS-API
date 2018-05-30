/*
* Create and export configuration variables
*
*/

// Container for all the environments
const environments = {};

// Staging environment (default)
environments.staging = {
    port: 3000,
    envName: 'staging'
};

// Production environment
environments.production = {
    port: 5050,
    envName: 'production'
};

// Determine which argument was passed as a command-line argument
let currentEnv = typeof process.env.NODE_ENV === 'string' ? process.env.NODE_ENV.toLowerCase() : '';

// Check that the current environment is one of the defined, if not, default to staging
let envToExport = typeof environments[currentEnv] === 'object' ? environments[currentEnv] : environments.staging;

// Export the module
module.exports = envToExport;