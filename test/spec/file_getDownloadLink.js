"use strict";

var util = require('util');
var _ = require('lodash');

// NOTE: This is a very loosey-goosey test requires the given #id to
// actually exist as a file. TODO: create a file then delete it after
//
module.exports = function(test, Promise) {

    return this.api
    .then(function(api) {

        return api.file.getDownloadLink({
            id: 40155627433
        })
        .then(function(link) {

            test.ok(_.isString(link) && link.length > 0, 'Download link created');

        });
    })
};