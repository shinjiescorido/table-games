/**
 *
 * @type {exports|module.exports}
 *
 * @author Joseph Dan B. Alinsug <josephdanalinsug@hotmail.com>
 */
const _ = require('lodash');
const conf = require('../config');
const bluebird = require('bluebird');
const redis = require('redis');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient(conf.redis.client);


module.exports = {
    /**
     *
     * @param namespace
     * @param data
     * @returns {*}
     */
    update (namespace, ...data) {
        _.forEach(data[0], (row, key) => {
            data[0][key] = _.isObject(row) || _.isNull(row) && !_.isFunction(row)
              ? JSON.stringify(row)
              : (row === undefined ? '' : row);
        });

        return client.hmsetAsync(namespace, ...data);
    },

    /**
     *
     * @param namespace
     */
    getAllUnserialized (namespace) {
       return client.hgetallAsync(namespace).then((data) => {
           _.forEach(data, (row, key) => {
                data[key] = this.parse(row);
           });

           return data;
       });
    },

    /**
     *
     * @param namespace
     * @param field
     */
    getFieldUnserialized (namespace, field) {
       return client.hmgetAsync(namespace, field).then((data) => {
           return this.parse(data);
       })
    },

    /**
     *
     * @param cursor
     * @returns {*}
     */
    getAllHashes (cursor = '0') {
        return client.scanAsync(cursor, 'MATCH', '*/*', 'COUNT', '10000');
    },

    /**
     * @desc Perform hdel asynchronously
     * @param namespace
     * @param key
     * @returns {*}
     */
    hdel (namespace, key) {
        return client.hdelAsync(namespace, key)
    },


   /**
    *  Delete Namespace
    *
    * @param namespace
    * @returns {*}
    */
    del (namespace) {
        return client.delAsync(namespace)
    },

    /**
     *
     * @param namespace
     * @param cursor
     * @param pattern
     * @param count
     * @returns {*}
     */
    async hscan (namespace, cursor, pattern, count = 10000) {
        return client.hscanAsync(namespace, cursor, 'MATCH', pattern, 'COUNT', count)
    },

    /**
     *
     * @param namespace
     * @param cursor
     * @param pattern
     * @param count
     */
    async scan (namespace, cursor = 0, count = 1000000) {
        return client.scanAsync(cursor, 'MATCH', namespace, 'COUNT', count)
    },

    /**
     *
     * @param data
     * @returns {*}
     */
    parse (data) {
        let temp = null;

        try {
            temp = JSON.parse(data);
        }
        catch (error) {
            temp = data;
        }

        return temp;
    },

    hgetall (namespace) {
        return client.hgetallAsync(namespace)
    },

    /**
     *
     * @param params
     */
    buildKeyValue (params) {
        let object = {};
        for (i = 0; i < params.length; i += 2) {
            object[params[i]] = params[i + 1];
        }

        return object;
    }
};
