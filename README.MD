# Box AppAuth SDK

https://box-content.readme.io/v2.0/docs/app-auth

# Usage

You will need to create a Box account and proper public/private keys, and register them with Box.

Then:

```

var appAuth = require('box-appauth');

appAuth({
	publicKey : Your public key,
	privateKey : Your private key,
	algorithm : one of ['RS256','RS384','RS512'], Default 'RS256'
	issuer : The same as #clientId,
	subject : An app id(#user) or enterprise id(#enterprise),
	subjectType : 'user' or 'enterprise',
	clientId : Your client id,
	clientSecret : Your client Secret,
    publicKeyId: The id of your public key,
    callRetryMax: The number of call retries before giving up,
    minutesUntilTokenRefresh: Lifespan of a token in minutes. Must be >= 5 & <=50
})
.then(function(api) {

	...do something with the Promise based api

	api.folders
	.methodA({...})
	.then(function(resultOfMethodA) {
	   return api.folder.methodB()
	})
	.then(function(resultOfMethodB) {
	    // etc across as many calls as you'd like, all
	    // executed "sequentially".
	})
	.catch(function(err) {
	    ...
	})

})
.catch(function(err) {
	console.log("** Unable to authenticate **", err);
});

```

# Tests

You will need to create a `.credentials.js` folder in the root of the application using this module.

This file should look something like this:

```
"use strict";

var fs = require('fs');
var path = require('path');

module.exports = {
	publicKey : fs.readFileSync(path.resolve('./rsa/public_key.pem')),
	privateKey : fs.readFileSync(path.resolve('./rsa/private_key.pem')),
	algorithm : 'RS256',
	issuer : '<same as #clientId>',
	subject : '<an app id(#user) or enterprise id(#enterprise)>',
	subjectType : '<user or enterprise>',
	clientId : '<your client id>',
	clientSecret : '<your client Secret>',
    publicKeyId: '<the id of your public key>
};
```

To run all tests:

```
node test
```
or
```
npm test
```

To run individual, or a few individual, tests look in the `test/spec` folder and use the file names:

```
node test folders
node test folders folder_graph
```




