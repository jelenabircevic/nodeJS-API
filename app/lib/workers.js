/*
 * Worker related tasks
 *
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const http = require('http');
const https = require('https');
const helpers = require('./helpers');
const url = require('url');

// Instantiate the workers object
const workers = {};

// Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = () => {
    // Get all the checks
    _data.list('checks', (err, checks) => {
        if(!err && checks && checks.length) {
            checks.forEach(check => {
                // Read in the check data by passing the check name
                _data.read('checks', check, (err, originalCheckData) => {
                    if(!err && originalCheckData) {
                        // Pass it to the check validator, and let that function continue or log error
                        workers.validateCheckData(originalCheckData);
                    } else {
                        console.log('Error reading one of the check\'s data');
                    }
                });
            });
        } else {
            console.log('Error: Could not find any checks to process');
        }
    })
}

// Sanity-check the check-data
workers.validateCheckData = (originalCheckData) => {
    originalCheckData = typeof originalCheckData === 'object' && originalCheckData !== null ? originalCheckData : false;
    originalCheckData.id = typeof originalCheckData.id === 'string' &&originalCheckData.id.trim().length === 20 ? originalCheckData.id.trim() : false;
    originalCheckData.userPhone = typeof originalCheckData.userPhone === 'string' && originalCheckData.userPhone.trim().length === 10 ? originalCheckData.userPhone.trim() : false;
    originalCheckData.protocol = typeof originalCheckData.protocol === 'string' && ['http', 'https'].indexOf(originalCheckData.protocol) !== -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof originalCheckData.url === 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof originalCheckData.method === 'string' && ['get', 'post', 'put', 'delete'].indexOf(originalCheckData.method) !== -1 ? originalCheckData.method : false;
    originalCheckData.successCodes = typeof originalCheckData.successCodes === 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
    originalCheckData.timeoutSeconds = typeof originalCheckData.timeoutSeconds === 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;
    
    // Set the keys that may not be set if the workers have never seen this check
    originalCheckData.state = typeof originalCheckData.state === 'string' && ['up', 'down'].indexOf(originalCheckData.state) !== -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof originalCheckData.lastChecked === 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.timeoutSeconds : false;

    // if all the checks pass, pass the data along to the next step in the process
    if(originalCheckData.id &&
        originalCheckData.userPhone &&
        originalCheckData.protocol &&
        originalCheckData.url &&
        originalCheckData.method &&
        originalCheckData.successCodes &&
        originalCheckData.timeoutSeconds) {
            workers.performCheck(originalCheckData);
        } else {
            console.log('Error: one of the checks is not properly formatted. Skipping it')
        }
}

// Perfom the check, send the originalCheckData and the outcome of the check process to the next step in the process
workers.performCheck = (data) => {
    // Prepare initial checks outcome
    const checkOutcome = {
        error: false,
        responseCode: false
    };

    // Mark that the outcome has not been sent yet
    let outcomeSent = false;

    // Parse the hostname and the path out of the originalCheckData
    const parsedUrl = url.parse(`${data.protocol}://${data.url}`, true);
    const hostName = parsedUrl.hostname;
    const path = parsedUrl.path; // Using path not "pathname" because we want the query string

    // Constructing the request
    const requestDetails = {
        protocol: `${data.protocol}:`,
        hostname: hostName,
        method: data.method.toUpperCase(),
        path,
        timeout: data.timeoutSeconds * 1000
    }

    // Instatiate the request object using http or https module
    const _moduleToUse = data.protocol === 'http' ? http : https;
    const req = _moduleToUse.request(requestDetails, res => {
        // Grab the status of the sent request
        const status = res.statusCode;

        // Update the checkOutcome and pass the data along
        checkOutcome.responseCode = status;
        if(!outcomeSent) {
            workers.processCheckOutcome(data, checkOutcome);
            outcomeSent = true;
        }
    });
    
    // Bind to the error event so it doesn't get thrown
    req.on('error', e => {
        // Update the checkOutcome and pass the data along
        checkOutcome.error = {
            error: true,
            value: e
        };
        if(!outcomeSent) {
            workers.processCheckOutcome(data, checkOutcome);
            outcomeSent = true;
        }
    });
    
    // Bind to the timeout event
    req.on('timeout', e => {
        // Update the checkOutcome and pass the data along
        checkOutcome.error = {
            error: true,
            value: 'timeout'
        };
        if(!outcomeSent) {
            workers.processCheckOutcome(data, checkOutcome);
            outcomeSent = true;
        }
    });

    // End the request
    req.end();
}

// Process the check outcome, update the check data, trigger an alert if needed
// Special logic for for accomodating a check that has never  been tested before
workers.processCheckOutcome = (data, checkOutcome) => {
    // Decide if the check is considered up or down
    const state = !checkOutcome.error && checkOutcome.responseCode && data.successCodes.indexOf(checkOutcome.responseCode) !== -1 ? 'up' : 'down';

    // Decide if an alert is wanted
    const alertWanted = data.lastChecked && data.state !== state ? true : false;

    // Update the check data
    const newCheckData = data;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();

    // Save the updates
    _data.update('checks', newCheckData.id, newCheckData, err => {
        if(!err) {
            // Send the new check data to the next phase in the process if needed
            if(alertWanted) {
                workers.alertUserToStatusChange(newCheckData);
            } else {
                console.log('Check outcome has not changed, no alert needed')
            }
        } else {
            console.log('Error trying to save updates to one of the checks');
        }
    });
}

// Alert the user as to a chacge in their check status
workers.alertUserToStatusChange = (data) => {
    const msg = `Alert: Your check for ${data.method.toUpperCase()} ${data.protocol}://${data.url} is currently ${data.state}!`;
    helpers.sendTwilioSms(data.userPhone, msg, err => {
        if(!err) {
            console.log('Success: User was alerted to a status change:', msg);
        } else {
            console.log('Error: Could not send an SMS alert to a user');
        }
    })
}

// Timer to execute the worker process once per minute
workers.loop = () => {
    setInterval(() => {
        workers.gatherAllChecks();
    }, 1000 * 60)
}

// Init script
workers.init = () => {
    // Execute all the checks immediatelly
    workers.gatherAllChecks();
    // Call the loop so that the checks continue to execute later on
    workers.loop();
}

// Export the module
module.exports = workers;