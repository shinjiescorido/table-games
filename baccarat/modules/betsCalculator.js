"use strict";

/*
|--------------------------------------------------------------------------
| BetsCalculator v1.1
|--------------------------------------------------------------------------
| Author : Shinji Escorido
| Processing of bets
|
*/

const _         = require("lodash");
const db        = require("./db.js" );
const request   = require("request-promise");
const moment    = require("moment");
const fs        = require("fs");

let seq = db.sequelize;
module.exports = {
    betlogs : null,
    bets : {},
    multipliers : {
        player      : 1,
        playerpair  : 11,
        tie         : 8,
        bankerpair  : 11,
        banker      : 0.95
    },
	multipliers_supersix : {
        player      : 1,
        playerpair  : 11,
        tie         : 8,
        bankerpair  : 11,
        banker      : 1,
		supersix    : 12
	},
	oddsbonus : null,

    processBets (tableId, roundId, result, gameName, dealer, roundNum) {
        let winValue = result[result.winner == "tie" ? "player" : result.winner].total;
        let roundWins = 0;
        let roundBets = 0;
        let markData = this.fnGetCardSideBetMark(result.winner, result.pairs);
        let gameMarksData = {};

        let natural = _.map(result.natural, (row) => {
            return `'${row}'`;
        }).join(',');

        result.resulted_at = moment().utcOffset(0).format("YYYY-MM-DD HH:mm:ss");
        result.created_at = moment(result.created_at).utcOffset(0).format("YYYY-MM-DD HH:mm:ss");

        seq.query(`UPDATE game_marks
                      SET \`mark\` = JSON_ARRAY_INSERT(mark, "$[200]", JSON_MERGE(JSON_OBJECT("natural", JSON_ARRAY(${natural})), JSON_OBJECT("num", ${winValue}), JSON_OBJECT("mark", "${markData}"))),
                       \`updated_at\` = NOW() 
                    WHERE table_id = ${tableId}
                    ORDER BY ID DESC LIMIT 1`.replace(/\n\s+/g, ' '));

        if (_.isEmpty(result.bets)) {
			let gr = _.pick(result, ["winner", "pairs", "supersix", "bonus", "size"]);

			gr = JSON.stringify(gr);

			let emptyBetsQuery = `UPDATE \`rounds\`
			                         SET \`status\` = "E"
			                           , \`game_result\` = '${gr}'
                                       , \`updated_at\` = NOW() 
                                   WHERE \`table_id\` = ${tableId}
                                     AND \`round_num\` = ${roundNum}`;

            emptyBetsQuery = emptyBetsQuery.replace(/\n\s+/g, " ");

            return seq.transaction({
                isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
            }).then(t => {
                return seq.query(emptyBetsQuery, { transaction: t }).then(() => {
                    t.commit();
                })
                .catch(e => {
                    t.rollback();
                    throw "error";
                });
            }).then(() => {
                return db.gameMarks.findOne({
                    where : { table_id: tableId },
                    order : [["id", "DESC"]],
                    attributes : ["table_id", "mark_num"]
                }).then(gm => {
                    gameMarksData = {
                        id : gm.get("table_id"),
                        shoeNumber : gm.get("mark_num"),
                        gameMarks: {
                            num     : winValue,
                            mark    : markData,
                            natural : result.natural
                        }
                    };
                }).catch(e => {
					throw "error";
				});
            }).then(() => {
                this.sendToAPIServer(gameName, result, [], dealer) ;
                return { gameMarksData, roundWins, roundBets, userInfo: [], oddsbonus : this.oddsbonus };
            }).catch(e => {
				throw "error";
			});
        }

        let betHistory      = "";
        let totalBets       = "";
        let totalWins       = "";
        let userMoney       = "";
        let totalRolling    = "";
        let totalLost       = "";
        let totalBetAndWin  = "";
        let userInfo        = [];

        let data = _.map(result.bets, (row) => {
            let temp = row.get();
            temp.bet_history = JSON.parse(temp.bet_history);
            temp.user = temp.user.get();
            return temp;
        });

        _.forEach(data, (row, index) => {
		    let type = (row.type == "f" || row.type == "r") ? "fnEvaluate" : row.type;
		    let temp = this[type](result, row.bet_history);

            data[index].bet_history     = temp.data;
            data[index].total_rolling   = temp.total_rolling;
            data[index].total_bet       = temp.total_bets;
            data[index].total_winning   = temp.payout;
            data[index].total_win       = temp.total_win;
            data[index].total_lost      = temp.total_lost;

            userInfo.push({
                id              : row.user_id,
                type            : row.type,
                total_winning   : Math.round(temp.total_win * 100) / 100,
                money           : row.user.money + temp.total_win,
				user_type       : row.user.user_type,
                total_lost      : temp.total_lost,
                bets            : row.bet_history
            });

			let temptotalWin = (data[index].user.vendor.integration_type == "transfer") ? temp.total_win : 0;

            userMoney       += `WHEN ${row.user_id} THEN u.money + ${temptotalWin} `;
            betHistory      += `WHEN ${row.id}      THEN '${JSON.stringify(data[index].bet_history)}' `;
            totalBets       += `WHEN ${row.id}      THEN ${temp.total_bets} `;
            totalWins       += `WHEN ${row.id}      THEN ${temp.payout} `;
            totalRolling    += `WHEN ${row.id}      THEN ${temp.total_rolling} `;
            totalLost       += `WHEN ${row.id}      THEN ${temp.total_lost} `;
            totalBetAndWin  += `WHEN ${row.id}      THEN ${temp.total_win} `;
            roundWins       += temp.payout;
            roundBets       += temp.total_bets;
        });

		let gr = _.pick(result, ["winner", "pairs", "supersix", "bonus", "size"]);
        gr = JSON.stringify(gr);

        let rawQuery = "";
        rawQuery += " UPDATE bets AS b ";
        rawQuery += "   JOIN nihtan_api.users AS u";
        rawQuery += "     ON b.user_id = u.id";
        rawQuery += "   JOIN baccarat.rounds AS r";
        rawQuery += "     ON b.round_id = r.id";
        rawQuery += "    SET b.bet_history = (CASE b.id " + betHistory + " END)";
        rawQuery += "     , b.total_winning = (CASE b.id " + totalWins + " END)";
        rawQuery += "     , b.total_rolling = (CASE b.id " + totalRolling + " END)";
        rawQuery += "     , b.total_lost = (CASE b.id " + totalLost + " END)";
        rawQuery += "     , b.total_win = (CASE b.id " + totalBetAndWin + " END)";
        rawQuery += "     , b.updated_at = NOW()";
	rawQuery += "     , u.money = (CASE u.id " + userMoney + " END)";
        rawQuery += "     , r.status ='E'";
        rawQuery += "     , r.game_result = '"+ gr + "'";
        rawQuery += "     , r.updated_at = NOW()";
        rawQuery += " WHERE r.status = 'P'";
        rawQuery += "   AND r.table_id = " + tableId;
        rawQuery += "   AND r.round_num = " + roundNum;

        return seq.transaction({
            autocommit : true,
            isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
        }).then(t => {
            return seq.query(rawQuery, { transaction: t }).then(() => t.commit()).catch(err => {
                t.rollback();
                throw 'error';
            });
        }).then(() => {
            return db.gameMarks.findOne({
                where : { table_id: tableId },
                order : [["id", "DESC"]],
                attributes : ["table_id", "mark_num"]
            }).then((gm) => {
                gameMarksData = {
                    id : gm.get("table_id"),
                    shoeNumber : gm.get("mark_num"),
                    gameMarks : {
                        num     : winValue,
                        mark    : markData,
                        natural : result.natural
                    }
                };
            }).catch(e => {
                throw "error";
            });
        }).then(() => {
            this.sendToAPIServer(gameName, result, data, dealer);
            return { gameMarksData, roundWins, roundBets, userInfo, oddsbonus : this.oddsbonus };
        }).catch(e => {
            throw "error";
        });
    },

    /**
     * Pass data for current round to Nihtan API Server.
     *
     * @param game
     * @param result
     * @param data
     * @param dealer
     */
    sendToAPIServer (game, result, data, dealer) {
        let jsonData = {
            method : "POST",
            uri : process.env.API_HISTORY_URL,
            body : {
                game,
                table       : result.table,
                dealer,
                round_no    : result.round_no,
                game_info   : { player : result.player, banker : result.banker },
				game_result : _.pick(result, ["winner", "pairs", "supersix", "bonus", "size"]),
                created_at  : result.created_at,
                resulted_at : result.resulted_at,
                data        : _.map(data, (row) => {
                    return {
                        id              : row.user.id,
                        user_id         : row.user.user_id,
                        user_name       : row.user.user_name,
                        vendor_id       : row.user.vendor_id,
                        type            : row.type,
						user_type       : row.user.user_type,
						bets            : row.bet_history,
						bet_range       : row.bet_range,
						total_bet       : row.total_bet,
                        total_rolling   : row.total_rolling,
                        total_win       : row.total_win,
                        total_lost      : row.total_lost,
                        bet_id          : row.bet_id,
                        session_id      : row.session_id,
                        created_at      : moment(row.created_at).utcOffset(0).format("YYYY-MM-DD HH:mm:ss"),
                        currency        : row.currency || row.user.currency || row.user.vendor.currency,
			            multiplier      : row.user.denomination || row.user.vendor.multiplier
                    };
                })
            },
            json: true
        };
     
        request(jsonData).then(() =>
            this.apiLog(jsonData)
        ).catch(e =>
            this.apiLog({ error : e.name, cause : e.cause, params : jsonData })
        );
    },

	apiLog (data) {
        return;
		let fn = "logs/" + moment().utcOffset(0).format("YY-MM-DD") + "-ApiRequest.log";

		if (fs.existsSync(fn)) {
			fs.appendFile(fn, "--START\n"
			+ moment().utcOffset(0).format("YYYY-MM-DD HH:mm:ss")
			+ ":\n" + JSON.stringify(data,null,"\t")
			+ "\n--END\n\n", err => {
                if (err) {
                    throw err;
                }
            });
		}
        else {
			fs.writeFile(fn, "--START\n"
			+ moment().utcOffset(0).format("YYYY-MM-DD HH:mm:ss")
			+ ":\n" + JSON.stringify(data, null,"\t")
			+ "\n--END\n\n", err => {
                if (err) {
                    throw err;
                }
            });
		}
	},
    /**
     * Evaluate each users' bet history
     *
     * @param result
     * @param betHistory
     */
	fnEvaluate (result, betHistory) {
        // function for default baccarat`
        let processed = [];
        let total_lost = 0;
        let total_win = 0;
        let total_bets;

        let total_rolling = total_bets = _.reduce(betHistory, (sum, row) => {
            return sum + row.bet_money;
        }, 0);

        let payout = 0;

        _.forEach(betHistory, (row) => {
            let key = row.bet.replace("bet_", "");

            // payout pairs
            if (key.indexOf("pair") !== -1 && result.pairs.indexOf(key.replace("pair", "")) !== -1) {
                row.win_money = this.multipliers[key] * row.bet_money;
                payout += row.win_money;
                total_win += (row.win_money + row.bet_money)
            }

            // payout main bets
            if (key === result.winner) {
                row.win_money = this.multipliers[key] * row.bet_money;
                payout += row.win_money;
                total_win += (row.win_money + row.bet_money)
            }

            // return money if bet if result is tie
            if (result.winner == "tie" && key !== "tie" && key.indexOf("pair") == -1) {
                row.win_money = row.bet_money;
                payout += row.win_money;
                total_rolling -=  row.bet_money;
                total_win += row.bet_money
            }

            if (!row.win_money) {
                total_lost += row.bet_money;
            }

            if (row.win_money) {
                row.win_money += (result.winner == "tie" && key !== "tie" && key.indexOf("pair") == -1 ? 0 : row.bet_money);
            }

            processed.push(row);
        });

        return { data : processed, total_rolling, total_bets, payout, total_lost, total_win };
    },
	s (result, betHistory) {
        let processed = [];
        let total_lost = 0;
        let total_win = 0;
        let total_bets;

        let total_rolling = total_bets = _.reduce(betHistory, (sum, row) => {
            return sum + row.bet_money;
        }, 0);

        let payout = 0;

        _.forEach(betHistory, (row) => {
            let key = row.bet.replace("bet_", "");
            // payout pairs
			
            if (key.indexOf('pair') !== -1 && result.pairs.indexOf(key.replace("pair", "")) !== -1) {
                row.win_money = this.multipliers_supersix[key] * row.bet_money;
                payout += row.win_money;
                total_win += (row.win_money + row.bet_money)
            }
			
            // payout main bets
            if (key === result.winner) {
				if(key == 'banker' && result.supersix){
					// if user bets on banker and result is supersix
					// banker will win 0.5 only
					row.win_money = 0.5 * row.bet_money;
				} else {
					row.win_money = this.multipliers_supersix[key] * row.bet_money;
				}
				payout += row.win_money;
				total_win += (row.win_money + row.bet_money);
            }

			if (key === "supersix" && result.supersix) {
				row.win_money = this.multipliers_supersix[key] * row.bet_money;
				payout += row.win_money;
				total_win += (row.win_money + row.bet_money)
			}
            
			// return money if bet if result is tie
            if (result.winner == "tie" && key !== "tie" && key.indexOf("pair") == -1 && key !== "supersix") {
                row.win_money = row.bet_money;
                payout += row.win_money;
                total_rolling -=  row.bet_money;
                total_win += row.bet_money
            }

            if (!row.win_money) {
                total_lost += row.bet_money;
            }

            if (row.win_money) {
                row.win_money += (result.winner == "tie" && key !== "tie" && key.indexOf("pair") == -1  && key !== "supersix" ? 0 : row.bet_money);
            }

            processed.push(row);
        });

        return {data: processed, total_rolling, total_bets, payout, total_lost, total_win};
    },
	odds : {
		'bonus_9' : 31,
		'bonus_8' : 11,
		'bonus_7' : 7,
		'bonus_6' : 5,
		'bonus_5' : 3,
		'bonus_4' : 2,
		'bonus_3' : 0,
		'bonus_2' : 0,
		'bonus_1' : 0,
		'natural_banker'  : 2,
		'natural_player'  : 2,
		'natural_tie' : 1
	},
	bigSmallOdds : {
		'big' : 0.54,
		'small' : 1.5
	},
	bonusCounter(k,r){
		return r.bonus.type ? this.odds[r.bonus.type] : 
			   this.odds[r.bonus.diff] ? this.odds[r.bonus.diff] : 0;
	},
	b (result, betHistory) {
        let processed = [];
        let total_lost = 0;
        let total_win = 0;
        let total_bets;
        let total_rolling = total_bets = _.reduce(betHistory, (sum, row) => {
            return sum + row.bet_money;
        }, 0);

        let payout = 0;

        _.forEach(betHistory, (row) => {
            let key = row.bet.replace("bet_", "");
            // payout pairs
            if (key.indexOf("pair") !== -1 && result.pairs.indexOf(key.replace("pair", "")) !== -1) {
                row.win_money = this.multipliers[key] * row.bet_money;
				
                payout += row.win_money;
                total_win += (row.win_money + row.bet_money)
            }

            // payout main bets
            if (key === result.winner) {
                row.win_money = this.multipliers[key] * row.bet_money;
                payout += row.win_money;
                total_win += (row.win_money + row.bet_money)
            }

			// bonus
            if (key.indexOf("bonus") !== -1) {
				let k = key.replace("bonus_", "");
				if(k==result.winner || result.winner == "tie") {
					let od = this.bonusCounter(k,result);
					row.win_money = od * row.bet_money;
					this.oddsbonus = od?od:null;
					if(row.win_money){
						payout += row.win_money;
						total_win += row.win_money; 
					}
				}
            }

			// big small
			if (key === result.size) {
				row.win_money = this.bigSmallOdds[result.size] * row.bet_money;
				payout += row.win_money;
				total_win += (row.win_money + row.bet_money);
			}
            // return money if bet if result is tie
            if (result.winner == "tie"
				&& key !== "tie"
				&& key.indexOf("pair") == -1
				&& key.indexOf("bonus") == -1
				&& key !== "big"
				&& key !== "small") {
                row.win_money = row.bet_money;
                payout += row.win_money;
                total_rolling -=  row.bet_money;
                total_win += row.bet_money
            }

            if (!row.win_money) {
                total_lost += row.bet_money;
            }

            if (row.win_money && key.indexOf("bonus") == -1) {
                row.win_money += (result.winner == "tie"
				&& key !== "tie"
				&& key.indexOf("pair") == -1
				&& key !== "big"
				&& key !== "small"
                    ? 0 : row.bet_money);
            }

            processed.push(row);
        });

        return {data: processed, total_rolling, total_bets, payout, total_lost, total_win};
    },

	fnGetCardSideBetMark(winner, pairs = []) {
        let map = {
            b: "b",     // banker
            p: "p",     // player
            t: "t",     // tie
            bbp: "q",   // banker banker-pair
            bbppp: "w", // banker banker-pair player-pair
            bpp: "e",   // banker player-pair
            pbp: "f",   // player banker-pair
            pbppp: "g", //player banker-pair player-pair
            ppp: "h",   // player player-pair
            tbp: "i",   // tie banker-pair
            tbppp: "j", // tie banker-pair player-pair
            tpp: "k"    // tie player-pair
        };
		let supersix_map = {
			b: "l",
			bbp: "m",   // banker banker-pair
            bbppp: "n", // banker banker-pair player-pair
            bpp: "o"   // banker player-pair
		};

        let key = winner.charAt(0) + _.map(pairs, (row) => row.charAt(0) + 'p').join('');
        return map[key]
    }
};
