/* jshint node: true */
'use strict';
var request = require('request');
var tap = require('tap');
var test = tap.test;

// Load test models.
require('./models');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/meanify');

// Start Express app.
var express = require('express');
var app = express();

var meanify = require('../meanify')({
  path: '/api',
  pluralize: true,
  exclude: ['Excluded'],
  jsonp: true,
  filter: function(req,model) { 
    var result = {};
    if (model.modelName == 'Filtered') result['name'] = 'Mr Filter';
    return result;
  }
});
app.use(meanify());

var port = 3811;
var url = 'http://localhost:' + port + '/api/';

console.log('Testing at ' + url);
mongoose.model('User').remove({}, function () {
  console.log('Users removed.');
});
mongoose.model('Post').remove({}, function () {
  console.log('Posts removed.');
});
var notAllowedFiltered;
mongoose.model('Filtered').remove({}, function () {
  console.log('Filtered removed.');
  mongoose.model('Filtered').create({name: 'Not Allowed',email: 'not@allowed.com'}, function (err,res) {
    console.log('  Not Allowed record created');
    notAllowedFiltered = res;
  });
});

var server = app.listen(port);

var testPost;
test('Create', function (test) {

  test.plan(5);

  function createPosts(user) {
    [
      {
        title: 'Post 2012',
        author: user._id,
        createdAt: new Date('2012-01-01')
      },
      {
        title: 'Post 2013',
        author: user._id,
        createdAt: new Date('2013-01-01')
      },
      {
        title: 'Post 2014',
        author: user._id,
        createdAt: new Date('2014-01-01')
      }
    ].forEach(function (post) {
      request.post({
        url: url + 'posts',
        json: true,
        body: post
      }, function (err, res) {
        var body = res.body;
        // populate initial post id
        if (!testPost) {
          testPost = body;
        }
        test.equal(body.title, post.title, 'Response contains post title (' + post.title + ').');
      });
    });
  }

  request.post({
    url: url + 'users',
    json: true,
    body: {
      name: 'Dave',
      email: 'dave@artzstudio.com'
    }
  }, function (err, res) {
    var user = res.body;
    test.equal(res.statusCode, 201, 'User created; status is 201.');
    test.equal(user.name, 'Dave', 'Response contains user (' + user.name + ').');

    createPosts(user);

  });
});

test('Update', function (test) {
  test.plan(1);
  testPost.type = 'poop';
  request.post({
    url: url + 'posts/' + testPost._id,
    json: true,
    body: testPost
  }, function (err, res) {
    var error = res.body;
    test.equal(error.name, 'ValidationError', 'Custom validation error received.');
  });
});

test('Search', function (test) {
  test.plan(2);
  request(url + 'posts', function (err, res) {
    var posts = JSON.parse(res.body);
    test.equal(posts.length, 3, 'Found 3 posts.');
  });
  request(url + 'posts?createdAt=' + JSON.stringify({ $gte: new Date('2013-01-01') }), function (err, res) {
    var posts = JSON.parse(res.body);
    test.equal(posts.length, 2, 'Found 2 posts.');
  });
});

test('Blank', function(test) {
  test.plan(3);
  request(url + 'posts', {method:'post'}, function (err, res) {
    var blank = JSON.parse(res.body);
    test.equal(blank.type, 'article', 'Post.type has a default value');
    var diff = Date.now() - blank.createdAt;
    test.ok(diff < 1000, "Date returned by blank is less than 1 second ago " + blank.createdAt + " diff = " + diff);
    test.equal(blank.title, null, "Title is null");
  })
});


test('Methods', function (test) {
  test.plan(5);
  request.post(url + 'posts/' + testPost._id + '/params?foo=bar', {
    json: true,
    body: testPost
  }, function (err, res) {
    var data = res.body;
    test.equal(res.statusCode, 200, '200 Success reported.');
    test.equal(data.foo, 'bar', 'Foo found: ' + JSON.stringify(data));
    test.equal(data.title, 'Custom', 'Custom title found: ' + data.title);
  });
  request.post(url + 'posts/' + testPost._id + '/params?bar=foo', {
    json: true,
    body: testPost
  }, function (err, res) {
    var data = res.body;
    test.equal(res.statusCode, 400, '400 Error reported.');
    test.equal(data.name, 'NoFoo', 'Error: ' + data.message);
  });
});

var testComment;
test('Sub-document Create', function (test) {
  test.plan(7);
  request.post({
    url: url + 'posts/' + testPost._id + '/comments',
    json: true,
    body: {
      message: 'Marvelous.'
    }
  }, function (err, res) {
    var comment = res.body;
    testComment = comment;
    test.equal(res.statusCode, 201, 'Comment created; status is 201.');
    test.equal(comment.message, 'Marvelous.', 'Response contains comment. ' + JSON.stringify(comment));
  });

  request.post({
    url: url + 'posts/' + testPost._id + '/comments',
    json: true,
    body: {
      message: 'Tiny.'
    }
  }, function (err, res) {
    var data = res.body;
    test.equal(res.statusCode, 400, '400 Error reported.');
    test.equal(data.name, 'ValidateLength', 'Response contains error name (' + data.name + ')');
    test.equal(data.message, 'Comments must be longer than 5 characters.', 'Response contains error message (' + data.message + ')');
  });

  request.post({
    url: url + 'posts/' + testPost._id + '/comments',
    json: true,
    body: {}
  }, function (err, res) {
    var data = res.body;
    test.equal(res.statusCode, 400, '400 Error reported.');
    test.equal(data.name, 'ValidationError', 'Response contains error name (' + data.name + ')');
  });

});

test('Sub-document Read', function (test) {
  test.plan(3);
  request.get({
    url: url + 'posts/' + testPost._id + '/comments/' + testComment._id,
    json: true
  }, function (err, res) {
    var comment = res.body;
    test.equal(res.statusCode, 200, 'Comment read success; status is 200.');
    test.equal(comment.message, 'Marvelous.', 'Read comment. ' + JSON.stringify(comment));
   });

  request.get({
    url: url + 'posts/' + testPost._id + '/comments/should404',
    json: true
  }, function (err, res) {
    test.equal(res.statusCode, 404, 'Comment 404 success.');
  });
});

test('Sub-document Update', function (test) {
  test.plan(2);
  request.post({
    url: url + 'posts/' + testPost._id + '/comments/' + testComment._id,
    json: true,
    body: {
      message: 'Fantastic.'
    }
  }, function (err, res) {
    var comment = res.body;
    test.equal(comment.message, 'Fantastic.', 'Updated message (' + comment.message + ')');
  });
  request.post({
    url: url + 'posts/' + testPost._id + '/comments/' + testComment._id,
    json: true,
    body: {
      message: ''
    }
  }, function (err, res) {
    var error = res.body;
    test.equal(error.name, 'ValidationError', 'Validation error received on update.');
  });
});

test('Sub-document Delete', function (test) {
  test.plan(1);
  request.del({
    url: url + 'posts/' + testPost._id + '/comments/' + testComment._id,
    json: true
  }, function (err, res) {
    test.equal(res.statusCode, 204, 'Deleted comment (' + res.statusCode + ')');
  });
});

test('Sub-document Search', function (test) {
  test.plan(2);
  request.get({
    url: url + 'posts/' + testPost._id + '/comments',
    json: true
  }, function (err, res) {
    var comments = res.body;
    test.equal(res.statusCode, 200, 'Successful search (200).');
    test.equal(comments.length, 0, 'Empty array returned. ' + JSON.stringify(comments));
  });
});

var filtered;
test('Create Filtered', function (test) {
  test.plan(2);
  request.post({
    url: url + 'filtereds',
    json: true,
    body: {
      name: 'Dave',
      email: 'dave@artzstudio.com'
    }
  }, function (err, res) {
    test.equal(res.statusCode, 201, 'User created; status is 201.');
    test.equal(res.body.name, 'Mr Filter', 'Response contains user (' + res.body.name + ').');
    filtered = res.body;
  });
});

test('Search Filtered', function (test) {
  test.plan(1);
  request(url + 'filtereds', function (err, res) {
    var posts = JSON.parse(res.body);
    test.equal(posts.length, 1, 'Found 1 filtered item.');
  });
});

test('Delete Filtered Not Allowed', function (test) {
  test.plan(1);
  request({
    url: url + 'filtereds/' + notAllowedFiltered._id,
    method: 'delete',
  }, function (err, res) {
    test.equal(res.statusCode, 404, 'Failed to delete record not allowed to delete');
    filtered = res.body;
  });
});

test('Exit', function (test) {
  test.plan(2);
  server.close(function () {
    test.ok(true, 'Express stopped.');
  });
  mongoose.connection.close(function () {
    test.ok(true, 'Mongoose stopped.');
  });
});
