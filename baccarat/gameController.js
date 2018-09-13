'use strict';
/*
 |--------------------------------------------------------------------------
 | GameController v1.0
 |--------------------------------------------------------------------------
 | Author : Shinji Escorido
 | relay dealer's actions to both dealer socket and socket-server netsockets
 |
 */


const deck           = require( './modules/cardsModule' );
const betsCalculator = require( './modules/betsCalculator' );
const _              = require( 'lodash' );
const services       = require('./modules/services');
const redis          = require('redis');
const conf           = require('./config');
const errorHandler   = require('./modules/errorHandler');
let log              = require('./modules/logger');

module.exports = {
    	 conn: redis.createClient(conf.redis),
    	 chinaConn : (conf.redisChina.status) ? redis.createClient(conf.redisChina) : null,
		 extraConn : (conf.redisHk.status) ? redis.createClient(conf.redisHk) : null,
		 markJson : {},
		 log,
		 dealerStorage : {},

    publish (data,dealerSocket,args) {
		var tt = {};
		let data2 = JSON.parse(data);
			if(!data2)
				return;

        console.log(' ============== publish data start ============ '.info);
        console.log(data2);
        console.log(' ============== publish data end ============ '.info);
			this.conn.publish('game-servers',data);
			if(this.chinaConn)
				this.chinaConn.publish('game-servers',data);
			if(this.extraConn)
				this.extraConn.publish('game-servers',data);
    },

    fnIfCardDealer (data) {
        let cardCheck = new deck(data);
        return (!cardCheck.checkCard(data));
    },

    fnFetchMarks (){
        let ar = {};
        services.fnFetchMarks().then(markJson=>{
            this.markJson = markJson;
        }).catch(e=>console.log(JSON.stringify(e,null,'\t').error));
    },
	fnCheckTableSlave(dataRow){
		let slaver = [];
		if(Array.isArray(dataRow.type)){
			_.each(dataRow.type,type=>{
				if(type == 'normal' || type == 'flippy')
					dataRow.type = type;
				if(type == 'supersix' || type == 'bonus'){
					slaver.push(type);
				}
			});
		}
		
		dataRow = Object.assign(dataRow, {'slave':slaver});
		return dataRow;
	},
    fnDealerListener (dealerSocket) {
	//if(this.extraConn){
		this.extraConn.on('error',e=>{
			console.log('redis error !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ');
			//this.extraConn.quit();
			//conf.redisHk.status = false;
		});
	//}
        dealerSocket.on('push', (data, next)=>{
            next = next || (() => {});
            switch(data.event){
                case 'checkifdealer':
                    services.fnCardType(data.data, res=>{
                        next(res);
                    });
                    break;

                case 'init':
                    services.fnGetCurrentRoundDatas(data.data)
                    .then(dr => {
						let dataRow = Object.assign({}, this.fnCheckTableSlave(dr));
                        if(!this.dealerStorage[data.data])
                            this.dealerStorage[data.data] = {
                                dealerId: +dataRow.dealer.id,
                                name: dataRow.dealer.name,
                                dealerImage: dataRow.dealer.dealer_image
                            };

                        dataRow.dealer.dealer_image	= this.dealerStorage[data.data].dealerImage;
						dealerSocket.type        = dataRow.type;
						dealerSocket.slave       = dataRow.slave;
						dealerSocket.roundId     = parseInt(dataRow.roundId);
                        dealerSocket.roundNum    = parseInt(dataRow.roundNum);
                        dealerSocket.status      = dataRow.status;
                        dealerSocket.postStatus  = dataRow.postStatus;
                        dealerSocket.tableId     = data.data;
                        dealerSocket.dealerId   = dataRow.dealer.id = this.dealerStorage[data.data].dealerId;
                        dealerSocket.name   	= dataRow.dealer.name = this.dealerStorage[data.data].name;
                        dealerSocket.bettimer    = parseInt(dataRow.bettimer);
                        dealerSocket.shoeId      = dataRow.shoeId;
                        dealerSocket.betSettings = data.betSettings;
                        dealerSocket.gameInfo    = dataRow.gameInfo;
                        
						if (!dealerSocket.latest.length) {
							dealerSocket.latest = [];
							if (dataRow.gameInfo.player1)
								dealerSocket.latest.push('player1');
							if (dataRow.gameInfo.player2)
								dealerSocket.latest.push('player2');
							if (dataRow.gameInfo.player3)
								dealerSocket.latest.push('player3');

							if (dataRow.gameInfo.banker1)
								dealerSocket.latest.push('banker1');
							if (dataRow.gameInfo.banker2)
								dealerSocket.latest.push('banker2');
							if (dataRow.gameInfo.banker3)
								dealerSocket.latest.push('banker3');
						}
						this.log.roundNum = dealerSocket.roundNum;
						this.log.tableId = dealerSocket.tableId;
						this.log.show('CONNECT')
						.catch(()=>{
							console.log('--socket connected');
						});
                        next(dataRow);
                    }).catch((err) => {
                        console.log(JSON.stringify(err,null,'\t').error);
                        next(false);
                    });
                    break;

                case 'gettables' :
                    services.fnGetTables(dealerSocket.gameName)
                    .then(tables=>{
                        next(tables);
                    });
                    break;

                case 'setroundprogress' :
                    services.fnSetRoundStatus(dealerSocket.tableId, dealerSocket.roundNum, dealerSocket.roundId,'P')
                        .then(()=>{
                            dealerSocket.postStatus = dealerSocket.status = 'P';
                            next(dealerSocket.postStatus);

                            this.publish(JSON.stringify({
                                eventName : 'setroundprogress',
                                gameName  : dealerSocket.gameName,
                                tableId   : parseInt(dealerSocket.tableId),
                                roundId   : parseInt(dealerSocket.roundId),
                                roundNum   : parseInt(dealerSocket.roundNum),
                                status   : 'P'
                            }),dealerSocket);
                        }).catch(e=>{
							errorHandler(dealerSocket,'Error: setroundprogress');
                        next('roundStatusError');
						});
                    break;

                case 'timerReset' :
                    services.fnResetTimer(dealerSocket.tableId, dealerSocket.roundNum, dealerSocket.roundId)
                        .then(()=>{
                            dealerSocket.postStatus = 'S';
                            next(dealerSocket.postStatus);
                        }).catch(e=>{
                        errorHandler(dealerSocket,'Error: timerReset');
                        next(e);
                    });
                    break;

                case 'inputitem' :
                    services.fnProcessCard(
                        data.data.value,
                        data.data.from,
                        dealerSocket.roundNum,
                        dealerSocket.roundId,
                        dealerSocket.realName,
                        dealerSocket.tableId,
                        dealerSocket.gameName,
                        dealerSocket.status,
                        resultData => {
                            if(data.data.from == 'shoeburncard'){
                                next(data.data.value);

                                this.publish(JSON.stringify({
                                    eventName : 'shoeburncard',//implement redis event listener for shoeburncard
                                    gameName  : dealerSocket.gameName,
                                    tableId   : parseInt(dealerSocket.tableId),
                                    roundId   : parseInt(dealerSocket.roundId),
                                    dealerId  : parseInt(dealerSocket.dealerId),
                                    value     : data.data.value
                                }),{});
                                return;
                            }
							if (resultData == 'roundStatusError'){
								next(resultData);
                                return;
							}
                            if (!resultData) {
								errorHandler(dealerSocket,'Error: inputitem');
                                next(false);
                                return;
                            }
							let args = '';
                            if(data.data.from == 'shoe'){
                                dealerSocket.shoeId = resultData;
                                next('shoe changed');

                                this.publish(JSON.stringify({
                                    tableId  : parseInt(dealerSocket.tableId),
                                    gameName : dealerSocket.gameName,
                                    roundId  : parseInt(dealerSocket.roundId),
                                    dealerId : parseInt(dealerSocket.dealerId),
                                    gameInfo : {},
                                    eventName   : 'shoechange'
                                }),{});
                                return;
                            }

                            if (resultData.eventName == "dealerchange") {
                                dealerSocket.dealerId = parseInt(resultData.dealerId);
                                this.dealerStorage[dealerSocket.tableId].dealerId = dealerSocket.dealerId;
                                dealerSocket.realName = resultData.dealerName;
                                this.dealerStorage[dealerSocket.tableId].name = resultData.dealerName;
                                this.dealerStorage[dealerSocket.tableId].dealerImage = resultData.dealerImage;
                                next(resultData);
                            }

                            services.fnGetCurrentRoundDatas(dealerSocket.tableId)
                            .then(dr => {
								let dataRow = Object.assign({}, this.fnCheckTableSlave(dr));
                                dealerSocket.latest = !dealerSocket.latest.length ? [] : dealerSocket.latest;

                                if (resultData.eventName == 'inputitem') {
									args = '('+data.data.from+'): '+data.data.value;
                                    dealerSocket.latest.push(data.data.from);
                                    dealerSocket.gameInfo[data.data.from] = data.data.value;
                                    resultData.gameInfo = dealerSocket.gameInfo;
                                }

                                this.publish(JSON.stringify(resultData),dealerSocket,args);
                                next(dataRow);
                            }).catch(e => {
								errorHandler(dealerSocket,'Error: init - fnGetCurrentRoundDatas');
								next(false);
                            });
                        });
                    break;

                case 'displayresults':
                    services.fnGetResults(dealerSocket.tableId, dealerSocket.roundNum, dealerSocket.roundId)
                        .then((d) => {
                            // process bets calculation and send winnings to users
                            betsCalculator.processBets(
                                dealerSocket.tableId,
                                dealerSocket.roundId,
                                d,
                                dealerSocket.gameName,
                                dealerSocket.realName,
                                dealerSocket.roundNum
                            ).then((roundMarkMoneyData) => {
								if(!roundMarkMoneyData){
									console.log(JSON.stringify('Error: process bets',null,'\t').error);
									errorHandler(dealerSocket,'Error: process bets');
									return;
								}
                                dealerSocket.postStatus = dealerSocket.status = 'E';
								let gResultPub = ['winner','pairs'];
								d.bonus.oddsbonus = (roundMarkMoneyData.oddsbonus)?roundMarkMoneyData.oddsbonus-1:null;
								if(dealerSocket.slave.indexOf('supersix') > -1){
									gResultPub.push('supersix');
								}
								if(dealerSocket.slave.indexOf('bonus') > -1){
									gResultPub.push('bonus');
									gResultPub.push('size');
								}
								let regionalResult = Object.assign(d,{game_info:dealerSocket.gameInfo});
                                this.publish(JSON.stringify({
                                    eventName: 'displayresults',
                                    gameName: dealerSocket.gameName,
                                    tableId: parseInt(dealerSocket.tableId),
                                    roundId: parseInt(dealerSocket.roundId),
                                    roundNum: parseInt(dealerSocket.roundNum),
                                    status: 'E',
                                    gameInfo: {player: d.player, banker: d.banker},
                                    gameResult: _.pick(d, gResultPub),
				    regionalResult,
				    dealerName : dealerSocket.realName,
                                    mark: roundMarkMoneyData.gameMarksData.gameMarks,
                                    totalWinning: parseInt(roundMarkMoneyData.roundWins),
                                    userInfo: roundMarkMoneyData.userInfo
                                }),dealerSocket);
                                next(d);
                            }).catch(() => { errorHandler(dealerSocket,'Error: process bets'); next(d); });
                        }).catch((e) => { errorHandler(dealerSocket,'Error: fnGetResults'); next(false); });
                    break;

                case 'newround' :
                    services.fnProcessNewRound(
                        data.data.roundNum,
                        dealerSocket.tableId,
                        dealerSocket.dealerId,
                        dealerSocket.realName,
                        dealerSocket.shoeId
                    ).then(data=>{
                        dealerSocket.postStatus = dealerSocket.status = 'S';
                        dealerSocket.roundId    = data.id;
                        dealerSocket.roundNum   = data.round_num;
                        dealerSocket.latest     = [];
                        dealerSocket.gameInfo   = {};
						this.log.roundNum = dealerSocket.roundNum;
                        let newRoundData = {
                            gameName: dealerSocket.gameName,
                            eventName: 'newround',
							dealerId : dealerSocket.dealerId,
                            tableId: parseInt(dealerSocket.tableId),
                            roundId: parseInt(dealerSocket.roundId),
                            roundNum: parseInt(dealerSocket.roundNum),
                            bettimer: parseInt(dealerSocket.bettimer),
                            status: dealerSocket.status
                        };

                        this.publish(JSON.stringify(newRoundData),dealerSocket);
                        next(data);
                    }).catch(e=>{
						errorHandler(dealerSocket,'Error : fnProcessNewRound');
						console.log(JSON.stringify(e,null,'\t').error);
						next(false);
						return;
					});
                    break;

                case 'removeitem' :
                    services.fnProcessDeleteCard(
                        dealerSocket.roundNum,
                        dealerSocket.tableId
                    ).then(()=>{
						services.fnGetCurrentRoundDatas(dealerSocket.tableId)
						.then(dr => {
							let dataRow = Object.assign({}, this.fnCheckTableSlave(dr));
							dealerSocket.gameInfo = dataRow.gameInfo;
							this.publish(JSON.stringify({
								gameName  : dealerSocket.gameName,
								eventName : 'removeitem',
								roundId   : parseInt(dealerSocket.roundId),
								roundNum  : parseInt(dealerSocket.roundNum),
								dealerId  : parseInt(dealerSocket.dealerId),
								tableId   : parseInt(dealerSocket.tableId),
								gameInfo  : dealerSocket.gameInfo
							}),dealerSocket);
							next(dataRow);
						});
                    }).catch(()=>{
                        console.log(JSON.stringify('Error: remove item',null,'\t').error);
						errorHandler(dealerSocket,'Error: remove item');
						next(false);
                    });
                    break;

                case 'autonextround':
                    services.fnProcessAutoNextRound(dealerSocket.tableId)
                        .then(data=>{
                            next(data);
                        })
						.catch(e=>errorHandler(dealerSocket,'Error: autonextround'));
                    break;

                case 'stoptimer' :
                    let stopTimerData = {
                        gameName  : dealerSocket.gameName,
                        eventName : 'stoptimer',
                        roundId   : parseInt(dealerSocket.roundId),
                        dealerId  : parseInt(dealerSocket.dealerId),
                        tableId   : parseInt(dealerSocket.tableId)
                    };
                    this.publish(JSON.stringify(stopTimerData),dealerSocket);
                    next(true);
                    break;

                case 'flip':
                    this.publish(JSON.stringify({
                        eventName : 'flip',
                        gameName  : dealerSocket.gameName,
                        roundId   : parseInt(dealerSocket.roundId),
                        dealerId  : parseInt(dealerSocket.dealerId),
                        tableId   : parseInt(dealerSocket.tableId),
                        gameInfo  : dealerSocket.gameInfo
                    }),dealerSocket);
                    next(true);
                    break;

                case 'flippytimer':
                    this.publish(JSON.stringify({
                        eventName : 'flippytimer',
                        gameName  : dealerSocket.gameName,
                        roundId   : parseInt(dealerSocket.roundId),
                        dealerId  : parseInt(dealerSocket.dealerId),
                        tableId   : parseInt(dealerSocket.tableId),
                        flipTime : parseInt(data.data.betTime),
                        totalTime: parseInt(data.data.totalTime)
                    }),dealerSocket);
                    next(true);
                    break;

                case 'setbettingtime' :
                    this.publish(JSON.stringify({
                        eventName : 'setbettingtime',
                        gameName  : dealerSocket.gameName,
                        roundId   : parseInt(dealerSocket.roundId),
                        dealerId  : parseInt(dealerSocket.dealerId),
                        tableId   : parseInt(dealerSocket.tableId),
                        bettingTime : parseInt(data.data.betTime),
                        totalTime: parseInt(data.data.totalTime)
                    }),dealerSocket);
					next(true);
                    break;
            }; //==end switch
        }); //== end push event
    }
}; // end module exports
