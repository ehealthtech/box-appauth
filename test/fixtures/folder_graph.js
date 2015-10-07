"use strict";

var util = require('util');
var _ = require('lodash');

module.exports = function(api, test, Promise) {

    return api.folder.graph({
        id: 0,
        verbose: true
    })
    .then(function(graph) {

        test.ok(_.isPlainObject(graph), '#graph returned a result');
        test.ok(graph.paths, '#graph returned paths');
        test.ok(graph.lookup, '#graph returned a lookup table');

        console.log(util.inspect(graph, {depth: 10}));
    })
    .catch(function(err) {
        console.log('folder.graph Error:', err);
    });
};