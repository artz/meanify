# meanify
[![Gitter](https://badges.gitter.im/Join Chat.svg)](https://gitter.im/artzstudio/meanify?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

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
sort     | Sorts the record according to provided [shorthand sort syntax](http://mongoosejs.com/docs/api.html#query_Query-sort) (e.g. `&__sort=-name`).
populate | Populates object references with the full resource (e.g. `&__populate=users`).
count    | When present, returns the resulting count in an array (e.g. `[38]`).
near     | Performs a geospatial query on given coordinates and an optional range (in meters), sorted by distance by default. Required format: `{longitude},{latitude},{range}`

Meanify also supports range queries. To perform a range query, pass in a stringified JSON object into the field on the request.

```
GET /api/posts?createdAt={"$gt":"2013-01-01T00:00:00.000Z"}
```

Using `ngResource` in AngularJS, performing range queries are easy:

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


## Roadmap

* Generation of AngularJS ngResource service via `/api/?ngResource` endpoint.

## Changelog

### 0.1.2 | 11/23/2014
* JSON object support in query parameters, enabling range queries.
* `body-parser` middleware is bundled in meanify router.
* Started unit test framework and added `.jshintrc`.

### 0.1.1 | 10/28/2014
* Basic example of a service using meanify.

### 0.1.0 | 10/28/2014
* Alpha release ready for publish to npm and testing.
