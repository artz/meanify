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
