"use strict";

var util = require('util');
var _ = require('lodash');

module.exports = function(test, Promise) {

    var API;

	return this.api
    .bind({})
    .then(function(api) {

        API = api;

        return api.folder.info({
            id: 0,
            fields: [
                'item_collection',
                'modified_by'
            ]
        })
    })
    .then(function(res) {

        test.comment('Tests for -> folder#info');

        test.ok(_.isPlainObject(res), 'Response is an object');

        test.equal(+res.id, 0, 'Received Integer(0) as response #id');

        test.equal(1,1);

        return API.folder.list({
            id: 0,
            limit: '10',
            offset: 0
        });
    })

    .then(function(res) {

        test.comment('Tests for -> folder#list A');

        test.ok(_.isArray(res.entries), '#entries is an Array');

        // Delete all folders with the prefix 'A_NEW_FOLDER'
        //
        var delTargs = res.entries.reduce(function(dt, item) {

            if(item.type !== 'folder' || (!/^A_NEW_FOLDER/.test(item.name) && !/^uploads_temp/.test(item.name))) {
                return dt;
            }

            var id = item.id;
            var name = item.name;

            dt.push(new Promise(function(resolve, reject) {
                API.folder.delete({
                    id: id,
                    recursive: true
                })
                .then(function() {

                    test.pass('Delete of ' + id + ' successful');

                    resolve({
                        id: id,
                        name: name
                    });
                })
                .catch(function(err) {

                    test.fail('Delete of ' + id + ' failed');

                    reject(err);
                });
            }));

            return dt;

        }, []);

        // We're testing this number in next Promise block.
        //
        this.expectedNumToDelete = delTargs.length;

        // Nothing to delete
        //
        if(!delTargs.length) {
            return Promise.resolve([]);
        }

        // Resolve all deletion requests
        //
        return Promise.all(delTargs);

    })
    .then(function(res) {

        test.comment('Tests for -> folder#delete');

        test.ok(_.isArray(res), '#delete returned Array');

        test.equal(this.expectedNumToDelete, res.length);

        return Promise.join(
            API.folder.create({
                parentId: 0,
                name: 'A_NEW_FOLDER_A'
            }),
            API.folder.create({
                parentId: 0,
                name: 'A_NEW_FOLDER_B'
            }),
            API.folder.create({
                parentId: 0,
                name: 'A_NEW_FOLDER_C'
            })
        );
    })
    .then(function(res) {

        test.comment('Tests for -> folder#create');

        test.ok(_.isArray(res), '#create returned Array');

        // Should have created three(3) folders
        //
        test.equal(3, res.length);

        // Simplify list of all new folder item objects to just #id and #name
        //
        var simp = res.reduce(function(coll, fld) {

            coll.push({
                id: fld.id,
                name: fld.name
            });

            return coll;

        },[]);

        // Change name of first new folder
        //
        var id = simp[0].id;
        var name = simp[0].name;
        var rename = name + '_RENAMED';

        // Store list of newly created folders
        //
        this.storedFolderObjects = simp;

        test.comment('Tests for -> folder#update');

        return API.folder.update({
            id: id,
            name: rename
        })
        .bind(this)
        .then(function(res) {

            test.pass('Folder update succeeded for -> ' + name);

            this.storedFolderObjects[0].name = rename;
        })
        .catch(function(err) {
            if(err.code === 'item_name_in_use') {

                test.fail('** Update failed: folder name in use -> ' + name);
            }
        });
    })
    .then(function(res) {

        // Move non-renamed folders into renamed folder.
        // Target folder is first(0) folder in #storedFolderObjects,
        // so after #shift we are copying two(2) folders.
        //
        var targ = this.storedFolderObjects.shift();
        var targId = targ.id;

        this.copyTargetName = targ.name;

        // Create a copy operation for each remaining folder
        // and execute all, fulfilling when all completed.
        //
        return Promise.all(this.storedFolderObjects.map(function(fOb) {
            return API.folder.copy({
                sourceId : fOb.id,
                destinationId : targId,
                fields: ['name', 'parent']
            })
        }));
    })
    .then(function(res) {

        test.comment('Tests for -> folder#copy');

        test.ok(_.isArray(res), '#copy should have returned an Array');

        // Should have two(2) elements.
        //
        test.equal(res.length, 2, 'Two(2) files were #copy-d');

        var ctn = this.copyTargetName;
        var sfn = this.storedFolderNames = this.storedFolderObjects.reduce(function(prev, next) {
            prev.push(next.name);
            return prev;
        }, []);

        // Now ensure two folders with the right names were copied
        // into the right folder (this#copyTargetName, #ctn). Each object
        // should have parent.name of this#copyTargetName, and have
        // a #name corresponding to one of the #name fields in
        // this#storedFolderNames(#sfn)
        //
        test.ok(_.every(res, function(obj) {
            return ~sfn.indexOf(obj.name) && obj.parent.name === ctn;
        }), '#copy-d folders are correct');

        // Get the items in the folder all files were copied into
        //
        return API.folder.list({
            id: res[0].parent.id,
            limit: this.storedFolderObjects.length
        });
    })
    .then(function(res) {
        test.comment('Tests for -> folder#list B');

        test.ok(_.isPlainObject(res), '#list returned an Object');

        test.equal(res.total_count, 2, '#list returned two elements');

        var sfn = this.storedFolderNames;
        test.ok(_.every(res.entries, function(obj) {
            return ~sfn.indexOf(obj.name);
        }), '#copy-d folders listing is correct');
    })
};