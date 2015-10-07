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

	// All methods for Box folders api
	//
	return {
	
		// Get meta-information about a folder, such as # of items.
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the folder
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
        //
		// https://box-content.readme.io/reference#folder-object
		// 
		info: function(args, cb) {
		
			var folderId = env.toNumberOrThrow(args.id, 'folder:info#id');
			var fields = env.toFieldStringOrThrow(args.fields);

			request.get(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/folders/%d?fields=%s', 
					folderId,
					fields
				)
			}), env.complete(cb));
		},

		// Get all items in folder
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the folder.
		// @param [args.limit] {Integer} The max # of item records returned.
		// @param [args.offset] {Integer}   The start index from which #limit item
		//                                  records are returned
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//
		// https://box-content.readme.io/reference#get-a-folders-items
		// 
		list: function(args, cb) {
		
			var folderId = env.toNumberOrThrow(args.id, 'folder:list#id');
			var limit =	env.toValidLimitOrThrow(args.limit);
			var offset = env.toValidOffsetOrThrow(args.offset);
			var fields = env.toFieldStringOrThrow(args.fields);

			request.get(env.prepare({
				url: util.format(
				'https://api.box.com/2.0/folders/%d/items?limit=%d&offset=%d&fields=%s', 	
					folderId, 
					limit, 
					offset,
					fields
				)
			}), env.complete(cb));
		},

		// Create a new folder
		//
		// @param args {Object}	Call signature
		// @param args.parentId {Integer}	The numeric id of the parent folder.
		// @param args.name {String}	The new folder name. Note the regex that
		//								validates the name.
		// @param args.fields {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://box-content.readme.io/reference#create-a-new-folder
		// 
		create: function(args, cb) {
		
			var parentId = env.toNumberOrThrow(args.parentId, 'folder:create#parentId');
			var name = env.toValidNameOrThrow(args.name);
			var fields = env.toFieldStringOrThrow(args.fields);
			
			if(!/^[a-z0-9_-]{6,}$/i.test(name)) {
				throw new Error('Malformed folder name sent to #folders.create');
			}

			request.post(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/folders?fields=%s',
					fields
				),
				body: util.format(
					'{"name":"%s", "parent": {"id": "%d"}}', 
					name, 
					parentId
				)
			}), env.complete(cb));
		},
		
		// Copy a folder
		//
		// @param args {Object}	Call signature
		// @param args.sourceId {Integer}	The numeric id of the folder to 
		//									be copied.
		// @param args.destinationId {Integer}	The id of the parent folder into 
		//										which #id folder is copied.
		// @param [args.name] {String}	Optional new name for folder copy.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://box-content.readme.io/reference#copy-a-folder
		// 
		copy: function(args, cb) {

			var sourceId = env.toNumberOrThrow(args.sourceId, 'folder:copy:#sourceId');
			var destinationId = env.toNumberOrThrow(args.destinationId, 'folder:copy#destinationId');
			var fields = env.toFieldStringOrThrow(args.fields);
			var name;
			
			var body = {
				"parent" : {
					"id" : destinationId
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
					'https://api.box.com/2.0/folders/%d/copy?fields=%s',
					sourceId,
					fields
				),
				body: JSON.stringify(body),
			}), env.complete(cb));
		},

		// Delete a folder
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the folder
		// @param [args.recursive] {Boolean}	Whether to delete subfolders. Default false.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://box-content.readme.io/reference#delete-a-folder
		// 
		delete: function(args, cb) {

			var folderId = env.toNumberOrThrow(args.id, 'folder:delete#id');
			var fields = env.toFieldStringOrThrow(args.fields);
			var recursive =	_.isBoolean(args.recursive) 
								? args.recursive 
								: false;

			request.del(env.prepare({
				url: util.format(
					'https://api.box.com/2.0/folders/%d?recursive=%s&fields=%s',
					folderId,
					recursive,
					fields
				)
			}), env.complete(cb));
		},
		
		// Update a folder
		//
		// @param args {Object}	Call signature
		// @param args.id {Integer}	The numeric id of the folder.
		// @param args.name {String}	The (new) name of the folder.
		// @param [args.description] {String}	A folder description.
		// @param [args.tags] {Array}	A list of (String) tags.
		// @param [args.fields] {Array}	Request non-standard fields and/or
		//								request a limited set of fields.
		//								
		// https://box-content.readme.io/reference#update-information-about-a-folder
		// 
		update: function(args, cb) {

			var name;
			var description;
			var tags;
			var folderId = env.toNumberOrThrow(args.id, 'folder:update:id');
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
					'https://api.box.com/2.0/folders/%d?fields=%s',
					folderId,
					fields
				),
				body: JSON.stringify(body)
			}), env.complete(cb));
		},

        //////////////////////////////////////////
        //
        // API Extended: Helper functions
        //
        //////////////////////////////////////////

        // Move a folder.
        // This performs a copy then delete operation as there is no
        // defined #move operation in the Box API.
        //
        // @param args {Object}	Call signature
        // @param args.sourceId {Integer}	The numeric id of the folder to
        //									be moved.
        // @param args.destinationId {Integer}	The id of the parent folder into
        //										which #id folder is moved.
        // @param [args.recursive] {Boolean}	Whether to delete subfolders. Default false.
        // @param args.fields {Array}	Request non-standard fields and/or
        //								request a limited set of fields.
        //
        // https://developers.box.com/docs/#folders-copy-a-folder
        // https://developers.box.com/docs/#folders-delete-a-folder
        //
        move: function(args, cb) {

            this.copy(args, function(err, copied) {

                if(err) {
                    return cb(err);
                }

                this.delete({
                    id : args.sourceId,
                    recursive : args.recursive
                }, function(err, res) {
                    if(err) {
                        return cb(err);
                    }

                    cb(null, copied);
                });

            }.bind(this));
        },

        // Get a graph of all folders and files under a given folderId
        //
        // @param args {Object}	Call signature
        // @param args.id {Integer}	The numeric id of the folder start in.
        // @param [args.verbose] {Boolean}  Whether to pass back extended entity info table.
        //
        graph: function(args, cb) {

            // (0) is the Box account root folder.
            //
            var id = typeof args.id === 'undefined'
                        ? 0
                        : env.toNumberOrThrow(args.id, 'folder:graph:id');

            var verbose = _.isBoolean(args.verbose) ? args.verbose : false;

            var lookupTable = {};

            var walk = function(folderId, path) {

                path = util.format('%s%d', path ? path + '/' : '', +folderId);

                return this.info({
                    id: folderId
                })
                .then(function(info) {

                    // Need to return an array (must #map).
                    // If a file, or a folder with no children create an array with 1 element.
                    // #terminal is checked in next block, and stops endlessly
                    // recursing #info on a folder with no children.
                    //
                    if(info.item_collection.total_count === 0) {

                        return[{
                            id: info.id,
                            type: info.type,
                            name: info.name,
                            etag: info.etag,
                            desc: info.description,
                            terminal: true
                        }];
                    }

                    return info.item_collection.entries;
                })
                .map(function(entry) {

                    var lup = {
                        type: entry.type,
                        name: entry.name
                    }

                    if(verbose) {
                        lup.desc = entry.description;
                        lup.etag = entry.etag;
                    }

                    lookupTable[entry.id] = lup;

                    if(entry.type === 'folder' && !entry.terminal) {

                        return walk(entry.id, path);
                    }

                    // If terminal, the path already contains the entity id
                    //
                    return util.format('%s%s', path, entry.terminal ? '' : '/' + entry.id);
                })
                .reduce(function(prev, next) {

                    return prev.concat(next);

                }, []);

            }.bind(this);

            walk(id).then(function(paths) {
                cb(null, {
                   paths: paths,
                   lookup: lookupTable
                });
            });
        }
	};
};