'use strict';

	/*
	|--------------------------------------------------------------------------
	| Game server v 1.0
	|----------------------------------------------------------
	| Author : Shinji Escorido
	| 
	| This is a mockup server for every games
	| - connects to socket servers through Nginx
	| - creates a net socket server for the scanners
	|
	*/

// const cluster            = require( 'cluster' );
const express            = require( 'express' );
const numCPUs            = require( 'os' ).cpus().length;
const app                = express();
const server             = require( 'http' ).createServer( app );
const GameController     = require( './gameController' );
const playerGetter       = require( './modules/playGetter' );
const _io                = require('socket.io');
const WebSocketConnector = require( './webSocketConnector' );
const conf               = require( './config' );
let colors = require('colors');
 
colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

const socketServerTCP    = new WebSocketConnector( conf.tcp.connect.port, conf.tcp.connect.host );
const gameName           = conf.gameName;
let games                = [];
const redis = require('redis');
let connGeneral = redis.createClient(conf.redis);
let pubconnGeneral = redis.createClient(conf.redis);
let chinaConn = (conf.redisChina.status)?redis.createClient(conf.redisChina):null;
let extraConn = (conf.redisHk.status)?redis.createClient(conf.redisHk):null;
let pubChinaConn = (conf.redisChina.status)?redis.createClient(conf.redisChina):null;
let pubconnExtra = (conf.redisHk.status)?redis.createClient(conf.redisHk):null;

//cluster.schedulingPolicy = cluster.SCHED_RR;
// cluster.schedulingPolicy = cluster.SCHED_NONE;

// if (cluster.isMaster) {
	
// 	for (let i = 0; i < numCPUs; i++) {
// 		// Create a worker
// 		cluster.fork();
// 	}
// 	cluster.on('exit', (worker, code, signal)=>{
//         console.log('worker ' + worker.process.pid + ' exited');
//     });
// } else {
	socketServerTCP.pubconn      = pubconnGeneral;
	socketServerTCP.conn         = connGeneral;
	socketServerTCP.pubChinaConn = pubChinaConn;
	socketServerTCP.chinaPub     = chinaConn;
	socketServerTCP.pubconnExtra = pubconnExtra;
	socketServerTCP.extraConn    = extraConn;

	socketServerTCP.connect();
	app.get('/', (req, res )=>{res.send('SERVER 1: GAME ON!');});
	app.set('view engine', 'ejs');
	app.use(express.static('public'));

	let ios = _io.listen(server);

	ios.sockets.on('connection', socket=>{
		socket.on('disconnect', ()=>{
			let m = socket.id + ' disconnected';
			
			games[socket.id].log.show('DISCONNECT')
			.catch(()=>{
				console.log('-- socket disconnected');
			});
			delete games[socket.id];
		});

		socket.gameName    = gameName
		socket.logRecorder = [],
		socket.tableId     = null;
		socket.shoeId      = null;
		socket.roundId     = null;
		socket.roundNum    = null;
		socket.status      = null;
		socket.postStatus  = null;
		socket.dealerId    = null;
		socket.bettimer    = null;
		socket.markJson    = {};
		socket.markDatas   = null;
		socket.name = null;
		socket.gameInfo = {};
		socket.latest      = [];
		games[socket.id]          = GameController;
		games[socket.id].gameName = gameName;
		games[socket.id].fnFetchMarks();
		games[socket.id].fnDealerListener(socket);
		socket.on('t',c=>ios.sockets.emit('rd',c));
		games[socket.id].socketServerTCP = socketServerTCP;
		app.get('/mov/:tid',(req,res)=>{
			let playerData = playerGetter;
			playerData.getRtmpLink(req.params.tid)
			.then(link=>{
				res.render('pages/index',{rtmp:link});
			})
			.catch(e=>{
				res.render('pages/index');
			});
		});
	});
	app.get('/view/',(req,res)=>{
		res.render('pages/index2');
	});
	server.listen(conf.serverPort, ()=>{
		let m = 'SERVER 1: app listening on port ' + conf.serverPort + '';
		console.log( m.info );
	});
//  } // end
