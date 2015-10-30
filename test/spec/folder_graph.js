"use strict";

var fs = require('fs');
var util = require('util');
var _ = require('lodash');

module.exports = function(test, Promise) {

    var API;

    return this.api
    .then(function(api) {

        API = api;

        return api.folder.graph({
            id: 0,
            verbose: true
        })
    })
    .then(function(graph) {
console.log(graph)
        test.ok(_.isPlainObject(graph), '#graph returned a result');
        test.ok(graph.paths, '#graph returned paths');
        test.ok(graph.lookup, '#graph returned a lookup table');

        fs.writeFileSync('graph.txt', JSON.stringify(graph))
/*
        api.folder.move({
            sourceId: 49007261,
            destinationId: 49004913,
            name: 'smashmouth football',
            recursive: true
        })
        .then(function(boxR) {
            console.log('MOVING-->', boxR)
        })
        .catch(function(err) {
            console.log('moving error', err)
        })
*/
    })
    .catch(function(err) {
        console.log('folder.graph Error:', err);
    });
};