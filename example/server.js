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
