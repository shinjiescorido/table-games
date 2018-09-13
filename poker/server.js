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

//const cluster            = require( 'cluster' );
const express            = require( 'express' );
//const numCPUs            = require( 'os' ).cpus().length;
const app                = express();
const server             = require( 'http' ).createServer( app );
const GameController     = require( './gameController' );
const playerGetter     = require( './modules/playerGetter' );
const _io                = require('socket.io');
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

//const socketServerTCP    = new WebSocketConnector( conf.tcp.connect.port, conf.tcp.connect.host );
const gameName           = conf.gameName;
let games                = [];
const redis    = require('redis');
console.log(conf);
let connGeneral = redis.createClient(conf.redis);
let connChina = (conf.redisChina.status)?redis.createClient(conf.redisChina):null;
let pubConnChina = (conf.redisChina.status)?redis.createClient(conf.redisChina):null;

let extraConn = (conf.redisHk.status)?redis.createClient(conf.redisHk):null;
let pubconnExtra = (conf.redisHk.status)?redis.createClient(conf.redisHk):null;
		if(conf.redisHk.status){
			extraConn.on('ready', ()=>{
				console.log('staging redis connected!'.info);
			});
			extraConn.on('error', (e)=>{
				console.log('extra conn disconnected, error: '.error, e);
			});

			pubconnExtra.on('ready', ()=>{
				console.log('staging redis connected!'.info);
			});
			pubconnExtra.on('error', (e)=>{
				console.log('extra conn disconnected, error: '.error, e);
			});
		}

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
	GameController.conn = connGeneral;
	GameController.connChina = connChina;
	GameController.pubConnChina = pubConnChina;
	
	GameController.extraConn = extraConn;
	GameController.pubconnExtra = pubconnExtra;


	GameController.startGame();

	app.use(express.static('public'));
	app.set('view engine', 'ejs');

	app.use(express.static('public'));
	let ios = _io.listen(server);

	ios.sockets.on('connection', socket=>{
		
		socket.on('disconnect', ()=>{
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
		socket.dealerName = null;
		socket.gameInfo = {
			burn   : [],
			player : [],
			dealer : [],
			flop: [],
			turn   : null,
			river  : null
		};
		socket.status      = null;
		socket.postStatus  = null;
		socket.dealerId    = null;
		socket.bettimer    = null;
		socket.markJson    = {};
		socket.resultHolder = null;
		socket.markDatas   = null;
		socket.latest      = [];
		socket.on('t',c=>ios.sockets.emit('rd',c));
		games[socket.id]          = GameController;
		games[socket.id].gameName = gameName;
		games[socket.id].fnDealerListener(socket);
	});
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
	app.get('/',(req,res)=>{
		//res.render('pages/index2');
		 res.send( gameName + ' SERVER 1: app listening on port ' + conf.serverPort );
	});
	server.listen(conf.serverPort, ()=>{   
		console.log( gameName + ' SERVER 1: app listening on port ' + conf.serverPort );
	});
 //} // end
