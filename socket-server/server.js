/**
 * @desc  socket server as game to clients gateways
 *
 * @version 1.0
 * @author Joseph Dan Alinsug
 */

const cluster          = require('cluster');
const sticky           = require('sticky-session');
const express = require('express');
const numCPUs = require('os').cpus().length;
const adapter = require('socket.io-redis');
const conf = require('./config');
const socketServerConf = conf.socketServers;
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server, {
    transports: ['websocket']
});
const redis = require('redis');
const ClusterManager = require('./lib/ClusterManager');
const Worker = require('./lib/Worker');
const XPacket = require('./lib/XPacket');
const _ = require('lodash');
const Store = require('./lib/Store');
const shouldUpdateAndEmit = parseInt(process.env.SHOULD_UPDATE_AND_EMIT) || 0;
const moment = require('moment');
// create pub/sub client for socket.io-redis adapter and set to unlimited listeners
let subClient = redis.createClient(conf.redis.client);
let pubClient = redis.createClient(conf.redis.client);
let userRegPub = redis.createClient(conf.redis.client);
subClient.setMaxListeners(0);
pubClient.setMaxListeners(0);

// console.log = function() {};

app.get('/', (req, res) => {res.send('ok');});

// graceful exit on ctr-C
//process.on('SIGINT', ()=>process.exit());

const disconnectUser = (data) => {
    _.forEach(data, (row, key) => {
        let temp = key.split(':');
        pubClient.publish('socket-registrations', JSON.stringify({
            eventName: 'reject',
            data: {
                pid: row,
                socketId: temp[temp.length -1],
                app: temp[0]
            }
        }))
    })
}

const updateCredits = (users) => {
    return Store.hgetall('all')
    .then((rows) => {
        let temp = [];

        for (const key in rows) {
            if (!rows.hasOwnProperty(key) || key.match(/maintenance/gi)) {
                continue;
            }

            let [server, id, socketId] = key.split(':');
            let index = _.findIndex(users, (user) => {
                return parseInt(user.id) === parseInt(id);
            });

            if (index === -1) {
                continue ;
            }

            temp.push({server, id, socketId, pid: parseInt(rows[key]), payload: users[index]})
        }

        temp = _.groupBy(temp, 'pid');
        return temp;
    });
};
const getChatUsers = async (userId)=>{
			let users = await Store.hscan('all', 0, `*:${userId}:*`);
            let returnId = null;
			let pid = null;
            if (users[1].length) {
                returnId = (users[1].length > 1)?users[1][users[1].length-2].split('#')[1]:users[1][1].split('#')[1];
				pid = (users[1].length > 1)?users[1][users[1].length-2].split('#')[0]:users[1][1].split('#')[0];
            }
			return {socketId : returnId, pid};
		};
const handler = (data, worker) => {
    try {
        data = JSON.parse(data);
    }
    catch (error) {}

    if (!data || data == 'sticky:balance' || data.type == 'axm:monitor') {
        return;
    }


    if (data.eventName === 'reject' && data.socketId) {
        worker.namespaces['all'].send(data.socketId, 'data', {
            eventName: 'reject'
        })
        return
    }

    if (data.eventName === 'reject' && !data.socketId) {
        return
    }
	if(data.eventName == 'newround'){
		data.currentDate = moment().utc().format('YYYY-MM-DD HH:mm:ss');
	}
	
    if (data.eventName === 'updatecredits') {
        for (let i = 0; i < data.data.length; i++) {
            worker.namespaces['all'].send(
                data.data[i].socketId,
                'data',
                {
                    gameName: data.gameName,
                    tableId: data.tableId,
                    eventName: 'updatecredits',
                    payload: { credits: data.data[i].payload }
                }
            );
        }
        return ;
    }

    if (data.eventName !== 'init' && worker.namespaces[`${data.gameName}/${data.tableId}`]) {
        worker.namespaces[`${data.gameName}/${data.tableId}`].emitter(data);
        return;
    }

	  if (data.eventName == 'mainmaintenancechange' || data.eventName == 'mainnoticechange') {
        for (const key in worker.namespaces) {
            if (key === 'managers' || key === 'Passwords' || key.match('/Rooms/gi')) {
                continue;
            }

            worker.namespaces[key].emitter(data);
        }
    }

    if (!data.tables) {
        return;
    }

    for (let i = 0; i < data.tables.length; i++) {
        if (!data.tables[i].id) {
            continue;
        }
        worker.updateStores(
            `${data.gameName}/${data.tables[i].id}`,
            typeof data.tables[i] == 'object' ? data.tables[i] : {}, {
            mainNotice:typeof data.mainNotice == 'object' ? data.mainNotice : {},
            mainMaintenance: typeof data.mainMaintenance == 'object' ? data.mainMaintenance : {}
        });
    }

    worker.removeNamespaces(data.gameName, _.map(data.tables, (row) => {
        return `${data.gameName}/${row.id}`;
    }));
};

if (cluster.isMaster) {
    // Listeners for game servers
    // webserver listener for http/s requests

    server.once('listening', function() {
        console.log('server started on 3000 port');
    });

    server.once(socketServerConf.ports.http, () =>{
         console.log(`Worker started ${process.pid}`, 'listening on port ' + socketServerConf.ports.http);
    });

    // Listeners for game servers
    let gameServerListener = redis.createClient(conf.redis.game);
    let userRegListener = redis.createClient(conf.redis.client);

    // Fork processes
    for (let i = 0; i < numCPUs; i++) {
        ClusterManager.registerWorker(`Worker ${i + 1}`, cluster.fork());
    }

    cluster.on('message', (worker, message) => {
        ClusterManager.send(message);
    });

    gameServerListener.on('subscribe', (channel) => {
        console.log(`Subscribed to  channel ${channel}`);
    });

    userRegListener.on('subscribe', (channel) => {
        console.log(`Subscribed to  channel ${channel}`);
    });

    userRegListener.on('message', (channel, data) => {
        data = JSON.parse(data);

        if (process.env.APP_NAME !== data.data.app) {
            return;
        }

        ClusterManager.send({
            eventName: 'reject',
            socketId: data.data.socketId,
        }, data.data.pid)
    });

    gameServerListener.on('message', (channel, data) => {
        data = JSON.parse(data);
        if ((data.eventName.toLowerCase().match(/displayresult/g) || data.eventName.toLowerCase().match(/regionalcredits/g)) && (data.userInfo || []).length) {
            updateCredits(data.userInfo).then((rows) => {
                _.forEach(rows, (row, key) => {
                    // second parameter specifies which pid to send it to
                    ClusterManager.send({
                        eventName: 'updatecredits',
                        gameName: data.gameName,
                        tableId: data.tableId,
                        data: row
                    }, key)
                });
            });
        }
        if (!shouldUpdateAndEmit) {
            return ;
        }

        // sends to a random subprocess
        ClusterManager.send(data);
    });

    // subscribe to channel
    gameServerListener.subscribe('game-servers');
    userRegListener.subscribe('socket-registrations');

    process.on('SIGINT', () => {
        server.close(async () => {
            let data = Store.buildKeyValue((await Store.hscan('all', 0, `*`))[1]);
            if (_.keys(data).length) {
                Store.hdel('all', _.keys(data))
            }
        });
    });
} else {
    io.adapter(adapter({subClient, pubClient}));

    let worker = Worker(io, null);
    let all = worker.createNamespace(`all`, true);
    let manager = worker.createNamespace(`managers`, true);

    worker.createFromStore(false, manager, all);

    manager.io.on('connection', (socket) => {
        const start = Date.now()
        // return all data here
        worker.getAllData().then((storeData) => {
            console.log(Date.now() - start + ' ms')
            socket.emit('data', XPacket.send({
                eventName: 'init',
                data: storeData
            }));
        });
	
        // manager sent events
        socket.on('data', (message) => {
            handler(message, worker);
        });
    });

    all.io.on('connection', async (socket) => {
        let namespaces = worker.getGameNamespaces();
        let promises = _.map(namespaces, (namespace) => { return namespace.generate(); });
        
		// will be deleted soon. we just need to test
		/*let rooms = await Store.scan('Rooms:*:*|*').then(async (rooms) => {
            let passwords = Store.buildKeyValue((await Store.hscan('Passwords', 0, '*'))[1]);
            let temp = {};
			let t = '', tid = 0;
            try {
                for (let i = 0; i < rooms[1].length; i++) {
                    let users = Store.buildKeyValue((await Store.hscan(rooms[1][i], 0, '*'))[1]);

                    let uSize = _.chain(Object.values(users))
                        .map(JSON.parse)
                        .filter(['remove',false])
                        .size();

                    let banker = _.chain(Object.values(users))
                        .map(JSON.parse)
                        .find(['type', 'banker'])
                        .value();
		
					let roomSplitted   = rooms[1][i].split('|');
					let gameTableId    = tid = roomSplitted[0].split(':')[1];
					let gameTableName  = t = roomSplitted[2];
					
					let gameTableToken = roomSplitted[4].split(':')[0];
					let flippers = await worker.namespaces[`${gameTableName}/${gameTableId}`].getRoomHighestBettingUsers(gameTableToken);
					let seatMates = await worker.namespaces[`${gameTableName}/${gameTableId}`].getJunketRoomMates(gameTableToken);
                    temp[rooms[1][i]] = {
                        banker: {user_id: banker.userId, user_name: banker.userName},
                        money: banker.money,
			roundCount: banker.roundCount,
			isMulti : banker.isMulti,
			seatMates,
			slave : banker.slave || "normal",
			expireDateUTC : banker.expireDateUTC,
                        users: uSize,
                        password: passwords[rooms[1][i]],
                        avatar: banker.avatar,
						flippers
                    }
                }
				//await worker.namespaces[`${t}/${tid}`].getJunketUserRooms({userId:3071,token:'1859563f-4c22-11e8-9306-00155d063d02',money:15000});
            } catch (error) {console.log(error)}
            return temp
        }); */

        Promise.all(promises).then((values) => {
            // return all data here
            socket.emit('data', XPacket.send({
                eventName: 'init',
                data: values
            }));
        });

        socket.on('register', async (message, next) => {
            let users = await Store.hscan('all', 0, `*:${message.id}:*`);
            next = next || (() => {});
            if (users[1].length) {
                disconnectUser(Store.buildKeyValue(users[1]));
            }

            let data = {};
            data[`${process.env.APP_NAME}:${message.id}:${socket.id}`] = process.pid;
            socket.user_id = message.id;
            Store.update('all', data).catch(console.log);
            next(true);
        });
		
		socket.on('chat', async (message)=>{
		 if(message.isPM){
			let userData = await getChatUsers(message.receiver);
			socket.to('/all#'+userData.socketId).emit('data', 
				XPacket.send({
					eventName : 'chatFromSocket',
					message : message.message,
					sender : message.sender,
					senderName: message.senderName,
					receiver : message.receiver,
					namespace: message.namespace,
					roomId : message.roomId
				})
			);
		}else{
			all.io.emit('data',
			XPacket.send({
				eventName : 'roomBroadcast',
					message : message.message,
					token : message.token,
					namespace: message.namespace,
					roomId : message.roomId
				})
			);
		}
		});
        socket.on('disconnect', () => {
            if (socket.user_id) {
                Store.hdel('all', `${process.env.APP_NAME}:${socket.user_id}:${socket.id}`)
                .catch(console.log);
            }
        });
    });

    let gameNamespaces = worker.getGameNamespaces();

    manager.io.emit('data', XPacket.send({
        eventName: 'init',
        data: _.map(gameNamespaces, (item) => {
            return item.generate();
        })
    }));

    process.on('message', (data) => {
        handler(data, worker);
    });

  // webserver listener for http/s requests
    server.once('listening', function() {
        console.log(`server started on ${process.env.HTTP_PORT} port`);
    });

    server.listen(socketServerConf.ports.http, () =>{
        console.log(`Worker started ${process.pid}`, 'listening on port ' + socketServerConf.ports.http);
    });

    process.on('unhandledRejection', function(err) {
        console.log('Caught exception: ' + err);
    });
}
