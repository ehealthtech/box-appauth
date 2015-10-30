"use strict";

var Path = require('path');
var appAuth = require('../../lib');

// Auth info for Box that every test will need.
//
var auth = require(Path.resolve('.credentials.js'));
var API;

// Want to do some preliminary tests of the API before returning the fixture.
// TODO: test all methods? Break a collections into individual global fixtures?
//
module.exports = function(test) {

    var apiP = appAuth(auth)
    .then(function(api) {

        API = api;

        return api.folder.info({
            id: 0
        })
    })
    .then(function(info) {

        return API;
    })
    .catch(function(err) {
        test.fail('API Fixture test failure:' + err)
    });

    return {
        api : apiP
    }
};