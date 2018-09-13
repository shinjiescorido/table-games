const _                = require('lodash');
const config           = require('../config');
const Redis            = require('ioredis');
const XPacket          = require('./XPacket');
const Store            = require('./Store');
const moment = require('moment');
/**
 * @desc This module connects game to front-end
 *
 * @author Joseph Dan Alinsug <josephdanalinsug@hotmail.com>
 * @version 1.0
 *
 * @param {Object} io socket socket io instance for current namespace
 * @param {String} namespace current namespace
 * @param {boolean} disableRooms enable/disable room feature
 * @param {Object} managerSocket Manager's socket io connection
 * @param {Object} allSocket all socket io connection, for lobby and multi-bet
 * @param {Object} initObject game data for initialization
 * @param {Object} extra Extra initialization data not part of table data
 * @returns {*}
 * @constructor
 */
let Namespace = function (io, namespace, disableRooms, managerSocket, allSocket, initObject = {}, extra = {}) {

	let gameName = null;
	let tableNumber = null;

	[gameName, tableNumber] = namespace.split('/');

    let ns = {
        // socket io connection
        io: io || null,
        // rooms currently instantiated
        rooms: [],
        // room bets
        roomBets : {},
        roomSocket :null,
        // dictionary of all users currently connected to a room and their indexes for easy access
        dictionary: {},
        // max number of seats per room
        seats: ['Big-Wheel', 'Pula-Puti'].indexOf(gameName) !== -1 ? 1000 : 7,
        // socket io namespace
        namespace,
        // game name
        gameName,
        // Table Number
        tableNumber,
        // manager namespace socket connection
        managerSocket,
        // all namespace socket connection
        allSocket,
        // namespace status
        status: null,
        // subscriber
        sub: new Redis(config.redis.client),
        // publisher
        pub: new Redis(config.redis.client),

        /**
         * Emit to specific socketId
         *
         * @param socketId
         * @param eventName
         * @param data
         */
        send (socketId, eventName, data) {
            if (this.io.sockets[socketId]) {
                this.io.sockets[socketId].emit(eventName, XPacket.send(data))
            }
        },
		/**
        * getJunketRoomMates
        *
        * @param token
		* returns roommates array[]
        */
		async getJunketRoomMates(token){
			try {
				let junkRoom = await Store.scan(`*|${token}:*`);
				
				if(!junkRoom || !junkRoom[1][0])
					throw('error');

				let usersStr = Store.buildKeyValue((await Store.hscan(junkRoom[1][0], 0, '*'))[1]);
				let users = [];

				for (const key in usersStr) {
					users.push(JSON.parse(usersStr[key]));
				};
				return users;
			} catch (e){
				return e;
			}
		},
       /**
        * @todo refactor to merge with logic for create_room and join_room from lobby
        *
        * @param range
        * @param key
        * @param type
        */
        async getRoom (range, key, type = 'Auto') {
            try {
                let data = await Store.scan(`Rooms:${this.namespace}:${type}:${range}:*`, 0);
                let i = 0;

                for (; i < data[1].length; i++) {
                    let users = await Store.hscan(data[1][i], 0, '*');
                    let mapped = Store.buildKeyValue(users[1]);
                    // redis format returns [key, value], hence division by 2
                    if ((users[1].length / 2) >= 7 && !mapped[key]) {
                        continue;
                    }
                    return {id: data[1][i], users: mapped}
                }

                return {
                    id: `Rooms:${this.namespace}:${type}:${range}:${i + 1 === (data[1].length) ? i + 1 : i}`,
                    users: {}
                };
            } catch (error) {
                console.log(error)
            }
        },

       /**
        * @todo refactor to merge with logic for create_room and join_room from lobby
        *
        * @param range
        * @param userId
        * @param userName
        * @param room
        * @param config shinji2
        * @returns {Promise<*>}
        */
        async joinRoom (range, userId, userName, vendor_id, room = null, config = {}) {
			try{
				let user = {};
				let key = `${userId}:${userName}`;
				room = room || await this.getRoom(range, key);

				if (room.users[key]) {
					room.users[key] = room.users[key];
					user[key] = JSON.parse(room.users[key]);
					user[key].range = range;
					user[key].money = config.money || 0;
                    			user[key].vendor_id = vendor_id;
					user[key].joinDate = moment().utc();
					user[key].expireDateUTC = config.expireDateUTC || null;
					user[key].remove = false;
				} else {
					user[key] = _.merge(config, {remove: false, bets: [], userId, userName, vendor_id, joinDate: moment().utc(), range});
				}
				await Store.update(room.id, user);
				return room;
			} catch(e){
				console.log(e);
				return false;
			}
        },

	   /**
        * @param range
        * @param userId
        * @param userName
        */
        async editJunketUserRange (range, userId, userName, token) {
			 let roomT = await Store.scan(`*|${token}:*`);
			 if (!roomT || !roomT[1].length) {
				 return;
			 }
			 let uKey = `${userId}:${userName}`;
			 let bc_temps = Store.buildKeyValue((await Store.hscan(roomT[1][0], 0, uKey))[1]);
	         if (!_.size(bc_temps)) {
	 			return;
			 }
             bc_temps[uKey] = JSON.parse(bc_temps[uKey]);
			 bc_temps[uKey].range = range;
			 await Store.update(roomT[1][0], bc_temps);
             return roomT[1][0];
        },
        /**
         * Register event listeners
         *
         * @desc Attach event listeners when a user connects to the socket server.
         * @memberof Namespace
         */
         registerListeners () {
             console.log(`Listener registered: PID > ${process.pid} | Namespace ${this.namespace}`);
             this.io.on('connection', async (socket) => {
                 if (this.namespace === 'managers') {
                     this.emitRoomDataToManagers();
                 }

                 if (this.namespace !== 'managers' && this.namespace !== 'all') {
                     let storeData = await this.generate();
                     socket.emit('data', XPacket.send({
                         eventName: 'init',
                         data: storeData
                     }));
                 }

                 // on initialization push the user to an available room
                 socket.on('data', async (message, res) => {
                     res = res || (() => {});
                     switch (message.eventName) {
						case 'disband_room':
							if(!message || !message.token) return false;
							let disbandResult = await this.disbandRoom(message.token);
							res(disbandResult.error);
						break;

						case 'disablechange':
                            if(!message) return false;
                            this.io.emit('data',
                                XPacket.send({
                                    eventName:'disablechange',
                                    gameName: message.gameName,
                                    tableId: message.tableId,
                                    status: message.status,
                                    vendor_id: message.vendor_id
                                })
                            );

                            if(message.status == 1) {
                                let disableResult = await this.disableRoom(message.vendor_id, message.gameName, message.tableId, socket);
                                res(disableResult.error);
                            }

						break;

						case 'update_room':
							let roomType = message.data.roomType || 'classic';
							let ui = `${message.data.vendor_id}|${message.data.title}|${message.data.gameName}|${roomType}|${message.data.token}`;
							let maxCnt = parseInt(message.data.userCnt);
							let rid = `Rooms:${message.data.gameTable}:${ui}:${message.data.range}:${maxCnt}:${message.data.roomId}`;
							let passw = {};
							passw[rid] = message.data.password || '';
							Store.update('Passwords', passw);
								if(this.io) {
									this.io.emit('data', XPacket.send({
									  eventName:'lobby_update_room',
										  data:{
											id:rid,
											roomId:message.data.roomId,
											isPublic:(!message.data.password)
										  }
									}));
								}else{
									console.log('all socket is ',this.allSocket);
								}
						 break;				 
						 case 'edit_user_junket_room_range':
							try{
								res( await this.editJunketUserRange (message.data.range, message.data.userId, message.data.userName, message.data.token));
							} catch(e){
								res(false);
							}
						 break;
						 case 'junket_room_mates':
							if(message.token)
								res( await this.getJunketRoomMates (message.token) );
							else
								res(false);
						 break;
						 case 'junket_flipper_who':
							if(message.token)
								res( await this.getRoomHighestBettingUsers (message.token) );
							else
								res(false);
						 break;
                         case 'create_room':
							 let now = moment().utc().format('YYYY-MM-DD HH:mm:ss');
							 let rType = message.data.roomType || 'classic';
							 let isMulti = message.data.isMulti || false;
                             let uniqueIdent = `${message.data.vendor_id}|${message.data.title}|${message.data.gameName}|${rType}|${message.data.token}`;
                             let max = parseInt(message.data.user_cnt);
                             let id = `Rooms:${message.data.gameTable}:${uniqueIdent}:${message.data.range}:${max}:${message.data.roomId}`;
                             let pass = {};
							 let balanceBet = message.data.balanceBet || 0;
							 var expireDateUTC = null; 

							 if(rType == 'junket'){
								 let vendorEndDateUTC = moment.utc(message.data.vendorEndDate);
								 if(moment().utc().isSameOrAfter(vendorEndDateUTC) || !message.data.vendorEndDate){
						
									res(false);
									return;
								 }
								 let offSetting = message.data.gameDuration || 0;
								 if((vendorEndDateUTC.diff(moment().utc(),'hours') <= offSetting) || (!offSetting)){		
															 
									expireDateUTC = vendorEndDateUTC.format('YYYY-MM-DD HH:mm');
								 } else {
									 expireDateUTC = moment()
										.utc()
										.add(offSetting,'h')
										.format('YYYY-MM-DD HH:mm:ss');
								 }
							 } else {
								expireDateUTC = message.data.vendorEndDate || null;
							 }

                             pass[id] = message.data.password;
                             Store.update('Passwords', pass);
                             await this.joinRoom(
                                 message.data.range,
                                 message.data.userId,
                                 message.data.userName,
								 message.data.vendor_id,
                                 { id, users: {} },
                                 { type: 'banker', 
									avatar: message.data.avatar, 
									money: message.data.money, 
									isMulti,
									roundCount:0,
									slave: message.data.slave || 'normal',
									expireDateUTC,
									balanceBet }
                             );
                             this.io.emit('data', XPacket.send({
                                 eventName: 'create_room',
                                 data: {
                                   id,
                                   banker: {user_id: message.data.userId, user_name: message.data.userName},
                                   users: 0,
                                   password: message.data.password,
                                   avatar: message.data.avatar,
					slave: message.data.slave || 'normal',
								   expireDateUTC,
								   isMulti,
								   roundCount:0,
								   balanceBet,
                                   money: message.data.money
                                 }
                             }));
							 socket.lobbyRoomId = message.data.roomId;
							 res(true);
                             break;
						 case 'get_room_bet_info': 
							 [totalBets, totalBetCount, totalUsers, betData] = await this.getJunketRoomBets(message.token);
							 res( {totalBets, totalBetCount, totalUsers, betData} );
						 break;
						 case 'get_junket_room' : 
							  if(!message || !message.token){
								  res('no data sent');
							  }
							  res( await this.getJunketRoom ( message.token ) );
						 case 'get_vendor_junket_room' : 
							  if(!message || !message.vendor){
								  res('no data sent');
							  }
							  res( await this.getJunketRoomByVendor ( message.vendor ) );
						 break;
                         case 'join_room':
                             let ns = await Store.scan(`*|${message.data.token}:*`);
							 if (!ns || !ns[1].length) {
                                 res('invalid room');
                                 return;
                             }

                             let maxUsers = parseInt(ns[1][0].split(':').pop() || 0);

                             let users = Store.buildKeyValue((await Store.hscan(ns[1][0], 0, '*'))[1]);

                             if (maxUsers <= _.size(users)) {
                                res('Room is full');
                                return;
                             }

							 // SEACH USERS IF JOINING USER IS A BANKER TYPE

							 let currentBanker = _.findKey(_.mapValues(users,r=>JSON.parse(r)), { type:'banker' }).split(':')[0];

							 if(message && message.data && currentBanker == message.data.userId){
								 // all players will not be kick
								 users = _.mapValues(_.each(_.mapValues(users,r=>JSON.parse(r)),u=>{
									u.remove = (u.type && u.type=="banker")?false:u.remove;
								 }),e=>JSON.stringify(e));
								 await Store.update(ns[1][0], users);
							 } else {
								this.joinRoom(
									 message.data.range,
									 message.data.userId,
									 message.data.userName,
									 message.data.vendor_id,
									 { id: ns[1][0], users },
									 { avatar: message.data.avatar, socketId: socket.id }
								);
							 }
							 if(this.io) {
									let usercounter = _.size(users);
									this.io.emit('data', XPacket.send({
									  eventName:'room_user_count',
									  gameName: message.data.gameName,
									  roomId : message.data.roomId,
									  userCount : usercounter
									}));
							  }
                             break;
						 case 'join_junket_room':
							if(!message.data.token){
								res('no token');
								return;
							}
							console.log('joining_junket ===>',message);
							socket.userId = `${message.data.userId}:${message.data.userName}`;
							let jns = await Store.scan(`*${message.data.token}*`);
							if(!jns || !jns[1] || !jns[1][0]){
								res('room not found');
								return;
							}
							let joinedRoom = {};
							let jusers = Store.buildKeyValue((await Store.hscan(jns[1][0], 0, '*'))[1]);
							if(!(jusers && jusers[socket.userId] && JSON.parse(jusers[socket.userId]).type == 'banker')){
							
									/*res({
										id: jns[1][0],
										users:await this.getJunketRoomMates(message.data.token)
									});
									return;*/
								let jroom = { id: jns[1][0], users:jusers };
								joinedRoom = await this.joinRoom(
									 message.data.range,
									 message.data.userId,
									 message.data.userName,
									 message.data.vendor_id,
									 jroom,
									 //{money: message.data.money}
									{money: message.data.money,expireDateUTC:message.data.vendorEndDate || null}
								 );

								 if(!joinedRoom){
									res('error on joined room');
									return;
								 }
							 } else {
								 joinedRoom = {
										id: jns[1][0],
										users:await this.getJunketRoomMates(message.data.token)
									};
							 }
							socket.roomId = jns[1][0];
							joinedRoom.roomId = jns[1][0];
							io.adapter.remoteJoin(socket.id, socket.roomId, (error) => {
						
								 if(error){
								 	res(error);
								 		return;
								 }
								let yusir = _.chain(Object.values(jusers))
                       								 .map(JSON.parse)
													.remove(u=>!u.type)
                        							 .filter(['remove',false])
                        							 .size();
								if(this.allSocket && message && message.data && message.data.token){
								 this.allSocket.io.emit('data',
									 XPacket.send({
										 eventName:'junket_joiners',
										 type: 'join', 
										 id: message.data.userId, 
										 data: {
											 name: message.data.userName,
											 userId: message.data.userId,
											 token: message.data.token, 
											 money: message.data.money,
											 users: yusir?yusir+1:0,
											 bets: []//room.users[socket.userId] ? 1 : []
										 }
									})
								 );
							
							 socket.to(joinedRoom.roomId).emit('multi-player',
								 XPacket.send({eventName:'junket_joiners',type: 'join', id: message.data.userId, data: {
									 name: message.data.userName,
									 userId: message.data.userId,
									 token: message.data.token, 
									 money: message.data.money,
									 users: _.keys(jusers).length-1,
									 bets: []//room.users[socket.userId] ? 1 : []
								 }})
							 );
							 res(joinedRoom);
							 return;
								}
							});
						 break;
                         case 'room':

                             socket.userId = `${message.data.userId}:${message.data.userName}`;
                             let temp = {};
                             let token = message.data.token || null;
                             let room = {};
                             let normal = false;
                             let nss = null;
                             let roomTemp = null;
                             if (token) {
                                 let ns = await Store.scan(`*|${message.data.token}:*`);
                                 nss = ns;
								 if(!ns)
									 return;
								 let users = Store.buildKeyValue((await Store.hscan(ns[1][0], 0, '*'))[1]);
								 room = { id: ns[1][0], users };
								 roomTemp = room;
                                 normal = !users[socket.userId];
                                 socket.banker = room.users[socket.userId]
                                   ? room.users[socket.userId].type === 'banker'
                                   : false;
                             }

                             if (!token || normal) {
                                 room = await this.joinRoom(
                                     message.data.range,
                                     message.data.userId,
                                     message.data.userName,
				     message.data.vendor_id,
				     null,
				     {expireDateUTC:message.data.vendorEndDate || null}
                                 );
                                 if(nss && nss[1])
                                     room.id = nss[1][0];
                             }

                             socket.roomId = room.id;
                             io.adapter.remoteJoin(socket.id, socket.roomId, (error) => {
								 if (error) {
									return;
								 }
								 temp.roomates = [];
									
								 socket.to(_.trim(socket.roomId)).emit('multi-player',
									 XPacket.send({type: 'join', id: message.data.userId, data: {
										 name: message.data.userName,
										 userId: message.data.userId,
										 bets: []//room.users[socket.userId] ? 1 : []
									 }})
								 );
								 this.allSocket.io.emit('data',
									 XPacket.send({eventName:'roomer',type: 'join', id: message.data.userId, data: {
										 name: message.data.userName,
										 userId: message.data.userId,
										 bets: []//room.users[socket.userId] ? 1 : []
									 }})
								 );
								 if(roomTemp){
								  for (const key in roomTemp.users) {
									 if (!roomTemp.users.hasOwnProperty(key)) {
										 continue;
									 }

									 roomTemp.users[key] = JSON.parse(roomTemp.users[key]);
									 temp.roomates.push(roomTemp.users[key])
								  }
								 }else{
									for (const key in room.users) {
										 if (!room.users.hasOwnProperty(key)) {
											 continue;
										 }

										 room.users[key] = JSON.parse(room.users[key]);
										 temp.roomates.push(room.users[key])
									}

								 }
                                 if (res) res(temp);
                             });
                             break ;
                         case 'kick':
                             let kns = await Store.scan(`*|${message.data.token}:*`);
                             if (!kns[1].length) {
                                return ;
                             }
							
                             socket.to(kns[1][0]).emit('multi-player',
                                 XPacket.send({
                                     type: 'kick',
                                      data: {
                                          id: message.data.userId ,
                                          user_name: message.data.userName
                                      }
                                 })
                             );
                         break;
						 case 'update_banker_credits':	
						 let name = message.gameName + '/' + message.tableId;						
			             // hardcoded since sicbo only uses room features '
			             await Store.update(name , {										
								roomBets: {}
						          });
                         try {
                             let r_temp = await Store.scan(`*|${message.token}:*`);
                             if (!r_temp[1].length) {
                                 return;
                             }
                             let uKey = `${message.userId}:${message.userName}`;
							 if(!r_temp)
								 return;
                             let bc_temp = Store.buildKeyValue((await Store.hscan(r_temp[1][0], 0, uKey))[1]);

                             if (!_.size(bc_temp)) {
                                return;
                             }

                             bc_temp[uKey] = JSON.parse(bc_temp[uKey]);
                             bc_temp[uKey].money = message.money;

                             await Store.update(r_temp[0], bc_temp);
                             this.io.emit('data',
                                  XPacket.send({
                                      eventName: 'update_banker_credits',
									  gameName: message.gameName,
                                      data: {					 
                                          token: message.token,
                                          money: message.money
                                      }
                                  })
                             );
                          } catch (error) {
                              console.log(error)
                          }
                         break;

						 case 'roombet':
							let betSum = 0;
							Store.getAllUnserialized(namespace).then((storeData) => {
								this.roomBets = storeData.roomBets;
								if(this.roomBets[message.roomId]){
									 let cnt = 0;
									 let finder =  _.find(this.roomBets[message.roomId],u=>u.user==message.userId);
									 if(finder){
											 _.each(this.roomBets[message.roomId],u => {
													 u.data = (u.user == message.userId)?message.data:u.data;
											 });
									 } else {
											 this.roomBets[message.roomId].push({
													 user : message.userId,
													 data : message.data
											 });
									 }
								 } else {
									 let partialObj = JSON.parse('{ "'+message.roomId+'": [] }');
									 partialObj[message.roomId].push({
											 user : message.userId,
											 data : message.data
									 });
									 this.roomBets = _.assign(partialObj,this.roomBets);
								 }
									_.each( this.roomBets[message.roomId], user=>{
											betSum += _.sumBy(user.data,amt=>amt.amount*amt.dividend);
									} );
									Store.update(namespace, {
											roomBets : this.roomBets
									});
									res({ total : betSum, bankerMoney: message.bankerMoney });
							});
                          break ;

                          case 'bet':
                          case 'cancel':
                             let betParent = message.gameName
                               ? {tableId:message.tableId, gameName: message.gameName,roundNum:message.roundNum}
                               : null;
                             await this.updateBettingStates(message.data, message.eventName, socket, betParent);
                             this.betsPass(socket, betParent);
                             break ;

                          case 'init':
                             socket.userId = message.data.userId;
                          break;
						  case 'edit-bet-range':
							if (!message || !message.oldRange || !message.userId) {
								res(false);
								return;
							}
							let ra   = await Store.scan(`Rooms:${this.namespace}:Auto:${message.oldRange}:*`, 0);
							if(!ra || !ra.length){
								res(false);
								return;
							}
							let u  = await Store.hscan(ra[1][0], 0, '*');
							if(!u || !u.length){
								res(false);
								return;
							}
							let m = Store.buildKeyValue(u[1]);
							await Store.hdel(ra[1][0], _.find(_.keys(m),v=>v.indexOf(message.userId)>= 0));
							
							socket.to(socket.roomId).emit('multi-player',
							   XPacket.send({
								type: 'leave',
								//users: m.length-1,
								data: { id: message.userId }
							}));
							res(true);
						 break;
						 case 'junket-update-money':
						 if (!message || !message.token || !message.userId) {
							res(false);
							return;
						 }
						 return(await this.getJunketUserRooms(message));
						 break;
                     }

                     if (this.namespace !== 'managers' && this.namespace !== 'all') {
                         this.emitRoomDataToManagers();
                     }
                 });

                 // remove from room if user disconnects
                 socket.on('disconnect', async () => {
                     if (this.namespace === 'all' || this.namespace === 'managers') {
                        return;
                     }

                     if (!socket.roomId || !socket.userId) {
                        return;
                     }
                     let user = await Store.hscan(socket.roomId, 0, socket.userId);
                     let userInfo = Store.buildKeyValue(user[1]);
                     let splitRoom = socket.roomId.split(':');
                     let splitUser = socket.userId.split(':');
                     if (!userInfo[socket.userId]) {
                         return;
                     }
                     let data = {};
                     data[ socket.userId ] = JSON.parse( userInfo[ socket.userId ] );
					 if( !( data[ socket.userId ].type == 'banker' && socket.roomId.indexOf( 'junket' ) > 0 ) )
						data[socket.userId].remove = true;
                     await Store.update( socket.roomId, data );
                     this.roomSocket = socket;
                     this.emitRoomDataToManagers();
			let jtoken = null;
				if(socket.roomId.indexOf('|junket|')>0)
					jtoken = socket.roomId.split('|')[socket.roomId.split('|').length-1].split(':')[0];
			             if(data[socket.userId].type !== 'banker'){
				let usersize = await this.getJunketUsersByRoomId(socket.roomId);
							
				 this.allSocket.io.emit('data', XPacket.send({
								eventName: 'room_player_left',
								data: { id : socket.roomId,
									token: jtoken,
									roomId : splitRoom[splitRoom.length-1],
									//users: (usersize)?(usersize.length-1):null,
									 users: (usersize)?usersize-1:null
									 },
							 }));
							 
							 socket.to(socket.roomId).emit('multi-player',
							   XPacket.send({
								type: 'leave',
								data: { id: socket.userId.split(':')[0], users:(usersize)?usersize-1:null}
							   })
							 );
						 }
                 });
             });
         },

          /**
         * @method getJunketUserRooms
         */
		 async getJunketUserRooms(message){
				let jkroom   = await Store.scan(`*${message.token}*`, 0);
			
				if(!jkroom || !jkroom.length){
					res(false);
					return;
				}
				let ju  = await Store.hscan(jkroom[1][0], 0, '*');
				if(!ju || !ju.length){
					res(false);
					return;
				}
				let jm = Store.buildKeyValue(ju[1]);
				let userfound = _.find(_.keys(jm),v=>v.indexOf(message.userId)>= 0);
				if(!userfound){
					return false;
				} 
				let partialData = JSON.parse(jm[userfound]);
				partialData['money'] = message.money;
				jm[userfound] = partialData;
				await Store.update( jkroom[1][0], jm );
				return userfound;
		 },


		async getJunketUsersByRoomId(roomid){
			 if(roomid.indexOf( 'junket' ) < 0){
			 	return 0;
			 } else {
				//console.log('--- ',roomid);
			}
			 let jkroom   = await Store.scan(`${roomid}`, 0);

				if(!jkroom || !jkroom.length){
					res(false);
					return;
				}
				let ju  = await Store.hscan(jkroom[1][0], 0, '*');
				if(!ju || !ju.length){
					res(false);
					return;
				}
				let jm = Store.buildKeyValue(ju[1]);
				let uSize = _.chain(Object.values(jm))
                        			.map(JSON.parse)
                        			.filter(['remove',false])
                        			.size();
				return uSize;
				//let userfound = _.find(_.keys(jm),v=>v.indexOf(message.userId)>= 0);
				//if(!userfound){
				//	return false;
				//} 
				//let partialData = JSON.parse(jm[userfound]);
				//partialData['money'] = message.money;
				//jm[userfound] = partialData;
				//await Store.update( jkroom[1][0], jm );
				//return userfound;
		 },


		 /**
		 * @method getJunketRoomByVendor()
		 * @param vendor id
		 */
		 async getJunketRoomByVendor(v){
			let rooms = await Store.scan(`Rooms:*:${v}|*|*|junket|*`);
			if(!rooms || !rooms.length || !rooms[1] || !rooms[1].length)
				return false;
			let passwords = Store.buildKeyValue((await Store.hscan('Passwords', 0, '*'))[1]);
			let temp = {};
			let t = '', tid = 0;
            try {
                for (let i = 0; i < rooms[1].length; i++) {
                    let users = Store.buildKeyValue((await Store.hscan(rooms[1][i], 0, '*'))[1]);

                    let uSize = _.chain(Object.values(users))
                        .map(JSON.parse)
                        .filter(['remove',false])
                        .size();

                    let banker = _.chain(Object.values(users))
                        .map(JSON.parse)
                        .find(['type', 'banker'])
                        .value();
					if(!banker) continue;
					let roomSplitted   = rooms[1][i].split('|');
					let gameTableId    = tid = roomSplitted[0].split(':')[1];
					let gameTableName  = t = roomSplitted[2];

					let gameTableToken = roomSplitted[4].split(':')[0];
					let flippers = await this.getRoomHighestBettingUsers(gameTableToken);
					let seatMates = await this.getJunketRoomMates(gameTableToken);
                    temp[rooms[1][i]] = {
                        banker: {user_id: banker.userId, user_name: banker.userName},
                        money: banker.money,
						roundCount: banker.roundCount,
						isMulti : banker.isMulti,
						seatMates,
						slave : banker.slave || "normal",
						expireDateUTC : banker.expireDateUTC,
                        users: seatMates.length-1,
                        password: passwords[rooms[1][i]],
                        balance: banker.balanceBet,
                        avatar: banker.avatar,
						flippers
                    }
                }
				//await worker.namespaces[`${t}/${tid}`].getJunketUserRooms({userId:3071,token:'1859563f-4c22-11e8-9306-00155d063d02',money:15000});
            } catch (error) {console.log(error)}
            return temp;
		 },
		/**
		* @method disbandRoom		 
		*/
		async disbandRoom(token){
			if(!token) return;
			let sprite = await Store.scan(`*${token}:*`);

			if(!sprite || !sprite.length || !sprite[1].length)
				return {error:true,message:'room is undefined'};

			let key = sprite[1][0];
			let editedUsers = await this.getAndRemoveRoomBanker(key);

			if(!editedUsers) return {error:true,message:'banker not found'};
			await Store.update(key,editedUsers);

			return {error:false,message:'success disband'};
		},

		/**
		 * @info should mark users who should be kicked on new round on current room disabled
         * @method disbandRoom
         */
        async disableRoom(vendor_id, gameName, tableId, socket){
            if(!vendor_id) return {error:true,message:'vendor_id null'};
            let rooms = await Store.scan(`Rooms:${gameName + '/' + tableId}:Auto:*`, 0);

            if(!rooms || !rooms.length || !rooms[1].length)
                return {error:true,message:'room is undefined'};

			for (let i = 0; i < rooms[1].length; i++) {
				let users = await Store.hscan(rooms[1][i], 0, '*', 100);
				let socketIds = [];
				users = Store.buildKeyValue(users[1]);

				// update user values with disabled rooms
				for (const key in users){
					let value = JSON.parse(users[key]);
					if (parseInt(value.vendor_id) !== parseInt(vendor_id)) continue;

					value.remove = true;
					users[key] = value;

					// get socketIds of all users that will be removed
					let userAll = await Store.hscan('all', 0, `*:${value.userId}:*`);
					if (!userAll[1].length) return {error:true,message:'user cant find'};;

					socketIds.push((userAll[1].length > 1)?userAll[1][userAll[1].length-2].split('#')[1]:userAll[1][1].split('#')[1]);
				}

				await Store.update(rooms[1][i], users);
				// send events to removed users
				this.allSocket.io.emit('data',XPacket.send({eventName:'dsiable_room'}));
				socketIds.forEach((socketId)=>{
					socket.to('/all#'+socketId).emit('data',
							XPacket.send({
								eventName : 'disable_room'
							})
					);
				});
			}
            return {error:false,message:'success disableRoom'};
        },

		/**
		* @method getAndRemoveRoomBanker		 
		*/
		async getAndRemoveRoomBanker(key){
			let usersFetched = _.mapValues(Store.buildKeyValue((await Store.hscan(key, 0, '*'))[1]),r=>JSON.parse(r));

			if(!usersFetched) return false;

			let bankerKey = _.findKey(usersFetched, { type:'banker' });
			let bankerVal = _.find(usersFetched, { type:'banker' });

			bankerVal.remove        = true;
			usersFetched[bankerKey] = bankerVal;
			return usersFetched;
		},

		  /**
         * @method emitRoomDataToManagers
         *
         * @desc Emit to managers page channel
         * Pass data to managers socket io channel through passed socket io instance
         *
         * @memberof Namespace
         */
        emitRoomDataToManagers (data) {
            if (!this.managerSocket) {
                return ;
            }

            if (!data) {
                let temp = {
                    eventName: 'room',
                    data: {}
                };

                this.generate().then((storeData) => {
                    temp.data = storeData;
                    this.managerSocket.io.emit('data', XPacket.send(temp));
                });

                return ;
            }

            switch (data.eventName) {
                case 'autonextround':
                case 'setbettingtime':
                case 'gettables':
                    break;
                default:
                    this.managerSocket.io.emit('data', XPacket.send(data));
                    break;
            }
        },

        /**
         * @method updateBettingStates
         *
         * @desc Update properties holding values
         *
			s.roomSocket.push(socket);        * @memberof Namespaces
         */
        async updateBettingStates (data, type, socket, betParent = null) {
			if(!socket.roomId){
				return false;
			}
            let user = await Store.hscan(socket.roomId, 0, socket.userId);
            let userInfo = {};
            let jsonData = {};
            try {
                jsonData = JSON.parse(user[1][1]);
            } catch (error) {console.log(error);}


            if (!user[1].length) {
				return false;
            }
            jsonData['bets'] = type === 'bet' ? data : [];
            userInfo[user[1][0]] = jsonData;
            await Store.update(socket.roomId, userInfo);
//this.io.of(this.namespace).to(socket.roomId).emit('multi-player', XPacket.send({ id: jsonData.userId,type, data: data, shinji:1 }));
			//this.io.in(socket.roomId).emit('multi-player', XPacket.send({ id: jsonData.userId,type, data: data}));
            socket.to(socket.roomId).emit('multi-player', XPacket.send({ id: jsonData.userId,type, data: data }));
            this.emitRoomDataToManagers();
        },
	    /**
         * @method resetJunketRoomsBettingStates
         *
         * @desc Reset values
         * Reset bet and winning values in the dictionary, this happens when the game enters a new round
         */
        async resetJunketRoomsBettingStates () {
			[ junketGameName, junketTableId ] = this.namespace.split('/');
            let rooms = await Store.scan(`Rooms:${junketTableId}:*|*|${junketGameName}|junket|*`, 0);

            // iterate through all namespaces
            for (let i = 0; i < rooms[1].length; i++) {
                let users = await Store.hscan(rooms[1][i], 0, '*', 100);
                let remove = [];
                users = Store.buildKeyValue(users[1]);

                // update user values
                _.each(users, (value, key) => {
                    value = JSON.parse(value);
                    if (value.remove) {
                        remove.push(key);
                        return;
                    }
                    value.bets = [];
                    users[key] = value;
                });

                await Store.update(rooms[1][i], users);
                if (remove.length) {
                    await  Store.hdel(rooms[1][i], remove);
                }
            }
        },
        /**
         * @method resetBettingStates
         *
         * @desc Reset values
         * Reset bet and winning values in the dictionary, this happens when the game enters a new round
         */
        async resetBettingStates () {
            let rooms = await Store.scan(`Rooms:${this.namespace}:*:*`, 0);
            // iterate through all namespaces
            for (let i = 0; i < rooms[1].length; i++) {
                let users = await Store.hscan(rooms[1][i], 0, '*', 100);
                let remove = [];
                users = Store.buildKeyValue(users[1]);

                // update user values
                _.each(users, (value, key) => {
                    value = JSON.parse(value);
                    if (value.remove) {
                        remove.push(key);
                        return;
                    }
                    value.bets = [];
                    users[key] = value;
                });

                await Store.update(rooms[1][i], users);
                if (remove.length) {
                    await  Store.hdel(rooms[1][i], remove);
                }
            }
        },
		/**
         * @method removeAllRooms
         *
         */
        async removeAllRooms () {
			let rs = await Store.scan(`Rooms*`);
			if(rs && rs.length && rs[1])
				_.each(rs[1], r=>{
					if(r.indexOf( 'junket' ) < 0) {
						Store.del(r);
						Store.hdel('Passwords',r);
					}
				});
		},
		/**
         * @method getRoomHighestBettingUsers
         *
         * @desc gets banker and player hands highest betting users.
         *
         * @memberof Namespace
         */
        async getRoomHighestBettingUsers (token) {

            let rooms = await Store.scan(`*|${token}:*`);
			let bankerBetsArray = [];
			let playerBetsArray = [];

			if(!rooms || !rooms.length || !rooms[1] || !rooms[1].length || !rooms[1][0])
				return;

                let users = Store.buildKeyValue((await Store.hscan(rooms[1][0], 0, '*'))[1]);
				if(!users || _.isEmpty(users))
					return;

			    _.each(users,u=>{
					let user = JSON.parse(u);
					let f = _.find(user.bets,b=>b.bet=='banker');
					let p = _.find(user.bets,b=>b.bet=='player');
					if (f){
						bankerBetsArray.push({
							userId  : user.userId,
							joinDate: user.joinDate,
							bet     : f.bet_amount
						});
					}
					if (p){
						playerBetsArray.push({
							userId  : user.userId,
							joinDate: user.joinDate,
							bet     : p.bet_amount
						});
					}
				});
				let _banker = _.orderBy(bankerBetsArray,['bet','joinDate'],['desc']) || [];
				let _player = _.orderBy(playerBetsArray,['bet'],['desc']) || [];

				return {
					banker : (_banker.length)?_.pick(_banker[0],['userId']).userId:[],
					player : (_player.length)?_.pick(_player[0],['userId']).userId:[]
				};
        },
		/**
         * @method removeDisconnectedUsers
         *
         * for feature sicbo rooms: removes all disconnected users in the room
		 * this function is a special case intended for sicbo's room feature only.
         */
        async removeDisconnectedUsers (forAuto) {
			let name = this.namespace.split('/')[0];
			let table = this.namespace.split('/')[1];
			if(name !== 'Sicbo' && name !== 'Pai-Gow' && name !== 'Baccarat' && name !== 'Dragon-Tiger')
				return;
	        let now = moment().utc().format('YYYY-MM-DD HH:mm:ss');

			//let rooms = await Store.scan(`Rooms:${table}:*|*|${name}|*`,0);
		let roomKey = (!forAuto)? `Rooms:${table}:*|*|${name}|*` : `Rooms:${name}/${table}:*`;
			
				let rooms = await Store.scan(roomKey,0);
            // iterate through all namespaces
            for (let i = 0; i < rooms[1].length; i++) {
                let users = await Store.hscan(rooms[1][i], 0, '*', 100);
		let vendorExpired = false;
                let remove = [];
				let removeRooms = [];
				let vendor_id = "";
                users = Store.buildKeyValue(users[1]);

                // update user values
                _.each(users, (value, key) => {		
                    value = JSON.parse(value);
					if( value.type == 'banker' ){
						value.roundCount++;
					}
                    if (value.remove || ( value.expireDateUTC && moment(now).isSameOrAfter(value.expireDateUTC) )) {
						
						remove.push(key);
						if(value.type == 'banker'){
							vendorExpired = ( moment(now).isSameOrAfter(value.expireDateUTC) );
							removeRooms.push( rooms[1][i] );
							let splitRoom = rooms[1][i].split(':');
							let splitUser = key.split(':');
							if(!forAuto){ 
							this.pub.publish("socket-servers", JSON.stringify({
								gameType : name.toLowerCase().replace('-',''),
								gameName : name,
								roomId : parseInt(splitRoom[splitRoom.length-1]),
								userId : parseInt(splitUser[0]),
								tableId : parseInt(table),
								vendorId : value.vendor_id,
								type : (rooms[1][i].indexOf('junket') > -1)?'J':'R'
							}));
							}
						}
                        return;
                    }

                    value.bets = [];
                    users[key] = value;
                });

                await Store.update(rooms[1][i], users);
                if (remove.length) {
                    await  Store.hdel(rooms[1][i], remove);
					await  Store.hdel('Passwords', rooms[1][i]);
			//if(!forAuto){
		    		_.each(remove,key=>{
						let splitu = key.split(':');
						console.log('leaving user ==>', splitu);
						this.io.to(rooms[1][i]).emit('multi-player',
							XPacket.send({
								type: 'leave',
								data: { id: parseInt(splitu[0]),users:1 }
							})
						);
				});
			//}
                }
				if (removeRooms.length && !forAuto) {
					
					this.io.to(rooms[1][i]).emit('multi-player',
						XPacket.send({
							type: 'kick_all',
							vendorExpired,
							gameName: name,
							data: { id: rooms[1][i] }
						})
					);
					this.io.emit('data', XPacket.send({
						eventName: 'remove_room',
						vendorExpired,
						gameName: name,
						data: { roomId: rooms[1][i] }
					}));
					this.allSocket.io.emit('data', XPacket.send({
						eventName: 'remove_room',
						vendorExpired,
						gameName: name,
						data: { roomId: rooms[1][i] }
					}));

					await  Store.del(rooms[1][i]);
                		}
            }

        },
        /**
         * @method emitter
         *
         * @desc Emit data to clients.
         * Pass on data to clients currently connected to namespace
         *
         * @param {*} data data to be emitted to client socket listeners
         * @memberof Namespace
         */
        emitter (data) {
            let processedData = _.pickBy(data, (v, k) => {
                return k !== "gameName";
            });

            let promise = this.update(data);
	
            if (data && allSocket) {
                // send game data and events to users
                this.io.emit('push', XPacket.send(processedData));
                // send game data to managers page
                this.allSocket.io.emit('data', XPacket.send(data));
            }

            if (data.eventName !== 'setbettingtime') {
                promise.then(() => {
                    this.emitRoomDataToManagers();
                }).catch((error) => {
                    console.log(`An error occurred @ ${namespace}`, error)
                });
            }
        },

        /**
         * @method publish
         *
         * @desc Emit to redis publisher client
         *
         * @param {String} event event name
         * @param {Object} data data to be passed
         * @memberof Namespace
         */
        publish (event, data) {
            data.processId = process.pid;
            this.pub.publish(event, JSON.stringify(data));
        },

        /**
         * @method update
         *
         * @desc Update current namespace state based on the events passed by the game servers
         *
         * @param {Object} data data passed from socket servers
         */
        async update (data) {
            if (!data.eventName) {
                return;
            }

            switch (data.eventName.toLowerCase()) {
                case 'newround':
					await this.removeDisconnectedUsers(true);
					await this.removeDisconnectedUsers(false);
					await this.resetBettingStates();
					await this.resetJunketRoomsBettingStates();

                    return Store.update(namespace, Object.assign({
                        gameInfo: {},
                        roundStatus: data.status,
                        totalWins: 0,
                        gameResult: {},
                        currentRound: data.roundNum
                    }, gameName == 'Baccarat' ? {shoeBurnCard : ''} : {}));

                case 'setroundprogress':
                case 'setroundhold':
                    return Store.update(namespace, {
                        roundStatus: data.status,
                        currentRound: data.roundNum
                    });

                case 'shoeburncard':
                    return Store.update(namespace, {
                        shoeBurnCard: data.value
                    });

                case 'shoechange':
					await this.removeDisconnectedUsers(false);
					await this.removeDisconnectedUsers(true);
                    return Store.update(namespace, {
                        gameMarks: [],
						gameInfo:{}
                    });

                case 'dealerchange':
                    return Store.update(namespace, {
                        currentDealer: data.dealerName,
                        dealerId : data.dealerId,
                        dealerImage: data.dealerImage,
                        tableImage: data.tableImage
                    });

                case 'inputitem':
                    return Store.update(namespace, Object.assign({
                        gameInfo: data.gameInfo,
                        currentRound: data.roundNum,
                        gameResult: {}
                    }, gameName == 'Baccarat' ? {shoeBurnCard : ''} : {}));

                case 'removeitem':
                    return Store.update(namespace, {
                        gameInfo: data.gameInfo
                    });

                case 'displayresult':
                case 'displayresults':
                    return Store.getAllUnserialized(namespace).then((storeData) => {
                        if (storeData.gameMarks.length >= (gameName == 'Pai-Gow' ? 5 : 150)) {
                            storeData.gameMarks.shift();
                        }

                        try {
                            storeData.gameMarks.push(data.mark);
                        }
                        catch (error) {
                            console.log(error, storeData.gameMarks);
                        }

                        return Store.update(namespace, Object.assign({
                            gameMarks: storeData.gameMarks,
                            roundStatus: data.status,
                            meta: data.meta || {},
                            gameResult: data.gameResult,
                            totalWins: data.totalWinning
                        }, gameName == 'Baccarat' ? {shoeBurnCard : ''} : {}));
                    });


                case 'maintenancechange':
                    let temp = {};

                    return Store.getAllUnserialized(namespace).then((storeData) => {
                        temp.status = data.data.status;
                        temp.start_time = data.data.start_date;
                        temp.end_time = data.data.end_date;
                        if(data.gameName == 'Baccarat' || data.gameName == 'Poker'){
                            _.each(storeData.maintenanceSetting.maintenance,m=>{
                                if(m.type==data.data.slave || (m.type=='normal' && data.data.slave=='flippy') || data.data.slave=='all'){
                                    m.info[data.data.division == 'Periodic' ? 0 : 1] = data.data;
                                }
                            });
                        } else {
                            storeData.maintenanceSetting[data.data.division == 'Periodic' ? 0 : 1] = data.data;
                            // switch other maintenance setting to zero, if both are disabled then
                            // this should have the same effect
                            storeData.maintenanceSetting[data.data.division == 'Periodic' ? 1 : 0].status = 0;
			                  }
						
                        return Store.update(namespace, {
                            maintenanceSetting: storeData.maintenanceSetting
                        });
                    });

                case 'noticechange':
                    return Store.getAllUnserialized(namespace).then((storeData) => {
                        storeData.noticeSetting = data.data;

                        return Store.update(namespace, {
                            noticeSetting : storeData.noticeSetting
                        });
                    });

				case 'displayrollback':
                case 'displaymodify':
                    return Store.getAllUnserialized(namespace).then((storeData) => {
                        if (data.data.mark instanceof Array) {
                            storeData.gameMarks = this.getRollbackLastMark(data.eventName,data.gameName,data.data.mark);
                        }
                        else if (data.data.mark) {
                            storeData.gameMarks.pop();
                            if(data.gameName == 'sicbo' || data.eventName == 'displaymodify')
								                storeData.gameMarks.push(this.getRollbackLastMark(data.eventName,data.gameName,data.data.mark));
                            }

                        try {
                            data.meta = JSON.parse(data.meta);
                        }
                        catch (error) {}

                        return Store.update(namespace, {
                            gameMarks: storeData.gameMarks,
                            meta: data.meta || []
                        });
                    });

                case 'mainmaintenancechange':
                    return Store.getAllUnserialized(namespace).then((storeData) => {
                        storeData.mainMaintenance = data.data;
                        _.forEach(storeData, (row, index) => {
                            if (!storeData.mainMaintenance || !storeData.mainMaintenance[index]) {
                                return ;
                            }

                            storeData.mainMaintenance[index].status = 0;
                        });
						this.removeAllRooms();
                        return Store.update(namespace, {
                            mainMaintenance: storeData.mainMaintenance
                        });
                    });
				
                case 'mainnoticechange':
                    return Store.getAllUnserialized(namespace).then((storeData) => {
                        storeData.mainNotice = data.data;

                        _.forEach(storeData, (row, index) => {
                            if (!storeData.mainNotice || !storeData.mainNotice[index]) {
                                return ;
                            }

                            storeData.mainNotice[index].status = 0;
                        });

                        return Store.update(namespace, {
                            mainNotice: storeData.mainNotice
                        });
                    });

                case 'setbettingtime':
                    //remove shoeburncard at the start and end of the timer
                    if (gameName == 'Baccarat' && (data.bettingTime == data.totalTime - 1 || data.bettingTime < 1)) {
                        return Store.update(namespace, {
                            shoeBurnCard : ''
                        });
                    }

                default:
                    break;
            }

            return new Promise(() => {
            });
        },

      /**
       *
       * @returns {Promise<*[]>}
       */
        async getRoomInformation () {
            let totalBets = 0;
            let totalBetCount = 0;
            let totalUsers = 0;
            let betData = {};
            let rooms = await Store.scan(`Rooms:${this.namespace}:*`, 0, 10000);
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
        },

        async betsPass(socket,betParent){
            //let betData = {};
			[totalBets, totalBetCount, totalUsers, betData] = await this.getRoomInformation();

			if (!betParent) {
				return;
			}

			this.io.emit('push',XPacket.send({
				eventName:'bets',
				data:betData,
				tableId: betParent.tableId,
				totalBettingUsers:totalBetCount,
				gameName:betParent.gameName
			}));

			if(this.allSocket) {
				this.allSocket.io.emit('data', XPacket.send({
					eventName:'bets',
					data:betData,
					tableId:betParent.tableId,
					gameName:betParent.gameName,
					totalBettingUsers:totalBetCount
				}));
			}
		},

        /**
         * @method generate
         *
         * @desc Generate data for this current namespace's information
         *
         * @returns {{}}
         * @memberof Namespace
         */
        async generate () {
			
            let data = {};
            [totalBets, totalBetCount, totalUsers, betData] = await this.getRoomInformation();

            return Store.getAllUnserialized(namespace).then((storeData) => {
                if(gameName == 'Baccarat') data['shoeBurnCard'] = storeData.shoeBurnCard || '';

                data['totalBets'] = totalBets;
                data['totalWins'] = storeData.totalWins;
                data['totalUsers'] = totalUsers;
                data['totalBettingUsers'] = totalBetCount;
                data['namespace'] = namespace;
                data['gameName'] = gameName;
                data['tableNumber'] = tableNumber;
                data['marks'] = storeData.gameMarks;
                data['type'] = storeData.type;
                data['slave'] = storeData.slave;
                data['shoeNumber'] = storeData.shoeNumber;
                data['currentRound'] = storeData.currentRound;
                data['currentDealer'] = storeData.currentDealer;
                data['dealerId'] = storeData.dealerId;
                data['dealerImage'] = storeData.dealerImage;
                data['tableImage'] = storeData.tableImage;
                data['gameInfo'] = storeData.gameInfo;
                data['gameResult'] = storeData.gameResult;
                data['sportBetRanges'] = storeData.sportBetRanges;
                data['casinoBetRanges'] = storeData.casinoBetRanges;
                data['roomType'] = storeData.roomType;
                data['roundStatus'] = storeData.roundStatus;
                data['maintenanceSetting'] = storeData.maintenanceSetting;
                data['mainMaintenance'] = storeData.mainMaintenance;
				data['betInfo'] = betData;
                data['noticeSetting'] = storeData.noticeSetting;
                data['mainNotice'] = storeData.mainNotice;
                data['userInfo'] = storeData.userInfo;
                data['meta'] = storeData.meta || [];
				data['roomBets'] = {};

                return data;
            });
        },

       /**
		    * @method getRollbackLastMark
		    * @param eName
		    * @param gName
		    * @param mark
		    * @returns {mark}
		    */
		    getRollbackLastMark (eName,gName,mark) {
			      if(eName == 'displaymodify') return mark;

			      gName = gName.toLowerCase();

			      if(gName == 'sicbo'){
				        mark.isVoid = true;
				        mark.game_info.isVoid = true;
			      } else {
				        mark.pop;
			      }
			      return mark;
		    },
		/** 
		    * @method getJunketRoomBets
		    * @param token
		*/
		async getJunketRoomBets (token) {
			let totalBets     = 0;
            let totalBetCount = 0;
            let totalUsers    = 0;
            let betData       = {};
            let rooms         = await Store.scan(`*|${token}:*`);

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
							betData[bet.bet].userList.push(usere);
						} else {
							betData = Object.assign(betData,{[bet.bet]:{
							totalBets : bet.bet_amount || 0 ,
							totalUsers : 1,
							userList : [usere]
							}});
						}
					});

				});
			}
            return [totalBets, totalBetCount, totalUsers, betData];
        },
		/*
			* @method getJunketRoom()
			* @param token
		*/
		async getJunketRoom(token){
			let room = await Store.scan(`*${token}*`);
			let passwords = Store.buildKeyValue((await Store.hscan('Passwords', 0, '*'))[1]);
			let temp = {};
			let t = '', tid = 0;
			if(!room || !room[1] || !room[1].length)
				return;
			let roomTitle = room[1][0];
			let users = Store.buildKeyValue((await Store.hscan(roomTitle, 0, '*'))[1]);
			
			let banker = _.chain(Object.values(users))
				.map(JSON.parse)
				.find(['type', 'banker'])
				.value();
				
			let flippers = await this.getRoomHighestBettingUsers(token);
			let seatMates = await this.getJunketRoomMates(token);
			//let junketRoomBetInfo = await this.getJunketRoomBets(token);
			[jtotalBets, jtotalBetCount, jtotalUsers, jbetData] = await this.getJunketRoomBets(token);
			temp[roomTitle] = {
				banker: {user_id: banker.userId, user_name: banker.userName},
				money: banker.money,
				isMulti : banker.isMulti,
				seatMates,
				users: seatMates.length - 1,
				slave: banker.slave || "normal",
				expireDateUTC : banker.expireDateUTC,
				password: passwords[roomTitle],
				avatar: banker.avatar,
                balance: banker.balanceBet,
				betInfo: {
					totalBets : jtotalBets, 
					totalBetCount: jtotalBetCount,
					totalUsers: jtotalUsers, 
					totalUsers : jbetData
				},
				flippers
			};
			return temp;
		},
        /**
         * @method disconnect
         *
         * @desc clean up socket connection and disconnect
         * @memberof Namespace
         */
        disconnect () {
            let connected = _.keys(this.io.connected);
            // disconnect all users connected
            connected.forEach((socketId) => {
                this.io.connected[socketId].disconnect();
            });

            this.io.removeAllListeners();
            console.log(`Listener registered: PID > ${process.pid} | Namespace ${this.namespace} Removed`);
        }
    };

    ns.registerListeners();

    return ns;
};

module.exports = Namespace;
