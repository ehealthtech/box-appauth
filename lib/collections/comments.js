"use strict";

var util = require('util');
var request = require('request');
var _ = require('lodash');

// @param env {Object}	Various call environment methods.
//
// @param env.access_token {String}	The access token.
// @param env.issued_at {Integer}	Ms timestamp at creation time.
// @param env.expires_at {Integer}	Ms expiry timestamp.
// @param env.toNumberOrThrow {Function}	Converts to a valid number where
//											needed, such as with an item id,
//											or throws.
// @param env.toValidLimitOrThrow {Function}	Ensure limit argument is valid,
//												set default if undefined,
//												throw otherwise.
// @param env.toValidOffsetOrThrow {Function}	Ensure offset argument is valid,
//												set default if undefined,
//												throw otherwise.
// @param env.toFieldStringOrThrow {Function}	Convert field argument to a
//												correct string, or throw if
//												defined but malformed.
// @param env.env.toValidNameOrThrow {Function}	Ensure file/folder names conform
//												to Box specifications.
// @param env.complete {Function}	Use this to handle responses.
// @param env.prepare {Function}	Prep your call object headers with this.
//									Primarily, this handles Bearer header.
// @param env.revoke {Function}	Disables this api by revoking token validity.
// @param env.asUser {Function}	Rather than setting 'As-User' header on every
//								call, have all future calls impersonate user.
//
module.exports = function(env) {

	// All methods for Box comments api
	// https://box-content.readme.io/reference#comment-object
	//
	return {
	
		// Create a comment on an item.
		//
		// @@ Not implemented
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the folder.
		// @param [args.message] {String}	A short-lived Chess championship.
		// @param [args.type] {String}	One of 'file' or 'comment'.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		// 
		// https://box-content.readme.io/reference#add-a-comment-to-an-item
		// 
		create: function(args, cb) {
		
			var itemId = env.toNumberOrThrow(args.id, 'comments:create#id');
			var fields = env.toFieldStringOrThrow(args.fields);
			var message;
			var type;
			var mKey;
			var mVal;
			var validTypes = [
				'file',
				'comment'
			];
			
			if(typeof args.taggedMessage !== 'undefined') {
				if(typeof args.taggedMessage !== 'string') {
					throw new Error('comments:create#taggedMessage #taggedMessage not a String. Received -> ' + args.taggedMessage);
				} else {
					mKey = 'tagged_message';
					mVal = args.taggedMessage;
				}
			} else if(typeof args.message !== 'undefined') {
				if(typeof args.message !== 'string') {
					throw new Error('comments:create#message #message not a String. Received -> ' + args.message);
				} else {
					mKey = 'message';
					mVal = args.message;
				}
			} else {
				mKey = 'message';
				mVal = '';
			}
			
			if(typeof args.type === 'undefined') {
				type = 'comment'
			} else if(!~validTypes.indexOf(args.type)) {
				throw new Error('comments:create#type Invalid #type. Received -> ' + args.type);
			} else {
				type = args.type;
			}
			
			var body = {
				item : {
					id: id,
					type: type
				}
			};
			
			body.item[mKey] = mVal;
			
			request.get(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/comments?fields=%s', 
					fields
				),
				body: JSON.stringify(body)
			}), env.complete(cb));
		}
	};
};