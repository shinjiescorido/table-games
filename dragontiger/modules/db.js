'use strict';

	/*
	|--------------------------------------------------------------------------
	| database init v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| defining our database and connecting different models
	|
	*/

const Sequelize = require('sequelize');
const conf               = require( '../config/' );

const sequelize = new Sequelize(conf.db.name, conf.db.user, conf.db.pass, {  
  host    : conf.db.host,
  port    : conf.db.port,
  dialect : 'mysql',
  logging : false,
  define  : {
    underscored: true
  },
  pool: {
    max: 20,
    idle: 30000
  }
});

const sequelizeTemp = new Sequelize('nihtan_api', conf.db.user, conf.db.pass, {  
  host    : conf.db.host,
  port    : conf.db.port,
  dialect : 'mysql',
  logging : false,
  define  : {
    underscored: true
  },
  pool: {
    max: 20,
    idle: 30000
  }
});
const liveSequelize = new Sequelize("nihtan_api", conf.liveDb.user, conf.liveDb.pass, {
  host    : conf.liveDb.host,
  port    : conf.liveDb.port,
  dialect : 'mysql',
  //logging : true,
  define  : {
    underscored: true
  },
  pool: {
    max: 20,
    idle: 30000
  }
});
sequelize.dialect.supports.schemas = true;
sequelizeTemp.dialect.supports.schemas = true;
liveSequelize.dialect.supports.schemas = true;

const db = {};

db.Sequelize     = Sequelize;
db.sequelize     = sequelize;
db.sequelizeTemp = sequelizeTemp;
db.liveSequelize = liveSequelize;

db.dealers    = require('../models/dealers')(sequelizeTemp, Sequelize);
db.tables     = require('../models/game_tables')(sequelize, Sequelize);
db.bets       = require('../models/bets')(sequelize,Sequelize);
db.rounds     = require('../models/rounds')(sequelize,Sequelize);
db.dealerLogs = require('../models/dealerLogs')(sequelize,Sequelize);
db.users      = require('../models/users')(sequelizeTemp,Sequelize);
db.gameMarks  = require('../models/game_marks')(sequelize,Sequelize);
db.shoes      = require('../models/shoe')(sequelize,Sequelize);
db.infoMarks = require('../models/info_marks')(sequelize,Sequelize);
db.vendors    = require('../models/vendors')(sequelizeTemp,Sequelize);
// ====== Relations

db.dealers.hasMany(db.rounds);
db.rounds.belongsTo(db.dealers);

//db.gameMarks.belongsTo(db.rounds);
db.gameMarks.belongsTo(db.tables);
db.bets.belongsTo(db.users);
db.users.belongsTo(db.vendors);

db.rounds.belongsTo(db.tables, { foreignKey : 'table_id' });
db.rounds.hasMany(db.bets);
db.users.hasMany(db.bets);
db.vendors.hasMany(db.users);
//== Please do not delete these line of codes :

sequelize.sync().then(()=>{

}).catch((e)=>{
	console.log(e);
});
	sequelizeTemp.sync().then(()=>{
		console.log('SQL RUNNING.'.info);
	});

module.exports = db;
