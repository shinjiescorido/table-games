'use strict';

	/*
	|--------------------------------------------------------------------------
	| GameController v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| relay dealer's actions to both dealer socket and socket-server netsockets
	|
	*/


const deck     = require( './modules/cardsModule' );
const _        = require( 'lodash' );
const services = require('./modules/services');
const Xpacket  = require('./modules/Xpacket');
const conf     = require('./config');
const errorHandler   = require('./modules/errorHandler');
const regionalRange = require("./modules/regionalRanges");
const regionChina = 'china';
let log           = require('./modules/logger');

module.exports = {
		socketServerTCP : null,
		markJson        : {},
		conn            : null,
		connChina 	: null,
		pubConnChina : null,
		extraConn 	: null,
		pubconnExtra : null,
		log,
		startGame(){
			services.fnGetTablesMarks('Poker')
			.then(data=>{
				this.publish(JSON.stringify(data),{});
			});
			if(this.pubConnChina){
				this.pubConnChina.on("message", (channel, m) => {
					if(JSON.parse(m).isInit){
						services.fnGetTablesMarks('Poker')
						.then(datas=>{
							console.log(' ######### REGIONS INITIALIZED ##########  ');
							console.log(datas);
							console.log(' ################ END#################### ');
							let toChinaData = JSON.parse(JSON.stringify(datas));
							toChinaData.tables = _.map(toChinaData.tables, table=>{
								if(regionalRange[regionChina] && regionalRange[regionChina][toChinaData.gameName]){
									table.sportBetRanges = regionalRange[regionChina][toChinaData.gameName].sportBetRange;
									table.casinoBetRanges = regionalRange[regionChina][toChinaData.gameName].casinoBetRange;
								}
								return table;
							});
							if(this.connChina)
								this.connChina.publish('game-servers',JSON.stringify(toChinaData));
						});
					}
				});
				this.pubConnChina.subscribe('regional-init');
			}
			if(this.pubconnExtra){
				this.pubconnExtra.on("message", (channel, m) => {
					if(JSON.parse(m).isInit){
						services.fnGetTablesMarks('Poker')
						.then(datas=>{
							console.log(' ######### REGIONS INITIALIZED ##########  ');
							console.log(datas);
							console.log(' ################ END#################### ');
							if(this.extraConn)
								this.extraConn.publish('game-servers',JSON.stringify(datas));
						});
					}
				});
				this.pubconnExtra.subscribe('regional-init');
			}
		},
		dealerStorage : {},

		publish(data,dealerSocket){
			let data2 = JSON.parse(data);
			
			if(!data2)
				return;
				console.log(' ============== publish data ================ ');
				console.log(data2);
				console.log(' ============== publish data end ============ ');

			this.conn.publish('game-servers',data);
			if(data2.eventName == 'init'){
				let toChinaData = JSON.parse(JSON.stringify(data2));
				toChinaData.tables = _.map(toChinaData.tables, table=>{
					if(regionalRange[regionChina] && regionalRange[regionChina][toChinaData.gameName]){
						table.sportBetRanges = regionalRange[regionChina][toChinaData.gameName].sportBetRange;
						table.casinoBetRanges = regionalRange[regionChina][toChinaData.gameName].casinoBetRange;
					}
					return table;
				});
				console.log(' init =============> ', JSON.stringify(toChinaData.tables));
				if(this.connChina)
					this.connChina.publish('game-servers',JSON.stringify(toChinaData));
				if(this.extraConn)
					this.extraConn.publish('game-servers',JSON.stringify(data2));
			} else {
				if(this.connChina)
					this.connChina.publish('game-servers',data);
				if(this.extraConn)
					this.extraConn.publish('game-servers',data);
			}
		},

		fnDealerListener (dealerSocket) {
			dealerSocket.on('push', (data, next)=>{
				next = next || (() => {});
				switch(data.event){

					case 'init':
					console.log('init called=>',data);
						services.fnGetCurrentRoundDatas(data.data)
						.then(dataRow=>{
							if(!this.dealerStorage[data.data])
								this.dealerStorage[data.data] = {
									dealerId: dataRow.dealer.id,
									realName: dataRow.dealer.real_name,
									name: dataRow.dealer.name,
									dealerImage: dataRow.dealer.dealer_image
								};

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
							dealerSocket.shoeId     = dataRow.shoe;
							dealerSocket.gameInfo = dataRow.gameInfo;
							this.log.roundNum = dealerSocket.roundNum;
							this.log.tableId = dealerSocket.tableId;
							this.log.show('CONNECT')
							.catch(()=>{
								console.log('--socket connected');
							});
							next({
								roundId       : parseInt(dataRow.roundId),
								roundNum      : parseInt(dataRow.roundNum),
								status        : dataRow.status,
								postStatus    : dataRow.postStatus,
								tableId       : parseInt(dataRow.tableId),
								dealer        : dataRow.dealer,
								player        : dataRow.player,
								turn          : dataRow.turn,
								betTimer      : parseInt(dataRow.bettimer),
								river         : dataRow.river,
								banker        : dataRow.banker,
								flop          : dataRow.flop,
								burn          : dataRow.burn,
								autonextround : dataRow.autonextround,
								shoe : dataRow.shoe
							});
						}).catch(err=>{
							errorHandler(dealerSocket,err + ' - '+data.event);
							next({error:true,message:err});
						});
					break;

					case 'getcardtype' :
						services.getCardType(data.data)
						.then(type=>{
							if(type)
								next(type);
							else
								next({error:true,message:'unrecognized card'});
						}).catch(error=>next({error:true,message:error}));
					break;

					case 'changedealer' :
						services.changeDealer(
							data.data, 
							dealerSocket.roundNum, 
							dealerSocket.roundId,
							dealerSocket.realName, 
							dealerSocket.tableId, 
							dealerSocket.gameName,
							dealerSocket.status,
							resultData=>{
								if(resultData.error){
									errorHandler(dealerSocket,resultData.message + ' - '+data.event);
									next(resultData);
									return;
								}
								if (resultData) {
									dealerSocket.dealerId = parseInt(resultData.dealerId);
									this.dealerStorage[dealerSocket.tableId].dealerId = dealerSocket.dealerId;
									dealerSocket.name = resultData.dealerName;
									this.dealerStorage[dealerSocket.tableId].name = dealerSocket.name;
									this.dealerStorage[dealerSocket.tableId].dealerImage = resultData.dealerImage;
									this.publish(JSON.stringify(resultData),{});
									next(resultData);
								} else {
									errorHandler(dealerSocket,'server error on: '+data.event);
									next({error:true,message:'server error: refresh the app'});
								}
							}
						);
					break;

					case 'bettimer' :
						this.publish(JSON.stringify({
							eventName   : 'setbettingtime',
							gameName    : dealerSocket.gameName,
							roundId     : parseInt(dealerSocket.roundId),
							roundNum    : parseInt(dealerSocket.roundNum),
							type        : data.countType,
							tableId     : parseInt(dealerSocket.tableId),
							bettingTime : data.data,
							totalTime   : parseInt(data.totalTime)
						}),{});
					break;

					case 'gettables' :
						services.fnGetTables(dealerSocket.gameName)
						.then(tables=>{
							next(tables);
						});
					break;

					case 'setroundprogress' :
						services.fnGetRoundStatus(dealerSocket.roundNum, dealerSocket.tableId)
						.then((roundStatus)=>{
							if (roundStatus !== 'S') {
								next('Error: set round status');
								return;
							}

							services.fnSetRoundStatus(dealerSocket.roundNum,'P',dealerSocket.tableId)
									.then(()=>{
										dealerSocket.postStatus = 'P';
										dealerSocket.status = 'P';
										this.publish(JSON.stringify({
											eventName   : 'setroundprogress',
											gameName    : dealerSocket.gameName,
											roundId     : parseInt(dealerSocket.roundId),
											roundNum    : parseInt(dealerSocket.roundNum),
											//dealerId    : dealerSocket.dealerId,
											tableId     : parseInt(dealerSocket.tableId),
											status : 'P'
										}),dealerSocket);
										next(dealerSocket.status);
										//next(dealerSocket.postStatus);
									}).catch(e=>{
								errorHandler(dealerSocket,e + ' - '+data.event);
							});
						}).catch(e=> {
							errorHandler(dealerSocket, e + ' - ' + data.event);
						});
					break;

					case 'timerReset' :
						services.fnResetTimer(dealerSocket.roundNum, dealerSocket.tableId)
								.then(()=>{
									dealerSocket.postStatus = 'S';
									next(dealerSocket.postStatus);
								}).catch(e=>{
							errorHandler(dealerSocket,'Error: timerReset');
							next(e);
						});
						break;

					case 'setroundhold' :
						let hold = (data.hold)?'H':dealerSocket.postStatus;
						services.fnSetRoundStatus(
							dealerSocket.roundNum,
							hold,
							dealerSocket.tableId
						).then(()=>{
							let roundPauseData = {
								gameName  : dealerSocket.gameName,
								eventName : 'setroundhold',
								dealerId  : parseInt(dealerSocket.dealerId),
								tableId   : parseInt(dealerSocket.tableId),
								roundId   : parseInt(dealerSocket.roundId),
								roundNum  : parseInt(dealerSocket.roundNum),
								status    : hold
							};
							this.publish(JSON.stringify(roundPauseData),dealerSocket);
							next(!data.hold);
						}).catch(e=>{
							errorHandler(dealerSocket,e + ' - '+data.event);
						});
					break;

					case 'inputitem' :
						if(dealerSocket.status != 'P'){
							next({error:true,message:'round not in progress'});
							return;
						}
						services.fnProcessCard(
							data.data, 
							data.from, 
							dealerSocket.roundNum,
							dealerSocket.tableId,
							resultData=>{
							if (resultData) {

								if(resultData.error){
									errorHandler(dealerSocket,'Error: pocessing card - inputitem');
									next({error:true,message:'scan errors'});
									return;
								}

								if(dealerSocket.gameInfo[data.from] instanceof Array)
									dealerSocket.gameInfo[data.from].push(data.data);
								else
									dealerSocket.gameInfo[data.from] = data.data;
								
								

								let swipeData = {
									gameName  : dealerSocket.gameName,
									roundId   : parseInt(dealerSocket.roundId),
									eventName : 'inputitem',
									tableId   : parseInt(dealerSocket.tableId),
									roundNum  : parseInt(dealerSocket.roundNum),
									gameInfo  : dealerSocket.gameInfo
								};

								this.publish(JSON.stringify(swipeData),dealerSocket);
								services.fnGetCurrentRoundDatas(dealerSocket.tableId)
								.then(dataRow=>{
									
									dealerSocket.roundId    = parseInt(dataRow.roundId);
									dealerSocket.roundNum   = parseInt(dataRow.roundNum);
									dealerSocket.status     = dataRow.status;
									dealerSocket.postStatus = dataRow.postStatus;
									dealerSocket.dealerId   = parseInt(dataRow.dealer.id);
									dealerSocket.realName   = dataRow.dealer.real_name;
									dealerSocket.bettimer   = parseInt(dataRow.bettimer);
									dealerSocket.shoeId     = dataRow.shoe;

									next({
										roundId       : parseInt(dataRow.roundId),
										status        : dataRow.status,
										postStatus    : dataRow.postStatus,
										tableId       : parseInt(dataRow.tableId),
										dealer        : dataRow.dealer,
										player        : dataRow.player,
										turn          : dataRow.turn,
										betTimer      : parseInt(dataRow.bettimer),
										river         : dataRow.river,
										banker        : dataRow.banker,
										flop          : dataRow.flop,
										burn          : dataRow.burn,
										autonextround : dataRow.autonextround
									});
								}).catch(err=>{
									errorHandler(dealerSocket,'Error: pocessing card - inputitem');
									next({error:true,message:err})
								});
							} else {
								errorHandler(dealerSocket,'Error: pocessing card - inputitem');
								next({error:true,message:'server error'});
							}
						});
					break;

					case 'passResult' :
						if(dealerSocket.resultHolder){
							this.publish(dealerSocket.resultHolder,dealerSocket);
							next(true);
						} else {
							next(false);
						}
					break;
					case 'getpartialresults' :
						services.fnGetPartialResults(dealerSocket.roundId,dealerSocket.roundNum,dealerSocket.tableId)
						.then(data=>{
							next(data);	
							return;
						}).catch(e=> {
							errorHandler(dealerSocket,'Error: processBets - partialresults');
							next({error:true,message:'server error'});
							return;
						});
					break;
					case 'displayresults' :
						let bonusAmount = 0;
						let pocketAmount = 0;
						services.fnGetResults(dealerSocket.roundId,dealerSocket.roundNum,dealerSocket.tableId,dealerSocket.shoeId)
						.then(data=>{
							let bonusCard = new deck('0000');
							let pocket = {//'bonus' is 'pocket' during bonusplus channel
								type : 'b',
								//badbeat : data.winSide === 'dealer' /* badbeat removed from pocket -12/5/17
								badbeat : false
							};
							bonusCard.getBonus(data.playerBonusHand, pocket)
							.then(b=> {
								bonusCard.getBonus(data.playerBonusHand, {type : 'r'})
								.then(r=> {
									bonusAmount = (r.length) ? r[0] : 0;
									pocketAmount = (b.length) ? b[0] : 0;
									services.processBets(dealerSocket.roundNum,
									dealerSocket.tableId,
									data.winSide,
									data.bets,
									bonusAmount,
									pocketAmount,
									data.playerCardRank,
									data.bonusplusAmount, {
										createdAt	: data.created_at,
										updatedAt	: data.updated_at,
										tableId		: parseInt(data.tableId),
										roundId		: parseInt(data.roundId),
										roundNum	: parseInt(data.roundNum),
										gameInfo	: data.gameInfo,
										gameResult	: data.gameResult
									}, dealerSocket.dealerName)
									.then(flag=> {
										// set bonus to passed data
										data.gameResult.pocketAmount = pocketAmount;
										data.gameResult.bonusAmount = bonusAmount;
										data.gameResult.bonusplusAmount = data.bonusplusAmount;
										let dataTrimmed = JSON.stringify({
											gameName	: dealerSocket.gameName,
											eventName	: 'displayresults',
											tableId		: parseInt(dealerSocket.tableId),
											dealerId	: parseInt(dealerSocket.dealerId),
											roundId		: parseInt(dealerSocket.roundId),
											roundNum	: parseInt(dealerSocket.roundNum),
											gameInfo	: data.gameInfo,
											gameResult	: data.gameResult,
											regionalResult : data,
											mark		: data.mark,
											status		: 'E',
											totalWinning: parseInt(flag.roundWins),
											userInfo	: flag.userInfo,
											meta		: data.meta
										});
										//this.publish(dataTrimmed,dealerSocket);
										dealerSocket.resultHolder = dataTrimmed;
										next(data);
									}).catch(e=> {
										errorHandler(dealerSocket,'Error: processBets - displayresults1');
										next({error:true,message:'server error'});
									});
								});
							});
						}).catch(e=>{
							if(typeof e === 'object'){
								errorHandler(dealerSocket,'Error - displayresults2');
								next(e);
								return;
							}
							errorHandler(dealerSocket,'Error - displayresults3');
							next({error:true,message:e})
						});
					break;

					case 'newround' :
						services.fnProcessNewRound(
							dealerSocket.tableId,
							dealerSocket.dealerId,
							data.roundNum
						)
						.then(data=>{
							if(!data){
									conosle.log(' error here 1 ');
								next({error:true,message:'server error: refresh the app'});
								return;
							}
							dealerSocket.gameInfo = {
								burn   : [],
								player : [],
								dealer : [],
								flop   : [],
								turn   : null,
								river  : null
							};
												
							dealerSocket.postStatus = 'S';
							dealerSocket.status     = 'S';
							dealerSocket.roundId    = data.id;
							dealerSocket.roundNum   = data.round_num;
							dealerSocket.latest     = [];
							console.log(' new round  2  ');
							let newRoundData = {
								gameName  : dealerSocket.gameName,
								eventName : 'newround',
								tableId   : parseInt(dealerSocket.tableId),
								roundId   : parseInt(dealerSocket.roundId),
								roundNum  : parseInt(dealerSocket.roundNum),
								bettimer  : parseInt(dealerSocket.bettimer),
								status    : 'S',
								dealerId  : dealerSocket.dealerId
							};
							this.log.roundNum = dealerSocket.roundNum;
							this.publish(JSON.stringify(newRoundData),dealerSocket);
							dealerSocket.resultHolder = null;
							console.log('neworund DATA send'.error);
							next(data.round_num);

						}).catch(err=>{
							console.log(' there was error n weround=> ',err);
							errorHandler(dealerSocket,'Error - newround');
							next({error:true,message:err})
						});
					break;

					case 'removeitem' :
						services.fnProcessDeleteCard(data.who,dealerSocket.tableId, dealerSocket.roundNum)
						.then(flag=>{
							if(flag){
								let shouldError = false;
								if(dealerSocket.gameInfo[data.who] instanceof Array){
									if((data.who == 'player' || data.who == 'dealer') && dealerSocket.gameInfo[data.who].length > 2){
										dealerSocket.gameInfo[data.who] = [];
										shouldError = true;
									}else if(data.who == 'flop' && dealerSocket.gameInfo[data.who].length > 3) {
										dealerSocket.gameInfo[data.who] = [];
										shouldError = true;
									}else{
										dealerSocket.gameInfo[data.who].pop();
									}
								}
								else
									dealerSocket.gameInfo[data.who] = null;
								this.publish(JSON.stringify({
										gameName   : dealerSocket.gameName,
										eventName  : 'removeitem',
										roundId    : parseInt(dealerSocket.roundId),
										roundNum   : parseInt(dealerSocket.roundNum),
										tableId    : parseInt(dealerSocket.tableId),
										gameInfo   : dealerSocket.gameInfo
								}),{});
								services.fnGetCurrentRoundDatas(dealerSocket.tableId)
								.then(dataRow=>{
									dealerSocket.roundId    = parseInt(dataRow.roundId);
									dealerSocket.roundNum   = parseInt(dataRow.roundNum);
									dealerSocket.status     = dataRow.status;
									dealerSocket.postStatus = dataRow.postStatus;
									dealerSocket.dealerId   = parseInt(dataRow.dealer.id);
									dealerSocket.realName   = dataRow.dealer.real_name;
									dealerSocket.bettimer   = parseInt(dataRow.bettimer);
									dealerSocket.shoeId     = dataRow.shoe;
									dealerSocket.gameInfo   = dataRow.gameInfo;

									
									dealerSocket.resultHolder = null;
									next(shouldError ? {error:true,message:'server error: refresh the app'} : {
										roundId       : parseInt(dataRow.roundId),
										status        : dataRow.status,
										postStatus    : dataRow.postStatus,
										tableId       : parseInt(dataRow.tableId),
										dealer        : dataRow.dealer,
										player        : dataRow.player,
										turn          : dataRow.turn,
										betTimer      : parseInt(dataRow.bettimer),
										river         : dataRow.river,
										banker        : dataRow.banker,
										flop          : dataRow.flop,
										burn          : dataRow.burn,
										autonextround : dataRow.autonextround
									});
								}).catch(err=>{
									errorHandler(dealerSocket,'Error - removeitem');
									next({error:true,message:err})
								});
							} else {
								errorHandler(dealerSocket,'Error - removeitem');
								next({error:true,message:'server error: refresh the app'});
								return;
							}
						}).catch(err=>{
							errorHandler(dealerSocket,'Error - removeitem');
							next({error:true,message:err})
						});
					break;

					case 'autonextround':
						services.fnProcessAutoNextRound(dealerSocket.tableId)
						.then(data=>next(data));
					break;

					case 'lastrounds':
						services.fnProcessLastRounds(dealerSocket.tableId,data.remaining)
						.then(data=>{
							let stopTimerData = {
								gameName  : dealerSocket.gameName,
								eventName : 'lastrounds',
								roundId   : parseInt(dealerSocket.roundId),
								roundNum  : parseInt(dealerSocket.roundNum),
								dealerId  : parseInt(dealerSocket.dealerId),
								tableId   : parseInt(dealerSocket.tableId),
								lastround : data
							};
							this.publish(JSON.stringify(stopTimerData),dealerSocket);
							next(data);
						})
						.catch(e=>next(e));
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
						this.publish(JSON.stringify(stopTimerData),dealerSocket);
						next();
					break;
				}; //==end switch

			}); //== end push event
		}
}; // end module exports
