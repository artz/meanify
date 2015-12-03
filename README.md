# meanify

Node.js Express middleware that uses your Mongoose schema to generate SCRUD API routes compatible with AngularJS and ngResource.

## Implementation

Before you begin, be sure [MongoDB is installed](http://docs.mongodb.org/manual/installation/) and `mongod` is running.

Install meanify as a dependency and add it to your `package.json` file.

```
npm install meanify --save
```

First, define your Mongoose models and any necessary validations and indexes.

```
// models.js
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
	name: { type: String, required: true },
	email: { type: String, required: true },
	password: { type: String, required: true }
});
mongoose.model('User', userSchema);

var postSchema = new Schema({
	title: { type: String, required: true },
	contents: { type: String, required: true },
	author: { type: Schema.Types.ObjectId, ref: 'User', index: true }
});
mongoose.model('Post', postSchema);
```
Initialize meanify's router middleware after your Mongoose models.

```
// server.js
var express = require('express');
var app = express();

require('./models');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/meanify');

var meanify = require('meanify')({
	path: '/api',
	pluralize: true
});
app.use(meanify());

app.listen(3001);
```
Start up your express app using the `DEBUG=meanify` param to verify your routes.

```
➜ DEBUG=meanify node server.js
```

The meanify log will show the newly created endpoints.

```
meanify GET    /api/users +0ms
meanify POST   /api/users +0ms
meanify GET    /api/users/:id +0ms
meanify POST   /api/users/:id +0ms
meanify DELETE /api/users/:id +0ms
meanify GET    /api/posts +0ms
meanify POST   /api/posts +0ms
meanify GET    /api/posts/:id +0ms
meanify POST   /api/posts/:id +0ms
meanify DELETE /api/posts/:id +0ms
```
The middleware functions powering these routes may also be accessed directly for more control over route creation.

For example:

```
// app.use(meanify()); // Disable automatic routing.

app.get('/api/posts', meanify.posts.search);
app.post('/api/posts', meanify.posts.create);
app.get('/api/posts/:id', meanify.posts.read);
app.put('/api/posts/:id', meanify.posts.update); // Support PUT instead of POST.
// app.delete('/api/posts/:id', meanify.posts.delete); // Disable this route.
```


## Options

meanify expects options to be passed in on require of the module as seen below. This builds an Express middleware router object, which is accessed by invoking the returned function.

```
var meanify = require('meanify')({
	path: '/api',
	exclude: ['Counter'],
	lowercase: false,
	pluralize: true,
	caseSensitive: false,
	strict: false,
	puts: true,
	relate: true
});
app.use(meanify());
```
### path
The root path to be used as a base for the generated routes. Default: `'/'`

### exclude
Array of models to exclude from middleware generation. Default: `undefined`

### lowercase
Prevents Meanify from lowercasing generated route name. Default: `true`

### pluralize
Pluralizes the model name when used in the route, i.e. "user" becomes "users". Default: `false`

### caseSensitive
Enable case sensitivity, treating "/Foo" and "/foo" as different routes. Default: `true`

### strict
Enable strict routing, treating "/foo" and "/foo/" differently by the router. Default `true`

### puts
By default, ngResource does not support PUT for updates without [making it more RESTful](http://kirkbushell.me/angular-js-using-ng-resource-in-a-more-restful-manner/). This option adds PUT routes in addition to the POST routes for resource creation and update.

### relate
Experimental feature that automatically populates references on create and removes them on delete. Default: `false`

## Usage

For each model, five endpoints are created that handle resource search, create, read, update and delete (SCRUD) functions.

### Search
```
GET /{path}/{model}?{fields}{options}
```
The search route returns an array of resources that match the fields and values provided in the query parameters.

For example:

```
GET /api/posts?author=544bbbceecd047be03d0e0f7&__limit=1
```
If no query parameters are present, it returns the entire data set.  No results will be an empty array (`[]`).

Options are passed in as query parameters in the format of `&__{option}={value}` in the query string, and unlock the power of MongoDB's `find()` API.

Option   | Description
-------- | -------------
limit    | Limits the result set count to the supplied value.
skip     | Number of records to skip (offset).
distinct | Finds the distinct values for a specified field across the current collection.
sort     | Sorts the record according to provided [shorthand sort syntax](http://mongoosejs.com/docs/api.html#query_Query-sort) (e.g. `&__sort=-name`).
populate | Populates object references with the full resource (e.g. `&__populate=users`).
count    | When present, returns the resulting count in an array (e.g. `[38]`).
near     | Performs a geospatial query on given coordinates and an optional range (in meters), sorted by distance by default. Required format: `{longitude},{latitude},{range}`

Meanify also supports range queries. To perform a range query, pass in a stringified JSON object into the field on the request.

```
GET /api/posts?createdAt={"$gt":"2013-01-01T00:00:00.000Z"}
```

Using `ngResource` in AngularJS, performing a range query is easy:

```
// Find posts created on or after 1/1/2013.
Posts.query({
	createdAt: JSON.stringify({
		$gte: new Date('2013-01-01')
	})
});
```

### Create
```
POST /{path}/{model}
```
Posting (or putting, if enabled) to the create route validates the incoming data and creates a new resource in the collection. Upon validation failure, a `400` error with details will be returned to the client. On success, a status code of `201` will be issued and the new resource will be returned.

### Read
```
GET /{path}/{model}/{id}
```
The read path returns a single resource object in the collection that matches a given id. If the resource does not exist, a `404` is returned.

### Update
```
POST /{path}/{model}/{id}
```
Posting (or putting, if enabled) to the update route will validate the incoming data and update the existing resource in the collection and respond with `204` if successful. Upon validation failure, a `400` error with details will be returned to the client. A `404` will be returned if the resource did not exist.

### Delete
```
DELETE /{path}/{model}/{id}
```
Issuing a delete request to this route will result in the deletion of the resource and a `204` response if successful. If there was no resource, a `404` will be returned.

## Sub-documents

[Mongoose sub-documents](http://mongoosejs.com/docs/subdocs.html) let you define schemas inside schemas, allowing for nested data structures that [can be validated](http://mongoosejs.com/docs/validation.html) and [hooked into via middleware](http://mongoosejs.com/docs/middleware.html).

```
var commentSchema = new Schema({
	message: { type: String, required: true }
});

var postSchema = new Schema({
	title: { type: String, required: true },
	author: { type: Schema.Types.ObjectId, ref: 'User', index: true },
	comments: [ commentSchema ],
	createdAt: Date
});

mongoose.model('Post', postSchema);
```

Meanify will detect sub-documents and expose SCRUD routes beneath the top-level models.

```
meanify GET    /api/posts/:id/comments +1ms
meanify POST   /api/posts/:id/comments +0ms
meanify GET    /api/posts/:id/comments/:commentsId +0ms
meanify POST   /api/posts/:id/comments/:commentsId +0ms
meanify DELETE /api/posts/:id/comments/:commentsId +0ms
```
These routes work similar to the model SCRUD routes defined above, with the exception of the Search route.  Currently, options are not supported so a `GET` to the sub-document collection will simply return the entire array set.

The sub-document middleware is made available underneath the parent middleware.

```
app.post('/api/posts/:id/comments/:commentsId', meanify.posts.comments.update);
```

## Validation Hooks

Meanify will handle [validation described by your models](http://mongoosejs.com/docs/validation.html), as well as any [error handling defined](http://mongoosejs.com/docs/middleware.html) in your `pre` middleware hooks.

```
postSchema.path('type').validate(function (value) {
  return /article|review/i.test(value);
}, 'InvalidType');

```

The above custom validator example will return a validation error if a value other than "article" or "review" exists in the `type` field upon creation or update.

Example response:

```
{
	message: 'Validation failed',
	name: 'ValidationError',
	errors: {
		type:
			{
				message: 'InvalidType',
				name: 'ValidatorError',
				path: 'type',
				type: 'user defined',
				value: 'poop'
			}
		}
	}
}
```

Advanced validation for the create and update routes may be achieved using the `pre` hook, for example:

```
commentSchema.pre('save', function (next) {
	if (this.message.length <= 5) {
		var error = new Error();
		error.name = 'ValidateLength'
		error.message = 'Comments must be longer than 5 characters.';
		return next(error);
	}
	next();
});
```
Meanify will return a `400` with the error object passed by your middleware.

```
{
	name: 'ValidateLength',
	message: 'Comments must be longer than 5 characters.'
}
```

## Instance Methods

[Instance methods](http://mongoosejs.com/docs/guide.html#methods) can also be defined on models in Mongoose and accessed via the meanify API routes.

```
postSchema.method('mymethod', function (req, res, done) {
	var error = null;
	var query = req.query;
	var body = req.body;
	if (query.foo) {
		// Do some stuff with query params.
		body.foo = query.foo;
		// Return new object in the response.
		done(error, body);
	} else {
		error = {
			name: 'NoFoo',
			message: 'Foo not found.'
		};
		// Send error.
		done(error);
	}
});
```

Instance methods defined on schemas should expect three arguments: the `request` object, `response` object, and a `done` callback.

If the `done` callback sees `null` as the first argument and the modified resource object second, a successful `200` response will be returned along with the resource object as the body. If the callback sees the error defined as the first argument, a failure (i.e. a `400`) response is returned.

The `response` object gives you more control over the response and status code sent. For example, you could send a `401` or `403` response status (i.e. `res.status(401).send()`) instead of the standard `400` using the callback.

Note that inside the schema method context, `this` refers to the resource document found in the database.

**Note:** When naming your instance methods, choose something other than the [built-in instance methods in Mongoose](http://mongoosejs.com/docs/api.html#document-js).

Methods are invoked by adding it after the `id` segment of the `POST` request.

```
POST /{path}/{model}/{id}/{method}?foo=bar
```
The query parameters and body of the `POST` are passed to the instance method, returning a `200` status and resource body if successful, or a `400` status and error object if not.

Custom instance methods are made available under the `meanify.update` property for greater control in your routes. Note that the `:id` parameter is required.

```
app.post('/api/posts/:id/mymethod', meanify.posts.update.mymethod);
```

**Note:** Instance methods are not supported on sub-documents.

## Roadmap

* Nested sub-documents.
* Sub-document instance methods.
* Static methods.
* Generation of AngularJS ngResource service via `/api/?ngResource` endpoint.
* Examples and documentation on integration in AngularJS.

## Changelog

### 0.1.6 | 12/31/2014
* Instance method constructor supports `req`, `res`, `next` interface.

### 0.1.5 | 12/8/2014
* Generated routes and middleware for schema sub-documents.
* Validation and error handling in middleware `pre` hooks.

### 0.1.4 | 12/7/2014
* Generated routes and middleware for model instance methods.

### 0.1.3 | 12/5/2014
* `exclude` option excludes models from router but retains middleware functions.

### 0.1.2 | 11/23/2014
* JSON object support in query parameters, enabling range queries.
* `body-parser` middleware is bundled in meanify router.
* Started unit test framework and added `.jshintrc`.

### 0.1.1 | 10/28/2014
* Basic example of a service using meanify.

### 0.1.0 | 10/28/2014
* Alpha release ready for publish to npm and testing.
