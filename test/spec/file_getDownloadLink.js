"use strict";

var util = require('util');
var _ = require('lodash');

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