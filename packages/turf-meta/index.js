var circle = require('@turf/circle');
var distance = require('@turf/distance');
var point = require('@turf/helpers').point;

/**
 * Iterate over coordinates in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name coordEach
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @param {boolean=} excludeWrapCoord whether or not to include
 * the final coordinate of LinearRings that wraps the ring in its iteration.
 * @example
 * var point = { type: 'Point', coordinates: [0, 0] };
 * coordEach(point, function(coords) {
 *   // coords is equal to [0, 0]
 * });
 */
function coordEach(layer, callback, excludeWrapCoord) {
    var i, j, k, g, l, geometry, stopG, coords, center, radiusMeters,
        geometryMaybeCollection,
        wrapShrink = 0,
        isGeometryCollection,
        isFeatureCollection = layer.type === 'FeatureCollection',
        isFeature = layer.type === 'Feature',
        stop = isFeatureCollection ? layer.features.length : 1;

  // This logic may look a little weird. The reason why it is that way
  // is because it's trying to be fast. GeoJSON supports multiple kinds
  // of objects at its root: FeatureCollection, Features, Geometries.
  // This function has the responsibility of handling all of them, and that
  // means that some of the `for` loops you see below actually just don't apply
  // to certain inputs. For instance, if you give this just a
  // Point geometry, then both loops are short-circuited and all we do
  // is gradually rename the input until it's called 'geometry'.
  //
  // This also aims to allocate as few resources as possible: just a
  // few numbers and booleans, rather than any temporary arrays as would
  // be required with the normalization approach.
    for (i = 0; i < stop; i++) {

        geometryMaybeCollection = (isFeatureCollection ? layer.features[i].geometry :
        (isFeature ? layer.geometry : layer));
        isGeometryCollection = geometryMaybeCollection.type === 'GeometryCollection';
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

        for (g = 0; g < stopG; g++) {
            geometry = isGeometryCollection ?
            geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
            coords = geometry.coordinates;

            wrapShrink = (excludeWrapCoord &&
                (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) ?
                1 : 0;

            if (geometry.type === 'Point') {
                callback(coords);
            } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
                for (j = 0; j < coords.length; j++)
                    callback(coords[j]);
            } else if (geometry.type === 'Circle') {
                center = point(coords);
                radiusMeters = distance(center, point([ coords[0] + geometry.radius, coords[1]]), 'meters');
                coordEach(circle(center, radiusMeters, 16, 'meters'), callback, excludeWrapCoord);
            } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
                for (j = 0; j < coords.length; j++)
                    for (k = 0; k < coords[j].length - wrapShrink; k++)
                        callback(coords[j][k]);
            } else if (geometry.type === 'MultiPolygon') {
                for (j = 0; j < coords.length; j++)
                    for (k = 0; k < coords[j].length; k++)
                        for (l = 0; l < coords[j][k].length - wrapShrink; l++)
                            callback(coords[j][k][l]);
            } else if (geometry.type === 'GeometryCollection') {
                for (j = 0; j < geometry.geometries.length; j++)
                    coordEach(geometry.geometries[j], callback, excludeWrapCoord);
            } else {
                throw new Error('Unknown Geometry Type');
            }
        }
    }
}
module.exports.coordEach = coordEach;

/**
 * Reduce coordinates in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all coordinates is unnecessary.
 *
 * @name coordReduce
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (memo, value) and returns
 * a new memo
 * @param {*} memo the starting value of memo: can be any type.
 * @param {boolean=} excludeWrapCoord whether or not to include
 * the final coordinate of LinearRings that wraps the ring in its iteration.
 * @returns {*} combined value
 */
function coordReduce(layer, callback, memo, excludeWrapCoord) {
    coordEach(layer, function (coord) {
        memo = callback(memo, coord);
    }, excludeWrapCoord);
    return memo;
}
module.exports.coordReduce = coordReduce;

/**
 * Iterate over property objects in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name propEach
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @example
 * var point = { type: 'Feature', geometry: null, properties: { foo: 1 } };
 * propEach(point, function(props) {
 *   // props is equal to { foo: 1}
 * });
 */
function propEach(layer, callback) {
    var i;
    switch (layer.type) {
    case 'FeatureCollection':
        for (i = 0; i < layer.features.length; i++) {
            callback(layer.features[i].properties, i);
        }
        break;
    case 'Feature':
        callback(layer.properties, 0);
        break;
    }
}
module.exports.propEach = propEach;

/**
 * Reduce properties in any GeoJSON object into a single value,
 * similar to how Array.reduce works. However, in this case we lazily run
 * the reduction, so an array of all properties is unnecessary.
 *
 * @name propReduce
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (memo, coord) and returns
 * a new memo
 * @param {*} memo the starting value of memo: can be any type.
 * @returns {*} combined value
 * @example
 * // an example of an even more advanced function that gives you the
 * // javascript type of each property of every feature
 * function propTypes (layer) {
 *   opts = opts || {}
 *   return propReduce(layer, function (prev, props) {
 *     for (var prop in props) {
 *       if (prev[prop]) continue
 *       prev[prop] = typeof props[prop]
 *     }
 *   }, {})
 * }
 */
function propReduce(layer, callback, memo) {
    propEach(layer, function (prop, i) {
        memo = callback(memo, prop, i);
    });
    return memo;
}
module.exports.propReduce = propReduce;

/**
 * Iterate over features in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name featureEach
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @example
 * var feature = { type: 'Feature', geometry: null, properties: {} };
 * featureEach(feature, function(feature) {
 *   // feature == feature
 * });
 */
function featureEach(layer, callback) {
    if (layer.type === 'Feature') {
        callback(layer, 0);
    } else if (layer.type === 'FeatureCollection') {
        for (var i = 0; i < layer.features.length; i++) {
            callback(layer.features[i], i);
        }
    }
}
module.exports.featureEach = featureEach;

/**
 * Get all coordinates from any GeoJSON object, returning an array of coordinate
 * arrays.
 *
 * @name coordAll
 * @param {Object} layer any GeoJSON object
 * @returns {Array<Array<number>>} coordinate position array
 */
function coordAll(layer) {
    var coords = [];
    coordEach(layer, function (coord) {
        coords.push(coord);
    });
    return coords;
}
module.exports.coordAll = coordAll;

/**
 * Iterate over each geometry in any GeoJSON object, similar to
 * Array.forEach.
 *
 * @name geomEach
 * @param {Object} layer any GeoJSON object
 * @param {Function} callback a method that takes (value)
 * @example
 * var point = {
 *   type: 'Feature',
 *   geometry: { type: 'Point', coordinates: [0, 0] },
 *   properties: {}
 * };
 * geomEach(point, function(geom) {
 *   // geom is the point geometry
 * });
 */
function geomEach(layer, callback) {
    var i, j, g, geometry, stopG,
        geometryMaybeCollection,
        isGeometryCollection,
        isFeatureCollection = layer.type === 'FeatureCollection',
        isFeature = layer.type === 'Feature',
        stop = isFeatureCollection ? layer.features.length : 1;

  // This logic may look a little weird. The reason why it is that way
  // is because it's trying to be fast. GeoJSON supports multiple kinds
  // of objects at its root: FeatureCollection, Features, Geometries.
  // This function has the responsibility of handling all of them, and that
  // means that some of the `for` loops you see below actually just don't apply
  // to certain inputs. For instance, if you give this just a
  // Point geometry, then both loops are short-circuited and all we do
  // is gradually rename the input until it's called 'geometry'.
  //
  // This also aims to allocate as few resources as possible: just a
  // few numbers and booleans, rather than any temporary arrays as would
  // be required with the normalization approach.
    for (i = 0; i < stop; i++) {

        geometryMaybeCollection = (isFeatureCollection ? layer.features[i].geometry :
        (isFeature ? layer.geometry : layer));
        isGeometryCollection = geometryMaybeCollection.type === 'GeometryCollection';
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

        for (g = 0; g < stopG; g++) {
            geometry = isGeometryCollection ?
            geometryMaybeCollection.geometries[g] : geometryMaybeCollection;

            if (geometry.type === 'Point' ||
                geometry.type === 'LineString' ||
                geometry.type === 'MultiPoint' ||
                geometry.type === 'Polygon' ||
                geometry.type === 'MultiLineString' ||
                geometry.type === 'MultiPolygon') {
                callback(geometry);
            } else if (geometry.type === 'GeometryCollection') {
                for (j = 0; j < geometry.geometries.length; j++)
                    callback(geometry.geometries[j]);
            } else {
                throw new Error('Unknown Geometry Type');
            }
        }
    }
}
module.exports.geomEach = geomEach;
