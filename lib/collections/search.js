"use strict";

var util = require('util');
var fs = require('fs');
var path = require('path');
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

	// File methods for Box API
	//
	// https://developers.box.com/docs/#files
	//
	return {
	
		// Perform searches against items
		//
		// @param args {Object}	Call signature
		// @param args.query {String}	Some text to search for. 
		//								See #content_types.
		// @param args.contentTypes {Array}	With #query, search against one
		//									or more of [name, description,
		//									file_content, comments, tags].
		// @param args.limit {Integer} The max # of search results returned.
		// @param args.offset {Integer} The start index from which #limit search
		//								results are returned
		// @param args.fileExtensions {Array}	A list of file extensions to
		//										limit the search to.
		// @param args.scope {String}	One of 'user_content' 
		//								or 'enterprise_content'
		//
		// @param args.sizeRange {String}	Limit query to files of given size.
		//									In bytes, where 1MB = 1000000 bytes.
		// @param args.sizeRange.lowerBound	Min bytes.
		// @param args.sizeRange.upperBound	Max bytes.
		//
		// @param args.ancestorFolderIds {Array}	Limit query to given 
		//											folder ids.
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://developers.box.com/docs/#search
		// 
		execute: function(args, cb) {
		
			var query;
			var contentTypes;
			var scope;
			var sizeRange;
			var lowerBound;
			var upperBound;
			var ancestorFolderIds;
			
			// Queries must be against one or more of these segments.
			// Will default to all -- see below.
			//
			var validContentTypes = [
				'name', 
				'description', 
				'file_content', 
				'comments', 
				'tags'
			];
			
			var validScopes = [
				'user_content',
				'enterprise_content'
			];
			
			var limit = env.toValidLimitOrThrow(args.limit);
			var offset = env.toValidOffsetOrThrow(args.offset);
			var fileExtensions = _.isArray(args.fileExtensions)
									? args.fileExtensions 
									: '';
			var fields = env.toFieldStringOrThrow(args.fields);
			
			// Check and set #query
			//
			if(typeof args.query === 'string' && args.query.length > 1) {
				query = args.query.trim();
			} else {
				throw new Error('search:execute#query is not a String. Received -> ' + args.query);
			}
			
			// Check and set #contentTypes
			//
			if(typeof args.contentTypes === 'undefined') {
				contentTypes = validContentTypes;
			} else if(_.isArray(args.contentTypes)) {
				if(_.every(args.contentTypes, function(type) {
					return ~validContentTypes.indexOf(type);
				})) {
					contentTypes = args.contentTypes;
				} else {
					throw new Error('search:execute#contentTypes contains an invalid type. Received -> ' + args.contentTypes);
				}
			} else {
				throw new Error('search:execute#contentTypes must be an array. Received -> ' + args.contentTypes);
			}
			
			// Check and set #scope
			//
			if(typeof args.scope === 'undefined') {
				scope = '';
			} else if(typeof args.scope === 'string') {
				if(!~validScopes.indexOf(args.scope)) {
					throw new Error('search:execute#scope is not valid. Must be one of ' + validScopes + '. Received -> ' + args.scope);
				}
				scope = args.scope;
			} else {
				throw new Error('search:execute#scope must be a string. Received ' + args.scope);
			}
			
			// Check and set #sizeRange
			//
			if(typeof args.sizeRange === 'undefined') {
				sizeRange = '';
			} else if(!_.isPlainObject(args.sizeRange)) {
				throw new Error('search:execute#sizeRange must be an Object. Received -> ' + args.sizeRange);
			} else {
			
				if(typeof args.sizeRange.lowerBound !== 'undefined') {
					lowerBound = env.toNumberOrThrow(args.sizeRange.lowerBound, 'search:execute#sizeRange#lowerBound');
				}

				if(typeof args.sizeRange.upperBound !== 'undefined') {
					upperBound = env.toNumberOrThrow(args.sizeRange.upperBound, 'search:execute#sizeRange#upperBound');
				}	

				// https://developers.box.com/docs/#search
				// "Trailing `lower_bound_size,` and leading `,upper_bound_size`
				// commas are also accepted as parameters."
				//
				if(lowerBound || upperBound) {
					sizeRange = [lowerBound || '', upperBound || ''].join(',');
				}
			}
			
			// Check and set #ancestorFolderIds
			//
			if(typeof args.ancestorFolderIds === 'undefined') {
				ancestorFolderIds = '';
			} else if(!_.isArray(args.ancestorFolderIds)) {
				throw new Error('search:execute#ancestorFolderIds must be an Array. Received -> ' + args.ancestorFolderIds);
			} else {
				// This will throw if any #ancestorFolderId cannot be
				// cast to an integer.
				//
				args.ancestorFolderIds.forEach(function(type, idx) {
					args.ancestorFolderIds[idx] = env.toNumberOrThrow(type, 'search:execute#ancestorFolderIds#' + idx);
				});
				
				ancestorFolderIds = args.ancestorFolderIds;
			}

			var url = util.format(
				'https://api.box.com/2.0/search?query=%s&content_types=%s&limit=%d&offset=%d&file_extensions=%s&scope=%s&size_range=%s&ancestor_folder_ids=%s&fields=%s', 	
					query,
					contentTypes.toString(),
					limit,
					offset,
					fileExtensions.toString(),
					scope,
					sizeRange,
					ancestorFolderIds,
					fields
			);
				
			console.log(url);

			request.get(env.prepare({
				url: url
			}), env.complete(cb));
		}
	};
};