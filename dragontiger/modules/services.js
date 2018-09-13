"use strict";

	/*
	|--------------------------------------------------------------------------
	| services v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| Service module/component for processing model datas
	|
	*/

const deck   = require("./cardsModule");
const _      = require("lodash");
const models = require("./db.js");

module.exports = {
	fnProcessBetTimer (time, searchId) {
		return new Promise((res, rej) => {
			models.tables.findById(searchId).then(table => {
				let settings = JSON.parse(table.get("bet_setting"));
				settings.betting_time = time.data;

				table.update({ bet_setting : settings }).then(() => res(time)).catch(() =>
					rej(false)
				);
			}).catch(err =>
				rej(err)
			);
		});
	},

	fnFetchMarks () {
		return new Promise((res, rej) => {
			models.infoMarks.findAll().then(marks => {
				let markData = {};

				_.forEach(marks, value => {
				  	let mark = value.get("mark");
				  	let markTransform = "";
				  	let splitInfo = value.get("mark_info").trim().split(" - ");

				  	if (splitInfo.length > 1) {
						markTransform = splitInfo[1].toLowerCase().replace(/ /g, "");
						markTransform = markTransform.replace(/dragon/g, "");
						markTransform = markTransform.replace(/tiger/g, "");
						markTransform = markTransform.replace(/big/g, "1");
						markTransform = markTransform.replace(/small/g, "0");
						markData[splitInfo[0].toLowerCase() + "." + markTransform] = mark;
				  	}

				  	markTransform = "";
				});

				res(markData);
			}).catch(e =>
				console.log(JSON.stringify(e, null, "\t"))
			);
		});
	},

	fnProcessAutoNextRound (searchId) {
		return new Promise((res, rej) => {
			models.tables.findById(searchId).then(table => {
				let settings = JSON.parse(table.get("bet_setting"));
				settings.auto_next_round = (settings.auto_next_round == "Y") ? "N" : "Y";

				table.update({ bet_setting : settings }).then(() => {
					var delayTime = (settings.auto_next_round == "Y") ? settings.delay_time : 0;
					res(delayTime);
				}).catch(err => rej(err));
			}).catch(err => rej(err));
		});
	},

	fnProcessDeleteCard (data, arrayDeleted, tableId, roundNum) {
		return new Promise((res, rej) => {
			let query = "";

			if (!arrayDeleted) {
				arrayDeleted = "burn";
			}

			query = " UPDATE dragontiger.rounds AS r";
			query += "   SET r.game_info = JSON_SET(game_info, '$." + arrayDeleted + "', null)";
			query += "     , r.updated_at = NOW()";
			query += " WHERE r.table_id = " + tableId;
			query += "   AND r.round_num = " + roundNum;

			this.fnMysqlRaw(query, models, false).then(() => {
				res({arrayDeleted});
			}).catch(() => {
				rej("Error: delete card");
			});
		});
	},

	fnMysqlRaw (query, db, plain) {
		let returnData = null;
		
		return db.sequelize.transaction({
			autocommit     : true,
			isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
		}).then(t => {
			return db.sequelize.query(query, { transaction : t, plain }).then(r => {
				if (r) {
					returnData = r;
				}

				t.commit();
			}).catch(e => {
				t.rollback();
				this.reject();
			});
		}).then(() => {
			return returnData;
		}).catch(e =>
			this.reject()
		);
	},

	fnDataProcessing (isCreate, data, model,db) {
		let returnData = null;
		return db.sequelize.transaction({
			autocommit     : true,
			isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
		}).then(t => {
			return model[isCreate](data.data, data.where, { transaction : t }).then((r) => {
				if (r) {
					returnData = r;
				}

				t.commit();
			}).catch(err => {
				t.rollback();
				throw "error";
			});
		}).then(() => {
			if (returnData) {
				return returnData;
			}
		}).catch(e =>{
				throw "error";
			});
	},

	fnProcessNewRound (currentTableId, dealerId, dealerName, shoeId, roundNum) {
		return new Promise((res, rej) => {
			let cardsData      = { dragon : null, tiger : null, burn : null };
			let round          = {};

			models.sequelize.transaction({
				autocommit     : true,
				isolationLevel : models.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
			}).then(t => {
				return models.rounds.create({
					dealer_id 	: dealerId,
					game_info 	: cardsData,
					round_num 	: (parseInt(roundNum) + 1),
					table_id  	: currentTableId,
					status 		: "S"
				}, {transaction : t}).then((r) => {
					if (r) {
						round = r;
					}
					t.commit();
				}).catch(() => {
					console.log("error hsit".error);
					t.rollback();
					rej("Error: new round queries");
				});
			}).then(() => {
				if (!round && !round.id) {
					rej("Error: new round queries");
				}

				let rid = (round.get("id")) ? round.get("id") : round.id;

				res({
					id : rid,
					round_num : round.get("round_num")
				});
			});
		});
	},

	fnGetResults (searchId, tableId, roundNum) {
		return new Promise((res, rej) => {
			models.rounds.find({
				where : {
					table_id : tableId, round_num : roundNum
				}, include : [{ model : models.bets, attributes : ["id", "round_id", "type", "user_id", "bet_history", "total_bet", "total_winning", "created_at", "updated_at", "bet_id", "session_id", "bet_range", "currency"], plain : true,
					include : [{
						model : models.users,
						attributes : ["id", "vendor_id", "user_id", "user_name", "money", "user_type", "currency", "denomination"],
						plain : true,
						include : [{
							model : models.vendors,
							attributes : ["id", "type", "integration_type", "currency", "multiplier"],
							plain : true
						}]
					}]
				}],
				attributes : ["id", "table_id", "round_num", "dealer_id", "game_info", "game_result", "status", "created_at", "updated_at"],
				plain : true
			}).then(round => {
				if (_.isEmpty(round)) {
					rej({ error : true, message : "round empty" });
				}

				if (round.status == "E") {
					rej({ error : true, message : "result already sent" });
					return;
				}
                if (round.status == "S") {
					rej({ error : true, message : "status not in progress" });
					return;
				}
				let card = JSON.parse(round.game_info);

				if (!card.dragon || !card.tiger) {
					rej({ error : true, message : "not enough cards" });
				}

				let dragon = {
					id     : card.dragon,
					value  : new deck( card.dragon ).value,
					suite  : new deck( card.dragon ).suite,
					parity : new deck( card.dragon ).parity,
					size   : new deck( card.dragon ).size
				};

				let tiger = {
					id     : card.tiger,
					value  : new deck( card.tiger ).value,
					suite  : new deck( card.tiger ).suite,
					parity : new deck( card.tiger ).parity,
					size   : new deck( card.tiger ).size
				};

				let result = {
					gameInfo:card,
					created_at 	: round.created_at,
					updated_at 	: round.updated_at,
					tableId 	: round.table_id,
					roundId 	: round.id,
					roundNum 	: round.round_num,
					winner 		: null,
					cards : {
						dragon,
						tiger
					},
					bets : round.bets
				};

				if (!tiger || !dragon || !dragon.value || !tiger.value) {
					rej({ error : true, message : "missing values" });
				}

				if (dragon.value > tiger.value) {
					result.winner = "dragon";
				}
				else if (tiger.value > dragon.value) {
					result.winner = "tiger";
				}
				else if (tiger.value == dragon.value) {
					result.winner = ((dragon.suite == tiger.suite) && dragon.value != 7) ? "suited tie" : "tie";
				}
				else {
					rej({ error : true, message : "undefined winner" });
				}

				return { result, card };
			}).then(r => {
				let dragon_unchecker = { 
					suite  : r.result.cards.dragon.suite,
					size   : r.result.cards.dragon.size,
					parity : r.result.cards.dragon.parity
				};

				let tiger_unchecker = { 
					suite  : r.result.cards.tiger.suite,
					size   : r.result.cards.tiger.size,
					parity : r.result.cards.tiger.parity
				};

				res({
					gameResult : {
						game_result : {
							winner : r.result.winner,
							side_bets : {
								dragon : (r.result.cards.dragon.value == 7) ? "seven" : dragon_unchecker,
								tiger : (r.result.cards.tiger.value == 7) ? "seven" : tiger_unchecker,
							}
						}, status : "E"
					},
					result : r.result,
					gameInfo : r.card
				});
			}).catch((e) => {
				console.log(JSON.stringify(e, null, "\t"));
				rej({ error : true, message : JSON.stringify(e, null, "\t") });
			});
		});
	},

	fnGetCardSideBetMark(w, wv, dv, tv) {
		let h = {
			"dragon.11" : "g",
			"dragon.10" : "h",
			"dragon.01" : "i",
			"dragon.00" : "j",

			"tiger.11"  : "k",
			"tiger.10"  : "l",
			"tiger.01"  : "m",
			"tiger.00"  : "n",

			"tie.11"    : "o",
			"tie.10"    : "p",
			"tie.01"    : "q",
			"tie.00"    : "r"
		};

		let l = (dv > 7) ? "1" : "0";
		let r = (tv > 7) ? "1" : "0";

		return {
			"num"  : wv,
			"mark" : w + h[w + "." + l + r]
		};
	},

	fnGetRoundStatus (roundNum, tableId) {
		return new Promise((res, rej)=>{
			models.rounds.findOne({where : {table_id : tableId, round_num : roundNum}})
					.then(round => {
						res(round.get('status'));
					}).catch(e=>rej('Error: get round status'));
		})
	},

	fnSetRoundStatus (id, status, tableId, roundNum) {
		return new Promise((res, rej)=>{
			models.rounds.update({status},{where:{round_num:roundNum,table_id:tableId}})
					.then(()=>res())
					.catch(e=>console.log(e));
		});
	},

	fnRefreshClientInit (tableId) {
		let finalResult = {
			roundId : null,
			dragon  : null,
			tiger   : null
		};

		return new Promise((res, rej)=>{
			models.tables.findOne({
				where : {
					id : tableId
				}, include : [{
					model : models.rounds,
					include : [{ model : models.dealers }]
				}]
			}).then(data => {
				let gameInfo = (data.round.get("game_info")) ? JSON.parse(data.round.get("game_info")) : {};
				let betSettings = JSON.parse(data.get("bet_setting"));

				res(Object.assign({}, {
					roundId  : data.round.get("id"),
					bettimer : betSettings.betting_time || 0,
					dragon   : (gameInfo.dragon) ? new deck(gameInfo.dragon) : null,
					tiger    : (gameInfo.tiger) ? new deck(gameInfo.tiger) : null
				}))
			});
		});
	},

	fnGetCurrentRoundDatas (tableId) {
		return new Promise((res, rej) => {
			models.rounds.findOne({
				where : {
					table_id : tableId
				}, include : [{
					model      : models.dealers,
					attributes : ["id", "real_name", "name", "dealer_image"]
				}, {
					model      : models.tables,
					attributes : ["id", "bet_setting"]
				}],
				order : [[ "id", "DESC" ]],
				attributes : ["id", "game_info", "round_num", "game_result", "status"],
				plain : true
			}).then(data => {
				if (!data) {
					res("Error: init");
					return;
				}

				let gameInfo = (data.game_info) ? JSON.parse(data.game_info) : {};
				let betSettings = JSON.parse(data.game_table.bet_setting);
				let done = false;
				let postStatus = data.status;

				if (data.game_result) {
					done = true;
				}

				// get post status logic
				if (data.status == "H") {
					if (data.game_result) {
						postStatus = "E";
					}
					else {
						if (!gameInfo.burn && !gameInfo.dragon && !gameInfo.tiger) {
							postStatus = "S";
						}
						else {
							postStatus = "P";
						}
					}
				}

				this.fnMysqlRaw("SELECT MAX(id) AS id FROM  game_marks WHERE table_id =" + tableId, models, true).then(markData => {
					//rej(false);
					res(Object.assign({}, {
						roundId       	: data.id,
						roundNum      	: data.round_num,
						dealer        	: data.dealer,
						autonextround 	: (betSettings.auto_next_round == "Y") ? betSettings.delay_time : 0,
						bettimer      	: betSettings.betting_time || 0,
						dragon        	: (gameInfo.dragon) ? new deck(gameInfo.dragon) : null,
						tiger         	: (gameInfo.tiger) ? new deck(gameInfo.tiger) : null,
						burn          	: (gameInfo.burn) ? new deck(gameInfo.burn) : null,
						table         	: data.game_table.id,
						status        	: data.status,
						gameInfo 	  	: (data.game_info)? JSON.parse(data.game_info) : {},
						postStatus,
						shoeId : markData.id,
						done
					}));
				}).catch(e => res("Error: init"));
			}).catch(e => res("Error: init"));
		});
	},

	fnProcessCard (value, type, roundNum, roundId, realName, tableId, gameName, status, next) {
		if (type == "dealer") {
			models.dealers.findOne({
				where : {
					code : value
				},
				attributes : ["id", "name", "dealer_image", "table_image"],
				plain : true
			}).then(dealer => {
				if (!dealer) {
					// means dealer not found
					next(false);
					return;
				}

				let dealerChangeData = {
					gameName,
					roundId,
					roundNum,
					eventName   : "dealerchange",
					tableId,
					dealerId    : dealer.id,
					dealerName  : dealer.name,
					dealerImage : dealer.dealer_image,
					tableImage  : dealer.table_image
				};

				if(status != 'S'){
					next(dealerChangeData);
					return;
				}

				// store dealers->real_name
				let dealerName = dealer.real_name;
				let promises = [];
					// 1. Before dealer table name is null

					let strQueryDealers = " UPDATE nihtan_api.dealers";
						 strQueryDealers += "   SET table_name = null,";
						 strQueryDealers += "   updated_at = NOW()";
						 strQueryDealers += " WHERE table_name='" + gameName + "# " + tableId + "'";

					promises.push(this.fnMysqlRaw(strQueryDealers, models, false));

					let strQueryUpdateMany = " UPDATE rounds AS T1";
						 strQueryUpdateMany += " INNER JOIN nihtan_api.dealers AS T2";
						 strQueryUpdateMany += "    ON T2.id=" + dealer.id;
						 strQueryUpdateMany += "   SET T1.dealer_id = " + dealer.id;
						 strQueryUpdateMany += "     , T2.table_name = '" + gameName + "# " + tableId + "'";
						 strQueryUpdateMany += "     , T1.updated_at = NOW()";
						 strQueryUpdateMany += "     , T2.updated_at = NOW()";
						 strQueryUpdateMany += " WHERE T1.table_id = " + tableId;
						 strQueryUpdateMany += "   AND T1.round_num = " + roundNum;

					promises.push(this.fnMysqlRaw(strQueryUpdateMany, models, false));

					Promise.all(promises).then(d => {
						_.each(d, i => {
							if (!i) {
								next(false);
								return;
							}
						});

						next(dealerChangeData);
					}).catch(e => next(false));
			}).catch(e => {
				next(false);
				return;
			});
		}
		else if (type == "shoe") {
			models.gameMarks.create({
				table_id 	: tableId,
				mark 		: [],
				mark_num	: value
			}).then(m =>
				next(m.get("id"))).catch(e => {
					next(false);
				}
			);
		}
		else {
			if (!value) {
				next(false);
				return;
			}

			let query = "";
			let stat = (type == "burn") ? "'S','P'" : "'P'";

			query = " UPDATE dragontiger.rounds AS r";
			query += "   SET r.game_info = JSON_SET(game_info, '$." + type + "', '" + value + "')";
			query += "     , r.updated_at= NOW()";
			query += " WHERE r.status IN (" + stat + ")";
			query += "   AND r.table_id = " + tableId;
			query += "   AND r.round_num = " + roundNum;

			this.fnMysqlRaw(query, models, false).then((ur) => {
				if (!ur) {
					next(false);
					return;
				}

				let swipeData = {
					value 		: value,
					type		: type,
					gameName,
					roundId,
					eventName 	: "inputitem",
					tableId,
					roundNum
				};

				next(swipeData);
				return;
			}).catch(() =>
				next(false)
			);
		}
	},

	/**
	 * Description: If round status is P then set to S
	 *
	 * @param id
	 * @param status
	 * @returns {Promise}
	 */
	fnResetTimer (id, tableId, roundNum) {
		
		return new Promise((res, rej) => {
			let updateQuery = {
				data : { status : "S" },
				where : {where:{round_num :roundNum, table_id :tableId}}
			};

			models.rounds.findOne({where : {table_id : tableId, round_num : roundNum}}).then(round => {
				if (round.get("status") != "P") {
					rej("Error: set round status");
					return;
				}

				this.fnDataProcessing("update", updateQuery, models.rounds, models).then(() => res()).catch(e =>{
					rej("Error: set round status");
				}
				);
			});
		});
	},

	fnGetTablesMarks () {
		return new Promise((res, rej) => {
			let tableGroups = [];
			let getTableMarkQuery = "";
			
            getTableMarkQuery += "SELECT m.main_text AS mainText";
            getTableMarkQuery += "     , m.sub_text AS subText";
            getTableMarkQuery += "     , m.status AS status";
            getTableMarkQuery += "     , DATE_FORMAT(m.start_time, '%Y-%m-%d %H:%i:00') AS startTime";
            getTableMarkQuery += "     , DATE_FORMAT(m.end_time, '%Y-%m-%d %H:%i:00') AS endTime";
            getTableMarkQuery += "     , a.id AS tableId";
            getTableMarkQuery += "     , a.game_name AS gameName";
            getTableMarkQuery += "     , a.maintenance_setting AS maintenanceSetting";
            getTableMarkQuery += "     , a.notice_setting AS noticeSetting";
            getTableMarkQuery += "     , a.casino_bet_ranges AS casinoBetRange";
            getTableMarkQuery += "     , a.sport_bet_ranges AS sportBetRange";
            getTableMarkQuery += "     , a.env_setting AS envSetting";
            getTableMarkQuery += "     , a.room_type AS roomType";
            getTableMarkQuery += "     , b.gameMarks";
            getTableMarkQuery += "     , b.shoeNumber";
            getTableMarkQuery += "     , r.round_num AS roundNum";
            getTableMarkQuery += "     , r.game_info AS gameInfo";
            getTableMarkQuery += "     , r.game_result AS gameResult";
            getTableMarkQuery += "     , r.status AS roundStatus";
            getTableMarkQuery += "     , d.name AS dealerName";
            getTableMarkQuery += "     , d.id AS dealerId";
            getTableMarkQuery += "     , d.dealer_image AS dealerImage";
            getTableMarkQuery += "     , DATE_FORMAT(n.start_time, '%Y-%m-%d %H:%i:00') AS noticeStartTime";
            getTableMarkQuery += "     , DATE_FORMAT(n.end_time, '%Y-%m-%d %H:%i:00') AS noticeEndTime";
            getTableMarkQuery += "     , n.content";
            getTableMarkQuery += "     , n.time_yn AS timeYn";
            getTableMarkQuery += "     , n.status AS noticeStatus";
            getTableMarkQuery += "  FROM nihtan_api.maintenance AS m";
            getTableMarkQuery += "     , dragontiger.game_tables AS a";
            getTableMarkQuery += "  JOIN (SELECT JSON_EXTRACT(mark,'$') AS gameMarks";
            getTableMarkQuery += "             , table_id";
            getTableMarkQuery += "             , mark_num AS shoeNumber";
            getTableMarkQuery += "          FROM dragontiger.game_marks";
            getTableMarkQuery += "         WHERE id IN (SELECT MAX(id)";
            getTableMarkQuery += "                        FROM dragontiger.game_marks";
            getTableMarkQuery += "                       GROUP BY table_id)) AS b";
            getTableMarkQuery += "    ON a.id = b.table_id";
            getTableMarkQuery += "  JOIN (SELECT T1.table_id";
            getTableMarkQuery += "	     , T1.id";
            getTableMarkQuery += "	     , T1.dealer_id";
            getTableMarkQuery += "	     , T1.round_num";
            getTableMarkQuery += "	     , T1.game_info";
            getTableMarkQuery += "	     , T1.game_result";
            getTableMarkQuery += "	     , T1.status";
            getTableMarkQuery += "	  FROM dragontiger.rounds AS T1";
            getTableMarkQuery += "	 INNER JOIN (SELECT table_id";
            getTableMarkQuery += "			  , max(id) AS id";
            getTableMarkQuery += "		       FROM dragontiger.rounds";
            getTableMarkQuery += "		      GROUP BY table_id) AS roundsGroup";
            getTableMarkQuery += "	    on T1.table_id = roundsGroup.table_id";
            getTableMarkQuery += "	   and T1.id = roundsGroup.id) AS r";
            getTableMarkQuery += "    ON r.table_id = a.id";
            getTableMarkQuery += "  JOIN nihtan_api.dealers AS d";
            getTableMarkQuery += "    ON r.dealer_id = d.id";
            getTableMarkQuery += "  LEFT JOIN nihtan_api.notice AS n";
            getTableMarkQuery += "    ON 1 = 1";
            getTableMarkQuery += " WHERE a.game_name = 'Dragon-Tiger'";
            getTableMarkQuery += "   AND a.status = '1'";

			
			models.liveSequelize.query(getTableMarkQuery, { type : models.liveSequelize.QueryTypes.SELECT }).then(initDatas => {
				let tables = [];
				let mainMaintenance = {};
				let mainNotice = {};
				let gameNames = false;
				
				_.each(initDatas, (table, index) => {
					if(!gameNames) {
						gameNames = table.gameName;
					}

					tables.push({
						id                 : table.tableId,
						shoeNumber         : table.shoeNumber,
						roundNum           : table.roundNum,
						roundStatus        : table.roundStatus,
						currentDealer      : table.dealerName,
						dealerId           : table.dealerId,
						dealerImage        : table.dealerImage,
						roomType           : table.roomType,
						envSetting         : JSON.parse(table.envSetting),
						sportBetRanges     : JSON.parse(table.sportBetRange),
						casinoBetRanges    : JSON.parse(table.casinoBetRange),
						maintenanceSetting : JSON.parse(table.maintenanceSetting),
						noticeSetting      : JSON.parse(table.noticeSetting),
						gameInfo           : JSON.parse(table.gameInfo),
						gameResult         : JSON.parse(table.gameResult),
						gameMarks          : JSON.parse(table.gameMarks)
					});

					mainMaintenance = {
						mainText   : table.mainText,
						subText    : table.subText,
						status     : table.status,
						start_time : table.startTime,
						end_time   : table.endTime
					};
                    
                    mainNotice = {
                        start_time  : table.noticeStartTime,
                        end_time    : table.noticeEndTime,
                        content     : table.content,
                        time_yn     : table.timeYn,
                        status      : table.noticeStatus
                    };
				});

				res({
					eventName : "init",
					gameName  : gameNames,
					mainMaintenance,
					mainNotice,
					tables
				});
			}).catch(e =>
				rej("Error: init game server")
			);
		});
	},
	
	roomDisconnect(data) {
        let strQuery1 = "CALL nihtan_api.USP_ROOMS_SAVE('A', 'dragontiger', " + data.roomId + ", " + data.tableId + ", '', " + data.userId + ", '0', '', '', '', 0, 0)";

        if (data.type == "J") {
            let strQuery2 = "CALL nihtan_api.USP_REMOVE_JUNKET_ROOM(" + data.vendorId + ", 'dragontiger-" + data.tableId + "')";
            models.sequelize.query(strQuery2);
        }
        
        return models.sequelize.query(strQuery1);
    },


	fnGetTables (gameName) {
		return new Promise((res, rej) => {
			let tableGroups = [];

			models.tables.findAll().then(tables => {
				_.each(tables, (table, index) => {
					tableGroups.push(table.get("id"));
				});

				res({
					eventName : "init",
					gameName,
					tables : tableGroups
				});
			}).catch(e =>
				console.log(JSON.stringify(e, null, "\t"))
			);
		});
	},

	fnCardType (value, next) {
		let cardCheck = new deck(value.trim());

		if (cardCheck.checkCard(value.trim())) {
			next("card");
			return;
		}

		models.dealers.findOne({ where : { code : value } }).then(data => {
			if (data) {
				next("dealer");
			}
			else {
				if (value.length == 8 && (value[0] + value[1]) == "AA") {
					next("shoe");
				}
				else {
					next(false);
				}
			}
		}).catch(() =>
			next(false)
		);
	}
}; // end module exports
