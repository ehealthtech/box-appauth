"use strict";

var util = require('util');
var request = require('request');
var Promise = require('bluebird');
var jwt = require('jsonwebtoken');
var uuid = require('node-uuid');
var backoff = require('backoff');
var chalk = require('chalk');

// The environment that all API collections are passed.
// See initialization at bottom of file (this export).
//
var env = require('./env.js');

module.exports = function(payload, claims, publicKey, privateKey, auth, opts) {

    var debug = opts.debug;
    var callRetryMax = opts.callRetryMax;
    var minutesUntilTokenRefresh = opts.minutesUntilTokenRefresh;

    // Track and ensure token refreshes.
    // See #refreshIfExpiring and Promise at EOF
    //
    var isRefreshing = false;
    var refreshTimer;

	// Identify active collections here; a module w/ same name must exist.
	//
	// @see #constructApiCollections
	//
	var api = {
		folder: {},
		trash: {},
		file: {},
		search: {}
	};

    function debugLog(color, pref, suff) {

        if(!debug) {
            return;
        }

        try {

            suff = JSON.stringify(suff);

        } catch(e) {}

        console.log(chalk[color]('\n', pref, '->\n', suff));
    }
	
	var Token = function() {

		var accessToken;
		var issuedAt;
		var expiresAt;

		// Revoke this token. NOTE: this is a destructive action that
		// permanently disables this api.
		//
		// @param [cb] {Function}	An optional callback that is called *after*
		//							the method Promise is resolved.
		//
        // TODO shouldn't be using both callbacks and promise.
        //
		this.revoke = function(cb) {
		
			cb = typeof cb === 'function' ? cb : function() {};
		
			return new Promise(function(resolve, reject) {

				request.post({
					url: 'https://api.box.com/oauth2/revoke',
					body: util.format(
						'client_id=%s&client_secret=%s&token=%s',
							auth.clientId,
							auth.clientSecret,
							accessToken
					)
				}, function(err, res, body) {
				
					if(err) {

                        debugLog('red','Unable to revoke token', accessToken);
						
						reject(err);
						cb(err);
						
						return;
					}

                    debugLog('magenta','Token has been revoked', accessToken);
					
					resolve(body);
					cb(null, body);
				});
			});
		};
		
		// Refresh if expiring within next #minutesUntilTokenRefresh minutes
		//
		this.refreshIfExpiring = function() {

            // Checking # of milliseconds
            //
			var doRefresh = (expiresAt - Date.now()) < (minutesUntilTokenRefresh * 60 * 1000);
		
			if(!isRefreshing && doRefresh) {

                isRefreshing = true;

				return this.set()
                .then(function(tok) {

                    debugLog('green','Token has been refreshed', tok);
                })
                .catch(function(err) {

                    debugLog('red','Token could not be refreshed (' + new Date() + ')', err);
                })
                .finally(function() {
                    isRefreshing = false;
                });
			}
			
			return Promise.resolve();
		};
		
		this.get = function() {
			return Promise.resolve(accessToken);
		};
		
		this.set = function() {
			return new Promise(function(resolve, reject) {

                debugLog('yellow', 'New Token Fetch attempt', new Date());

                var fibonacciBackoff = backoff.fibonacci({
                    randomisationFactor: opts.randomisationFactor,
                    initialDelay: opts.initialDelay,
                    maxDelay: opts.maxDelay
                });

                fibonacciBackoff.failAfter(callRetryMax);

                fibonacciBackoff.on('backoff', function(number, delay) {
                    if(number > 0) {
                       debugLog('red', util.format('Token call backoff #%d, %dms', number, delay), new Date());
                    }
                });

                fibonacciBackoff.on('ready', function(number, delay) {

                    // Generate a new unique id for the JWT payload
                    //
                    payload.jti = uuid.v4();

                    var signedJwt = jwt.sign(payload, privateKey, claims);
                    var tokenObj;
                    var jwtVerified;

                    try {

                        jwtVerified = jwt.verify(signedJwt, publicKey);

                        debugLog('green', 'JWT as verified', jwtVerified);

                    } catch(e) {

                        return reject(e);
                    }

                    request.post({
                        url: auth.authEndpoint,
                        form: {
                            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                            client_id: auth.clientId,
                            client_secret: auth.clientSecret,
                            assertion: signedJwt
                        }
                    }, function(err, res, body) {

                        debugLog('blue', 'Received token response', body);

                        if(err) {
                            return fibonacciBackoff.backoff();
                        }

                        try {

                            tokenObj = JSON.parse(body);

                        } catch(e) {

                            return fibonacciBackoff.backoff();
                        }

                        // Might get some JSON, but it will only be reporting a token fetch error.
                        //
                        if(!tokenObj.access_token) {

                            return fibonacciBackoff.backoff();
                        }

                        // Add an issued and expiry timestamp
                        //
                        var now = Date.now();
                        tokenObj.issued_at = now;
                        tokenObj.expires_at = now + (tokenObj.expires_in * 1000);

                        accessToken = tokenObj.access_token;
                        issuedAt =  tokenObj.issued_at;
                        expiresAt = tokenObj.expires_at;

                        debugLog('green','Token OK (' + new Date() + ')', tokenObj);

                        resolve(tokenObj);
                    });
                });

                fibonacciBackoff.on('fail', function() {
                    reject(new Error('Unable to get token after 10 tries'));
                });

                fibonacciBackoff.backoff();
			});
		};
	};

	return new Promise(function(resolve, reject) {
	
		var tokenInstance = new Token();

        // Initialize new tokenInstance with a valid auth token (#set).
        // Once we have that token, initialize the API environment with it (#env);
        //
		tokenInstance
		.set()
		.then(function() {

			// For every collection identified in #api require that
			// collection, promisify all returned collection methods,
			// and update #api collection with those methods
			//
			var _env = env(tokenInstance);
		
			Object.keys(api).forEach(function(name) {
			
				var coll = require(__dirname + '/collections/' + name)(_env);
				
				Object.keys(coll).forEach(function(collFuncName) {
					api[name][collFuncName] = Promise.promisify(coll[collFuncName]);
				});
			});
			
			// Alias Token#revoke on the returned #api
			//
			api.revoke = function(cb) {
				tokenInstance.revoke(cb);
				return api;
			};
			
			// Alias #env#asUser on the returned #api
			// @see ./env.js
			//
			api.asUser = function(userId) {
				_env.asUser(userId);
				return api;
			};

            // Create a timer to ensure freshness of auth token,
            // checking every minute.
            //
            (refreshTimer = function() {
                tokenInstance.refreshIfExpiring();
                setTimeout(refreshTimer, 60000);
            })();

			resolve(api);
		})
		.catch(reject);
	});
};

/*

 curl https://api.box.com/2.0/files/42133774101?fields=expiring_embed_link -H "Authorization: Bearer pKTeluL9mwFxgN5oS6zpbPcoIGQ9ZOwc"
 curl https://api.box.com/2.0/folders/5189315161?recursive=true -H "Authorization: Bearer iTcXkSvLtO4SMrj8frs0Rn5mVhSdXhIy" -X DELETE

 */