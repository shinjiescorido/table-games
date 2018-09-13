"use strict";

	/*
	|--------------------------------------------------------------------------
	| BetsCalculator v1.1
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| Processing of bets
	|
	*/

const _  		= require("lodash");
const db 		= require("./db.js");
const request 	= require("request-promise");
const config 	= require("../config/index");
const moment 	= require("moment");
const fs 		= require("fs");

module.exports = {
	betlogs : null,
	bets 	: {},
	multipliers : {
		dragon : {
			regular : 1, // 1:1
			big     : 1, 
			small   : 1,
			odd     : 1,
			even    : 1,
			heart   : 3,
			diamond : 3,
			club    : 3,
			spade   : 3
		},
		tiger : {
			regular : 1,
			big     : 1,
			small   : 1,
			odd     : 1,
			even    : 1,
			heart   : 3,
			diamond : 3,
			club    : 3,
			spade   : 3
		},
		tie : {
			regular : 10, // 10: 1
			suited  : 50 // 50 :1
		}
	},

	processBets (roundId, gameResult, result, h, tableId, roundNum, gameInfo, shoeId, dealerName) {
		result.updated_at = moment().utcOffset(0).format("YYYY-MM-DD HH:mm:ss");
        result.created_at = moment(result.created_at).utcOffset(0).format("YYYY-MM-DD HH:mm:ss");

		let winValue = result.cards[(result.winner == "tie" || result.winner == "suited tie") ? "dragon" : result.winner].value;
		let roundWins = 0;
		let roundBets = 0;

		let markData = this.fnGetCardSideBetMark (
			result.winner,
			winValue,
			result.cards.dragon.value,
			result.cards.tiger.value,
			h
		);

		let gameMarksData = {};

		if (_.isEmpty(result.bets)) {
			let emptyBetsQuery = "";

			emptyBetsQuery = " UPDATE rounds AS r";
			emptyBetsQuery += "   SET r.status = 'E'";
			emptyBetsQuery += "     , r.game_result = '" + JSON.stringify(gameResult) + "'";
			emptyBetsQuery += "     , r.updated_at = NOW()";
			emptyBetsQuery += " WHERE r.table_id = " + tableId;
			emptyBetsQuery += "   AND r.round_num = " + roundNum;

			console.log(emptyBetsQuery);

			db.sequelize.query("UPDATE game_marks SET mark = JSON_ARRAY_INSERT(mark, '$[200]', JSON_MERGE(JSON_OBJECT(\"num\", " + winValue + ") ,JSON_OBJECT(\"mark\", \"" + markData + "\"))) ,updated_at = NOW() WHERE id = " + shoeId);
			return db.sequelize.transaction({
				isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
			}).then(t => {
				return db.sequelize.query(emptyBetsQuery, { transaction: t }).then(() =>
					t.commit()
				).catch(e => {
					t.rollback();
					throw "error";
                });
			}).then(() => {
				result.gameResult = gameResult;
				this.sendToAPIServer(config.gameName, result, [], dealerName);

				return {
					gameMarksData : {
						num  : winValue,
						mark : markData
					},
					roundWins,
					userInfo : null
				};
			}).catch(e => {
				throw "error";
			});
		}

		let queryBH       = "";
		let queryTB       = "";
		let queryTW       = "";
		let queryTWinning = "";
		let queryTR       = "";
		let queryTLoss    = "";
		let idArray       = [];
		let userMoney     = "";
		let userIds       = [];
		let userInfo      = [];
		let apiUserInfo   = [];
		let totalWin      = 0;
		
		_.each(result.bets, (bets, index) => {
			let resultBets     = [];
			let betData        = bets.get();
			let data           = JSON.parse(betData.bet_history);
			let totalBetAmount = 0;
			totalWin           = 0;
			let win_money      = 0;
			let totalRolling   = 0;
			let tempp          = 0;
			let winningBet     = 0;
			let betLost        = 0;
			let totalUserMoney = 0;

			_.each(data, (betData, index) => {
				win_money = this[betData.bet.trim()](result, betData.bet_money);
				
				totalWin 		+= win_money;
	            totalBetAmount 	+= betData.bet_money;
	            totalUserMoney 	+= (betData.user_money) ? betData.user_money : 0;

	            if (win_money) {
		            betData.win_money = win_money + betData.bet_money;
		            winningBet += betData.bet_money;
	            }
				else {
		            // if player loses
		            betLost += betData.bet_money;
	            }

	            let mainBetFlag = (betData.bet == "dragon" || betData.bet == "tiger");

	            if ((result.winner == "tie" || result.winner == "suited tie") && !win_money && mainBetFlag) {
		            tempp = betData.bet_money / 2;
		            totalBetAmount += totalRolling;	

		            betData.win_money = tempp;	
		            totalWin += tempp;
		            betLost -= tempp;
	            }
				
	            resultBets.push(betData);
			});

			totalRolling = totalBetAmount - tempp;

			let moneyForUser = winningBet+totalWin;

			userInfo.push({
				id         		: bets.user_id,
				money      		: bets.user.money + moneyForUser,
				user_type       : bets.user.user_type,
				total_winning  	: Math.round(moneyForUser * 100) / 100,
				total_lost 		: betLost,
				bets 			: data
			});
            //
			//data.created_at = moment(data.created_at).utcOffset(0).format("YYYY-MM-DD HH:mm:ss");
			//data.updated_at = moment(data.updated_at).utcOffset(0).format("YYYY-MM-DD HH:mm:ss");
			bets.created_at = moment(bets.created_at).utcOffset(0).format("YYYY-MM-DD HH:mm:ss");

			apiUserInfo.push({
			    id              : bets.user.get("id"),
				user_id         : bets.user.get("user_id"),
				user_name       : bets.user.get("user_name"),
				vendor_id       : bets.user.get("vendor_id"),
				type            : bets.type,
				user_type       : bets.user.get("user_type"),
				bets            : data,
				bet_range       : bets.bet_range,
				total_bet       : totalBetAmount,
				total_rolling   : totalRolling,
				total_win       : moneyForUser,
				total_lost      : betLost,
				bet_id		  	: bets.bet_id,
				session_id		: bets.session_id,
				created_at      : bets.created_at,
				currency	    : bets.currency || bets.user.currency || bets.user.vendor.currency,
				multiplier      : bets.user.denomination || bets.user.vendor.multiplier
			});

			let betuser = bets.user.get();
			let temptotalWin = (betuser.vendor.integration_type == "transfer") ? moneyForUser : 0;

			//let temptotalWin = moneyForUser;
			userIds.push(bets.user_id);
			userMoney 		+= "WHEN " + bets.user_id + " THEN u.money + " + temptotalWin + " ";
			queryBH 		+= "WHEN " + bets.id + " THEN \'" +  JSON.stringify(resultBets) + "\' ";
			queryTB 		+= "WHEN " + bets.id + " THEN " +  totalBetAmount + " ";
			queryTW 		+= "WHEN " + bets.id + " THEN " +  totalWin + " ";
			queryTLoss 		+= "WHEN " + bets.id + " THEN " +  betLost + " ";
			queryTWinning 	+= "WHEN " + bets.id + " THEN " +  moneyForUser + " ";
			queryTR 		+= "WHEN " + bets.id + " THEN " +  totalRolling + " ";

			roundWins += moneyForUser;
			roundBets += totalBetAmount;
			idArray.push(bets.id);
		});

		let rawQuery = "";
		rawQuery = " UPDATE bets AS b";
		rawQuery += "  JOIN nihtan_api.users AS u";
		rawQuery += "    ON b.user_id = u.id";
		rawQuery += "  JOIN dragontiger.rounds AS r";
		rawQuery += "    ON b.round_id = r.id";
		rawQuery += "   SET b.bet_history = (CASE b.id " + queryBH + " END)";
		rawQuery += "     , b.total_bet = (CASE b.id " + queryTB + " END)";
		rawQuery += "     , b.total_winning = (CASE b.id " + queryTW + " END)";
		rawQuery += "     , b.total_win = (CASE b.id " + queryTWinning + " END)";
		rawQuery += "     , b.total_lost = (CASE b.id " + queryTLoss + " END)";
		rawQuery += "     , b.total_rolling = (CASE b.id " + queryTR + " END)";
		rawQuery += "     , u.money = (CASE u.id " + userMoney + " END)";
		rawQuery += "     , r.status ='E'";
		rawQuery += "     , r.game_result = '" + JSON.stringify(gameResult) + "'";
		rawQuery += "     , b.updated_at = NOW()";
		rawQuery += "     , u.updated_at = NOW()";
		rawQuery += "     , r.updated_at = NOW()";
		rawQuery += " WHERE r.table_id = " + tableId;
		rawQuery += "   AND r.round_num = " + roundNum;

		db.sequelize.query("UPDATE game_marks SET mark = JSON_ARRAY_INSERT(mark, '$[200]', JSON_MERGE(JSON_OBJECT(\"num\", " + winValue + "), JSON_OBJECT(\"mark\", \"" + markData + "\"))), updated_at = NOW() WHERE id = " + shoeId);

		return db.sequelize.transaction({
			autocommit : true,
			isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
		}).then(t => {
			return db.sequelize.query(rawQuery, { transaction : t }).then(() => t.commit()).catch(e => {
				console.log(' + + + + + + + + ++++++++++++++++++++++ ');
				t.rollback();
				throw "error";
            });
		}).then(() => {
			result.gameResult = gameResult;
			this.sendToAPIServer(config.gameName, result, apiUserInfo, dealerName);

			return {gameMarksData : {
					num 	: winValue,
					mark	: markData
				},
				roundWins,
				userInfo
			};
		}).catch(e => {
			console.log(' + + + + + + + + ++++++++++++++++++++++ ');
			t.rollback();
			throw "error";
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
        let jsonData = {
            method : "POST",
            uri : process.env.API_HISTORY_URL,
		body : {
                game,
                table       : result.tableId,
                round_no    : result.roundNum,
                game_info   : result.gameInfo,
                game_result : result.gameResult,
                created_at  : result.created_at,
                resulted_at : result.updated_at,
				dealer 		: dealer,
                data 		: data
            },
            json : true
        };
		//console.log('API===========================>\n', JSON.stringify(jsonData.body.data));
		//return;
        request(jsonData).then(() => {
			this.apiLog(jsonData);
		}).catch(e =>
			this.apiLog({ error : e.name, cause : e.cause, params : jsonData })
		);
	},
	apiLog (data) {
		return;

		let fn = "logs/" + moment().utcOffset(0).format("YY-MM-DD") + "-ApiRequest.log";

		if (fs.existsSync(fn)) {
			console.log(fn);

			fs.appendFile(fn, "--START\n" + moment().utcOffset(0).format("YYYY-MM-DD HH:mm:ss") + ":\n" + JSON.stringify(data, null, "\t") + "\n--END\n\n", err => {
				if (err) {
					throw err;
				}
			});
		}
		else {
			console.log("---" + fn);

			fs.writeFile(fn, "--START\n" + moment().utcOffset(0).format("YYYY-MM-DD HH:mm:ss") + ":\n" + JSON.stringify(data, null, "\t") + "\n--END\n\n", err => {
				if (err) {
					throw err;
				}
			});
		}
	},

	checkseven(betName, result) {
		return (result.cards[betName].value == 7);
	},

	tie (result, amount) {
		if (result.winner == "tie" && amount) {
			 return amount * this.multipliers.tie.regular;
		}
		else if (result.winner == "suited tie" && amount) {
			 return amount * this.multipliers.tie.regular;
		}

		return 0;
	},

	dragon (result, amount) {
		return (result.winner == "dragon" && amount) ? amount * this.multipliers.dragon.regular : 0;
	},

	suited_tie (result, amount) {
		let tieOdds = (this.checkseven("dragon", result)) ? this.multipliers.tie.regular : this.multipliers.tie.suited;
		
		return (result.winner == "suited tie" && amount) ? amount * tieOdds : 0;
	},

	dragon_odd ( result, amount ) {
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return ((result.cards.dragon.value % 2) && amount) ? amount * this.multipliers.dragon.odd : 0;
	},

	dragon_even (result, amount) {
		// return if dragoncard is even and and amount > 0
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return (!(result.cards.dragon.value % 2) && amount) ? amount * this.multipliers.dragon.even : 0;
	},

	dragon_big (result, amount) {
		// return if dragoncard is greater than 7 and amount > 0
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return ((result.cards.dragon.value > 7) && amount) ? amount * this.multipliers.dragon.big : 0;
	},

	dragon_small (result, amount) {
		// return if dragoncard is less than 7 and amount > 0
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return ((result.cards.dragon.value < 7) && amount) ? amount * this.multipliers.dragon.small : 0;
	},

	dragon_clubs (result, amount) {
		// return if dragoncard is club suit and amount > 0
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return ((result.cards.dragon.suite == "club") && amount) ? amount * this.multipliers.dragon.club : 0;
	},

	dragon_hearts (result, amount) {
		// return if dragoncard is heart suit and amount > 0
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return ((result.cards.dragon.suite == "heart") && amount) ? amount * this.multipliers.dragon.heart : 0;
	},

	dragon_diamonds (result, amount) {
		// return if dragoncard is diamond suit and amount > 0
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return ((result.cards.dragon.suite == "diamond") && amount) ? amount * this.multipliers.dragon.diamond : 0;
	},

	dragon_spades (result, amount) {
		// return if dragoncard is spade suit and amount > 0
		if (this.checkseven("dragon", result)) {
			return 0;
		}

		return ((result.cards.dragon.suite == "spade") && amount) ? amount * this.multipliers.dragon.spade : 0;
	},

/* 					*
 *					*
 * TIGER BETS PHASE *
 *					*
 *					*
 *					*
 *					*/

 	tiger (result, amount) {
		return (result.winner == "tiger" && amount) ? amount * this.multipliers.tiger.regular : 0;
	},

	tiger_odd (result, amount) {
		// return if tigercard is odd and and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return ((result.cards.tiger.value % 2) && amount) ? amount * this.multipliers.tiger.odd : 0;
	},

	tiger_even (result, amount) {
		// return if tigercard is even and and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return (!( result.cards.tiger.value % 2) && amount) ? amount * this.multipliers.tiger.even : 0;
	},

	tiger_big (result, amount) {
		// return if tigercard is greater than 7 and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return ((result.cards.tiger.value > 7) && amount) ? amount * this.multipliers.tiger.big : 0;
	},

	tiger_small (result, amount) {
		// return if tigercard is less than 7 and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return ((result.cards.tiger.value < 7) && amount) ? amount * this.multipliers.tiger.small : 0;
	},

	tiger_clubs (result, amount) {
		// return if tigercard is club suit and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return ((result.cards.tiger.suite == "club") && amount) ? amount * this.multipliers.tiger.club : 0;
	},

	tiger_hearts (result, amount) {
		// return if tigercard is heart suit and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return ((result.cards.tiger.suite == "heart") && amount) ? amount * this.multipliers.tiger.heart : 0;
	},

	tiger_diamonds ( result, amount ) {
		// return if tigercard is diamond suit and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return ((result.cards.tiger.suite == "diamond") && amount) ? amount * this.multipliers.tiger.diamond : 0;
	},

	tiger_spades (result, amount) {
		// return if tigercard is spade suit and amount > 0
		if (this.checkseven("tiger", result)) {
			return 0;
		}

		return ((result.cards.tiger.suite == "spade") && amount) ? amount * this.multipliers.tiger.spade : 0;
	},

	fnGetCardSideBetMark(w, wv, dv, tv, h) {
		if (w == "suited tie") {
			if (dv == 7) {
				w = "tie";
			}
		}

		let l = (dv > 7) ? "1" : "0";
		let r = (tv > 7) ? "1" : "0";

		return h[w + "." + l + r];
	}
};
