# Box AppAuth SDK

https://box-content.readme.io/v2.0/docs/app-auth

# Testing

You will need to create a `.credentials.js` folder in the root of the application using this module.

This file should look something like:

"use strict";

var fs = require('fs');
var path = require('path');

```
module.exports = {
	publicKey : fs.readFileSync(path.resolve('./rsa/public_key.pem')),
	privateKey : fs.readFileSync(path.resolve('./rsa/private_key.pem')),
	algorithm : 'RS256',
	issuer : '<same as #clientId>',
	subject : '<an app id(#user) or enterprise id(#enterprise)>',
	subjectType : '<user or enterprise>',
	clientId : '<your client id>',
	clientSecret : '<you client Secret>'
};
```