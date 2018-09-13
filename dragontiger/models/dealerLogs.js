'use strict';

	/*
	|--------------------------------------------------------------------------
	| Dealer logs Model v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	|
	*/

module.exports = (sequelize, DataTypes) => {  
	const DealerLogs = sequelize.define('dealer_log', {
		id : {
			type          : DataTypes.INTEGER(10).UNSIGNED,
			primaryKey    : true,
			autoIncrement : true,
			allowNull     : false
		},
		table_id  : {type:DataTypes.INTEGER(10).UNSIGNED,defaultValue:null},
		real_name : {type:DataTypes.STRING(30),defaultValue:null},
		round_num : {type:DataTypes.INTEGER(10).UNSIGNED,defaultValue:null},
		actions   : {type:DataTypes.JSON,defaultValue:null},
	});
	return DealerLogs;
}
