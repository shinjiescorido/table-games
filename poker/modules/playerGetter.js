'use strict';

	/*
	|--------------------------------------------------------------------------
	| services v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| Service module/component for processing model datas
	|
	*/


const models  = require( './db.js' );
const config  = require('../config/index');

module.exports = {
	getRtmpLink(tableId){
		return models.tables.findById(tableId).then(t=>{
			let eSettings = JSON.parse(t.get('env_setting'));
			return eSettings.web_stream+'_800x450';
		});
	}
};