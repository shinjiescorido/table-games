'use strict';

	/*
	|--------------------------------------------------------------------------
	| services v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| playGetter - get rtmp player
	|
	*/
const models  = require( './db.js' );

module.exports = {
	getRtmpLink(tableId){
		return models.tables.findById(tableId).then(t=>{
			let eSettings = JSON.parse(t.get('env_setting'));
			return eSettings.web_stream+'_800x450';
		});
	}
};
