'use strict';

	/*
	|--------------------------------------------------------------------------
	| webSocketConnector Module
	|--------------------------------------------------------------------------
	|  Author: Shinji Escorido
	| This module is the TCP connection to our Socket servers via Load Balancer.
	| Example: var connector = new webSocketConnector( theIP, theHost );
	|
	*/
const services = require( './modules/services' );
const regionalRange = require("./modules/regionalRanges");
const regionChina = 'china';
const _ = require('lodash');

module.exports = function (p, h) {
	return {
		pubconn	     : null,
		conn         : null,
		chinaPub     : null,
		pubChinaConn : null,
		extraConn    : null,
		pubconnExtra : null,
		port         : (p) ? p : 9000,
		host         : (h) ? h : 'localhost',
		isConnected  : false,
		doInit(includeLive) {
			services.fnGetTablesMarks()
			.then(data=>{
				let toChinaData = JSON.parse(JSON.stringify(data));
				console.log(' ============================================ INITIALIZATIONS START====================================== '.info);
				console.log(JSON.stringify(data,null,'\t').info);
				console.log(' ============================================ INITIALIZATIONS END ======================================= '.info);
				
				toChinaData.tables = _.map(toChinaData.tables, table=>{
					if(regionalRange[regionChina] && regionalRange[regionChina][toChinaData.gameName]){
						table.sportBetRanges = regionalRange[regionChina][toChinaData.gameName].sportBetRange;
						table.casinoBetRanges = regionalRange[regionChina][toChinaData.gameName].casinoBetRange;
					}
					return table;
				});
				if(includeLive)
					this.conn.publish('game-servers',JSON.stringify(data));
				if(this.chinaPub)
					this.chinaPub.publish('game-servers',JSON.stringify(toChinaData));
				if(this.extraConn)
					this.extraConn.publish("game-servers", JSON.stringify(data));
			});
		},
		connect () {
			this.isConntected = true;
			 console.log('game server CONNECTED TO SOCKET SERVER TCP'.info);
			// fetch tables write data to socket-server
			this.doInit(true);
			if(this.pubChinaConn){
				this.pubChinaConn.on("message", (channel, m) => {
					if(JSON.parse(m).isInit){
						this.doInit(false);
					}
				});
				this.pubChinaConn.subscribe('regional-init');
			}
			if(this.pubconnExtra){
				this.pubconnExtra.on("message", (channel, m) => {
					if(JSON.parse(m).isInit){
						this.doInit(true);
					}
				});
				this.pubconnExtra.subscribe('regional-init');
			}
			// CONN
			this.pubconn.on("message", (channel, m) => {
				m = JSON.parse(m);
				if(m.gameName !== 'Dragon-Tiger') return;

				services.roomDisconnect(m).then(()=>{
					console.log("message from socket o o o o o o o o o o o o o o o o o o o o o o o o o o ");
					console.log('Room-id: ' + m.roomId + ' have been disconnected'.error);
					console.log("o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o ");
				}).catch(e=>{
					console.log('room disconnected failed error stack==>',e);
				});
			});
			this.pubconn.subscribe('socket-servers');
			
			// LISTENER
			if(this.extraConn){
			this.extraConn.on('ready', ()=>{
				console.log('staging redis connected!'.info);
			});
			this.extraConn.on('error', (e)=>{
				console.log('extra conn disconnected, error: '.error, e);
			});
			// LISTENER
			this.pubconnExtra.on('ready', ()=>{
				console.log('staging redis connected!'.info);
			});
			this.pubconnExtra.on('error', (e)=>{
				console.log('extra conn disconnected, error: '.error, e);
			});
			}
		}
	};
};
