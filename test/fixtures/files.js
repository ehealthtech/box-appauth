"use strict";

var util = require('util');
var _ = require('lodash');

module.exports = function(api, test, Promise) {

	return api
	.folder.create({
		parentId: 0,
		name: 'uploads_temp',
		fields: [
			'name',
			'parent'
		]
	})
	.bind({}) // Is #this through promise chain 

	.then(function(res) {
	
		console.log('** Upload folder created ->\n', res);

		this.tempUploadId = res.id;

		return api.file.preflightCheck({
			name: 'mynewfile.jpg',
			parentId: res.id
		})
	})
	.then(function(res) {
	
		console.log('** Preflight Status ->\n', res);
		
		var tmp = this.tempUploadId;

		return api.file.upload({
			name: 'mynewfile.jpg',
			file: __dirname + '/assets/test_image.jpg',
			parentId: tmp,
			fields: [
				'total_count'
			]
		})
	})
	.then(function(res) {
		console.log('**  Upload ->\n', util.inspect(res, {depth:10}));
		
		// Store new file id
		//
		this.upFileId = res.entries[0].id;
		
		var tmp = this.tempUploadId;
		
		return api.file.download({
			id: res.entries[0].id
		})
	})
	.then(function(res) {
		console.log('**  Download ->', Buffer.byteLength(res, 'utf8'), 'bytes');
		
		var tmp = this.tempUploadId;

		return api.folder.list({
			id: tmp
		})
	})
	.then(function(res) {
		console.log('** Upload folder listing after upload ->\n', res);
		
		var upId = this.upFileId;
		
		return api.file.info({
			id: upId,
			fields: [
				'file_version',
				'size',
				'parent'
			]
		});
	})
	.then(function(res) {
		console.log('** Uploaded file info ->\n', util.inspect(res, {depth: 10}));
		
		var upId = this.upFileId;
		
		return api.file.update({
			id: upId,
			name: 'booberry.jpg',
			description: 'This describes a new booberry file',
			tags: [
				'some',
				'tags',
				'here'
			],
			fields : [
				'name',
				'file_version',
				'tags',
				'description'
			]
		});
	})
	.then(function(res) {
		console.log('** Updated file info ->\n', res);

		var tmp = this.tempUploadId;
		
		return api.folder.list({
			id: tmp,
			fields: []
		})
	})
	.then(function(res) {
		console.log('** Upload folder list after file info updated ->\n', res);
		
		var upId = this.upFileId;
		var tmp = this.tempUploadId;

		// Make a copy of the uploaded file, giving it a new name
		//
		return api.file.copy({
			id: upId,
			toFolderId: tmp,
			name: 'abrandnew_name.jpg',
			fields: [
				'file_version',
				'name',
				'parent'
			]
		});
	})
	.then(function(res) {
		console.log('** Uploaded file copied ->\n', util.inspect(res, {depth: 10}));
		
		var upId = this.upFileId;
		
		return api.file.delete({
			id: upId
		});
	})
	.then(function(res) {
		console.log('** Deleted file info ->\n', res);

		var tmp = this.tempUploadId;
		
		return api.folder.list({
			id: tmp
		})
	})
	.then(function(res) {
		console.log('** Upload Folder listing after delete ->\n', util.inspect(res, {depth: 10}));
	})
	.finally(function() {
		console.log('** Deleting upload folder ->\n');
		
		var tmp = this.tempUploadId;
		
		api.folder.delete({
			id: tmp,
			recursive: true
		});
	});
}; 