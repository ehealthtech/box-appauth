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

	// Trash methods, merging definitions for Trash operations as found in the
	// Folders and Files Box apis
	//
	// https://developers.box.com/docs/#files
	// https://developers.box.com/docs/#folders
	//
	return {
	
		// List all items in trash.
		//
		// @param args {Object}	Call signature
		// @param args.limit {Integer} The max # of item records returned.
		// @param args.offset {Integer} The start index from which #limit item
		//								records are returned
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://box-content.readme.io/reference#get-the-items-in-the-trash
		// 
		list: function(args, cb) {
		
			var limit = env.toValidLimitOrThrow(args.limit);
			var offset = env.toValidOffsetOrThrow(args.offset);
			var fields = env.toFieldStringOrThrow(args.fields);

			request.get(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/folders/trash/items?limit=%d&offset=%d&fields=%s', 	
					limit, 
					offset,
					fields
				)
			}), env.complete(cb));
		},
		
		// Get an file in the trash
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer} The id of the file to fetch.
		//
		// https://box-content.readme.io/reference#get-a-trashed-file
		// 
		getFile: function(args, cb) {
		
			var fileId = env.toNumberOrThrow(args.id, 'trash:getFile#id');

			request.get(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/files/%d/trash', 	
					fileId
				)
			}), env.complete(cb));
		},
		
		// Get an folder in the trash
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer} The id of the folder to fetch.
		//
		// https://box-content.readme.io/reference#get-a-trashed-folder
		// 
		getFolder: function(args, cb) {
		
			var folderId = env.toNumberOrThrow(args.id, 'trash:getFolder#id');

			request.get(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/folders/%d/trash', 	
					folderId
				)
			}), env.complete(cb));
		},
		
		// Restore a file in the trash
		//
		// Note: read the documentation re: how new folder/file name
		// are handled. Importantly, new folder and file name are only
		// used in conflict situations -- they do not override
		// default method behavior, which is to use the original folder
		// and file name.
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The id of the file to restore.
		// @param [args.parentId] {Integer} The optional id of the folder to 
		//									restore into.
		// @param [args.name] {String} The optional new name of the file
		//
		// https://box-content.readme.io/reference#restore-a-trashed-item
		// 
		restoreFile: function(args, cb) {

			var fileId = env.toNumberOrThrow(args.id, 'trash:restoreFile#id');
			
			var parentId;
			var name;		
			var body = {};
			
			if(name = typeof args.name === 'undefined' 
						? false
						: env.toValidNameOrThrow(args.name)
			) {
				body.name = name;
			};
			
			if(parentId = typeof args.parentId === 'undefined' 
							? false 
							: env.toNumberOrThrow(args.parentId, 'trash:restoreFile#parentId')
			) {
				body.parent = {
					id: parentId
				}
			}

			request.post(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/files/%d', 	
					fileId
				),
				body: JSON.stringify(body)
			}), env.complete(cb));
		},			
		
		// Restore a folder in the trash. 
		//
		// Note: read the documentation re: how new folder/file name
		// are handled. Importantly, new folder and file name are only
		// used in conflict situations -- they do not override
		// default method behavior, which is to use the original folder
		// and file name.
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The id of the folder to restore.
		// @param [args.parentId] {Integer} The optional id of the folder to 
		//									restore into.
		// @param [args.name] {String} The optional new name of the folder
		//
		// https://box-content.readme.io/reference#restore-a-trashed-folder
		// 
		restoreFolder: function(args, cb) {

			var folderId = env.toNumberOrThrow(args.id, 'trash:restoreFolder#id');
			
			var parentId;
			var name;		
			var body = {};
			
			if(name = typeof args.name === 'undefined' 
						? false
						: env.toValidNameOrThrow(args.name)
			) {
				body.name = name;
			};
			
			if(parentId = typeof args.parentId === 'undefined' 
							? false 
							: env.toNumberOrThrow(args.parentId, 'trash:restoreFolder#parentId')
			) {
				body.parent = {
					id: parentId
				}
			}
			
			request.post(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/folders/%d', 	
					folderId
				),
				body: JSON.stringify(body)
			}), env.complete(cb));
		},	
		
		// Permanently delete a file in the trash.
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer} The id of the file to delete.
		//
		// https://box-content.readme.io/reference#permanently-delete-a-trashed-file
		// 
		destroyFile: function(args, cb) {
		
			var fileId = env.toNumberOrThrow(args.id, 'trash:destroyFile#id');

			request.del(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/files/%d/trash', 	
					fileId
				)
			}), env.complete(cb));
		},
		
		// Permanently delete a folder in the trash.
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer} The id of the folder to delete.
		//
		// https://box-content.readme.io/reference#permanently-delete-a-trashed-folder
		// 
		destroyFolder: function(args, cb) {
		
			var folderId = env.toNumberOrThrow(args.id, 'trash:destroyFolder#id');

			request.del(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/folders/%d/trash', 	
					folderId
				)
			}), env.complete(cb));
		}
	};
};