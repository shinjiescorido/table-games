'use strict';

/*
 |--------------------------------------------------------------------------
 | logger Module
 |--------------------------------------------------------------------------
 | Author: Shinji Escorido
 |  - logs functions handlers
 |
 */
module.exports = {
			roundNum: null,
			tableId : null,
			show (event) {
				return new Promise((res, rej) => {
					if(!this.tableId && !this.roundNum)
						rej();
console.log( `★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
★                                                                                                                  ★
★                                                                                                                  ★
★                                                                                                                  ★
★                                                                                                                  ★
                                                 TABLE #${this.tableId} ${event}ED!!!                                     
                                                 CURRENT ROUND NUMBER : ${this.roundNum}                               
★                                                                                                                  ★
★                                                                                                                  ★
★                                                                                                                  ★
★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★` );
					res();
				});
			}
};
