require('node-env-file')(`${__dirname}/../.env`);

module.exports = {
	gameName   : process.env.GAME_NAME || 'Dragon-Tiger',
	apiBetsUrl : process.env.API_HISTORY_URL || '127.0.0.1',
	serverHost : process.env.SERVER_HOST || '127.0.0.1',
	serverPort : process.env.SERVER_PORT || 8006,
	tcp        : {
		connect : {
			host : process.env.TCP_HOST || '127.0.0.1',
			port : process.env.TCP_PORT || 8001
		}
	},
	redisChina: {
		status : process.env.REDIS_CHINA_STATUS || false,
		host: process.env.REDIS_CHINA_HOST || '127.0.0.1',
		port: process.env.REDIS_CHINA_PORT || 6379,
		password: process.env.REDIS_CHINA_PASSWORD || ''
	},
	redisHk: {
		status : process.env.REDIS_HK_STATUS || false,
		host: process.env.REDIS_HK_HOST || '112.198.15.68',
		port: process.env.REDIS_HK_PORT || 6375,
        	password: process.env.REDIS_HK_PASSWORD || 'bfd3v3l0p3r1@',
		retry_max_delay:10000
	},
	redis: {
        	host: process.env.REDIS_HOST || '127.0.0.1',
        	port: process.env.REDIS_PORT || 6379,
        	password: process.env.REDIS_PASSWORD || ''
    	},
	db : {
		host : process.env.DB_HOST || '127.0.0.1',
		user : process.env.DB_USER || 'root',
		port : process.env.DB_PORT || 3307,
		name : process.env.DB_NAME || 'Dragon-Tiger',
		pass : process.env.DB_PASS || 'password'
	},

    liveDb : {
        host: process.env.LIVE_DB_HOST,
        user: process.env.LIVE_DB_USER,
        port: process.env.LIVE_DB_PORT,
        name: process.env.LIVE_DB_NAME,
        pass: process.env.LIVE_DB_PASS
    }
};
