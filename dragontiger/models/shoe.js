'use strict';

	/*
	|--------------------------------------------------------------------------
	| shoe Model v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	|
	*/

module.exports = (sequelize, DataTypes) => {  
  const shoe = sequelize.define('shoes', {
    id : {
      type       : DataTypes.INTEGER(10).UNSIGNED,
      primaryKey : true,
      autoIncrement: true,
      allowNull : false
    },	
	code      : DataTypes.STRING(45)
  });
  return shoe;
};
