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
	
		// Fetch info on a file
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The file id
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://developers.box.com/docs/#files-get
		// 
		info: function(args, cb) {
		
			var fileId = env.toNumberOrThrow(args.id, 'file:info#id');
			var fields = env.toFieldStringOrThrow(args.fields);

			request.get(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/files/%d?fields=%s', 	
					fileId,
					fields
				)
			}), env.complete(cb));
		},
		
		// Delete a file
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the file
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://developers.box.com/docs/#files-delete-a-file
		// 
		delete: function(args, cb) {

			var fileId = env.toNumberOrThrow(args.id, 'file:delete#id');
			var fields = env.toFieldStringOrThrow(args.fields);

			request.del(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/files/%d?fields=%s',
					fileId,
					fields
				)
			}), env.complete(cb));
		},
		
		// Copy a file
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the file to 
		//							be copied.
		// @param args.toFolderId {Integer}	The id of the parent folder into 
		//									which #id folder is copied.
		// @param [args.name] {String}	Optional new name for folder copy.
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://developers.box.com/docs/#files-copy-a-file
		// 
		copy: function(args, cb) {

			var sourceId = env.toNumberOrThrow(args.id, 'file:copy:#sourceId');
			var toFolderId = env.toNumberOrThrow(args.toFolderId, 'file:copy#folderId');
			var fields = env.toFieldStringOrThrow(args.fields);
			var name;
			
			var body = {
				"parent" : {
					"id" : toFolderId
				}
			};

			if(name = typeof args.name === 'undefined' 
						? false 
						: env.toValidNameOrThrow(args.name)
			) {
				body.name = name;
			}

			request.post(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/files/%d/copy?fields=%s',
					sourceId,
					fields
				),
				body: JSON.stringify(body),
			}), env.complete(cb));
		},
		
		// Verify that an upload will be accepted.
		//
		// @param args {Object}	Call signature
		// @param args.parentId {Integer}	The id of the folder that will 
		//									receive the upload (parent).
		// @param args.name {String}	The name that the file will want
		//								to take when uploaded.
		// @param [args.size] {Integer}	The size of the file in bytes.
		//
		// https://developers.box.com/docs/#files-preflight-check
		// 
		preflightCheck: function(args, cb) {
		
			var name = env.toValidNameOrThrow(args.name, 'file:preflightCheck#name');
			var parentId = env.toNumberOrThrow(args.parentId, 'file:preflightCheck#parentId');
			var size = typeof args.size === 'undefined' 
						? 0
						: env.toNumberOrThrow(args.size, 'preflightCheck:size');
						
			request(env.prepare({
				method: 'OPTIONS',
				url: 'https://api.box.com/2.0/files/content',
				body: util.format(
				'{"name": "%s", "parent": {"id": "%d"}, "size": %d}', 	
					name,
					parentId,
					size
				)
			}), env.complete(cb));
		},
		
		// Upload a file
		//
		// @param args {Object}	Call signature
		// @param args.parentId {Integer}	The folder id to upload into.
		// @param args.name {String}	The name uploaded file will take.
		// @param args.file {Mixed}	Either a String file path or a 
		//							Readable stream.
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://developers.box.com/docs/#files-upload-a-file
		//
		// @TODO: content_created_at, content_modified_at attributes
		// 
		upload: function(args, cb) {
		
			var parentId = env.toNumberOrThrow(args.parentId);
			var name = env.toValidNameOrThrow(args.name);
			var fields = env.toFieldStringOrThrow(args.fields);
			var file;
			
			if(args.file instanceof fs.ReadStream) {
				file = args.file
			}
			
			if(typeof args.file === 'string') {
				try {
					file = fs.createReadStream(path.resolve(args.file));
				} catch(e) {}
			}
			
			if(!file) {
				throw new Error('file:upload -> Unable to create ReadStream from #file path');			
			}

			request.post(env.prepare({
				url: util.format(
					'https://upload.box.com/api/2.0/files/content?fields=', 
						fields
				),
				formData: {
					'attributes': util.format(
						'{"name":"%s", "parent":{"id":"%s"}}',
						name,
						parentId
					),
					attachments: [
						file
					],
				}
			}), env.complete(cb));
		},
		
		// Download a file
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The file id
		//
		// https://developers.box.com/docs/#files-download-a-file
		// 
		download: function(args, cb) {
		
			var fileId = env.toNumberOrThrow(args.id, 'file:download#fileId');

			request.get(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/files/%d/content', 	
					fileId
				)
			}), env.complete(cb));
		},
		
		// Update file info
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the folder.
		// @param args.name {String}	The (new) name of the folder.
		// @param args.description {String}	A folder description.
		// @param args.tags {Array}	A list of (String) tags.
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://developers.box.com/docs/#files-update-a-files-information
		// 
		// TODO: implement permissions, access flags, etc.
		//
		update: function(args, cb) {

			var name;
			var description;
			var tags;
			var fileId = env.toNumberOrThrow(args.id, 'file:update#id');
			var fields = env.toFieldStringOrThrow(args.fields);
			
			var body = {};
			
			if(name = typeof args.name === 'undefined' 
						? false 
						: env.toValidNameOrThrow(args.name)
			) {
				body.name = name;
			}
			
			if(description = _.isString(args.description) 
								? args.description 
								: false
			) {
				body.description = description;
			}
			
			if(tags = _.isArray(args.tags) 
						? args.tags.toString() 
						: false
			) {
				body.tags = tags;
			}

			request.put(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/files/%d?fields=%s',
					fileId,
					fields
				),
				body: JSON.stringify(body)
			}), env.complete(cb));
		}
	};
};