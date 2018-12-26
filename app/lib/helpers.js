/*
 * Helpers for various tasks
 *
 */

// Dependencies
const crypto = require('crypto');
const config = require('./config');
const querystring = require('querystring');
const https = require('https');

// Container for all the helpers
const helpers = {};

// Hash helper SHA256
helpers.hash = (str) => {
    if(typeof str === 'string' && str.length) {
        let hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash;
    } else {
        return false;
    }
}

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = (str) => {
    try {
        let obj = JSON.parse(str);
        return obj;
    } catch(e) {
        return {};
    }
}

// Create a string of random alphanumeric characters of a given length
helpers.createRandomString = (strLength) => {
    strLength = typeof strLength === 'number' && strLength > 0 ? strLength : false;
    if(strLength) {
        // Define all the possible characters that could go into a string
        const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

        // Start the final string
        let str = '';

        for(let i = 0; i < strLength; i++) {
            // Get a random character
            const randomCharacter =  possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
            //Append this character to the final string
            str += randomCharacter;
        }

        // Return the final string
        return str;
    } else {
        return false;
    }
}

// Send an SMS via Twilio
helpers.sendTwilioSms = (phone, msg, callback) => {
    // Validate the parameters
    phone =typeof phone === 'string' && phone.trim().length === 10 ? phone.trim() : false;
    msg = typeof msg === 'string' && msg.trim().length <=1600 && msg.trim().length > 0 ? msg.trim() : false;
    if(phone && msg) {
        // Configure the request payload
        const payload = {
            From: config.twilio.fromPhone,
            To: `+1${phone}`,
            Body: msg
        }

        // Stringify the payload
        const stringPayload = querystring.stringify(payload);

        // Configure the request details
        const requestDetails = {
            protocol: 'https:',
            hostname: 'api.twilio.com',
            method: 'POST',
            path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
            auth: `${config.twilio.accountSid}:${config.twilioauthToken}`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(stringPayload)
            }
        }

        // Instantiate the requst object
        const req = https.request(requestDetails, res => {
            // Grab the status of the sent request
            const status = res.statusCode;
            // Callback successfully if the requst went through
            if(status === 200 || status === 201) {
                callback(false);
            } else {
                callback(`Status code returned was ${status}`);
            }
        });

        // Bind to the error event so it doesn't get thrown
        req.on('error', e => {
            callback(e);
        });

        // Add the payload
        req.write(stringPayload);

        // End the request
        req.end();

    } else {
        callback('Given parmeters were misisng or invalid');
    }
}


// Export the module
module.exports = helpers;