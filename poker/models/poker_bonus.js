'use strict';

	/*
	|--------------------------------------------------------------------------
	| Bonus Model v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	|
	*/

module.exports = (sequelize, DataTypes) => {  
  const PokerBonus = sequelize.define('poker_bonus', {
    id : {
      type          : DataTypes.INTEGER(10).UNSIGNED,
      primaryKey    : true,
      autoIncrement : true,
      allowNull     : false
    },
	bonus_idx         : {
		type: DataTypes.INTEGER(11),
		allowNull     : false
	},
	bonus_name    : {
		type: DataTypes.STRING(255),
		allowNull     : false
	},
	multiplier : {
		type: DataTypes.INTEGER(11),
		allowNull     : false
	}
  });
  return PokerBonus;
};
