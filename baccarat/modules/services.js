"use strict";

/*
 |--------------------------------------------------------------------------
 | services v1.0
 |--------------------------------------------------------------------------
 | Author : Shinji Escorido
 | Service module/component for processing model datas
 |
 */

const deck      = require("./cardsModule");
const _         = require("lodash");
const models    = require("./db.js");
const Cards     = require("./cards");
const request   = require("request-promise");

module.exports = {
    fnProcessBetTimer (time, searchId) {
        return new Promise((res, rej) => {
            models.tables.findById(searchId).then(table => {
                let settings = JSON.parse(table.get("bet_setting"));
                settings.betting_time = time;

                table.update({bet_setting:settings}).then(() =>
                    res(time)).catch(() => rej(false)
                );
            }).catch(err=>rej(err));
        });
    },

	fnPromisePublish (conn, field, data) {
		return new Promise((res, rej) => {
			if (!conn || !field || !data) {
				rej("naay error");
			}

			conn.publish(field, data);
			res();
		});
	},

    fnFetchMarks () {
        return new Promise((res, rej) => {
            models.infoMarks.findAll().then(marks => {
				if (!marks) {
                    rej("Error: fetch marks");
                }

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
                rej("Error: fetch marks")
            );
        });
    },

    fnProcessAutoNextRound (searchId) {
        return new Promise((res, rej) => {
            models.tables.findById(searchId).then(table => {
                let settings = JSON.parse(table.get("bet_setting"));
                settings.auto_next_round = (settings.auto_next_round == "Y") ? "N" : "Y";

                table.update({bet_setting:settings}).then(() => {
                    var delayTime = (settings.auto_next_round == "Y") ? settings.delay_time : 0;
                    res(delayTime);
                }).catch(err =>
                    rej(err)
                );
            }).catch(err => rej(err));
        });
    },

    fnProcessDeleteCard (round_num, table_id) {
        return this.fnDataProcessing("update", {
            data : {
                game_info:{
                    banker1 : null,
                    banker2 : null,
                    banker3 : null,
                    player1 : null,
                    player2 : null,
                    player3 : null
                },
                status : "P"
            },
            where : {
                where : { round_num, table_id }
            }
        }, models.rounds, models);
    },

    fnMysqlRaw (query, db, plain) {
        let returnData = null;

        return db.sequelize.transaction({
            autocommit     : true,
            isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
        }).then(t => {
            return db.sequelize.query(query, { transaction : t, plain }).then((r) => {
                if (r) {
                    returnData = r;
                }
                else {
                    this.reject();
                }

                t.commit();
            }).catch(err => {
                t.rollback();
                this.reject();
            });
        }).then(() => {
			if (!returnData) {
                this.reject();
            }

            return returnData;
        }).catch(() => {
			this.reject();
            return returnData;
        });
    },

    fnDataProcessing (isCreate, data, model, db) {
        let returnData = null;
        return db.sequelize.transaction({
            autocommit     : true,
            isolationLevel : db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
        }).then(t=>{
            return model[isCreate](data.data,data.where, {transaction: t}).then((r)=>{
                if(r)
                    returnData = r;
                else
                    throw "errorsj";

                t.commit();
            }).catch(e => {
                t.rollback();
                this.reject();
            });
        }).then(() => {
			if (returnData && (typeof returnData == "object")) {
                return returnData;
            }

            if (!(returnData && returnData.length && returnData[0])) {
                throw "errorss";
            }

            return returnData;
        }).catch(e => {
           throw "error2";
            return returnData;
        });
    },

    fnProcessNewRound (roundNum, currentTableId,dealerId, dealerName, shoeId) {
        return new Promise((res, rej) => {
            let query = "";


            let cardsData = {
                banker1:null,
                banker2:null,
                banker3:null,
                player1:null,
                player2:null,
                player3:null
            };

            let round = null;

            models.sequelize.transaction({
                autocommit     : true,
                isolationLevel : models.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
            }).then(t => {
                query =  "INSERT INTO rounds (";
                query += "       table_id";
                query += "     , dealer_id";
                query += "     , round_num";
                query += "     , status";
                query += "     , game_info";
                query += "     , game_result";
                query += "     , modify_flag";
                query += "     , created_at";
                query += "     , updated_at";
                query += ")  VALUES (";
                query += "       " + currentTableId;
                query += "     , " + dealerId;
                query += "     , " + (parseInt(roundNum) + 1);
                query += "     , 'S'";
                query += "     , '" + JSON.stringify(cardsData) + "'";
                query += "     , NULL";
                query += "     , NULL";
                query += "     , NOW()";
                query += "     , NULL";
                query += ")";

                return models.sequelize.query(query, { type : models.sequelize.QueryTypes.INSERT }).then((r) => {
                    if (r) {
                        round = r;
                    }
                    else {
                        rej("Error: new round");
                    }

                    t.commit();
                }).catch((err) => {
                    t.rollback();
                    rej("Error: new round");
                });
            }).then(() => {
                res({ id : round, round_num : (parseInt(roundNum) + 1) });
            }).catch(err =>
                rej("Error: new round")
            );
        });
    },

    hasPair (data) {
        data = _.pickBy(data, (row, key) => {
            return parseInt(key) !== 2;
        });

        return _.filter(_.countBy(data, (card) => {
            return card.value;
        }), (o) => {
            return o >= 2
        }).length;
    },

    isNatural (data) {
        data = _.pickBy(data, (row, key) => {
            return parseInt(key) !== 2;
        });

        let temp = _.reduce(data, (sum, card) => {
            return sum + card.bcValue;
        }, 0) % 10;
        return [8, 9].indexOf(temp) !== -1;
    },

    fnGetResults (tableId, roundNum, searchId) {
        return new Promise((res, rej) => {
            models.rounds.find({
                where : { table_id : tableId, round_num : roundNum },
                include : [{
                    model : models.bets,
                    attributes : [
                        "id",
                        "round_id",
                        "type",
                        "user_id",
                        "bet_history",
                        "total_bet",
                        "total_winning",
                        "total_rolling",
                        "bet_range",
                        "bet_id",
                        "session_id",
                        "created_at",
                        "currency"
                    ],
                    include: [{
                        model : models.users,
                        attributes: [
                            "id",
                            "vendor_id",
                            "user_id",
                            "user_name",
                            "money",
			    "user_type",
                            "currency",
			    "denomination"
                        ],
                        include : [{
                            model : models.vendors,
                            attributes: ["id",
                                "type",
                                "integration_type",
                                "currency",
				"multiplier"
                            ],
                            plain : true
                        }]}
                    ]}
                ],
                attributes : [
                    "id",
                    "table_id",
                    "round_num",
                    "dealer_id",
                    "game_info",
                    "game_result",
                    "created_at",
                    "updated_at"
                ],
                plain : true
            }).then(round => {
                if (_.isEmpty(round) || !round) {
                    rej(false);
                }

                let cards = JSON.parse(round.game_info);
				if (!cards.banker1 || !cards.banker2 || !cards.player1 || !cards.player2) {
					rej("inc");
				}
				
				if (round.status == "E") {
					rej("doubleresult");
				}

				let naturalType = null;

                let result = {
                    winner      : null,
                    round_no    : round.round_num,
                    table       : round.table_id,
                    created_at  : round.get("created_at"),
                    resulted_at : round.get("updated_at"),
                    pairs       : [],
                    natural     : [],
                    banker      : {total : 0, cards : []},
                    player      : {total : 0, cards : []},
                    bets        : round.bets,
					supersix    : false,
					bonus       : false,
					size        : _.filter(cards,d => d).length > 4 ? "big" : "small"
                };

                _.forEach(cards, (value, key) => {
                    if (value === null) {
                        return ;
                    }

                    let temp = key.slice(0, -1);
                    result[temp].cards.push(new deck(value));
                    result[temp].total = (result[temp].total + Cards.getCardValue(value)) % 10;
                });

                if (this.hasPair(result.banker.cards)) {
                    result.pairs.push("banker");
                }

                if (this.hasPair(result.player.cards)) {
                    result.pairs.push("player");
                }

                if (this.isNatural(result.player.cards)) {
                    result.natural.push("player");
					naturalType = "natural";
                }

                if (this.isNatural(result.banker.cards)) {
                    result.natural.push("banker");
					naturalType = "natural";
                }

                result.winner = result.banker.total === result.player.total ? "tie" : result.banker.total > result.player.total ? "banker" : "player";

				//supersix result calculation
				result.supersix = (result.winner == "banker" && result.banker.total == 6);

                //bonus result calculation
				result.bonus = {
					type : (naturalType) ? naturalType + "_" + result.winner : null,
					diff : (result.winner == "tie") ? null : result.winner == "banker" ? "bonus_" + (result.banker.total - result.player.total).toString() : "bonus_" + (result.player.total - result.banker.total).toString()
				};

                return res(result);
            }).catch(e => rej("Error: get results error - fnGetResults"));
        });
    },

    fnSetRoundStatus (tableId, roundNum, id, status) {
        return new Promise((res, rej)=>{
            let updateQuery = {
                data : {status},
                where : {where:{round_num :roundNum, table_id :tableId, status:'S'}}
            };

            this.fnDataProcessing("update",updateQuery, models.rounds, models)
                .then(()=>res())
                .catch(e=>rej('Error: set round status'));
        });
    },

    /**
     * Description: If round status is P then set to S
     *
     * @param id
     * @param status
     * @returns {Promise}
     */
    fnResetTimer (tableId, roundNum, id) {
        return new Promise((res, rej)=>{
            let updateQuery = {
                data : {status:'S'},
                where : {where:{round_num :roundNum, table_id :tableId, status: 'P'}}
            };

            this.fnDataProcessing("update",updateQuery, models.rounds, models)
                .then(()=>res())
                .catch(e=>rej('Error: set round status'));

        });
    },

    fnGetCurrentRoundDatas (tableId) {
        return new Promise((res, rej)=>{
            models.rounds.findOne({
                where : {
                    table_id : tableId
                }, include : [{
                    model      : models.dealers,
                    attributes : ["id", "real_name", "name", "dealer_image"]
                }, {
                    model      : models.tables,
                    attributes : ["id", "bet_setting", "env_setting"]
                }], order: [ ["created_at", "DESC"]]
                , attributes : ["id", "game_info", "round_num", "game_result", "status"]
                , plain:true
            }).then(data => {
                if (!data) {
                    rej("Error: init data");
                    return;
                }

                let gameInfo = (data.game_info) ? JSON.parse(data.game_info) : {};
                let betSettings = JSON.parse(data.game_table.bet_setting);
				let envSetting = JSON.parse(data.game_table.env_setting);
                let done = false;
                let postStatus = data.status;

                if (_.size(data.game_result)) {
                    done = true;
                }

                // get post status logic
                if (data.status == "H") {
                    if (data.game_result) {
                        postStatus = "E";
                    }
                    else {
                        postStatus = !_.filter(gameInfo, (row) => { return row }) ? "S" : "P";
                    }
                }

                // find the latest road map shoe
                models.gameMarks.findOne({
                    where : { table_id : data.game_table.id },
                    attributes : ["id"],
                    order: [[ "id", "DESC" ]]
                }).then(markData=>{
                    res(Object.assign({},{
                        roundId       : data.id,
                        roundNum      : data.round_num,
                        dealer        : data.dealer,
                        autonextround : (betSettings.auto_next_round == "Y") ? betSettings.delay_time : 0,
                        bettimer      : betSettings.betting_time || 0,
                        type          : betSettings.type,
                        betSettings,
						envSetting,
                        table         : data.game_table.id,
                        status        : data.status,
                        gameInfo,
                        postStatus,
                        shoeId : markData.id,
                        done
                    }));
                });
            }).catch(e=>{
                console.log('services ==========> ');
                rej("Error: init data");
			});
        });
    },

    fnProcessCard (value, type, roundNum, roundId, realName, tableId, gameName, status, next) {
        if (type == "shoeburncard") {
            next("shoeburncard");
            return;
        }

        let strQueryInsertUpdate = null;

        if (type == "dealer_id") {
            models.dealers.findOne({
                where : {
                    code : value
                },
                attributes : ["id", "name", "dealer_image", "real_name"],
                plain : true
            }).then(dealer => {
                if (!dealer) {
                    next(false);
                    return;
                }

                let dealerChangeData = {
                    gameName,
                    eventName : "dealerchange",
                    dealerId: dealer.id,
                    dealerName: dealer.name,
                    roundId,
                    roundNum,
                    tableId,
                    dealerImage: dealer.dealer_image,
                    data: {
                        dealerImage: dealer.dealer_image,
                        currentDealer: dealer.name
                    }
                };

                if(status != 'S'){
                    next(dealerChangeData);
                    return;
                }

                let strQueryDealers = "";
                let dealerName = dealer.real_name;
                let promises = [];

                // 1. Before dealer table name is null
                strQueryDealers = " UPDATE nihtan_api.dealers";
                strQueryDealers += "   SET table_name = null";
                strQueryDealers += " WHERE table_name='" + gameName + "# " + tableId + "'";

                promises.push(this.fnMysqlRaw(strQueryDealers, models, false));

                strQueryInsertUpdate = " UPDATE rounds AS T1";
                strQueryInsertUpdate += " INNER JOIN nihtan_api.dealers AS T2";
                strQueryInsertUpdate += "    ON T2.id = " + dealer.id;
                strQueryInsertUpdate += "   SET T1.dealer_id = " + dealer.id;
                strQueryInsertUpdate += "     , T2.table_name = '" + gameName + "# " + tableId + "'";
                strQueryInsertUpdate += "     , T1.updated_at = NOW()";
                strQueryInsertUpdate += "     , T2.updated_at = NOW()";
                strQueryInsertUpdate += " WHERE T1.table_id = " + tableId;
                strQueryInsertUpdate += "   AND T1.round_num = " + roundNum;

                promises.push(this.fnMysqlRaw(strQueryInsertUpdate, models, false));

                Promise.all(promises).then(d => {
                    _.each(d,i => {
                        if (!i) {
                            next(false);
                            return;
                        }
                    });

                    next(dealerChangeData);
                }).catch(e => {
                    next(false);
                    return;
                });
            }).catch(() => {
				next(false);
                return;
			});
        } else if(type == "shoe") {
            this.fnDataProcessing("create", {
                data : {
                    table_id : tableId,
                    mark : [],
                    mark_num : value
                }, where : {
                    where : null
                }
            }, models.gameMarks, models).then(shoe =>
                next(shoe.get('id'))
            ).catch(e => {
				next(false);
			});
        } else {
            //== if not dealer save to round as item
            models.rounds.findOne({where : {
                table_id : tableId, round_num:roundNum
            }}).then(round => {
                let query = '';

                if (round.get("status") == "S") {
                    next("roundStatusError");
                    return;
                }

                query = ' UPDATE baccarat.rounds AS r';
                query += '          SET r.game_info = JSON_SET(game_info, "$.' + type + '", "' + value + '")';
                query += ' WHERE r.round_num = ' + roundNum;
                query += '   AND r.status = "P"';
                query += '   AND r.table_id = ' + tableId;

                this.fnMysqlRaw(query, models, false).then(() => {
                    models.rounds.findOne({
                        where : { round_num : roundNum, table_id : tableId }
                    }).then(r => {
                        let swipeData = {
                            value : value,
                            type: type,
                            gameName,
                            roundId,
                            eventName : "inputitem",
                            tableId,
                            roundNum,
                            gameInfo : JSON.parse(r.get("game_info"))
                        };
                        next(swipeData);
                    }).catch(() => {
                        next(false);
                        return;
                    });
                }).catch(() => {
                    next(false);
                    return;
                });
            }).catch(e => {
                next(false);
                return;
            });
        }
    },
    fnGetTablesMarks (gameName) {
        return new Promise((res, rej)=>{
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
            getTableMarkQuery += "     , a.bet_setting AS betSetting";
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
            getTableMarkQuery += "     , baccarat.game_tables AS a";
            getTableMarkQuery += "  JOIN (SELECT JSON_EXTRACT(mark,'$') AS gameMarks";
            getTableMarkQuery += "             , table_id";
            getTableMarkQuery += "             , mark_num AS shoeNumber";
            getTableMarkQuery += "          FROM baccarat.game_marks";
            getTableMarkQuery += "         WHERE id IN (SELECT MAX(id)";
            getTableMarkQuery += "                        FROM baccarat.game_marks";
            getTableMarkQuery += "                       GROUP BY table_id)) AS b";
            getTableMarkQuery += "    ON a.id = b.table_id";
            getTableMarkQuery += "  JOIN (SELECT T1.table_id";
            getTableMarkQuery += "             , T1.id";
            getTableMarkQuery += "             , T1.dealer_id";
            getTableMarkQuery += "             , T1.round_num";
            getTableMarkQuery += "             , T1.game_info";
            getTableMarkQuery += "             , T1.game_result";
            getTableMarkQuery += "             , T1.status";
            getTableMarkQuery += "          FROM baccarat.rounds AS T1";
            getTableMarkQuery += "         INNER JOIN (SELECT table_id";
            getTableMarkQuery += "                          , MAX(id) AS id ";
            getTableMarkQuery += "                       FROM baccarat.rounds";
            getTableMarkQuery += "                      GROUP BY table_id) AS roundsGroup";
            getTableMarkQuery += "            ON T1.table_id = roundsGroup.table_id";
            getTableMarkQuery += "           AND T1.id = roundsGroup.id) AS r";
            getTableMarkQuery += "    ON r.table_id = a.id";
            getTableMarkQuery += "  JOIN nihtan_api.dealers AS d";
            getTableMarkQuery += "    ON r.dealer_id = d.id";
            getTableMarkQuery += "  LEFT JOIN nihtan_api.notice AS n";
            getTableMarkQuery += "    ON 1 = 1";
            getTableMarkQuery += " WHERE a.game_name = 'Baccarat'";
            getTableMarkQuery += "   AND a.status = '1'";

            models.liveSequelize.query(getTableMarkQuery, { type: models.liveSequelize.QueryTypes.SELECT }).then(initDatas => {
                let tables = [];
                let mainMaintenance = {};
                let mainNotice = {};

                _.each(initDatas,(table, index) => {
                    let sType = null;
                    let sSlave = [];

                    if (Array.isArray(JSON.parse(table.betSetting).type)) {
                        _.each(JSON.parse(table.betSetting).type,type => {
                            if (type == "normal" || type == "flippy") {
                                sType = type;
                            }

                            if (type == "supersix" || type == "insurance" || type == "bonus") {
                                sSlave.push(type);
                            }
                        });
                    }
                    else {
                        sType = JSON.parse(table.betSetting).type;
                    }

                    tables.push({
                        id                 : table.tableId,
                        shoeNumber         : table.shoeNumber,
                        roundNum           : table.roundNum,
                        currentDealer      : table.dealerName,
                        dealerId           : table.dealerId,
                        dealerImage        : table.dealerImage,
                        envSetting         : JSON.parse(table.envSetting),
                        type               : sType,
                        slave              : sSlave,
                        sportBetRanges     : JSON.parse(table.sportBetRange),
                        casinoBetRanges    : JSON.parse(table.casinoBetRange),
                        maintenanceSetting : JSON.parse(table.maintenanceSetting),
                        noticeSetting      : JSON.parse(table.noticeSetting),
                        gameInfo           : JSON.parse(table.gameInfo),
                        gameResult         : JSON.parse(table.gameResult),
                        gameMarks          : JSON.parse(table.gameMarks),
                        roomType           : table.roomType,
                        roundStatus        : table.roundStatus
                    });

                    mainMaintenance = {
                        mainText : table.mainText,
                        subText : table.subText,
                        status : table.status
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
                    gameName,
                    mainMaintenance,
                    mainNotice,
                    tables
                });
            }).catch(e =>
                console.log(JSON.stringify(e,null, "\t").error)
            );
        });
    },

    roomDisconnect(data){
        //let strQuery = "CALL nihtan_api.USP_ROOMS_SAVE('A', 'baccarat', " + data.roomId + ", " + data.tableId + ", '', " + data.userId + ", '0', '', '', '', 0, 0)";
        //return models.sequelize.query(strQuery);

     let strQuery1 = "CALL nihtan_api.USP_ROOMS_SAVE('A', 'baccarat', " + data.roomId + ", " + data.tableId + ", '', " + data.userId + ", '0', '', '', '', 0, 0)";

     if (data.type == "J") {
          let strQuery2 = "CALL nihtan_api.USP_REMOVE_JUNKET_ROOM(" + data.vendorId + ", '" + data.gameType + "-" + data.tableId + "')";
          models.sequelize.query(strQuery2);
     }
      return models.sequelize.query(strQuery1);
    },

    fnGetTables (gameName) {
        return new Promise((res, rej) => {
            let tableGroups = [];

            models.tables.findAll().then(tables => {
                _.each(tables,(table,index) => {
                    tableGroups.push(table.get("id"));
                });

                res({
                    eventName : "init",
                    gameName,
                    tables : tableGroups
                });
            }).catch(e =>
                console.log(JSON.stringify(e,null, "\t").error)
            );
        });
    },

    fnCardType (value, next) {
        let cardCheck = new deck(value);

        if (cardCheck.checkCard(value)) {
            next("card");
        }

        models.dealers.findOne({where : { code:value, status : "1" }}).then(data => {
            if (!data && (value.length !== 8 || value.substring(0, 2) !== "AA")) {
                next("error");
                return;
            }

            data ? next("dealer") : next("shoe");
        }).catch(() => {
            next("Internal Server Error");
        });
    },

	logger (data,dealerRealName) {
		if(data.eventName == "init") {
            return;
        }

		let logData = [{
			actions : "insert",
			comment : data.eventName
		}];

		let query = "";

		return models.dealerLogs.findOne({
            where : {
                round_num : data.roundNum,
                table_id : data.tableId
            }
        }).then(log => {
            let eventNameData = data.eventName + data.args;

            if (log) {
                // update dealer Logs
                query = " UPDATE baccarat.dealer_logs AS dl";
                query += "   SET dl.real_name = '" + dealerRealName + "'";
                query += "     , dl.actions = JSON_ARRAY_INSERT(actions, '$[100]', JSON_MERGE(JSON_OBJECT('action', 'insert'), JSON_OBJECT('comment', '" + eventNameData + "')))";
                query += "     , dl.updated_at = NOW()";
                query += " WHERE dl.table_id = " + data.tableId;
                query += "   AND dl.round_num = " + data.roundNum;

                this.fnMysqlRaw(query,models,false).catch(e =>
                    console.log("error on saving dealer logs".info)
                );
            }
            else {
                return models.dealerLogs.create({
                    table_id    : data.tableId,
                    round_num   : data.roundNum,
                    real_name   : dealerRealName,
                    actions     : logData
                }).catch(e =>
                    console.log("error creating new row on dealer logs".info)
                );
            }
        });
	}
}; // end module exports
