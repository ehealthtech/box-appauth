"use strict";

var util = require('util');
var Promise = require('bluebird');
var test = require('blue-tape');
var reporter = require('../lib/apt-tap');
var basic = require('../lib/apt-tap-basic');

	
test
.createStream()
.pipe(reporter(basic))
.pipe(process.stdout);
	
test('the test here', function(t) {
	return new Promise(function(resolve) {	
		t.pass('foo');
		resolve();
	});
});

