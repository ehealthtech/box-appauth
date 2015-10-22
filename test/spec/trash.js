"use strict";

var util = require('util');
var _ = require('lodash');
var uuid = require('node-uuid');

module.exports = function(test, Promise) {

    var API;

	return this.api
    .then(function(api) {

        API = api;

        return API.folder.create({
            parentId: 0,
            name: 'RESTORED_FILES_FOLDER'
        })
    })
	.bind({}) // Is #this through promise chain 
	.then(function(res) {
		console.log('** New folder created ->\n', res);
		
		this.restoredFolderId = res.id;
		
		return API.trash.list({
			limit: 5,
			offset: 0,
			fields: []
		});
	})
	.then(function(res) {
		console.log('** Trash list ->\n', util.inspect(res, {depth:10}));
		
		// Delete 5 items from trash (either folder or file).
		//
		var targs = res.entries.reduce(function(prev, next) {
		
			var id = next.id;
			var name = next.name;
			var type = next.type;
		
			var meth = next.type === 'folder' 
						? API.trash.destroyFolder
						: API.trash.destroyFile
		
			prev.push(new Promise(function(resolve, reject) {
				meth({
					id: id
				})
				.then(function() {
					resolve(id + ' - ' + name);
				})
				.catch(reject);
			}));
			
			return prev;
			
		}, []);
		
		return Promise.all(targs);
	})
	.then(function(res) {
		console.log('** Trash items destroyed ->\n', res);
		
		return API.trash.list({
			limit: 5,
			fields: []
		});
	})
	.then(function(res) {
		console.log('** Trash list ->\n', util.inspect(res, {depth:10}));
		
		var restoredFolderId = this.restoredFolderId;
		
		// Restore 5 items from trash (either folder or file).
		//
		var targs = res.entries.reduce(function(prev, next) {
		
			var id = next.id;
			var name = next.name;
			var type = next.type;
			
			var newName = name + '_' + uuid.v4();
		
			var meth = next.type === 'folder' 
						? API.trash.restoreFolder
						: API.trash.restoreFile;
		
			prev.push(new Promise(function(resolve, reject) {
				meth({
					id: id,
					parentId: restoredFolderId,
					name: newName
				})
				.then(function() {
					resolve(id + ' - ' + newName);
				})
				.catch(reject);
			}));
			
			return prev;
			
		}, []);
		
		return Promise.all(targs);
	})
	.then(function(res) {
		console.log('** Trash items restored ->\n', util.inspect(res, {depth:10}));
		
		var restoredFolderId = this.restoredFolderId;
		
		return API.folder.list({
			id: restoredFolderId,
			limit: 5,
			offset: 0
		});
	})
	.then(function(res) {
		console.log('** Restored file folder listing ->\n', util.inspect(res, {depth:10}));
	})
	.catch(function(err) {
		console.log("*** ERROR:", util.inspect(err, {depth:10}));
	})
	.finally(function() {
	
		console.log('Deleting restored files folder');

		// Solely for this demo, where we want to always ensure
		// the temp restore folder is deleted in case of error.
		//
		var tmp = this.restoredFolderId;
		
		API.folder.delete({
			id: tmp,
			recursive: true
		});
	})

}; 