'use strict';

	/*
	|--------------------------------------------------------------------------
	| Bets Model v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	|
	*/

module.exports = (sequelize, DataTypes) => {  
	const Bets = sequelize.define('bet', {
		id : {
			type          : DataTypes.INTEGER(10).UNSIGNED,
			primaryKey    : true,
			autoIncrement : true,
			allowNull     : false
		},
		type : {type:DataTypes.ENUM('r','b'),defaultValue:'r'},
		bet_history   : {type:DataTypes.JSON,defaultValue:null},
		total_bet     : {type:DataTypes.DECIMAL(15,2),defaultValue:null},
		total_winning : {type:DataTypes.DECIMAL(15,2),defaultValue:null},
		total_win     : {type:DataTypes.DECIMAL(15,2),defaultValue:null},
		total_lost    : {type:DataTypes.DECIMAL(15,2),defaultValue:null},
		bet_range     : {type:DataTypes.STRING(20),defaultValue:null},
		total_rolling : {type:DataTypes.DECIMAL(15,2),defaultValue:0},
		session_id    : {type:DataTypes.STRING(40),defaultValue:null},
		bet_id: {type:DataTypes.STRING(32),defaultValue:null},
		currency	  : {
			type   : DataTypes.ENUM,
			values : ['CNY','USD','JPY','KRW','THB','MYR','IDR','RUB','UAH','GEL','EUR','GBP','TRY','IRR','DGN','CZK','HUF','SEK','VND','HKD','BYN','INR'],
			defaultValue: null
		}
	});
	return Bets;
}
