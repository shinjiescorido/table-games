let _ = require('lodash');

/**
 *
 * @desc ClusterManager, Syntactical sugar for managing processes
 *
 * @namespace ClusterManager
 * @author Joseph Dan Alinsug <josephdanalinsug@hotmail.com>
 * @version 1.0
 * @type {{workers: {}, registerWorker: (function(*, *)), send: (function(*, *))}}
 */
let ClusterManager = {
    // Forked workers
    workers: {},

    /**
     * @method registerWorker
     *
     * @desc Add additional workers to workers property, reject if it already exists
     * or replace if third parameter is passed
     *
     * @param {String} name worker name
     * @param {ChildProcess} worker forked process
     * @param {boolean} replace force replace existing worker
     * @memberof Worker
     */
    registerWorker (name, worker, replace) {
        if (this.workers[name] && !replace) {
            return ;
        }

        this.workers[name] = worker;
    },

    /**
     * @method send
     *
     * @desc Send data to child workers
     *
     * @param {Object, String} data
     * @param {Number} pid child's process id
     * @memberof ClusterManager
     */
    send (data, pid = null) {
        let worker = null;

        try {
            data = JSON.parse(data);
        }
        catch (error) {}

        if (!data) {
            return;
        }

        if (pid && (worker = (_.find(this.workers, (worker) =>  worker.process.pid === parseInt(pid))))) {
            try {
                worker.send(data);
            } catch (error) {
                console.log(error)
            }
            return ;
        }

        // failed to send to correct pid
        if (pid) {
            return ;
        }

        if (data.eventName != 'init') {
            let randomized = _.shuffle(_.keys(this.workers));
            randomized.length ? this.workers[randomized[0]].send(data) : null;
            return ;
        }

        for (const key in this.workers) {
            this.workers[key].send(data);
        }
    }
};

module.exports = ClusterManager;
