const _ = require('lodash');
const Store = require('./Store');
let Namespace = require('./Namespace');

/**
 * @desc Wrapper for current child processes' instantiated namespaces
 *
 * @author Joseph Dan Alinsug <josephdanalinsug@hotmail>
 * @version 1.0
 *
 * @param io
 * @param managerSocket
 * @returns {*}
 * @constructor
 */
let Worker = (io, managerSocket) => {

    return {
        // socket io instance
        io,
        // Manager's socket io
        managerSocket,
        // games registered
        namespaces: {},

        /**
         *
         * @param disableRooms
         * @param managerSocket
         * @param allSocket
         */
        createFromStore (disableRooms, managerSocket, allSocket) {
            Store.getAllHashes().then((row) => {
                for (let i = 0; i < row[1].length; i++) {
                    if (row[1][i] === 'Passwords' || row[1][i].match(/Room/gi) ) {
                        continue;
                    }

                    Store.getAllUnserialized(row[1][i]).then((data) => {
                        this.createNamespace(
                            row[1][i],
                            disableRooms,
                            managerSocket,
                            allSocket,
                            data,
                            {mainMaintenance: typeof data.mainMaintenance == 'object' ? data.mainMaintenance : {}}
                        );
                    });
                }
            })
        },

        /**
         *
         * @param name
         * @param initObject
         * @param extra
         */
        updateStores (name, initObject, extra) {
            return Store.update(name, _.merge(initObject, extra));
        },

        /**
         *
         * @returns {Promise}
         */
        getAllData () {
            let data = this.getGameNamespaces();
            let promises = [];
            _.forEach(data, (namespace) => {
                promises.push(namespace.generate());
            });

            return Promise.all(promises);
        },

        /**
         * @method createNamespace
         *
         * @desc Creates socket io namespace and stores it
         *
         * @param {string} name
         * @param {Boolean} disableRooms
         * @param {Object} managerSocket
         * @param {Object} allSocket
         * @param {Object} initObject
         * @param {Object} extra
         * @memberof Worker
         * @returns {*}
         */
        createNamespace (name, disableRooms, managerSocket, allSocket, initObject, extra) {
            if (this.namespaces[name]) {
                return this.namespaces[name];
            }

            this.namespaces[name] = new Namespace(
                this.io.of(name),
                name,
                disableRooms,
                managerSocket,
                allSocket,
                initObject,
                extra
            );

            return this.namespaces[name];
        },

        /**
         * @method removeNamespaces
         *
         * @desc Remove namespaces provided in the array
         *
         * @param {string} gameName gameName to filter out other namespaces
         * @param {Array} namespaces Array of namespaces
         */
        removeNamespaces(gameName, namespaces = []) {
            let diff = _.difference(this.getGameNamespaceKeys(gameName), namespaces);

            for (let i = 0; i < diff.length; i++) {
                this.namespaces[diff[i]].disconnect();
                delete this.namespaces[diff[i]];
            }
        },

        /**
         * @method getGameNamespaces
         *
         * @desc Return only game namespaces excluding manager and all namespaces
         *
         * @return Array filtered array
         */
        getGameNamespaces () {
            return _.filter(this.namespaces, (ns) => {
                return ns.namespace != 'managers' && ns.namespace != 'all';
            });
        },

        /**
         * @method getGameNamespaceKeys
         *
         * @desc Return namespace keys for all games
         *
         * @param {string} gameName filter namespaces only with the same gameName
         * @returns {Array}
         */
        getGameNamespaceKeys (gameName) {
            return _.filter(_.keys(this.namespaces), (key) => {
                return !gameName ? false : key.indexOf(gameName) !== -1;
            });
        }
    };
};

module.exports = Worker;
