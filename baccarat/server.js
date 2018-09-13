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

const cluster            = require( 'cluster' );
const express            = require( 'express' );
const numCPUs            = require( 'os' ).cpus().length;
const app                = express();
const server             = require( 'http' ).createServer( app );
const GameController     = require( './gameController' );
const playerGetter     = require( './modules/playerGetter' );
const _io                = require('socket.io');
const WebSocketConnector = require( './webSocketConnector' );
let conf               = require( './config' );
const webSocketConnector    = new WebSocketConnector( conf.redis.port, conf.redis.host  );
const gameName           = conf.gameName;
let games                = [];
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
//if (cluster.isMaster) {
//    for (let i = 0; i < numCPUs; i++) {
//        // Create a worker
//        cluster.fork();
//    }
//
//    cluster.on('exit', (worker, code, signal)=>{
//        console.log('worker ' + worker.process.pid + ' exited');
//    });
//} else {

    webSocketConnector.connect();
    webSocketConnector.extraConn.on('error',e=>{
		console.log(' server redis errors --------------------------->> '.verbose);
		//webSocketConnector.extraConn.quit();
		//conf.redisHk.status = false;
	});
	webSocketConnector.pubconnExtra.on('error',e=>{
                //webSocketConnector.pubconnExtra.quit();
                //conf.redisHk.status = false;
        });

    app.use(express.static('public'));
    app.set('view engine', 'ejs');
    app.get('/', (req, res) => {res.send('SERVER 1: GAME ON!');});

    

    let ios = _io.listen(server);

    ios.sockets.on('connection', socket => {
        socket.on('disconnect', () => {
			games[socket.id].log.show('DISCONNECT')
			.catch(()=>{
				console.log('-- socket disconnected');
			});
            delete games[socket.id];
        });

        socket.gameName    = gameName;
        socket.logRecorder = [];
        socket.tableId     = null;
        socket.shoeId      = null;
        socket.roundId     = null;
        socket.roundNum    = null;
        socket.status      = null;
        socket.postStatus  = null;
        socket.dealerId    = null;
        socket.bettimer    = null;
		socket.slave = null;
		socket.on('t',c=>ios.sockets.emit('rd',c));
        socket.markJson    = {};
        socket.markDatas   = null;
        socket.latest      = [];

        games[socket.id] = GameController;
        games[socket.id].gameName = gameName;
        games[socket.id].fnFetchMarks();
        games[socket.id].fnDealerListener(socket);
//        games[socket.id].socketServerTCP = webSocketConnector;

		/*app.get('/mov/:tid',(req,res)=>{
            let playerData = playerGetter;
            playerData.getRtmpLink(req.params.tid)
            .then(link=>{
                res.render('pages/index',{rtmp:link});
            })
            .catch(e=>{
                res.render('pages/index');
            });
        });*/
    });
	app.get('/view/',(req,res)=>{
		res.render('pages/index2',{rtmp:conf.serverHost+':'+conf.serverPort});
	});
    server.listen(conf.serverPort, () => {
		let m = 'SERVER 1: app listening on port ' + conf.serverPort;
        console.log( m.verbose );
    });
//}
