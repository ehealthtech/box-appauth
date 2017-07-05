"use strict";

var util = require('util');
var fs = require('fs');
var path = require('path');
var request = require('request');
var moment = require('moment');
var stream = require('stream');
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
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://docs.box.com/reference#files
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
		// https://docs.box.com/reference#delete-a-file
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
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://docs.box.com/reference#copy-a-file
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
				body: JSON.stringify(body)
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
		// https://docs.box.com/reference#preflight-check
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
		// @param [args.SHA1Hash] {String}  The SHA1 hash of the file.
		// @param [args.createdAt] {String} Timestamp of file creation.
		// @param [args.modifiedAt] {String}    Time of last file modification.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://docs.box.com/reference#upload-a-file
		// https://docs.box.com/docs/content-times
		// 
		upload: function(args, cb) {

			var parentId = env.toNumberOrThrow(args.parentId);
			var name = env.toValidNameOrThrow(args.name);
			var fields = env.toFieldStringOrThrow(args.fields);
			var file;

			if(args.file instanceof stream.Readable) {
				file = args.file;
			} else if(typeof args.file === 'string') {
				try {
					file = fs.createReadStream(path.resolve(args.file));
				} catch(e) {
					throw new Error('file:upload -> Unable to create ReadStream from #file path');
				}
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
					'Content-MD5': args.SHA1Hash || '',
					'content_created_at': args.createdAt || moment().format(),
					'content_modified_at': args.modifiedAt || moment().format(),
					'attachments': [
						file
					]
				}
			}), env.complete(cb));
		},

		// Download a file
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The file id
		//
		// https://docs.box.com/reference#download-a-file
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

		// NOTE: THE FOLLOWING FUNCITON APPEARS TO BE DEPRECATED
		// Get a short-lived URL to a document preview session
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The file id
		//
		// (NO LINK AVAILABLE)
		//
		getPreviewLink: function(args, cb) {

			var fileId = env.toNumberOrThrow(args.id, 'file:download#fileId');

			request.get(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/files/%d?fields=expiring_embed_link',
					fileId
				)
			}), function(err, r) {

				// Snip out the embedded link and just return that
				//
				var elink;
				try {
					elink = JSON.parse(r.body).expiring_embed_link.url;
				} catch(e) {}

				env.complete(cb)(err, r, elink);
			});
		},

		// Get the download link to a file.
		// NOTE: Box resolves a request for a file by returning a redirect 302.
		// Using simple #download method follows that link and returns the file data.
		// Using #getSharedLink returns a URL that will follow a 302 path to the "real" link.
		// Here we want to *not* follow the redirect, and return the pre-redirect
		// Location: header, which is the download link we're seeking.
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The file id
		//
		// https://docs.box.com/reference#download-a-file
		//
		getDownloadLink: function(args, cb) {

			var fileId = env.toNumberOrThrow(args.id, 'file:download#fileId');

			request.get(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/files/%d/content',
					fileId
				),
				followRedirect: false
			}), function(err, r) {
				// env.complete expects a typical @request callback signature.
				// Here we intercept the callback, grab the Location: value from
				// the redirect response, and pass that along as the expected body.
				//
				env.complete(cb)(err, r, r.headers.location);
			});
		},

		// Create a shared link on a file. This is a link that can be used to download that file.
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the file to
		//							be linked.
		// @param [args.access] {String}	The access level of the file. Default 'open'
		// @param [args.password] {String}	A password necessary for accessing the file.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// TODO: add further privileges; add a #deleteLink method (null #shared_link)
		//
		// https://docs.box.com/reference#create-a-shared-link-for-a-file
		//
		getSharedLink: function(args, cb) {

			var id = env.toNumberOrThrow(args.id, 'file:createLink:#id');
			var fields = env.toFieldStringOrThrow(args.fields);

			var allowedAccessLevels = [
				'open',
				'company',
				'collaborators'
			];

			var access;
			if(typeof args.access === 'undefined') {
				access = 'open';
			} else if(!~allowedAccessLevels.indexOf(args.access)) {
				throw new Error('file:createLink -> Illegal #access argument. Received ' + args.access);
			} else {
				access = args.access;
			}

			request(env.prepare({
				method: 'PUT',
				url: util.format(
					'https://api.box.com/2.0/files/%d?fields=%s',
					id,
					fields
				),
				body: util.format(
					'{"shared_link": {"access": "%s"}}',
					access
				)
			}), env.complete(cb));
		},

		// Update a file (add a new version of the file content)
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The file id
		// @param [args.ifMatch] {String}	An ETag; only overwrite if matches
		//                                  current file's ETag.
		// @param args.file {Mixed}	Either a String file path or a
		//							Readable stream.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://docs.box.com/reference#upload-a-new-version-of-a-file
		//
		update: function(args, cb) {

			var fileId = env.toNumberOrThrow(args.id, 'file:download#fileId');
			var fields = env.toFieldStringOrThrow(args.fields);
			var headers = {};
			var file;

			if(typeof args.ifMatch !== 'undefined') {
				headers['If-Match'] = args.ifMatch;
			}

			if(args.file instanceof fs.ReadStream) {
				file = args.file;
			} else if(typeof args.file === 'string') {
				try {
					file = fs.createReadStream(path.resolve(args.file));
				} catch(e) {
					throw new Error('file:upload -> Unable to create ReadStream from #file path');
				}
			}

			request.post(env.prepare({
				headers: headers,
				url: util.format(
					'https://upload.box.com/api/2.0/files/%d/content',
					fileId
				),
				formData: {
					attachments: [
						file
					]
				}
			}), env.complete(cb));
		},

		// Update file info
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the folder.
		// @param args.name {String}	The (new) name of the folder.
		// @param [args.description] {String}	A folder description.
		// @param [args.tags] {Array}	A list of (String) tags.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://docs.box.com/reference#update-a-files-information
		// 
		// TODO: implement permissions, access flags, etc.
		//
		updateInfo: function(args, cb) {

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