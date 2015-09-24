"use strict";

var fs = require('fs');
var path = require('path');
var util = require('util');
var Promise = require('bluebird');
var test = require('blue-tape');
var glob = require('glob');
var appAuth = require('../lib');
var Promise = require('bluebird');
var reporter = require('apt-tap');
var basic = require('apt-tap-basic');

Promise.longStackTraces();

// Auth info for Box that every test will need.
//
var auth = require(path.resolve('.credentials.js'));

// To run specific tests, pass them along via command line.
//
var tests = process.argv.splice(2);

if(tests.length) {
	tests = tests.map(function(name) {
		return util.format('./fixtures/%s.js', name);
	});
} else {

	// Otherwise, run them all
	//
	tests = glob.sync(__dirname + '/fixtures/**/*.js');
}

// Try to authenticate (this terminates everything if it fails),
// then run tests, passing along the authenticated #api, the
// test "harness", and a Promise constructor.
//
// Promise.reduce awaits resolved promises, so it will execute
// test fixtures in order. This is why we #finally(resolve) the
// new Promise returned.
//
appAuth(auth)
.then(function(api) {
	
	test
	.createStream()
	.pipe(reporter(basic))
	.pipe(process.stdout);
	
	Promise.reduce(tests, function(prev, path) {
	
		return new Promise(function(resolve) {
			test(path, function(t) {
				return require(path)(api, t, Promise).finally(resolve);
			})
		});
		
	}, []);
	
})
.catch(function(err) {
	console.log("** Unable to authenticate", err);
});