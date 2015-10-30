"use strict";

var util = require('util');
var request = require('request');

var _ = require('lodash');

module.exports = function(test, Promise) {

    var API;

    return this.api
    .bind({}) // Is #this through promise chain
    .then(function(api) {

        API = api;

        return API.folder.create({
            parentId: 0,
            name: 'uploads_temp',
            fields: [
                'name',
                'parent'
            ]
        })
    })
    .then(function(res) {

        console.log('** Upload folder created ->\n', res);

        this.tempUploadId = res.id;

        return API.file.preflightCheck({
            name: 'mynewfile.jpg',
            parentId: res.id
        })
    })
    .then(function(res) {

        console.log('** Preflight Status ->\n', res);

        var tmp = this.tempUploadId;

        return API.file.upload({
            name: 'mynewfile.jpg',
            file: __dirname + '/assets/test_image_upload.jpg',
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

        return API.file.getSharedLink({
            id: res.entries[0].id,
            access: 'open'
        })
    })
    .then(function(res) {
        console.log('**  Shared Link Created ->\n', util.inspect(res, {depth:10}));

        return new Promise(function(resolve, reject) {
            return request(res.shared_link.download_url, function(error, response, body) {
                if(!error && response.statusCode == 200) {
                    return resolve(body);
                }
                reject(error);
            })
        })
    })
    .then(function(res) {

        var bytesdl = Buffer.byteLength(res, 'utf8');

        console.log('**  Download via Shared Link ->', bytesdl, 'bytes');

        this.sharedLinkBytes = bytesdl;

        var dlid = this.upFileId;

        return API.file.download({
            id: dlid
        })
    })
    .then(function(res) {

        var bytesdl = Buffer.byteLength(res, 'utf8');

        console.log('**  Download via API) ->', bytesdl, 'bytes');

        test.equal(bytesdl, this.sharedLinkBytes, 'Shared Link Download and API download returned equal # of bytes (' + bytesdl + ')');

        var tmp = this.tempUploadId;

        return API.folder.list({
            id: tmp
        })
    })
    .then(function(res) {
        console.log('** Upload folder listing after upload ->\n', res);

        var upId = this.upFileId;

        return API.file.info({
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

        return API.file.updateInfo({
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

        return API.folder.list({
            id: tmp,
            fields: []
        })
    })
    .then(function(res) {
        console.log('** Upload folder list after file info updated ->\n', res);

        var upId = this.upFileId;

        // Upload a new version of the file.
        //
        return API.file.update({
            id: upId,
            file: __dirname + '/assets/test_image_update.jpg',
        });
    })
    .then(function(res) {
        console.log('** File version updated ->\n', util.inspect(res, {depth: 10}));

        var tmp = this.tempUploadId;

        return API.folder.list({
            id: tmp,
            fields: []
        })
    })
    .then(function(res) {
        console.log('** Upload folder list after file version updated ->\n', util.inspect(res, {depth: 10}));

        var upId = this.upFileId;
        var tmp = this.tempUploadId;

        // Make a copy of the uploaded file, giving it a new name
        //
        return API.file.copy({
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

        return API.file.delete({
            id: upId
        });
    })
    .then(function(res) {
        console.log('** Deleted file info ->\n', res);

        var tmp = this.tempUploadId;

        return API.folder.list({
            id: tmp
        })
    })
    .then(function(res) {
        console.log('** Upload Folder listing after delete ->\n', util.inspect(res, {depth: 10}));
    })
    .finally(function() {
        console.log('** Deleting upload folder ->\n');

        var tmp = this.tempUploadId;

        console.log('** Deleted folder with id ' + tmp);

        API.folder.delete({
            id: tmp,
            recursive: true
        });
    });
};