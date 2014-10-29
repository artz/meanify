/*
	✔︎ DELETE /items/{id}
	✔︎ GET /items
	✔︎ GET /items/{id}
	✔︎ POST /items
	✔︎ PUT /items (optional)
	✔︎ PUT /items/{id}
	✔︎ POST /items/{id} (optional)

	TODO: https://github.com/mgonto/restangular
*/
var debug = require('debug')('meanify');
var express = require('express');
var mongoose = require('mongoose');
var pluralize = require('pluralize');
// mongoose.set('debug', true);

function Meanify(Model, options) {

	if (typeof Model === 'string') {
		Model = mongoose.model(Model);
	}

	var modelName = Model.modelName;
	var meanify = this;

	// Find geospatial index for geo queries.
	// http://docs.mongodb.org/manual/reference/operator/query/nearSphere/
	// https://github.com/LearnBoost/mongoose/wiki/3.6-Release-Notes#geojson-support-mongodb--24
	var indexes = Model.schema._indexes;
	var geoField;
	if (indexes) {
		indexes.forEach(function (indexes) {
			indexes.forEach(function (index) {
				for (var x in index) {
					if (index[x] === '2dsphere') {
						geoField = x;
						break;
					}
				}
			});
		});
	}

	// Enable relationship support on create/delete.
	if (options.relate) {
		var relationships = [];
		var tree = Model.base.modelSchemas[modelName].tree;
		for (var property in tree) {

			// Alternative way of specifying Geospatial index.
			// https://github.com/LearnBoost/mongoose/wiki/3.6-Release-Notes#geojson-support-mongodb--24
			if (tree[property].index === '2dsphere') {
				geoField = property;
			}

			var schema = tree[property];
			if (Array.isArray(schema)) {
				schema = schema[0];
			}

			if (schema.ref) {
				var relatedModel = mongoose.model(schema.ref);
				var relatedTree = relatedModel.base.modelSchemas[schema.ref].tree;
				for (var relatedProperty in relatedTree) {

					var isArray = false;
					var relatedSchema = relatedTree[relatedProperty];
					if (Array.isArray(relatedSchema)) {
						isArray = true;
						relatedSchema = relatedSchema[0];
					}

					if (relatedSchema.ref === modelName) {
						// debug('Found related property: ', y);
						relationships.push({
							isArray: isArray,
							Model: Model,
							property: property,
							relatedModel: relatedModel,
							relatedProperty: relatedProperty
						});
					}
				}
			}
		}
	}

	meanify.search = function search(req, res, next) {
		// TODO: Use Model.schema.paths to check/cast types.
		var fields = req.query;
		var params = {};

		// Normalize count parameter.
		if (fields.hasOwnProperty('__count')) {
			fields.__count = true;
		}

		['count', 'populate', 'sort', 'skip', 'limit', 'near'].forEach(function (param) {
			params[param] = fields['__' + param];
			delete fields['__' + param];
		});

		if (params.near) {

			if (!geoField) {
				return next({
					'error': 'Geospatial Index Not Found',
					'message': 'http://docs.mongodb.org/manual/reference/operator/query/nearSphere/ --> The $nearSphere operator requires a geospatial index and can use either 2dsphere index or 2d index for location data defined as GeoJSON points or legacy coordinate pairs. To use a 2d index on GeoJSON points, create the index on the coordinates field of the GeoJSON object. To set index in Mongoose: // https://github.com/LearnBoost/mongoose/wiki/3.6-Release-Notes#geojson-support-mongodb--24'
				});
			}

			var coordinates = params.near.split(',')
				.map(function (item) {
					return parseFloat(item);
				});

			fields[geoField] = {
				$nearSphere: {
					$geometry: {
						type: 'Point',
						coordinates: coordinates
					}
				}
			};

			// Set max distance (meters) if supplied.
			if (coordinates.length === 3) {
				fields[geoField].$nearSphere.$maxDistance = coordinates.pop();
			}

		}

		var query = Model.find(fields);

		if (params.count) {
			query.count(function (err, data) {
				if (err) {
					return next(err);
				}
				return res.send([data]);
			});
		} else {
			if (params.limit) {
				query.limit(params.limit);
			}
			if (params.skip) {
				query.skip(params.skip);
			}
			if (params.sort) {
				query.sort(params.sort);
			}
			if (params.populate) {
				query.populate(params.populate);
			}
			query.exec(function (err, data) {
				if (err) {
					return next(err);
				}
				return res.send(data);
			});
		}
	};

	meanify.create = function create(req, res, next) {

		Model.create(req.body, function (err, data) {
			if (err) {
				return next(err);
			}

			// Populate relationships.
			if (options.relate) {
				// TODO: Finish relationships before sending response.
				relationships.forEach(function (relation) {

					var referenceId = data[relation.property];
					// Normalize to array.
					if (!Array.isArray(referenceId)) {
						referenceId = [ referenceId ];
					}

					referenceId.forEach(function (id) {
						var update = {};
						update[relation.relatedProperty] = data._id;
						relation.relatedModel.findByIdAndUpdate(id,
							relation.isArray ? { $addToSet: update } : update,
							function (err, data) {
								if (err) {
									debug('Relationship error:', err);
									debug('Failed to relate:',
										relation.relatedModel.modelName,
										relation.relatedProperty);
								}
								debug('Relationship success:', data);
							}
						);
					});

				});
			}

			return res.status(201).send(data);
		});
	};

	meanify.update = function update(req, res, next) {
		var id = req.params.id;
		Model.findById(id, function (err, data) {
			if (err) {
				debug('Error:', err);
				return res.status(400).send(err);
			}
			if (data) {
				// Simple extend.
				for (var property in req.body) {
					data[property] = req.body[property];
				}
				data.save(function (err, data) {
					if (err) {
						return res.status(400).send(err);
					}
					return res.status(204).send();
				});
			} else {
				return res.status(404).send();
			}
		});
	};

	meanify.delete = function del(req, res, next) {
		var id = req.params.id;
		if (id) {
			Model.findByIdAndRemove(id, function (err, data) {
				if (err) {
					debug('Error:', err);
					return next(err);
				}

				// Remove relationships.
				if (options.relate && data) {
					debug('Deleting:', data);
					// TODO: Finish deleting relationships before sending response.
					relationships.forEach(function (relation) {

						var referenceId = data[relation.property];
						// Normalize to array.
						if (!Array.isArray(referenceId)) {
							referenceId = [ referenceId ];
						}

						referenceId.forEach(function (id) {
							var update = {};
							update[relation.relatedProperty] = data._id;
							relation.relatedModel.findByIdAndUpdate(id,
								relation.isArray ? { $pull: update } : { $unset: update },
								function (err, data) {
									if (err) {
										debug('Relationship delete error:', err);
										debug('Failed to delete relation:',
											relation.relatedModel.modelName + '.' +
											relation.relatedProperty);
									}
									debug('Relationship delete success:', data);
								}
							);
						});

					});
				}

				if (data) {
					return res.status(204).send();
				} else {
					return res.status(404).send();
				}

			});

		} else {
			return res.status(404).send();
		}
	};

	meanify.read = function (req, res, next) {

		var populate = '';
		if (req.query.__populate) {
			populate = req.query.__populate;
			delete req.query.__populate;
		}

		var id = req.params.id;
		if (id) {
			Model.findById(id)
				.populate(populate)
				.exec(function (err, data) {
				if (err) {
					debug('Error:', err);
					return next(err);
				}
				if (data) {
					return res.send(data);
				} else {
					return res.status(404).send();
				}
			});
		} else {
			return res.status(404).send();
		}
	};

}

module.exports = function (options) {

	options = options || {};

	var router = express.Router({
		caseSensitive: options.caseSensitive || true,
		strict: options.strict || true
	});

	function api() {
		return router;
	}

	if (options.path) {
		if (options.path.charAt(options.path.length - 1) !== '/') {
			options.path = options.path + '/';
		}
	} else {
		options.path = '/';
	}

	for (var model in mongoose.models) {

		var path = options.path;

		if (options.exclude && options.exclude.indexOf(model) !== -1) {
			continue;
		}

		var route = model;
		if (options.lowercase !== false) {
			route = route.toLowerCase();
		}

		if (options.pluralize) {
			route = pluralize(route);
		}

		path = path + route;

		var meanify = new Meanify(model, options);
		router.get(path, meanify.search);
		debug('GET    ' + path);
		router.post(path, meanify.create);
		debug('POST   ' + path);
		if (options.puts) {
			router.put(path, meanify.create);
			debug('PUT    ' + path);
		}
		path = path + '/:id';
		router.get(path, meanify.read);
		debug('GET    ' + path);
		if (options.puts) {
			router.put(path, meanify.update);
			debug('PUT    ' + path);
		}
		router.post(path, meanify.update);
		debug('POST   ' + path);
		router.delete(path, meanify.delete);
		debug('DELETE ' + path);

		api[route] = meanify;
	}

	return api;
};
