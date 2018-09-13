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

const cards = {
		// clubs
		'0000': { suite : 'club', value : 1},
		'0001': { suite : 'club', value : 2},
		'0002': { suite : 'club', value : 3},
		'0003': { suite : 'club', value : 4},
		'0004': { suite : 'club', value : 5},
		'0005': { suite : 'club', value : 6},
		'0006': { suite : 'club', value : 7},
		'0007': { suite : 'club', value : 8},
		'0008': { suite : 'club', value : 9},
		'0009': { suite : 'club', value : 10},
		'0010': { suite : 'club', value : 11},
		'0011': { suite : 'club', value : 12},
		'0012': { suite : 'club', value : 13},
		// hearts
		'0013': { suite : 'heart', value : 1},
		'0014': { suite : 'heart', value : 2},
		'0015': { suite : 'heart', value : 3},
		'0016': { suite : 'heart', value : 4},
		'0017': { suite : 'heart', value : 5},
		'0018': { suite : 'heart', value : 6},
		'0019': { suite : 'heart', value : 7},
		'0020': { suite : 'heart', value : 8},
		'0021': { suite : 'heart', value : 9},
		'0022': { suite : 'heart', value : 10},
		'0023': { suite : 'heart', value : 11},
		'0024': { suite : 'heart', value : 12},
		'0025': { suite : 'heart', value : 13},
		// diamonds
		'0026': { suite : 'diamond', value : 1},
		'0027': { suite : 'diamond', value : 2},
		'0028': { suite : 'diamond', value : 3},
		'0029': { suite : 'diamond', value : 4},
		'0030': { suite : 'diamond', value : 5},
		'0031': { suite : 'diamond', value : 6},
		'0032': { suite : 'diamond', value : 7},
		'0033': { suite : 'diamond', value : 8},
		'0034': { suite : 'diamond', value : 9},
		'0035': { suite : 'diamond', value : 10},
		'0036': { suite : 'diamond', value : 11},
		'0037': { suite : 'diamond', value : 12},
		'0038': { suite : 'diamond', value : 13},
		// spades
		'0039': { suite : 'spade', value : 1},
		'0040': { suite : 'spade', value : 2},
		'0041': { suite : 'spade', value : 3},
		'0042': { suite : 'spade', value : 4},
		'0043': { suite : 'spade', value : 5},
		'0044': { suite : 'spade', value : 6},
		'0045': { suite : 'spade', value : 7},
		'0046': { suite : 'spade', value : 8},
		'0047': { suite : 'spade', value : 9},
		'0048': { suite : 'spade', value : 10},
		'0049': { suite : 'spade', value : 11},
		'0050': { suite : 'spade', value : 12},
		'0051': { suite : 'spade', value : 13}
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

	let cardId         = getCardValue(value);
	let cardSuite      = getCardSuite(value);
	let cardStringName = '';

	let cardName = {
		'1'  : 'ace',
		'11' : 'jack',
		'12' : 'queen',
		'13' : 'king'
	};

	// check if cardName[ id ] <--- is under ace, king - jack. else return string name of id
	cardStringName = (cardName[cardId]) ? cardName[cardId] : cardId.toString();
	return cardStringName + ' of ' + cardSuite + 's';  
}

module.exports = function (v) {
	return {
		id     : v,
		value  : getCardValue(v),
		suite  : getCardSuite(v),
		parity : getParity(v),
		size   : getSize(v),
		checkCard (d) {
			return (isCard(d));
		},
		getCardById (cardid, type) {
			return {
				type : type,
				card : cards[cardid]
			};
		}
	};
};
