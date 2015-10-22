"use strict";

var util = require('util');
var _ = require('lodash');

module.exports = function(test, Promise) {

    var API;

	return this.api
    .then(function(api) {

        API = api;

        return API.folder.create({
            parentId: 0,
            name: 'uploads_temp',
            fields: [
                'name',
                'parent'
            ]
        });
    })
	.bind({}) // Is #this through promise chain
	.then(function(res) {
	
		console.log('** Upload folder created ->\n', res);

		this.tempUploadId = res.id;

		return Promise.all([
			__dirname + '/assets/foo.txt', 
			__dirname + '/assets/bar.txt'
		].map(function(file) {
			return API.file.upload({
				name: file.match(/.*\/([^\s]+)$/)[1], // last path segment
				file: file,
				parentId: res.id
			});
		}));
	})
	.then(function(res) {
		console.log('**  Upload ->\n', util.inspect(res, {depth:10}));

		var tmp = this.tempUploadId;
		
		return API.folder.list({
			id: tmp
		})
	})
	.then(function(res) {
		console.log('** Upload Folder listing ->\n', util.inspect(res, {depth: 10}));
		
		var tmp = this.tempUploadId;
		
		return API.search.execute({
			query: 'fi',
			fileExtensions: ['txt'],
			ancestorFolderIds: [0, tmp],
			contentTypes: ['file_content'],
			offset: 0,
			limit: 10
		});
	})
	.then(function(res) {
		console.log('** Search results ->\n', util.inspect(res, {depth: 10}));
	})
	.catch(function(err, res) {
		console.log("*** ERROR:", util.inspect(err, {depth:10}), res);
	})
	.finally(function() {
	
		console.log('Deleting temp upload folder');

		// Solely for this demo, where we want to always ensure
		// the temp upload folder is deleted in case of error.
		//
		var tmp = this.tempUploadId;
		
		API.folder.delete({
			id: tmp,
			recursive: true
		});
	
	});
}; 
