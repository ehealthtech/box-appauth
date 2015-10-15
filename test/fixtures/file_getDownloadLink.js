"use strict";

var util = require('util');
var _ = require('lodash');

module.exports = function(api, test, Promise) {

    return api.file.getDownloadLink({
        id: 40155627433
    })
    .then(function(link) {

        console.log("link:", link);
    })
    .catch(function(err) {
        console.log('file.getDownloadLink Error:', err);
    });
};