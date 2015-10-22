"use strict";

var util = require('util');
var _ = require('lodash');

// @param Token {Object}	Token manager. See ./factory.js
//
module.exports = function(Token) {

	var env = {};
	var asUser = false;

    // @see #complete
    //
    var prepError = function(err, res, body) {

        var statusCode = res ? res.statusCode : 0;
        var headers = res ? res.headers : {};
        var message = 'Call Error';

        if(_.isPlainObject(body) && body.type === 'error') {
            message = body
        }

        return JSON.stringify({
            headers: headers,
            statusCode: statusCode,
            message: message
        });
    };
	
	// Revoke the token this api is using.
	//
	// https://box-content.readme.io/reference#revoke
	//
	// NOTE: This is a destructive action -- this api instance is now fully
	// disabled, and cannot be resuscitated. 
	//
	env.revoke = function(cb) {
		return Token.revoke(cb);
	};
	
	// Ensure that all calls are made as a given user.
	// @param [userId] {Integer}	The user id to impersonate. Sending no
	//								id has the effect of cancelling any
	//								previously enabled impersonation.
	//
	// https://box-content.readme.io/reference#as-user-1
	//
	env.asUser = function(userId) {
		if(!userId) {
			asUser = false;
			return;
		}
		return (asUser = env.toNumberOrThrow(userId));
	};
	
	// Add common headers to all Request call arguments. 
	//
	// @param callObj {Object}	Expects an object that may or may not have 
	//							#headers set; if set, they are augmented, and
	//							if not sent they are added.
	// @see #asUser
	//
	env.prepare = function(callObj) {
	
		var token = Token.get().value();
		
		callObj.headers = callObj.headers || {};

		// Note that this will always override any sent Authorization header 
		// to the one bound by this interface. Private token, IOW.
		//
		callObj.headers.Authorization = 'Bearer ' + token;
		
		// Note that if As-User is sent, the per-call setting takes precedence
		// regardless of state of #asUser
		//
		if(!callObj.headers['As-User'] && asUser) {
			callObj.headers['As-User'] = asUser;
		}
		
		return callObj;
	};

	// All calls made to Box API use the @request module.
	// The function returned here is used as the callback for @request
    // by all API methods.
    // We want to check for response errors, refresh the API token
    // if close to expiring, and return a Node-style (err, val) response.
	//
	env.complete = function(cb) {
		return function(err, res, body) {

            if(err) {
                return cb(prepError(err, res, body));
            }

            // If no body check for error codes.
            // Otherwise, determine if body itself is an error message.
            // Finally, return body.
            //
            if(!body) {
                if(+res.statusCode >= 400) {
                    return cb(prepError(err, res, body));
                }
            } else {

                try {
                    body = JSON.parse(body);
                } catch(e) {
                    // It's ok for a body to not be parseable, such as when
                    // downloading a file.
                }

                // A body might return error information
                //
                if(_.isPlainObject(body) && body.type === 'error') {
                    return cb(prepError(err, res, body));
                }
            }

            cb(null, body);
		}
	};
	
	// Ensure that a numeric argument is valid (such as for item ids)
	//
	env.toNumberOrThrow = function(val, msg) {
	
		msg = msg || '';
	
		if(_.isFinite(val) || _.isFinite(Number(val))) {
			return +val;
		}

		throw new Error(util.format(
			'%s -> Received invalid numeric argument -> %s',
			msg,
			val
		));
	};
	
	// Ensure that limit arguments are valid.
	// Note that default is 10.
	//
	env.toValidLimitOrThrow = function(limit) {
	
		return typeof limit === 'undefined' 
				? 10 
				: env.toNumberOrThrow(limit, '#limit malformed');
	};
	
	env.toValidOffsetOrThrow = function(offset) {
	
		return typeof offset === 'undefined' 
				? 0 
				: env.toNumberOrThrow(offset, '#offset malformed');
	};
	
	// Translate proper fields argument.
	//
	env.toFieldStringOrThrow = function(fields) {
	
		if(typeof fields === 'undefined') {
			return '';
		}
	
		if(_.isArray(fields)) {
			return fields.toString();
		}
	
		throw new Error('Received invalid #fields argument ->', fields);
	};
	
	// Ensure proper #name (folder/file names)
	//
	// For Box constraints (implemented below) see:
	// https://developers.box.com/docs/#files-preflight-check
	//
	env.toValidNameOrThrow = function(name) {
	
		if(typeof name !== 'string') {
			throw new Error('#name must be a String');
		}
		
		// Lose leading/trailing spaces
		//
		name = name.trim();
		
		// Cannot contain slash or backslash
		//
		if(/[\/\\]/.test(name)) {
			throw new Error('#name cannot include slash(/) or backslash(\\)');
		}
		
		// Must be printable ASCII. (+) One character or more.
		// https://en.wikipedia.org/wiki/ASCII#ASCII_printable_characters
		//
		if(!/^[\x20-\x7E]+$/.test(name)) {
			throw new Error('#name can only use ASCII printable codes, and must contain at least one character. See https://en.wikipedia.org/wiki/ASCII#ASCII_printable_characters');
		}
		
		// Cannot be longer than 255 characters
		//
		if(name.length > 255) {
			throw new Error('#name cannot be longer than 255 characters');
		}
		
		// Cannot use special folder names
		//
		if(name === '.' || name === '..') {
			throw new Error('#name cannot be "." or ".."');
		}
		
		return name;
	};
	
	return env;
};