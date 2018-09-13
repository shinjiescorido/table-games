'use strict';


	/*
	|--------------------------------------------------------------------------
	| Table Model v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	|
	*/

module.exports = (sequelize, DataTypes) => {  
  const Tables = sequelize.define('game_table', {
		id : {
 			type          : DataTypes.INTEGER(10).UNSIGNED,
 			primaryKey    : true,
 			autoIncrement : true,
 			allowNull     : false
		},
		game_name           : DataTypes.STRING(20),
		env_setting         : DataTypes.JSON,
		bet_setting         : DataTypes.JSON,
		maintenance_setting : DataTypes.JSON,
		casino_bet_ranges   : DataTypes.JSON,
		sport_bet_ranges    : DataTypes.JSON,
		room_type : {
			type   : DataTypes.ENUM,
			values : ['n','p','v'],
			defaultValue : 'n'
		},
		status : {
			type   : DataTypes.ENUM,
			values : ['0','1']
		},
		deleted_at : DataTypes.DATE
	});
  return Tables;
};
