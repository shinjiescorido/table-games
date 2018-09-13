'use strict';

	/*
	|--------------------------------------------------------------------------
	| services v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| Service module/component for processing model datas
	|
	*/

const deck    = require( './cardsModule' );
const _       = require( 'lodash' );
const models  = require( './db.js' );
const Hand    = require('pokersolver').Hand;
const request = require('request-promise');
const config  = require('../config/index');
const moment = require('moment');

module.exports = {
	payoutHandler : {
		player(data){
			let anteBonusOdds = data.anteBonusOdds;
			let anteBonusPlusAmount = +data.anteBonusPlusAmount || 0;//bp
			let bh            = data.bh;
			let bonusAmount   = data.bonusAmount;
			let bonus = data.bonus;

			let totalWin      = 0;
			let totalBet      = bh.ante.bet + bh.flop.bet + bh.turn.bet + bh.river.bet + bh[bonus].bet + (bh.bonusplus ? bh.bonusplus.bet : 0);
			let lostBet       = 0;
			let totalWinning  = bh.flop.bet + bh.turn.bet + bh.river.bet;
			let totalRolling  = bh.ante.bet + bh.flop.bet + bh.turn.bet + bh.river.bet + bh[bonus].bet + (bh.bonusplus ? bh.bonusplus.bet : 0);
			let totalLost     = 0;

	    	bh.flop.win  = bh.flop.bet * 2;
			bh.turn.win  = bh.turn.bet * 2;
			bh.river.win = bh.river.bet * 2;

	    	if (anteBonusOdds) {
	    		bh.ante.win = bh.ante.bet * 2;
	    		totalWinning += bh.ante.bet;
	    	}
	    	else {
	    		bh.ante.win = bh.ante.bet;
	    	    totalRolling = totalRolling - bh.ante.bet;
	    	}

	    	if (bonusAmount) {
	    		let bonusWin = bh[bonus].bet * bonusAmount;
	    		bh[bonus].win = bonusWin + bh[bonus].bet;
	    		totalWinning += bonusWin;
	    	}
	    	else {
	    		lostBet = bh[bonus].bet;
	    	}

			if (anteBonusPlusAmount && bonus == 'pocket') {
				let bonusPlusWin = (bh.bonusplus ? bh.bonusplus.bet : 0) * anteBonusPlusAmount;
				bh.bonusplus.win = bonusPlusWin + (bh.bonusplus ? bh.bonusplus.bet : 0);
				totalWinning += bonusPlusWin;
			}
			else {
				lostBet += (bh.bonusplus ? bh.bonusplus.bet : 0);
			}

	    	totalWin  = totalBet + totalWinning - lostBet;
	    	totalLost = lostBet;

	    	return {
	    		totalWin,
	    		totalLost,
	    		totalBet,
	    		totalWinning,
	    		totalRolling,
	    		bh
	    	};
	    },
	    tie(data){
	    	let bh           = data.bh;
	    	let bonusAmount  = data.bonusAmount;
			let anteBonusPlusAmount = +data.anteBonusPlusAmount || 0;//bp
			let bonus = data.bonus;

	    	let totalBet     = bh.ante.bet + bh.flop.bet + bh.turn.bet + bh.river.bet + bh[bonus].bet + (bh.bonusplus ? bh.bonusplus.bet : 0);
	    	let totalWin     = totalBet - bh[bonus].bet - (bh.bonusplus ? bh.bonusplus.bet : 0);
	    	let totalWinning = 0;
	    	let totalRolling = 0;
	    	let totalLost    = 0;

	    	if(bonusAmount){
	    		let bonusWin = bh[bonus].bet * bonusAmount;
	    		totalWinning += bonusWin;
	    		bh[bonus].win = bonusWin + bh[bonus].bet;
	    		totalWin += bh[bonus].bet; // if bonus win, then bonus bet is refunded also
	    		totalRolling = bh[bonus].bet;
	    	} else {
	    		totalLost = bh[bonus].bet;
	    		totalRolling = bh[bonus].bet;
	    	}

			if (anteBonusPlusAmount && bonus == 'pocket') {
				let bonusPlusWin = (bh.bonusplus ? bh.bonusplus.bet : 0) * anteBonusPlusAmount;
				totalWinning += bonusPlusWin;
				bh.bonusplus.win = bonusPlusWin + (bh.bonusplus ? bh.bonusplus.bet : 0);
				totalWin += (bh.bonusplus ? bh.bonusplus.bet : 0); // if bonus win, then bonus bet is refunded also
				totalRolling += (bh.bonusplus ? bh.bonusplus.bet : 0);
			} else {
				totalLost += (bh.bonusplus ? bh.bonusplus.bet : 0);
				totalRolling += (bh.bonusplus ? bh.bonusplus.bet : 0);
			}

			totalWin  += totalWinning;

			bh.ante.win = bh.ante.bet;
			bh.flop.win = bh.flop.bet;
			bh.turn.win = bh.turn.bet;
			bh.river.win = bh.river.bet;

	    	return {
	    		totalWin,
	    		totalLost,
	    		totalBet,
	    		totalWinning,
	    		totalRolling,
	    		bh
	    	};
	    },
	    dealer(data){
	    	let bh           = data.bh;
	    	let bonusAmount  = data.bonusAmount;
			let anteBonusPlusAmount = +data.anteBonusPlusAmount || 0;//bp
			let bonus = data.bonus;

	    	let totalBet     = bh.ante.bet + bh.flop.bet + bh.turn.bet + bh.river.bet + bh[bonus].bet + (bh.bonusplus ? bh.bonusplus.bet : 0);
	    	let totalWin     = 0;
	    	let totalWinning = 0;
	    	let totalRolling = totalBet;
	    	let totalLost    = bh.ante.bet + bh.flop.bet + bh.turn.bet + bh.river.bet;

	    	if(bonusAmount){
	    		let bonusWin = bh[bonus].bet * bonusAmount;
	    		bh[bonus].win = bonusWin + bh[bonus].bet;
	    		totalWinning += bonusWin;
	    		totalWin +=  bh[bonus].bet;
	    	} else {
	    		totalLost += bh[bonus].bet;
	    	}

			if(anteBonusPlusAmount && bonus == 'pocket'){
				let bonusPlusWin = (bh.bonusplus ? bh.bonusplus.bet : 0) * anteBonusPlusAmount;
				bh.bonusplus.win = bonusPlusWin + (bh.bonusplus ? bh.bonusplus.bet : 0);
				totalWinning += bonusPlusWin;
				totalWin += (bh.bonusplus ? bh.bonusplus.bet : 0);
			} else {
				totalLost += (bh.bonusplus ? bh.bonusplus.bet : 0);
			}

			totalWin += totalWinning;
	    	return {
	    		totalWin,
	    		totalLost,
	    		totalBet,
	    		totalWinning,
	    		totalRolling,
	    		bh
	    	};

	    }
	},
	getCards(cards){
		let result = [];
		_.each(cards,(c,i)=>{
			if(c.value == 1 || c.value > 9){
				let ccc = {
					"1" : "A",
					"10": "T",
					"11": "J",
					"12": "Q",
					"13": "K"
				};
				c.value = ccc[c.value.toString()];
			}
			result.push(c.value + c.suit.toUpperCase());
		});
		return result;
	},
	fnDataProcessing (isCreate, data, model, db) {
		let returnData = null;
		return db.sequelize.transaction({
			autocommit     : true,
			isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
		}).then(t=>{
			return model[isCreate](data.data,data.where, {transaction: t})
					.then((r)=>{
						if(r)
							returnData = r;
						else
							throw 'errorsj';

						t.commit();
					})
					.catch(e => {
						t.rollback();
						this.reject();
					});
		}).then(()=>{
					if(returnData && (typeof returnData == 'object'))
						return returnData;
					if (!(returnData && returnData.length && returnData[0]))
						throw 'errorss';
					return returnData;
				})
				.catch(e => {
					throw 'error2';
					return returnData;
				});
	},
	convertInput(card){
		let cardlooper = (crd,h)=>{
			_.each(h,c=>crd.push(new deck(c).name));
			return crd;
		};

		return {
			turn   : new deck(card.turn).name,
			river  : new deck(card.river).name,
			player : cardlooper([],card.player),
			flop   : cardlooper([],card.flop),
			burn   : cardlooper([],card.burn),
			dealer : cardlooper([],card.dealer)
		};
	},

	fnGetCurrentRoundDatas (tableId) {
		return new Promise((res, rej)=>{
			models.rounds.findOne({
				where: {
					table_id : tableId
				},include:[{
					model      : models.dealers,
					attributes : ['id', 'real_name','name','dealer_image']
				},{
					model      : models.tables,
					attributes : ['id', 'bet_setting','env_setting']
				}],
				order: [ [ 'id', 'DESC' ]],
				attributes : ['id','game_info','round_num','game_result','status'],
				plain:true
			})
			.then(data=>{
				if(!data){
					rej('cant find current round: refresh the app');
					return;
				}

				let gameInfo    = (data.game_info)? JSON.parse(data.game_info) : {};
				let betSettings = JSON.parse(data.game_table.bet_setting);
				let done        = (data.game_result);
				let postStatus  = data.status;
				let envSetting  = JSON.parse(data.game_table.env_setting);
				gameInfo = this.convertInput(gameInfo);

				// get post status logic
				if(data.status=='H'){
					if (data.game_result){
						postStatus = 'E';
					} else {
						if(!gameInfo.player){
							postStatus = 'S';
						} else {
							postStatus = 'P';
						}
					}
				}

				models.gameMarks.findOne({
					attributes : ['mark_num'],
					order      : [ [ 'created_at', 'DESC' ]]
				})
				.then(markData=>{
					res(Object.assign({},{
						roundId       : data.id,
						roundNum      : data.round_num,
						dealer        : data.dealer,
						autonextround : (betSettings.auto_next_round == "Y")? betSettings.delay_time : 0,
						bettimer      : betSettings.betting_time || 0,
						lastrounds    : betSettings.lastrounds,
						player        : (gameInfo.player)? gameInfo.player:null,
						banker        : (gameInfo.dealer)? gameInfo.dealer:null,
						flop          : (gameInfo.flop)? gameInfo.flop:null,
						turn          : gameInfo.turn,
						river         : gameInfo.river,
						burn          : (gameInfo.burn)? gameInfo.burn:null,
						gameInfo      : (data.game_info)? JSON.parse(data.game_info) : {},
						table         : data.game_table.id,
						status        : data.status,
						rtmp          : envSetting.web_stream,
						postStatus,
						shoe          : markData.mark_num,
						done,
						tableId
					}));
				}).catch(e=>rej('server error: refresh the page'));
			}).catch(e=>rej('server error: refresh the page'));
		});
	},

	fnProcessNewRound (currentTableId,dealerId,roundNum) {

		return new Promise((res, rej)=>{
			let cardsData      = {
				dealer : [],
				player : [],
				flop   : [],
				river  : null,
				turn   : null,
				burn   : []
			};
			let round          = {};
            //let json         = JSON.parse(JSON.stringify(roundNum));
            let countNumData = parseInt(roundNum) + 1;
            let qd = {
                data:{
                    dealer_id : dealerId,
                    game_info : cardsData,
                    round_num : countNumData,
                    table_id  : currentTableId
                },
                where:null
            };

            models.sequelize.transaction({
                autocommit     : true,
                isolationLevel : models.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
            })
            .then(t=>{

                return models.rounds.create({
                    dealer_id : dealerId,
                    game_info : cardsData,
                    round_num : countNumData,
                    table_id  : currentTableId,
                    status    : 'S'
                }, {transaction: t})
                .then((r)=>{
                    // models.gameMarks.create({
                    // 	round_id : r.get('id'),
                    // 	table_id : r.get('table_id'),
                    // 	mark_num : '2917265930004'
                    // });

                    if(r){
                        round = r;
                    }

                    t.commit();
                })
                .catch(err=>{
                    rej(err);
                    t.rollback()
                });
            }).then(()=>{
                res({
                        id        : round.get('id'),
                        round_num : round.get('round_num')
                    });
            });

		});
	},

	getCardType (data){
		return new Promise((res, rej)=>{
			let cardCheck = new deck(data);
				let cardFlag  = (cardCheck.checkCard(data))?'card':false;
				if(cardFlag){ // checks if data is from game cards
					res( cardFlag  );
				}

				if(data.length == 5 && data[0] == 'D')
					res( 'dealer' );
				else
					rej('unrecognized card');

			/* models.dealers.find({where:{code:data}})
			.then(dealer=>{
				if(dealer)
					res('dealer');
			})
			.then(()=>{
				let cardCheck = new deck(data);
				let cardFlag  = (cardCheck.checkCard(data))?'card':false;
				if(cardFlag)
					res( cardFlag  );
				else
					rej('unrecognized card');
			}).catch(()=>rej('server error: refresh the app')); */
		});
	},

	fnProcessDeleteCard(who,tableId, roundNum){
		return new Promise((res, rej)=>{
			models.rounds.find({
				where : {
					table_id : tableId,
					round_num : roundNum
				}
			})
			.then(round=>{
				if(!round){
					rej('cant find round: refresh the app');
					return;
				}
				let game_info = JSON.parse(round.get('game_info'));

				if(game_info[who] instanceof Array){
					if((who == 'player' || who == 'dealer') && game_info[who].length > 2){
						game_info[who] = [];
					}else if(who == 'flop' && game_info[who].length > 3) {
						game_info[who] = [];
					}
					else{
						game_info[who].pop();
					}
				}

				else
					game_info[who] = null;
				round.update({game_info,status:'P'})
				.then(f=>res(game_info))
				.catch(()=>rej('update error: refresh the app'));
				/*.then(()=>{
					this.putLogs(true,round.get('round_num'),real_name,round.get('table_id'))
					.then(f=>res(game_info))
					.catch(()=>rej('delete error: refresh the app'));
				}).catch(()=>rej('delete error: refresh the app'));*/
			}).catch(()=>{
				rej('Error: delete card, please refresh');
			});
		});
	},

	putLogs(isDelete,roundNum,real_name,tableId) {
		return new Promise((res, rej)=>{
			models.dealerLogs.find({where:{round_num:roundNum,table_id:tableId}})
			.then(log=>{
				if(log){
					let logAction = JSON.parse(log.get('actions'));
					logAction.push({action:"update",comment:"remove item"});
					log.update({actions:logAction,real_name})
					.then(()=>res(true));
				} else{
					let actions = [{action:"update",comment:"remove item"}];
					models.dealerLogs.create({
						table_id,
						round_num,
						real_name,
						actions
					}).then(()=>res(true));
				}
			});
		});
	},
	checkCards(gameInfo,type,value){
		if(type == 'river' || type == 'turn')
			return true;
		let handLength = {
			'player' : 2,
			'dealer' : 2,
			'flop'   : 3,
			'burn'   : 3
		};

		if(gameInfo[type].length >= handLength[type]) // check if hand is full
			return false;
		if(gameInfo[type].indexOf(value) >= 0) // check if value is existing
			return false;

		return true;
	},
	fnProcessCard (value, type, roundNum, tableId,  next) {
		let strQuery = '';

		if(type == 'turn' || type == 'river')
			strQuery = 'update rounds set game_info = JSON_SET(game_info, "$.'+type+'", "'+value+'" ) where round_num = '+roundNum+' and table_id = '+tableId;
		else
			strQuery = 'update rounds set game_info = JSON_SET(game_info, "$.'+type+'[2]", "'+value+'" ) where round_num = '+roundNum+' and table_id = '+tableId;

		//return;
		this.fnMysqlRaw(strQuery,models,false)
		.then(()=>{
			next( true );
		}).catch(e=>{
			next({error:true});
		});
	},

	/**
	 * Description: If round status is P then set to S
	 *
	 * @param id
	 * @returns {Promise}
	 */
	fnResetTimer (roundNum, tableId) {
		return new Promise((res, rej)=>{
			let updateQuery = {
				data : {status:'S'},
				where : {where:{round_num :roundNum, table_id :tableId}}
			};

			models.rounds.findOne({where:{
						round_num : roundNum,
						table_id : tableId
					}})
					.then(round => {
						if (round.get('status') != 'P') {
							rej('Error: set round status');
							return;
						}

						this.fnDataProcessing('update',updateQuery,models.rounds,models)
								.then(()=>res())
								.catch(e=>rej('Error: set round status'));
					});
		});
	},

	changeDealer(value,roundNum, roundId, realName, tableId, gameName, status, next){
		let strQueryInsertUpdate = null;
		models.dealers.findOne({
					where:{
						code : value
					},
					attributes : ['id','real_name','name','code','dealer_image','table_image'],
					plain : true
				})
				.then(dealer=>{

					if(!dealer){
						next({error:true,message:'server error: refresh the app'});
						return;
					}

					let dealerChangeData = {
						gameName,
						roundId,
						roundNum,
						eventName   : 'dealerchange',
						tableId,
						dealerId    : dealer.id,
						dealerCode  : dealer.code,
						dealerName  : dealer.name,
						dealerImage : dealer.dealer_image,
						tableImage  : dealer.table_image
					};

					if(status != 'S'){
						next(dealerChangeData);
						return;
					}

					// store dealers->real_name
					/*let dealerName = dealer.real_name;*/

					 let promises = [];
					// 1. Before dealer table name is null

					let strQueryDealers = " UPDATE nihtan_api.dealers";
						strQueryDealers += "   SET table_name = null";
						strQueryDealers += " WHERE table_name='" + gameName + "# " + tableId + "'";

						promises.push(this.fnMysqlRaw(strQueryDealers,models,false));

						strQueryInsertUpdate = " UPDATE rounds AS T1";
							strQueryInsertUpdate += " INNER JOIN nihtan_api.dealers AS T2";
							strQueryInsertUpdate += " ON T2.id = " + dealer.id;
							strQueryInsertUpdate += " SET T1.dealer_id = " + dealer.id;
							strQueryInsertUpdate += " , T2.table_name = '" + gameName + "# " + tableId + "'";
							strQueryInsertUpdate += " , T1.updated_at = NOW()";
							strQueryInsertUpdate += " , T2.updated_at = NOW()";
							strQueryInsertUpdate += " WHERE T1.table_id = " + tableId;
							strQueryInsertUpdate += " AND T1.round_num = " + roundNum;
							promises.push(this.fnMysqlRaw(strQueryInsertUpdate,models,false));

	                        Promise.all(promises)
	                        .then(d=>{
								_.each(d,i=>{
									if (!i){
										next(false);
										return;
									}
								});
	                        	next(dealerChangeData);
	                        })
	                        .catch(()=>{
	                        	next({error:true,message:'server error: refresh the app'});
	                        });
				}).catch(()=>next({error:true,message:'server error: refresh the app'}));
	},
	fnMysqlRaw (query,db,plain) {

		let returnData = null;

		return db.sequelize.transaction({
			autocommit     : true,
			isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
		})
		.then(t=>{
			return db.sequelize.query(query,{transaction: t,plain})
			.then(r=>{
				if(r){
					returnData = r;
				}
				t.commit();
			})
			.catch(err=>{
				t.rollback();
				this.reject();
			});
		}).then(()=>{
			return returnData;
		})
		.catch(e=>{
			this.reject();
		});
	},

	/**
	 *
	 * @param rank
	 * @param winner
	 * @returns {number}
     */
	getAnteBonus(rank, isBadBeat){
		// this function is for ante bonus feature
			let n = '';
			if(rank.search(",")+1){
	    		n = rank.split(',')[0].toLowerCase().trim();
	    	} else {
	    		n = rank.toLowerCase().trim();
	    	}

	    	let rankDataler = {
	    		"royal flush"    : [500 , 500],//rank = royal flush always wins.
	    		"straight flush" : [50	, 500],
	    		"four of a kind" : [10	, 50],
	    		"full house"     : [3	, 10],
	    		"flush"          : [1.5	, 8],
	    		"straight"       : [1	, 5]
	    	};

			return rankDataler[n] ?
						rankDataler[n][isBadBeat] || 0
						: 0;
	},

	getAntePayoutOdds(rank){
		// this function is for ante bonus feature

			let n = '';
			if(rank.search(",")+1){
	    		n = rank.split(',')[0].toLowerCase().trim();
	    	} else {
	    		n = rank.toLowerCase().trim();
	    	}

	    	let rankDataler = {
	    		"royal flush":true,//    : 500,
	    		"straight flush":true,// : 50,
	    		"four of a kind":true,// : 10,
	    		"full house":true,//     : 3,
	    		"flush":true,//          : 1.5,
	    		"straight":true,//       : 1
	    	};
			return (rankDataler[n])?1:0;
	},
	fnGetPartialResults(roundId,roundNum,tableId){
		return new Promise((res, rej)=>{
			models.rounds.find({
				where:{
					round_num: roundNum,
                    table_id: tableId
				},
				attributes:['id','table_id','round_num','dealer_id','game_info','game_result','created_at','updated_at']
			}).then(round=>{
				if (_.isEmpty(round)) {
					rej('round empty');
					return;
				}
				let cardCodes = JSON.parse(round.get('game_info'));
				let card      = this.convertInput(JSON.parse(round.get('game_info')));

				if(!card.river){
					rej('river empty');
					return;
				}

				let fivePlayerSet =  [...card.player,...card.flop];

				let unifiedPlayerSet = _.union( card.player,card.flop,[card.turn],[card.river] );
				let unifiedbankerSet = _.union( card.dealer,card.flop,[card.turn],[card.river] );

				if(unifiedPlayerSet.length != 7 || unifiedbankerSet.length != 7){
					rej('insufficient cards');
					return;
				}

				let player5Hands    = Hand.solve(fivePlayerSet);
				let playerHands     = Hand.solve(unifiedPlayerSet);
				let bankerHands     = Hand.solve(unifiedbankerSet);
				let winner          = Hand.winners([playerHands,bankerHands]);
				let cards           = [];
				let handtype        = (winner[0].descr == 'Royal Flush')?winner[0].descr:winner[0].name;
				let winSide         = 'dealer';
				let bets            = round.bets;

				cards = this.getCards(winner[0].cards);


				if(winner.length > 1)
					winSide = 'tie';
				else if (winner[0], _.isEqual(playerHands,winner[0]))
					winSide = 'player';

				let uCards = [];
				_.each(cards,(c,ind)=>{
					if(ind < 5)
						uCards.push(new deck('0000').getCodeByName(c).code);
				});
				res({
						created_at : round.created_at,
						updated_at : round.updated_at,
						tableId    : round.table_id,
						roundId    : round.id,
						roundNum   : round.round_num,
						playerHands,
						bankerHands,
						winner,
						winSide,
						gameInfo : cardCodes,
						gameResult : {
							cards,
							cardsCode : uCards,
							winner:winSide,
							handtype
						}
				});
			});
		});
	},
	fnGetResults(roundId,roundNum,tableId,shoeId){
		return new Promise((res, rej)=>{
			models.rounds.find({
				where:{
					round_num: roundNum,
                    			table_id: tableId,
					status: 'P'
				},include:[{
					model:models.bets,
					attributes:['id','round_id','type','user_id','bet_history','total_bet','total_winning','bet_range','created_at','updated_at','session_id','bet_id','currency'],
					include : [{
						model:models.users,attributes: ['id', 'vendor_id', 'user_id', 'user_name', 'money', 'user_type', "currency","denomination"],plain:true,
						include : [{
							model:models.vendors,
							attributes: ['id','type','integration_type', "currency", "multiplier"],
							plain:true
						}]
					}]
				}],
				attributes:['id','table_id','round_num','dealer_id','game_info','game_result','created_at','updated_at']
			})
			.then(round=>{
				if (_.isEmpty(round)) {
					rej('round empty');
					return;
				}
				let cardCodes = JSON.parse(round.get('game_info'));
				let card      = this.convertInput(JSON.parse(round.get('game_info')));

				if(!card.river){
					rej('river empty');
					return;
				}

				// convert barcodes to poker-solver readables
				let playerBonusHand = card.player;
				let fivePlayerSet =  [...card.player,...card.flop];

				let unifiedPlayerSet = _.union( card.player,card.flop,[card.turn],[card.river] );
				let unifiedbankerSet = _.union( card.dealer,card.flop,[card.turn],[card.river] );

				if(unifiedPlayerSet.length != 7 || unifiedbankerSet.length != 7){
					rej('insufficient cards');
					return;
				}

				let player5Hands    = Hand.solve(fivePlayerSet);
				let playerHands     = Hand.solve(unifiedPlayerSet);
				let bankerHands     = Hand.solve(unifiedbankerSet);
				let winner          = Hand.winners([playerHands,bankerHands]);
				let cards           = [];
				let handtype        = (winner[0].descr == 'Royal Flush')?winner[0].descr:winner[0].name;
				let winSide         = 'dealer';
				let bets            = round.bets;
				let playerCardRank  = this.getAntePayoutOdds(playerHands.descr);

				//include extra cards for tie
				cards = _.union(this.getCards(winner[0].cards), winner.length > 1 ? this.getCards(winner[1].cards) : []);

				if(winner.length > 1)
					winSide = 'tie';
				else if (winner[0], _.isEqual(playerHands,winner[0]))
					winSide = 'player';

				let bonusplusAmount = this.getAnteBonus(player5Hands.descr, +(winSide == 'dealer'));
				let uCards = [];
				_.each(cards,(c,ind)=>{
					//for flush only
					if(ind < 5 || (ind >= 5 && winner.length > 1))
						uCards.push(new deck('0000').getCodeByName(c).code);
				});
				let finalResult = {
                                        game_result : {
                                                cards:uCards,
                                                //bonus,
                                                winner:winSide,
                                                handtype
                                        },
                                        status : 'E'
                                };
				round.update(finalResult)
				.then(()=>{
					models.gameMarks.insertOrUpdate({
						mark:{mark:winSide[0].toUpperCase()},
                        round_id : roundId,
						table_id : tableId,
						//mark_num : shoeId
					}).catch(e=>{console.log(e);rej('server error at game Marks');});
				})
				.then(()=>{
					models.rounds.findAll({
						where:{
							table_id:tableId
						},
						limit: 3,
						order: [['id', 'DESC']],
						attributes:['id',
							'round_num',
							'status',
							'game_info',
							'game_result']
					})
					.then(lastrounds=>{
						let meta = [];
						let currentResults = {
							cards : uCards,
							//bonus,
							winner:winSide,
							handtype
						};
						_.each(lastrounds,lround=>{
							let gameInfo = Object.assign(JSON.parse(lround.game_info), lround.status === 'W' ? {isVoid : true} : {});
							meta.push({
								roundId    : JSON.parse(lround.id),
								roundNum   : JSON.parse(lround.round_num),
								gameInfo,
								gameResult : (lround.game_result)?JSON.parse(lround.game_result):currentResults
							});
						});

						res({
							created_at : round.created_at,
							updated_at : round.updated_at,
							tableId    : round.table_id,
							roundId    : round.id,
							roundNum   : round.round_num,
							playerHands,
							bankerHands,
							winner,
							winSide,
							bets,
							playerBonusHand,
							playerCardRank,
							bonusplusAmount,
							gameInfo : cardCodes,
							gameResult : {
								cards,
								cardsCode : uCards,
								winner:winSide,
								handtype
							},
							finalResult,
							mark:{mark:winSide[0].toUpperCase()},
							meta
						});
					}).catch(e=>rej('server error at meta results'));
				}).catch(e=>rej('server error at update roundresults'));
			}).catch(e=>{console.log(' eeeeeeeeeeeeeeee----> ',e);rej('server error at find results');});
		});
	},

	fnGetTables (gameName) {
		return new Promise((res, rej)=>{
			let tableGroups = [];
			models.tables.findAll()
			.then(tables=>{
				_.each(tables,(table,index)=>{
					tableGroups.push(table.get('id'));
				});
				res({
					eventName : 'init',
					gameName,
					tables : tableGroups
				});
			}).catch(e=>console.log(e));
		});
	},

	fnGetRoundStatus (roundNum, tableId) {
		return new Promise((res, rej)=>{
			models.rounds.findOne({where : {table_id : tableId, round_num : roundNum}})
					.then(round => {
						res(round.get('status'));
					}).catch(e=>rej('Error: get round status'));
		})
	},

	fnSetRoundStatus (roundNum,status,tableId) {
		return new Promise((res, rej)=>{
			let updateQuery = {
				data : {status},
				where : {where:{round_num :roundNum}}
			};
			models.rounds.update({status},{where:{round_num:roundNum,table_id:tableId}})
			.then(()=>res())
			.catch(e=>console.log(e));
		});
	},

	fnProcessAutoNextRound (searchId) {
		return new Promise((res, rej)=>{
			models.tables.findById(searchId)
			.then(table=>{
			let settings = JSON.parse(table.get('bet_setting'));
				settings.auto_next_round = (settings.auto_next_round == "Y")? "N" : "Y";
				table.update({bet_setting:settings})
				.then(()=>{
					var delayTime = (settings.auto_next_round == "Y")? settings.delay_time : 0;
					res(delayTime);
				}).catch(err=>rej(err));
			}).catch(err=>rej(err));
		});
	},

	fnProcessLastRounds (searchId,amt) {
		return new Promise((res, rej)=>{
			let querys = 'UPDATE `poker`.`game_tables` as `gt`'
					+ ' SET'
					+ ' `gt`.`bet_setting`= JSON_SET(`bet_setting`,"$.lastrounds",'+amt+'),'
					+ ' `gt`.`updated_at`=NOW()'
					+ ' WHERE `gt`.`id`=' + searchId;

			this.fnMysqlRaw(querys,models,false).then(()=>{
				res(amt);
			}).catch(e=>rej(false));
		});
	},
   /**
     * Pass data for current round to Nihtan API Server.
     *
     * @param game
     * @param result
     * @param data
     */
    sendToAPIServer (game, result, data,dealer) {
		//return;
		console.log(result);
         request({
            method: 'POST',
            uri: config.apiBetsUrl,
            body: {
                game,
                table       : result.tableId,
                round_no    : result.roundNum,
                game_info   : result.gameInfo,
                game_result : result.gameResult,
                created_at  : result.created_at,
                resulted_at : result.updated_at,
                dealer :dealer,
                data: data
            },
            json: true
        }).catch(e=>console.log(e));

    },

	processBets(roundNum,tableId,winner,bets,bonusAmount,pocketAmount,anteBonusOdds,anteBonusPlusAmount,result,dealerName){
		return new Promise((res, rej)=>{
			let betsJson        = [];
			let queryBH         = '';
			let queryTB         = '';
			let queryTW         = '';
			let queryTWin       = '';
			let queryTLost      = '';
			let queryBetRolling = '';
			let idArray         = [];
			let userMoney       = '';
			let userIds         = [];
			let userInfo        = [];
			let apiUserInfo     = [];
			let betsWinning     = '';
			let roundWins       = 0;
			let roundBets       = 0;
			let totalRolling    = 0;

			result.updated_at = moment(result.updated_at).utcOffset(0).format('YYYY-MM-DD HH:mm:ss');
			result.created_at = moment(result.created_at).utcOffset(0).format('YYYY-MM-DD HH:mm:ss');
			console.log('created_at---------------------->',result.created_at);

			if(bets.length){
				_.each(bets,(bet,index)=>{

					let bh             = JSON.parse(bet.bet_history);
					let bonus = bet.type == 'b' ? 'pocket' : 'bonus';
					let bonusAmountUsed = bet.type == 'b' ? pocketAmount : bonusAmount;
					let totalBet       = bh.ante.bet + bh.flop.bet + bh.turn.bet + bh.river.bet + bh[bonus].bet +
							(bh.bonusplus ? bh.bonusplus.bet : 0);
					//let totalWin       = bet.total_winning;
					let moneyPayToUser = 0;
					//let totalLost = 0;
					let totalUserMoney = '';
					let betRange = '';
					// anteBonusAmount is the bonus for ante
					let anteBonusAmount = 0;
					// get payouts on winning cases
					let resultHolder = this.payoutHandler[winner]({
						bh,
						bonusAmount : bonusAmountUsed,
						anteBonusOdds,
						anteBonusPlusAmount,
						bonus
					});

					bh.ante.user_money = (bh.ante.user_money)?bh.ante.user_money:0;
					bh.flop.user_money = (bh.flop.user_money)?bh.flop.user_money:0;
					bh.turn.user_money = (bh.turn.user_money)?bh.turn.user_money:0;
					bh.river.user_money = (bh.river.user_money)?bh.river.user_money:0;

					//totalUserMoney += bh.ante.user_money + bh.flop.user_money + bh.turn.user_money + bh.river.user_money;

					//totalUserMoney = bh.ante.user_money - resultHolder.totalBet + resultHolder.totalWin;

					totalUserMoney = bet.user.get('money') + resultHolder.totalWin;

					if(bh.flop.bet < 1) {
						//bonusplus
						if(bonus == 'pocket'){
							resultHolder.bh.bonusplus.win = 0;
						}
						// user folded
						resultHolder.bh.ante.win = 0;
						resultHolder.bh.flop.win = 0;
						resultHolder.bh.turn.win = 0;
						resultHolder.bh.river.win = 0;
						resultHolder.bh[bonus].win = 0;
						resultHolder.totalWinning = 0;
						resultHolder.totalWin = 0;
						resultHolder.totalRolling = totalBet;
						resultHolder.totalLost = totalBet;
						totalUserMoney = bet.user.get('money');
					}
					let betuser = bet.user.get();
					let temptotalWin = (betuser.vendor.integration_type == 'transfer')?resultHolder.totalWin:0;
					userMoney += 'WHEN ' + bet.user_id + ' THEN u.money+' +  temptotalWin + ' ';
					console.log('trapping =======================>',userMoney);
					//userIds.push(bet.user_id);
					queryTLost += 'WHEN ' + bet.id + ' THEN ' + resultHolder.totalLost + ' ';
					queryBetRolling += 'WHEN ' + bet.id + ' THEN ' + resultHolder.totalRolling + ' ';
					queryBH += 'WHEN ' + bet.id + ' THEN \'' +  JSON.stringify(resultHolder.bh) + '\' ';
					queryTB += 'WHEN ' + bet.id + ' THEN ' +  resultHolder.totalBet + ' ';
					queryTW += 'WHEN ' + bet.id + ' THEN ' +  resultHolder.totalWinning + ' '; // total winning <-- raw money won
					queryTWin += 'WHEN ' + bet.id + ' THEN ' +  resultHolder.totalWin + ' '; // total win <--- total money won with bets

					userInfo.push({
						id:bet.user_id,
						total_winning:Math.round(resultHolder.totalWin * 100) / 100,
						money:totalUserMoney,
						user_type: bet.user.get('user_type'),
						total_lost:resultHolder.totalLost,
						bets:bh,
						type:bet.type
					});

					apiUserInfo.push({
					        id              : bet.user.get('id'),
							user_id         : bet.user.get('user_id'),
							user_name       : bet.user.get('user_name'),
							vendor_id       : bet.user.get('vendor_id'),
							type            : bet.type,
							user_type       : bet.user.get('user_type'),
							bets            : bh,
							bet_range       : bet.bet_range,
							total_bet       : totalBet,
							total_rolling   : resultHolder.totalRolling,
							total_win       : resultHolder.totalWin,
							total_lost      : resultHolder.totalLost,
							bet_id          : bet.bet_id,
							session_id	    : bet.session_id,
							created_at      : moment(bet.created_at).utcOffset(0).format('YYYY-MM-DD HH:mm:ss'),
							currency	    : bet.currency || bet.user.currency || bet.user.vendor.currency,
							multiplier      : bet.user.denomination || bet.user.vendor.multiplier
						});
					roundWins += resultHolder.totalWin;
					roundBets += resultHolder.totalBet;
				});

					let rawQuery = "UPDATE `bets` as `b` "
						+ "JOIN `nihtan_api`.`users` as `u` ON `b`.`user_id` = `u`.`id` "
                        + "JOIN `rounds` as `r` ON `r`.`id` = `b`.`round_id` "
						+ "SET `b`.`bet_history` = (CASE `b`.`id` "+queryBH+" END),"
						+ "`b`.`total_bet` = (CASE `b`.`id` "+queryTB+" END),"
						+ "`b`.`total_winning` = (CASE `b`.`id` "+queryTW+" END),"
						+ "`b`.`total_win` = (CASE `b`.`id` "+queryTWin+" END),"
						+ "`b`.`total_lost` = (CASE `b`.`id` "+queryTLost+" END),"
						+ "`b`.`total_rolling` = (CASE `b`.`id` "+queryBetRolling+" END),"
						+ "`u`.`money` = (CASE `u`.`id` "+userMoney+" END),"
						+ "`b`.`updated_at`=NOW(),"
						+ "`u`.`updated_at`=NOW(),"
						+ "`r`.`updated_at`=NOW()"
						+ " WHERE `r`.`round_num` = " + roundNum
                        + "   AND `r`.`table_id` = " + tableId;

					models.sequelize.transaction({
						autocommit : true,
						isolationLevel : models.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
					}).then(t=>{
						return models.sequelize.query(rawQuery, {transaction: t})
						.then(()=>t.commit())
						.catch(err=>{
							t.rollback();
							rej(err);
						});
					}).then(()=>{
						this.sendToAPIServer(config.gameName, result, apiUserInfo,dealerName);
						res({roundWins,userInfo});
					}).catch(err=>{
						rej(err);
					});
			} else {

				this.sendToAPIServer(config.gameName, result, apiUserInfo,dealerName);
				res({roundWins,userInfo});
			}
		});
	},

fnGetTablesMarks (gameName) {
    return new Promise((res, rej) => {
	    let strQuery = "";

	    let tableId     = 0;
	    let roundNum    = 0;
	    let dataCnt     = 0;

        let dealerId   = "";
	    let dealerName  = "";
	    let dealerImage = "";

	    let mainMaintenance     = {};
	    let mainNotice          = {};

	    let envSetting          = "";
	    let roomType            = "";
	    let sportBetRanges      = "";
	    let casinoBetRanges     = "";
	    let maintenanceSetting  = "";
	    let noticeSetting       = "";

	    let gameInfo    = "";
	    let gameResult  = "";
	    let roundStatus = "";

	    let gameMarks   = [];
	    let tableIds    = [];
	    let tableGroups = [];

	    let gameMark    = {};
	    let tableGroup  = {};

	    models.tables.findAll({
	        where : {
	            status : "1"
	        },
	        attributes: ["id"]
	    }).then(tables => {
	        _.each(tables, (table, index) => {
	            tableIds.push(table.get("id"));
	        });

	        strQuery = " SELECT TB_1.id";
	        strQuery += "     , TB_1.game_name";
	        strQuery += "     , TB_1.mark_id";
	        strQuery += "     , TB_1.round_id";
	        strQuery += "     , TB_1.round_num";
			strQuery += "     , CASE WHEN TB_1.status = 'W' THEN JSON_MERGE(TB_1.game_info, '{\"isVoid\": true}')";
			strQuery += "            ELSE TB_1.game_info END AS game_info";
	        strQuery += "     , TB_1.game_result";
	        strQuery += "     , TB_1.status AS round_status";
	        strQuery += "     , TB_1.mark";
	        strQuery += "     , TB_1.env_setting";
			strQuery += "     , TB_1.betSetting";
	        strQuery += "     , TB_1.room_type";
	        strQuery += "     , TB_1.sport_bet_ranges";
	        strQuery += "     , TB_1.casino_bet_ranges";
	        strQuery += "     , TB_1.maintenance_setting";
	        strQuery += "     , TB_1.notice_setting";
	        strQuery += "     , TB_2.main_text";
	        strQuery += "     , TB_2.sub_text";
			strQuery += "     , TB_2.status AS maintenance_status";
	        strQuery += "     , DATE_FORMAT(TB_2.start_time, '%Y-%m-%d %H:%i:00') AS start_time";
	        strQuery += "     , DATE_FORMAT(TB_2.end_time, '%Y-%m-%d %H:%i:00') AS end_time";
	        strQuery += "     , DATE_FORMAT(TB_3.start_time, '%Y-%m-%d %H:%i:00') AS notice_start_time";
            strQuery += "     , DATE_FORMAT(TB_3.end_time, '%Y-%m-%d %H:%i:00') AS notice_end_time";
            strQuery += "     , TB_3.content";
            strQuery += "     , TB_3.time_yn";
            strQuery += "     , TB_3.status AS notice_status";
	        strQuery += "     , TB_1.dealer_id";
	        strQuery += "     , TB_1.real_name";
	        strQuery += "     , TB_1.dealer_image";
	        strQuery += "  FROM (SELECT T1.id";
	        strQuery += "             , T1.game_name";
	        strQuery += "             , T4.id AS mark_id";
	        strQuery += "             , T4.round_id";
	        strQuery += "             , T2.round_num";
	        strQuery += "             , T2.game_info";
	        strQuery += "             , T2.game_result";
	        strQuery += "             , T2.status";
	        strQuery += "             , T4.mark";
	        strQuery += "             , T1.env_setting";
	        strQuery += "             , T1.room_type";
			strQuery += "             , T1.bet_setting as betSetting";
	        strQuery += "             , T1.sport_bet_ranges";
	        strQuery += "             , T1.casino_bet_ranges";
	        strQuery += "             , T1.maintenance_setting";
	        strQuery += "             , T1.notice_setting";
	        strQuery += "             , T3.id AS dealer_id";
	        strQuery += "             , T3.real_name";
	        strQuery += "             , T3.dealer_image";
	        strQuery += "          FROM poker.game_tables AS  T1";
	        strQuery += "          LEFT JOIN poker.rounds AS T2";
	        strQuery += "            ON T1.id = T2.table_id";
	        strQuery += "          LEFT JOIN nihtan_api.dealers AS T3";
	        strQuery += "            ON T2.dealer_id = T3.id";
	        strQuery += "          LEFT JOIN (SELECT T.id";
	        strQuery += "                          , T.table_id";
	        strQuery += "                          , T.round_id";
	        strQuery += "                          , T.mark";
	        strQuery += "                       FROM poker.game_marks AS T";
	        strQuery += "                      WHERE T.table_id = " + tableIds[0];
	        strQuery += "                      ORDER BY T.id DESC";
	        strQuery += "                      LIMIT 150) AS T4";
	        strQuery += "            ON T2.id = T4.round_id";
	        strQuery += "           AND T1.id = T4.table_id";
	        strQuery += "         WHERE T1.status = '1'";
	        strQuery += "           AND T4.id IS NOT NULL";

	        for (let i = 1; i < tableIds.length; i++) {
	            strQuery += " ";
	            strQuery += "         UNION ALL";
	            strQuery += " ";
	            strQuery += "        SELECT T1.id";
	            strQuery += "             , T1.game_name";
	            strQuery += "             , T4.id AS mark_id";
	            strQuery += "             , T4.round_id";
	            strQuery += "             , T2.round_num";
	            strQuery += "             , T2.game_info";
	            strQuery += "             , T2.game_result";
	            strQuery += "             , T2.status";
	            strQuery += "             , T4.mark";
	            strQuery += "             , T1.env_setting";
				strQuery += "             , T1.bet_setting as betSetting";
	            strQuery += "             , T1.room_type";
	            strQuery += "             , T1.sport_bet_ranges";
	            strQuery += "             , T1.casino_bet_ranges";
	            strQuery += "             , T1.maintenance_setting";
	            strQuery += "             , T1.notice_setting";
	            strQuery += "             , T3.id AS dealer_id";
	            strQuery += "             , T3.real_name";
	            strQuery += "             , T3.dealer_image";
	            strQuery += "          FROM poker.game_tables AS  T1";
	            strQuery += "          LEFT JOIN poker.rounds AS T2";
	            strQuery += "            ON T1.id = T2.table_id";
	            strQuery += "          LEFT JOIN nihtan_api.dealers AS T3";
	            strQuery += "            ON T2.dealer_id = T3.id";
	            strQuery += "          LEFT JOIN (SELECT T.id";
	            strQuery += "                          , T.table_id";
	            strQuery += "                          , T.round_id";
	            strQuery += "                          , T.mark";
	            strQuery += "                       FROM poker.game_marks AS T";
	            strQuery += "                      WHERE T.table_id = " + tableIds[i];
	            strQuery += "                      ORDER BY T.id DESC";
	            strQuery += "                      LIMIT 150) AS T4";
	            strQuery += "            ON T2.id = T4.round_id";
	            strQuery += "           AND T1.id = T4.table_id";
	            strQuery += "         WHERE T1.status = '1'";
	            strQuery += "           AND T4.id IS NOT NULL";
	        }

	        strQuery += ") AS TB_1";
	        strQuery += "  LEFT JOIN nihtan_api.maintenance AS TB_2";
	        strQuery += "    ON 1 = 1";
	        strQuery += "  LEFT JOIN nihtan_api.notice AS TB_3";
            strQuery += "    ON 1 = 1";
	        strQuery += " ORDER BY TB_1.id";
	        strQuery += "        , TB_1.mark_id";
			console.log( '-------------------------------------------------------------' );
			console.log(strQuery);
			console.log( '-------------------------------------------------------------' );
	        models.liveSequelize.query(strQuery, { plain : false }).then(marks => {
	        	let ctr = 0;

	            dataCnt = marks[0].length;

	            _.each(marks[0], (obj, index) => {
	                if (index == 0) {
	                    tableId = obj.id;

	                    mainMaintenance = {
	                        mainText    : obj.main_text,
	                        subText     : obj.sub_text,
	                        status      : obj.maintenance_status,
	                        startTime   : obj.start_time,
	                        endTime     : obj.end_time
	                    };

                        mainNotice = {
                            start_time  : obj.notice_start_time,
                            end_time    : obj.notice_end_time,
                            content     : obj.content,
                            time_yn     : obj.time_yn,
                            status      : obj.notice_status
                        };
	                }

	                gameMark = {
	                    mark_id     : obj.mark_id,
	                    round_id    : obj.round_id,
	                    mark        : JSON.parse(obj.mark)
	                };


	                if (tableId !== obj.id) {

	                    tableGroup = {
	                        id                  : tableId,
	                        roundNum            : roundNum,
	                        dealerId            : dealerId,
	                        currentDealer       : dealerName,
	                        dealerImage         : dealerImage,
	                        envSetting          : JSON.parse(envSetting),
							betSetting          : JSON.parse(betSetting),
	                        roomType            : roomType,
	                        sportBetRanges      : JSON.parse(sportBetRanges),
	                        casinoBetRanges     : JSON.parse(casinoBetRanges),
	                        maintenanceSetting  : JSON.parse(maintenanceSetting),
	                        noticeSetting       : noticeSetting,
	                        gameInfo            : JSON.parse(gameInfo),
	                        gameResult          : JSON.parse(gameResult),
	                        roundStatus         : roundStatus,
	                        gameMarks           : gameMarks
	                    };

	                    tableGroups.push(tableGroup);

	                    tableId = obj.id;
	                    gameMarks = [];
	                }

	                roundNum = obj.round_num;

                    dealerId    = obj.dealer_id;
	                dealerName  = obj.real_name;
	                dealerImage = obj.dealer_image;

	                envSetting          = obj.env_setting;
	                roomType            = obj.room_type;
	                sportBetRanges      = obj.sport_bet_ranges;
	                casinoBetRanges     = obj.casino_bet_ranges;
	                maintenanceSetting  = obj.maintenance_setting;
	                noticeSetting       = obj.notice_setting;

					let slave = (typeof JSON.parse(obj.betSetting).type == 'array' ||
					typeof JSON.parse(obj.betSetting).type == 'object')?JSON.parse(obj.betSetting).type[1]:JSON.parse(obj.betSetting).type;
	                gameInfo = obj.game_info;
	                gameResult = obj.game_result;
	                roundStatus = obj.round_status;

	                	gameMarks.push(JSON.parse(obj.mark));
	                ctr++;
	                if (dataCnt == index + 1) {
	                    tableGroup = {
	                        id                  : tableId,
	                        roundNum            : roundNum,
	                        dealerId            : dealerId,
	                        dealerName          : dealerName,
	                        dealerImage         : dealerImage,
	                        envSetting          : JSON.parse(envSetting),
	                        roomType            : roomType,
	                        sportBetRanges      : JSON.parse(sportBetRanges),
	                        casinoBetRanges     : JSON.parse(casinoBetRanges),
	                        maintenanceSetting  : JSON.parse(maintenanceSetting),
	                        noticeSetting       : noticeSetting,
	                        gameInfo            : JSON.parse(gameInfo),
	                        gameResult          : JSON.parse(gameResult),
	                        roundStatus         : roundStatus,
	                        gameMarks           : gameMarks,
							slave
	                    };

	                    tableGroups.push(tableGroup);
	                }
	            });

	            res({
	                eventName       : "init",
	                gameName        : gameName,
	                mainMaintenance : mainMaintenance,
	                mainNotice      : mainNotice,
	                tables          : tableGroups
	            });
	        });
	    });
	});
}
};
