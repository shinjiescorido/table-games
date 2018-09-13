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
const errorHandler   = require('./modules/errorHandler');
let log           = require('./modules/logger');

module.exports = {
		socketServerTCP : null,
		publishDataHolder : null,
		log,
		markJson : {},

		fnIfCardDealer (data) {
			let cardCheck = new deck(data);
			return (!cardCheck.checkCard(data));
		},

		dealerStorage : {},
		sendToSocketServer(data,dealerSocket){
			let data2 = JSON.parse(data);
			if(!data2)
				return;
			if(data2.eventName !== 'setbettingtime'){
				console.log(' ============== publish data ================ ');
				console.log(data2);
				console.log(' ============== publish data end ============ ');
			}
			this.socketServerTCP.conn.publish('game-servers',data);
			if(this.socketServerTCP.chinaPub)
				this.socketServerTCP.chinaPub.publish('game-servers',data);
			if(this.socketServerTCP.extraConn)
				this.socketServerTCP.extraConn.publish('game-servers',data);
		},

		fnFetchMarks (){
			let ar = {};
			services.fnFetchMarks().then(markJson=>{
				this.markJson = markJson;
			});
		},

		fnDealerListener (dealerSocket) {
			dealerSocket.on('push', (data, next)=>{
				switch(data.event){

					case 'checkifdealer':
						services.fnCardType(data.data, res=>next(res));
					break;

					case 'init':
						services.fnGetCurrentRoundDatas(data.data)
						.then(dataRow=>{
							if(!this.dealerStorage[data.data])
								this.dealerStorage[data.data] = {
									dealerId: dataRow.dealer.id,
									realName: dataRow.dealer.real_name,
									name: dataRow.dealer.name,
									dealerImage: dataRow.dealer.dealer_image
								};

							if (!dealerSocket.latest.length) {
								dealerSocket.latest = [];
								if (dataRow.dragon) {
									dealerSocket.latest.push('dragon');
								}

								if (dataRow.tiger) {
									dealerSocket.latest.push('tiger');
								}
							}

							dataRow.dealer.dealer_image	= this.dealerStorage[data.data].dealerImage;
							dealerSocket.roundId    = parseInt(dataRow.roundId);
							dealerSocket.roundNum   = parseInt(dataRow.roundNum);
							dealerSocket.status     = dataRow.status;
							dealerSocket.postStatus = dataRow.postStatus;
							dealerSocket.tableId    = data.data;
							dealerSocket.dealerId   = dataRow.dealer.id = this.dealerStorage[data.data].dealerId;
							dealerSocket.realName   = dataRow.dealer.real_name = this.dealerStorage[data.data].realName;
							dealerSocket.name   	= dataRow.dealer.name = this.dealerStorage[data.data].name;
							dealerSocket.bettimer   = parseInt(dataRow.bettimer);
							dealerSocket.shoeId     = dataRow.shoeId;
							dealerSocket.gameInfo = dataRow.gameInfo;
							this.log.roundNum = dealerSocket.roundNum;
							this.log.tableId = dealerSocket.tableId;
							this.log.show('CONNECT')
							.catch(()=>{
								console.log('--socket connected');
							});
							next(dataRow);

						}).catch(e=>{
						
						errorHandler(dealerSocket,'Error:init');
						});
					break;

					case 'bettimer' :
						this.sendToSocketServer(JSON.stringify({
							eventName   : 'setbettingtime',
							gameName    : dealerSocket.gameName,
							roundId     : parseInt(dealerSocket.roundId),
							roundNum    : parseInt(dealerSocket.roundNum),
							tableId     : parseInt(dealerSocket.tableId),
							bettingTime : parseInt(data.data),
							totalTime   : parseInt(data.totalTime)
						}),{});
					break;

					case 'gettables' :
						services.fnGetTables(dealerSocket.gameName)
						.then(tables=>next(tables));
					break;

					case 'setroundprogress' :
						services.fnGetRoundStatus(dealerSocket.roundNum, dealerSocket.tableId)
						.then((roundStatus)=>{
							if (roundStatus !== 'S') {
								next('roundStatusError');
								return;
							}

							services.fnSetRoundStatus(dealerSocket.roundId, 'P', dealerSocket.tableId, dealerSocket.roundNum)
							.then(()=>{
								dealerSocket.postStatus = 'P';
								dealerSocket.status     = 'P';
								next(dealerSocket.postStatus);

								this.sendToSocketServer(JSON.stringify({
									eventName   : 'setroundprogress',
									gameName    : dealerSocket.gameName,
									roundId     : parseInt(dealerSocket.roundId),
									roundNum    : parseInt(dealerSocket.roundNum),
									//dealerId    : dealerSocket.dealerId,
									tableId     : parseInt(dealerSocket.tableId),
									status : 'P'
								}),dealerSocket);
							}).catch(e=>{
								errorHandler(dealerSocket,'Error:setroundprogress');
								next('roundStatusError');
							});
						}).catch(e=> {
							errorHandler(dealerSocket, e + ' - ' + data.event);
						});
					break;

					case 'timerReset' :
						services.fnResetTimer(dealerSocket.roundId, dealerSocket.tableId, dealerSocket.roundNum).then(() => {
							dealerSocket.postStatus = "S";
							next(dealerSocket.postStatus);
						}).catch(e => {
							errorHandler(dealerSocket, "Error: timerReset");
							next(e);
						});

						break;
					case 'setroundhold' :
						let hold = (data.hold)?'H':dealerSocket.postStatus;
						services.fnSetRoundStatus(dealerSocket.roundId, hold, dealerSocket.tableId, dealerSocket.roundNum)
						.then(()=>{
							let roundPauseData = {
								gameName    : dealerSocket.gameName,
								eventName   : 'setroundhold',
								//dealerId    : dealerSocket.dealerId,
								tableId     : parseInt(dealerSocket.tableId),
								roundId     : parseInt(dealerSocket.roundId),
								roundNum    : parseInt(dealerSocket.roundNum),
								status : hold

							};
							this.sendToSocketServer(JSON.stringify(roundPauseData),dealerSocket);
							next(!data.hold);
						}).catch(e=>{
							errorHandler(dealerSocket,'Error:setroundhold');
						});
					break;

					case 'inputitem' :
						services.fnProcessCard(
							data.value, 
							data.from, 
							dealerSocket.roundNum, 
							dealerSocket.roundId,
							dealerSocket.realName, 
							dealerSocket.tableId, 
							dealerSocket.gameName,
							dealerSocket.status,
							resultData=>{
							if (resultData) {
								if(resultData == 'roundStatusError'){
									next(resultData);
									return;
								}
								if(data.from == 'shoe'){
									dealerSocket.shoeId = resultData;
									next('shoe changed');

									this.sendToSocketServer(JSON.stringify({
										tableId  : parseInt(dealerSocket.tableId),
										gameName : dealerSocket.gameName,
										roundId  : parseInt(dealerSocket.roundId),
										roundNum : parseInt(dealerSocket.roundNum),
										dealerId : parseInt(dealerSocket.dealerId),
										gameInfo : {},
										eventName   : 'shoechange'
									}));
									return;
								}


								if (data.from == 'burn') {
									dealerSocket.gameInfo[resultData.type] = resultData.value;
									resultData.gameInfo = dealerSocket.gameInfo;
									this.sendToSocketServer(JSON.stringify(resultData),dealerSocket);
									//return;
								}

								if (data.from == 'dragon') {
									dealerSocket.latest.push('dragon');
									dealerSocket.gameInfo[resultData.type] = resultData.value;
									resultData.gameInfo = dealerSocket.gameInfo;

									this.sendToSocketServer(JSON.stringify(resultData),dealerSocket);
									next({
										from : resultData.type,
										value : resultData.value
									});
									return;
								}
								if (data.from == 'tiger') {
									dealerSocket.latest.push('tiger');
									dealerSocket.gameInfo[resultData.type] = resultData.value;
									resultData.gameInfo = dealerSocket.gameInfo;

									this.sendToSocketServer(JSON.stringify(resultData),dealerSocket);
									next({
										from : resultData.type,
										value : resultData.value
									});
									return;
								}

								if (resultData.eventName == "dealerchange") {
									dealerSocket.dealerId = parseInt(resultData.dealerId);
									this.dealerStorage[dealerSocket.tableId].dealerId = dealerSocket.dealerId;
									dealerSocket.realName = resultData.dealerName;
									this.dealerStorage[dealerSocket.tableId].realName = dealerSocket.realName;
									dealerSocket.name = resultData.dealerName;
									this.dealerStorage[dealerSocket.tableId].name = dealerSocket.name;
									this.dealerStorage[dealerSocket.tableId].dealerImage = resultData.dealerImage;
									// record dealer change
									this.sendToSocketServer(JSON.stringify(resultData),{});
									next(resultData);
									return;
								}

								services.fnGetCurrentRoundDatas(dealerSocket.tableId)
								.then(dataRow=>{

									if (!dealerSocket.latest.length) {
										dealerSocket.latest = [];
										if (dataRow.dragon) {
											dealerSocket.latest.push('dragon');
										}

										if (dataRow.tiger) {
											dealerSocket.latest.push('tiger');
										}
									}
									this.sendToSocketServer(JSON.stringify(resultData),dealerSocket);
									next(dataRow);
								}).catch(e=>{
									errorHandler(dealerSocket,'Error: pocessing card - inputitem');
									next(false);
								});
							} else {
								errorHandler(dealerSocket,'Error: pocessing card - inputitem');
								next(false);
							}
						});
					break;
					
					case 'showresults':
						//this.sendToSocketServer(this.publishDataHolder,dealerSocket);
						next(true);
					break;

					case 'displayresults' :
						services.fnGetResults(dealerSocket.roundId, dealerSocket.tableId, dealerSocket.roundNum)
						.then(data=>{
							// process bets calculation and send winnings to users
							betsCalculator.processBets(
								dealerSocket.roundId,
								data.gameResult.game_result, 
								data.result, this.markJson,
								dealerSocket.tableId,
								dealerSocket.roundNum,
								data.gameInfo,
								dealerSocket.shoeId,
								dealerSocket.name
							)
							.then(roundMarkMoneyData=>{
								dealerSocket.postStatus = 'E';
								dealerSocket.status     = 'E';
								//let dataTrimmed = JSON.stringify(data).replace(/\s+/g, '');

								let dataTrimmed = JSON.stringify({
										gameName     : dealerSocket.gameName,
										eventName    : 'displayresults',
										tableId      : parseInt(dealerSocket.tableId),
										dealerId     : parseInt(dealerSocket.dealerId),
										roundId      : parseInt(dealerSocket.roundId),
										roundNum     : parseInt(dealerSocket.roundNum),
										gameInfo     : data.gameInfo,
										gameResult   : data.gameResult.game_result,
										mark         : roundMarkMoneyData.gameMarksData,
										totalWinning : parseInt(roundMarkMoneyData.roundWins),
										status       : 'E',
										userInfo     : roundMarkMoneyData.userInfo,
										regionalResult : data.result,
										dealerName : dealerSocket.name
								});
								//this.publishDataHolder = dataTrimmed;
								this.sendToSocketServer(dataTrimmed,dealerSocket);
								next(data.result);
							}).catch(e=> {
								console.log('err: ', e);
								errorHandler(dealerSocket,'Error:displayresults');
							    next({error:true,message:'server error'});
							});
						}).catch(e=> {
							console.log('err: ', e);
							if(typeof e === 'object'){
								errorHandler(dealerSocket,'Error:displayresults');
								 next(e);
								 return;
							}
							errorHandler(dealerSocket,'Error:displayresults');
							next({error:true,message:'server error'});
						});
					break;

					case "newround" :
						services.fnProcessNewRound(
							dealerSocket.tableId,
							dealerSocket.dealerId, 
							dealerSocket.realName, 
							dealerSocket.shoeId,
							data.roundNum
						)
						.then(data=>{
									dealerSocket.postStatus = 'S';
									dealerSocket.status     = 'S';
									dealerSocket.roundId    = data.id;
									dealerSocket.roundNum   = data.round_num;
									this.log.roundNum       = dealerSocket.roundNum;
									dealerSocket.latest     = [];
									dealerSocket.gameInfo = {burn:null,tiger:null,dragon:null};
									let newRoundData = {
										gameName  : dealerSocket.gameName,
										eventName : 'newround',
										tableId   : parseInt(dealerSocket.tableId),
										dealerId  : dealerSocket.dealerId,
										roundId   : parseInt(dealerSocket.roundId),
										roundNum  : parseInt(dealerSocket.roundNum),
										bettimer  : parseInt(dealerSocket.bettimer),
										status : 'S'
									};

									this.sendToSocketServer(JSON.stringify(newRoundData),{});
									next(data.round_num);
						}).catch(e=>{
							errorHandler(dealerSocket,'Error:newround');
							next(false);
						});
					break;

					case "removeitem" :
						let deleteData = {
							tableId 	: dealerSocket.tableId,
							roundNum 	: dealerSocket.roundNum,
							roundId 	: dealerSocket.roundId,
							realName 	: dealerSocket.realName
						};

						let tod = (dealerSocket.latest.length) ? dealerSocket.latest[dealerSocket.latest.length - 1] : null;

						services.fnProcessDeleteCard(
							deleteData,
							tod,
							dealerSocket.tableId,
							dealerSocket.roundNum
						)
						.then(data=>{
							dealerSocket.gameInfo[data.arrayDeleted] = null;
							let deleteDataCard = {
								gameName  : dealerSocket.gameName,
								eventName : 'removeitem',
								roundId   :parseInt(dealerSocket.roundId),
								roundNum  : parseInt(dealerSocket.roundNum),
								//dealerId  : dealerSocket.dealerId,
								tableId   : parseInt(dealerSocket.tableId),
								gameInfo  : dealerSocket.gameInfo
								//hand      : data.arrayDeleted
							};
							this.sendToSocketServer(JSON.stringify(deleteDataCard),{});
							dealerSocket.latest.pop();
							if(data.arrayDeleted){
								next(data.arrayDeleted);
							}
							else{
								next('supposed ot be burn');
							}
						}).catch(e=>{
							errorHandler(dealerSocket,'Error:removeitem');
							next(false);
						});
					break;

					case 'autonextround':
						services.fnProcessAutoNextRound(dealerSocket.tableId)
						.then(data=>next(data));
					break;

					case 'stoptimer' :
						let stopTimerData = {
							gameName  : dealerSocket.gameName,
							eventName : 'stoptimer',
							roundId   : parseInt(dealerSocket.roundId),
							roundNum  : parseInt(dealerSocket.roundNum),
							dealerId  : parseInt(dealerSocket.dealerId),
							tableId   : parseInt(dealerSocket.tableId)
						};
						this.sendToSocketServer(JSON.stringify(stopTimerData),dealerSocket);
						next();
					break;

					case 'setbettingtime' :
						services.fnProcessBetTimer(
							{data: data.data, totalTime: data.totalTime},
							dealerSocket.tableId,
							dealerSocket.roundId
						).then(data=>{
							dealerSocket.betTimer = data;
							let sendDataBettingTime = {
								gameName    : dealerSocket.gameName,
								eventName   : 'setbettingtime',
								roundId     : parseInt(dealerSocket.roundId),
								roundNum    : parseInt(dealerSocket.roundNum),
								tableId     : parseInt(dealerSocket.tableId),
								bettingTime : parseInt(data.data),
								totalTime   : parseInt(data.totalTime)
							};
							next();
						});
					break;

				}; //==end switch

			}); //== end push event
		}
}; // end module exports
