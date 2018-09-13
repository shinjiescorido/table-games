var should = require('should');
var io = require('socket.io-client');

var socketURL = 'http://127.0.0.1:8007/';

var options = {
	transports : ['websocket'],
	'force new connection' : true
};

describe("get  tables", ()=>{
	it('should return table list', (done)=>{
		 var client1 = io.connect(socketURL, options);

		 client1.on('connect', data=>{
		 	client1.emit('push',{event:'gettables'},(data)=>{
				should(data).have.property('tables');
				done();
			});
		 });
	});
});

