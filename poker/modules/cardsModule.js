'use strict';

	/*
	|--------------------------------------------------------------------------
	| cardsModule v1.0
	|--------------------------------------------------------------------------
	| Author : Shinji Escorido
	| This module returns the card object 
	| receiving the card id as argument
	|
	*/
const _ = require('lodash');
const cards = {
		// clubs
		'0000': { suite : 'club',name:'AC', value : 1, code: '0000'},
		'0001': { suite : 'club',name:'2C', value : 2, code: '0001'},
		'0002': { suite : 'club',name:'3C', value : 3, code: '0002'},
		'0003': { suite : 'club',name:'4C', value : 4, code: '0003'},
		'0004': { suite : 'club',name:'5C', value : 5, code: '0004'},
		'0005': { suite : 'club',name:'6C', value : 6, code: '0005'},
		'0006': { suite : 'club',name:'7C', value : 7, code: '0006'},
		'0007': { suite : 'club',name:'8C', value : 8, code: '0007'},
		'0008': { suite : 'club',name:'9C', value : 9, code: '0008'},
		'0009': { suite : 'club',name:'TC', value : 10, code: '0009'},
		'0010': { suite : 'club',name:'JC', value : 11, code: '0010'},
		'0011': { suite : 'club',name:'QC', value : 12, code: '0011'},
		'0012': { suite : 'club',name:'KC',value : 13, code: '0012'},
		// hearts
		'0013': { suite : 'heart',name:'AH',value : 1, code: '0013'},
		'0014': { suite : 'heart',name:'2H', value : 2, code: '0014'},
		'0015': { suite : 'heart',name:'3H', value : 3, code: '0015'},
		'0016': { suite : 'heart',name:'4H', value : 4, code: '0016'},
		'0017': { suite : 'heart',name:'5H', value : 5, code: '0017'},
		'0018': { suite : 'heart',name:'6H', value : 6, code: '0018'},
		'0019': { suite : 'heart',name:'7H', value : 7, code: '0019'},
		'0020': { suite : 'heart',name:'8H', value : 8, code: '0020'},
		'0021': { suite : 'heart',name:'9H', value : 9, code: '0021'},
		'0022': { suite : 'heart',name:'TH', value : 10, code: '0022'},
		'0023': { suite : 'heart',name:'JH', value : 11, code: '0023'},
		'0024': { suite : 'heart',name:'QH', value : 12, code: '0024'},
		'0025': { suite : 'heart',name:'KH', value : 13, code: '0025'},
		// diamonds
		'0026': { suite : 'diamond',name:'AD', value : 1, code: '0026'},
		'0027': { suite : 'diamond',name:'2D', value : 2, code: '0027'},
		'0028': { suite : 'diamond',name:'3D', value : 3, code: '0028'},
		'0029': { suite : 'diamond',name:'4D', value : 4, code: '0029'},
		'0030': { suite : 'diamond',name:'5D', value : 5, code: '0030'},
		'0031': { suite : 'diamond',name:'6D', value : 6, code: '0031'},
		'0032': { suite : 'diamond',name:'7D', value : 7, code: '0032'},
		'0033': { suite : 'diamond',name:'8D', value : 8, code: '0033'},
		'0034': { suite : 'diamond',name:'9D', value : 9, code: '0034'},
		'0035': { suite : 'diamond',name:'TD', value : 10, code: '0035'},
		'0036': { suite : 'diamond',name:'JD', value : 11, code: '0036'},
		'0037': { suite : 'diamond',name:'QD', value : 12, code: '0037'},
		'0038': { suite : 'diamond',name:'KD', value : 13, code: '0038'},
		// spades
		'0039': { suite : 'spade',name:'AS', value : 1, code: '0039'},
		'0040': { suite : 'spade',name:'2S', value : 2, code: '0040'},
		'0041': { suite : 'spade',name:'3S', value : 3, code: '0041'},
		'0042': { suite : 'spade',name:'4S', value : 4, code: '0042'},
		'0043': { suite : 'spade',name:'5S', value : 5, code: '0043'},
		'0044': { suite : 'spade',name:'6S', value : 6, code: '0044'},
		'0045': { suite : 'spade',name:'7S', value : 7, code: '0045'},
		'0046': { suite : 'spade',name:'8S', value : 8, code: '0046'},
		'0047': { suite : 'spade',name:'9S', value : 9, code: '0047'},
		'0048': { suite : 'spade',name:'TS', value : 10, code: '0048'},
		'0049': { suite : 'spade',name:'JS', value : 11, code: '0049'},
		'0050': { suite : 'spade',name:'QS', value : 12, code: '0050'},
		'0051': { suite : 'spade',name:'KS', value : 13, code: '0051'}
};

function getCardValue (value) {
	if(isCard(value)) {
		return cards[value].value;
	}
}

function isCard(value) {
	return (cards[value]);
}

function getCardSuite (value) {
	if(isCard(value)) {
		return cards[value].suite;
	}
}

function getParity (value) {
	if(value !== 7) {
		return (getCardValue(value) % 2 == 0)? 'even' : 'odd';
	} else {
		return 'seven';
	}
}
function getSize (value) {
	value = getCardValue(value);
	
	if(value !== 7) {
		return (value > 7)? 'big' : 'small';
	} else {
		return 'seven';
	}
}

function getCardName (value) {
	if(!isCard(value)){
		return null;
	}
	return cards[value].name;
}

// function checkBonus(hands) {
// 	let 
// }

function getAA(cards){
	return new Promise(function(res,rej){
 		res((cards[0].name == cards[1].name && cards[0].name== "A")?30:0);
    });
}

function getAKSuited(cards){
	return new Promise(function(res,rej){
		if(cards[2].type == 'b'){// update: removed from pocket -12/5/17
			res(0);
		}
		var j = cards[0].name + cards[1].name;
		if(cards[0].suit == cards[1].suit){
	    	if(j.search('A') >= 0 && j.search('K') >= 0)
	        res(cards[2].type == 'b' ? 20 : 25);
	    }
	    res(0);
	});
}

function getAJAQSuited(cards){
	return new Promise(function(res,rej){
		if(cards[2].type == 'b'){// update: removed from pocket -12/5/17
			res(0);
		}
		var j = cards[0].name + cards[1].name;
		if(cards[0].suit == cards[1].suit){
	        if(j.search('A') >= 0 && j.search('Q') >= 0)
	        res(20);
	        else if(j.search('A') >= 0 && j.search('J') >= 0)
	        res(20);
	    }
	    res(0);
	});
}
function getAKOffSuited(cards){
	return new Promise(function(res,rej){
	if(cards[2].type == 'b'){// update: removed from pocket -12/5/17
		res(0);
	}
	var j = cards[0].name + cards[1].name;
		if(cards[0].suit !== cards[1].suit){
			if(j.search('A') >= 0 && j.search('K') >= 0)
			res(cards[2].type == 'b' ? 10 : 15);
		}
		res(0);
	});
}
function getAJAQOffSuited(cards){
	return new Promise(function(res,rej){
		if(cards[2].type == 'b'){// update: removed from pocket -12/5/17
			res(0);
		}
		var j = cards[0].name + cards[1].name;
		if(cards[0].suit !== cards[1].suit){
	        if(j.search('A') >= 0 && j.search('Q') >= 0)
	        res(cards[2].type == 'b' ? 10 : 5);
	        else if(j.search('A') >= 0 && j.search('J') >= 0)
	        res(cards[2].type == 'b' ? 10 : 5);
	    }
	    res(0);
	});
}
function getKKQQJJ(cards){
	return new Promise(function(res,rej){
	 	if (cards[0].name == cards[1].name){
	    	var n = cards[0].name;
	        res((n == "K" || n=="Q" || n=="J")?
					(cards[2].type == 'b' ?
							(cards[2].badbeat ?
									3
									:3)//old amount 4
							:10)
					:0);
	    }
	    res(0);
	});
}
function getAnyPair(cards){
	return new Promise(function(res,rej){
		if (cards[0].name == cards[1].name){
	    	var n = cards[0].name;
	        res((n !== "K" && n !=="Q" && n!== "J" && n !== "A")?
					(cards[2].type == 'b' ?
							(cards[2].badbeat ?
									3
									:3)//old amount 4
							:3)
					:0);
	    }
	    res(0);
	});
}

module.exports = function (v) {
	return {
		id     : v,
		value  : getCardValue(v),
		suite  : getCardSuite(v),
		parity : getParity(v),
		size   : getSize(v),
		name : getCardName(v),
		getBonus(hand,pocket){
			let hands = {
				right : hand[0],
				left : hand[1]
			};

			var text = [
				{ name:hands.right[0], suit: hands.right[1] },
				{ name:hands.left[0], suit: hands.left[1] },
				pocket //from bonus plus type
			];

			var promise = [];
			promise.push(getAA(text));
			promise.push(getAKSuited(text));
			promise.push(getAJAQSuited(text));
			promise.push(getAKOffSuited(text));
			promise.push(getKKQQJJ(text));
			promise.push(getAJAQOffSuited(text));
			promise.push(getAnyPair(text));

			return Promise.all(promise)
			.then(function(r){

				return _.filter(r, function(n){
					return ( n > 0 );
				});
			});
		},
		checkCard (d) {
			return (isCard(d));
		},
		getCodeByName(name){

			return _.find(cards, function(o) { 
				//console.log(o.name);
				return o.name == name; 
			});
		},
		getCardById (cardid, type) {
			return {
				type : type,
				card : cards[cardid]
			};
		}
	};
};
