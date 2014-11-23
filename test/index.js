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
  pluralize: true
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

var server = app.listen(port);

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

test('Exit', function (test) {
  test.plan(2);
  server.close(function () {
    test.ok(true, 'Express stopped.');
  });
  mongoose.connection.close(function () {
    test.ok(true, 'Mongoose stopped.');
  });
});
