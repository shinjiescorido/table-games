'use strict';


	/*
	|--------------------------------------------------------------------------
	| Rounds Model v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	|
	*/

module.exports = (sequelize, DataTypes) => {
	const Rounds = sequelize.define( 'round',{
		id :{
			type          : DataTypes.INTEGER(10).UNSIGNED,
			primaryKey    : true,
			autoIncrement : true,
			allowNull     : false
		},
		round_num : {
			type:DataTypes.INTEGER(10).UNSIGNED,
			allowNull:false
		},
		status : {
			type   : DataTypes.ENUM,
			values : ['S', 'E', 'H', 'P'],
			defaultValue: 'S'
		},
		game_info   : DataTypes.JSON,
		game_result : DataTypes.JSON,
		table_id: {
              type: DataTypes.INTEGER(10).UNSIGNED,
              references: 'game_tables', // <<< Note, its table's name, not object name
              referencesKey: 'id' // <<< Note, its a column name
        }
	});
	return Rounds;
};
