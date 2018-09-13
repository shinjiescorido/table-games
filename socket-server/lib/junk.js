'use strict';
const _                = require('lodash');
const config           = require('../config');
const Redis            = require('ioredis');
const XPacket          = require('./XPacket');
const Store            = require('./Store');

const moment = require('moment');
module.exports = {
	'getRoomInformation' : async (namespace)=>{
		let totalBets = 0;
		let totalBetCount = 0;
		let totalUsers = 0;
		let betData = {};
		let rooms = await Store.scan(`Rooms:${namespace}:*`, 0, 10000);
		for (let i = 0; i < rooms[1].length; i++) {
			let users = Store.buildKeyValue((await Store.hscan(rooms[1][i], 0, '*'))[1]);
			totalUsers += _.size(users);
			Object.values(users).forEach((user) => {
				let usere = JSON.parse(user);
				totalBetCount += usere.bets.length ? 1 : 0;
				totalBets += _.sumBy(usere.bets, 'bet_amount');

				_.each(usere.bets,bet => {
					if (betData[bet.bet]) {
						betData[bet.bet].totalBets += bet.bet_amount;
						betData[bet.bet].totalUsers++;
					} else {
						betData = Object.assign(betData,{[bet.bet]:{
						totalBets : bet.bet_amount || 0 ,
						totalUsers : 1
						}});
					}
				});

			});

		}
		return [totalBets, totalBetCount, totalUsers, betData];
	}
}; // end module