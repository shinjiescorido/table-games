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
const LZString = require('lz-string');
const net      = require('net');
const services = require( './modules/services' );
const redis    = require('redis');
const conf     = require('./config');
const _ = require('lodash');
const regionalRange = require("./modules/regionalRanges");
const regionChina = 'china';

module.exports = function (p, h, gameName) {
    return {
		pubconn		 : redis.createClient(conf.redis),
        conn         : redis.createClient(conf.redis),
		chinaConn    : (conf.redisChina.status) ? redis.createClient(conf.redisChina) : null,
		pubconnChina : (conf.redisChina.status) ? redis.createClient(conf.redisChina) : null,
		extraConn    : (conf.redisHk.status) ? redis.createClient(conf.redisHk) : null,
		pubconnExtra : (conf.redisHk.status) ? redis.createClient(conf.redisHk) : null,
		port        : (p) ? p : 9000,
        host        : (h) ? h : 'localhost',
        isConnected : false,
        gameName    : (gameName) ? gameName : 'Baccarat',
		doInit(includeLive) {
			services.fnGetTablesMarks(this.gameName).then(data=>{
				let toChinaData = JSON.parse(JSON.stringify(data));
				toChinaData.tables = _.map(toChinaData.tables, table=>{
					if(regionalRange[regionChina] && regionalRange[regionChina][toChinaData.gameName]){
						table.sportBetRanges = regionalRange[regionChina][toChinaData.gameName].sportBetRange;
						table.casinoBetRanges = regionalRange[regionChina][toChinaData.gameName].casinoBetRange;
					}
					return table;
				});
				console.log(' ====================== sGAME INITIALIZED ====================== '.info);
				if( includeLive )
					this.conn.publish("game-servers", JSON.stringify(data));
				if(this.chinaConn)
					this.chinaConn.publish("game-servers", JSON.stringify(toChinaData));
				if (this.extraConn)					
					this.extraConn.publish("game-servers", JSON.stringify(data));
				
            });
		},
        connect () {
            this.isConntected = true;
			this.doInit( true );

			this.doInit( true );

			// CHINA CONN
			if(this.pubconnChina){
				this.pubconnChina.on("message", (channel, m) => {
					if(JSON.parse(m).isInit){
						this.doInit(false);
					}
				});
				this.pubconnChina.subscribe('regional-init');
			}
			// EXTRA CONN
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
				if(m.gameName !== 'Baccarat') return;

				services.roomDisconnect(m).then(()=>{
					console.log("message from socket o o o o o o o o o o o o o o o o o o o o o o o o o o ");
					console.log('Room-id: ' + m.roomId + ' have been disconnected'.error);
					console.log("o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o o ");
				}).catch(e=>{
					console.log('room disconnected failed error stack==>',e);
				});
			});
			this.pubconn.subscribe('socket-servers');
        }
    };
};
