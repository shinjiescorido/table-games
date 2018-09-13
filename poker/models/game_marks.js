'use strict';


  /*
  |--------------------------------------------------------------------------
  | Game Maps Model v1.0
  |--------------------------------------------------------------------------
  | Author : Shinji Escorido
  |
  */

module.exports = (sequelize, DataTypes) => {  
  const RoadMap = sequelize.define('game_mark', {
    id: {
      type          : DataTypes.INTEGER(10).UNSIGNED,
      autoIncrement : true,
      primaryKey    : true,
      allowNull     : false
    },
    round_id : {
      type          : DataTypes.INTEGER(10).UNSIGNED,
      allowNull     : false,
      unique: 'compositeKey'
    },
    table_id : {
      type          : DataTypes.INTEGER(10).UNSIGNED,
      allowNull     : false,
      unique: 'compositeKey'
    },
    mark     : {
      type         : DataTypes.JSON,
      defaultValue : null
    },
    mark_num : DataTypes.STRING(255)
  });
  return RoadMap;
};
