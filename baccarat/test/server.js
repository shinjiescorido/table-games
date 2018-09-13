'use strict';
const should  = require('should');
const services      = require('../modules/services');

describe("Services Module", ()=>{

	describe("fnFetchMarks", ()=>{
		it('should return and object of marks', (done)=>{
			services.fnFetchMarks()
			.then(data=>{
				data.should.be.type('object');
				done();
			});			
		});
	});

	
	 		
});
	
/*	
	it('should return current round of table on event \'init\'', (done)=>{
		 client1.on('connect', datas=>{
		 	client1.emit('push',Xpacket.received({event:'init',data:choseTable}),(data)=>{
				data.should.have.property('roundId');
				data.should.have.property('dealer');
				data.should.have.property('status');
				data.should.have.property('table');
				done();
			});
		 });
	});

	it('should able to check card type on event \'checkifdealer\'', (done)=>{
		 client1.on('connect', datas=>{
		 	client1.emit('push',Xpacket.received({ data:'D0088', event: 'checkifdealer' }),(data)=>{
				data.should.equal('dealers');
				done();
			});
		 });
	});

	it('should register dragon card on event \'scancard\'', (done)=>{
		let obj = {
			event : 'scancard',
			value : '0000',
			from : 'dragon'
		};

		 client1.on('connect', datas=>{
		 	client1.emit('push',Xpacket.send(obj),(data)=>{
		 		data.card.suite.should.equal(1);
		 		'false'.should.be.empty;
				// data.type.should.equal('dragon');
				done();
			});
		 });
		 
	});
*/

