// models.js
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
	name: { type: String, required: true },
	email: { type: String, required: true }
});

mongoose.model('User', userSchema);

var commentSchema = new Schema({
	message: { type: String, required: true }
});

commentSchema.pre('save', function (next) {
	if (this.message.length <= 5) {
		var error = new Error();
		error.name = 'ValidateLength'
		error.message = 'Comments must be longer than 5 characters.';
		return next(error);
	}
	next();
});

var postSchema = new Schema({
	title: { type: String, required: true },
	author: { type: Schema.Types.ObjectId, ref: 'User', index: true },
	comments: [ commentSchema ],
	type: String,
	createdAt: Date
});

postSchema.path('type').validate(function (value) {
  return /article|review/i.test(value);
}, 'InvalidType');

postSchema.method('params', function (params, body, callback) {
	var error = null;
	if (params.foo) {
		body.title = 'Custom';
		body.foo = params.foo;
		callback(error, body);
	} else {
		error = {
			name: 'NoFoo',
			message: 'Foo not found.'
		};
		callback(error);
	}
});

mongoose.model('Post', postSchema);

var excludedSchema = new Schema({
	name: { type: String, required: true }
});

mongoose.model('Excluded', excludedSchema);
