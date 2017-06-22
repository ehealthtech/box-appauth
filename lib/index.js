"use strict";

var fs = require('fs');
var Promise = require('bluebird');
var _ = require('lodash');

module.exports = function(args) {

	// if we're only using this module's folder-name-formatting functionality there's no need for its auth aspect
	if(args && args.formatName) {
		var env = require('./env.js');
		return  env().toValidNameOrThrow(args.formatName);
	}
	else {
		var build = require('./factory');

		var opts = args.options || {};

		var randomisationFactor = +opts.randomisationFactor;
		randomisationFactor = randomisationFactor >= 0 && randomisationFactor <= 1 ? randomisationFactor : 0;

		// Must be >= 5 and <= 50 minutes
		//
		var minutesUntilTokenRefresh = +opts.minutesUntilTokenRefresh;
		minutesUntilTokenRefresh = minutesUntilTokenRefresh >= 5 && minutesUntilTokenRefresh <= 50
			? minutesUntilTokenRefresh
			: 50;

		// Box only supports a limited set of signing algorithms.
		//
		var supportedAlgorithms = ['RS256', 'RS384', 'RS512'];
		var defaultAlgorithm = 'RS256';

		var validSubjectTypes = ['enterprise', 'user'];

		// The auth token issuing service for Box
		//
		var authEndpoint = 'https://api.box.com/oauth2/token';

		if (!_.isPlainObject(args)) {
			throw new Error('box-appauth factory received non-Object as argument');
		}

		var publicKey = args.publicKey;
		var privateKey = args.privateKey;

		var algorithm = typeof args.algorithm === 'string'
			? args.algorithm.toUpperCase()
			: defaultAlgorithm;
		var issuer = args.issuer;
		var subject = args.subject;
		var subjectType = args.subjectType;
		var clientId = args.clientId;
		var clientSecret = args.clientSecret;
		var publicKeyId = args.publicKeyId;

		if (!~supportedAlgorithms.indexOf(algorithm)) {
			console.warn('box-appauth #algorithm must be one of ' + supportedAlgorithms.toString() + '. Received: ' + algorithm + '. Will use ' + defaultAlgorithm);

			algorithm = defaultAlgorithm;
		}

		if (!issuer) {
			throw new Error('box-appauth did not receive #issuer');
		}

		if (!subject) {
			throw new Error('box-appauth did not receive #subject');
		}

		if (!~validSubjectTypes.indexOf(subjectType)) {
			throw new Error('box-appauth #subjectType must be one of ' + validSubjectTypes.toString() + '. Received: ' + subjectType);
		}

		if (!publicKey) {
			throw new Error('box-appauth did not receive a #publicKey');
		}

		if (!privateKey) {
			throw new Error('box-appauth did not receive a #privateKey');
		}

		if (!publicKeyId) {
			throw new Error('box-appauth did not receive a #publicKeyId');
		}

		if (!clientId) {
			throw new Error('box-appauth did not receive a #clientId');
		}

		if (!clientSecret) {
			throw new Error('box-appauth did not receive a #clientSecret');
		}

		// Pass along material to generate a JWT from; factory builds API using app-auth JWT.
		// #build(payload, claims, publicKey, privateKey, authKeys)
		//
		return new Promise(function (resolve, reject) {
			var now = Math.floor(Date.now() / 1000) - 5 // Now with a 5 second buffer
			build({
					box_sub_type: subjectType,
					jti: 'this_is_reset_in_factory#set',
					iat: now
				}, {
					algorithm: algorithm,
					issuer: issuer,
					subject: subject,
					audience: authEndpoint,
					expiresIn: 58,
					notBefore: -10,
					headers: {
						typ: 'JWT',
						alg: algorithm,
						kid: publicKeyId
					}
				},
				publicKey,
				privateKey, {
					clientId: clientId,
					clientSecret: clientSecret,
					authEndpoint: authEndpoint
				}, {
					callRetryMax: opts.callRetryMax || 10,
					minutesUntilTokenRefresh: minutesUntilTokenRefresh,
					randomisationFactor: randomisationFactor,
					initialDelay: opts.initialDelay || 20,
					maxDelay: opts.maxDelay || 500,
					debug: !!opts.debug
				})
				.then(resolve)
				.catch(reject);
		});
	}
};