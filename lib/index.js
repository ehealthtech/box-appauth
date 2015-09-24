"use strict";

var fs = require('fs');
var uuid = require('node-uuid');
var Promise = require('bluebird');
var _ = require('lodash');

var build = require('./factory');

module.exports = function(args) {

	var signed;

	// Box only supports a limited set of signing algorithms.
	//
	var supportedAlgorithms = ['RS256','RS384','RS512'];
	var defaultAlgorithm = 'RS256';
	
	var validSubjectTypes = ['enterprise', 'user'];
	
	// The auth token issuing service for Box
	//
	var authEndpoint = 'https://api.box.com/oauth2/token';

	if(!_.isPlainObject(args)) {
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
	
	if(!~supportedAlgorithms.indexOf(algorithm)) {
		console.warn('box-appauth #algorithm must be one of ' + supportedAlgorithms.toString() + '. Received: ' + algorithm + '. Will use ' + defaultAlgorithm);
		
		algorithm = defaultAlgorithm;
	}

	if(!issuer) {
		throw new Error('box-appauth did not receive #issuer');
	}
	
	if(!subject) {
		throw new Error('box-appauth did not receive #subject');
	}
	
	if(!~validSubjectTypes.indexOf(subjectType)) {
		throw new Error('box-appauth #subjectType must be one of ' + validSubjectTypes.toString() + '. Received: ' + subjectType);
	}
	
	if(!publicKey) {
		throw new Error('box-appauth did not receive a #publicKey');
	}
	
	if(!privateKey) {
		throw new Error('box-appauth did not receive a #privateKey');
	}
	
	if(!clientId) {
		throw new Error('box-appauth did not receive a #clientId');
	}
	
	if(!clientSecret) {
		throw new Error('box-appauth did not receive a #clientSecret');
	}
	
	return new Promise(function(resolve, reject) {
		build({ 
			box_sub_type: subjectType,
			jti: uuid.v4()
		}, { 
			algorithm: algorithm,
			issuer: issuer,
			subject: subject,
			audience: authEndpoint,
			expiresInSeconds: 59,
			headers: {
				typ: 'JWT',
				alg: algorithm,
			}
		}, 
		publicKey, 
		privateKey, {
			clientId : clientId,
			clientSecret : clientSecret,
			authEndpoint : authEndpoint
		})
		.then(resolve)
		.catch(reject);
	});
};