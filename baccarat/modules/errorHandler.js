'use strict';

/*
 |--------------------------------------------------------------------------
 | errorHandler function Module
 |--------------------------------------------------------------------------
 | Author: Shinji Escorido
 |  - logs thrown errors to db
 |
 */
const models = require( './db.js' );
module.exports = function (data,eventName) {
		let query = "";
		//eventName = eventName.('\'','"');
		query =  "INSERT INTO dealer_fail_logs (";
		query += "       table_id";
		query += "     , round_num";
		query += "     , real_name";
		query += "     , actions";
		query += "     , created_at";
		query += ") VALUES (";
		query += "       " + data.tableId;
		query += "     , " + data.roundNum;
		query += "     , '" + data.realName + "'";
		query += "     , JSON_ARRAY(JSON_MERGE(JSON_OBJECT('action', 'insert'), JSON_OBJECT('comment', '" + eventName + "'), JSON_OBJECT('time', NOW())))";
		query += "     , NOW()";
		query += ")";
		query += "ON DUPLICATE KEY UPDATE real_name = '" + data.realName + "'";
		query += "                      , actions = JSON_ARRAY_INSERT(`actions`, '$[100]', JSON_MERGE(JSON_OBJECT('action', 'insert'), JSON_OBJECT('comment', '" + eventName + "'), JSON_OBJECT('time', NOW())))";
		query += "                      , updated_at = NOW()";
		console.log(query);
		return models.sequelize.query(query);
};