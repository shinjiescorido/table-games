'use strict';


  /*
  |--------------------------------------------------------------------------
  | info marks Model v1.0
  |--------------------------------------------------------------------------
  | Author : Shinji Escorido
  |
  */

module.exports = (sequelize, DataTypes) => {  
  const infoMarks = sequelize.define('info_mark', {
    id: {
      type          : DataTypes.INTEGER(10).UNSIGNED,
      autoIncrement : true,
      primaryKey    : true,
      allowNull     : false
    },
    mark : DataTypes.CHAR(1),
    mark_info : DataTypes.STRING(35),
    image     : DataTypes.STRING(45)
  });
  return infoMarks;
};
