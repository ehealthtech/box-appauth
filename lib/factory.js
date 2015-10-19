"use strict";

var util = require('util');
var request = require('request');
var Promise = require('bluebird');
var jwt = require('jsonwebtoken');
var uuid = require('node-uuid');

// The environment that all API collections are passed.
// See initialization at bottom of file (this export).
//
var env = require('./env.js');

module.exports = function(payload, claims, publicKey, privateKey, auth) {
	
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
					
						console.warn('Unable to revoke token ->', accessToken);
						
						reject(err);
						cb(err);
						
						return;
					}
					
					console.info('Token ->', accessToken, 'has been revoked');
					
					resolve(body);
					cb(null, body);
				});
			});
		};
		
		// If this token will expire within the next ~15 minutes,
		// refresh it. 
		//
		this.refreshIfExpiring = function() {

            // Checking # of milliseconds
            //
			var doRefresh = (expiresAt - Date.now()) < (15 * 60 * 1000);
		
			if(doRefresh) {

				return this.set();
			}
			
			return Promise.resolve();
		};
		
		this.get = function() {
			return Promise.resolve(accessToken);
		};
		
		this.set = function() {
			return new Promise(function(resolve, reject) {

                // Generate a new unique id for the JWT payload
                //
                payload.jti = uuid.v4();

				var signedJwt = jwt.sign(payload, privateKey, claims);
                var tokenObj;
		
				if(!jwt.verify(signedJwt, publicKey)) {
					return reject(new Error('box-appauth cannot create a verified JWT with the sent parameters. Check #publicKey against #privateKey'));
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
				
					if(err) {

						return reject(new Error('Unable to GET new token -> ', err));
					}
					
					try {

						tokenObj = JSON.parse(body);
						
					} catch(e) {
						return reject(new Error('Unable to PARSE new token -> ', err));
					}
	
					// Add an issued and expiry timestamp
					//
					var now = Date.now();
					
					// Add timestamp of projected expiry time
					//
					tokenObj.issued_at = now;
					tokenObj.expires_at = now + (tokenObj.expires_in * 1000);	
					
					accessToken = tokenObj.access_token;
					issuedAt =  tokenObj.issued_at;
					expiresAt = tokenObj.expires_at;

					console.log('Token generated -> ', tokenObj);
					
					resolve(tokenObj);
				});
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
			
			resolve(api);
		})
		.catch(reject);
	});
};