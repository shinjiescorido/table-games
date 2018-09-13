require('node-env-file')(`${__dirname}/../.env`);

module.exports = {
    gameName: process.env.GAME_NAME || 'dragontiger',
    serverHost: process.env.SERVER_HOST || '127.0.0.1',
    serverPort: process.env.SERVER_PORT || 8007,
    redis: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || ''
    },
    redisChina: {
	status : process.env.REDIS_CHINA_STATUS || false,
	host: process.env.REDIS_CHINA_HOST || '127.0.0.1',
	port: process.env.REDIS_CHINA_PORT || 6379,
	password: process.env.REDIS_CHINA_PASSWORD || ''
    },
    redisHk: {
	status : process.env.REDIS_EXTRA_STATUS || false,
	host: process.env.REDIS_EXTRA_HOST || '112.198.15.68',
	port: process.env.REDIS_EXTRA_PORT || 6375,
	password: process.env.REDIS_EXTRA_PASSWORD || 'bfd3v3l0p3r1@',
	retry_max_delay:2000
    },
	/*
    redisHkis: {
        host: process.env.REDIS_HKIS_HOST || '127.0.0.1',
        port: process.env.REDIS_HKIS_PORT || 6379,
	password: process.env.REDIS_HKIS_PASSWORD || ''
    },
    redisHkkk: {
        host: process.env.REDIS_HKKK_HOST || '127.0.0.1',
        port: process.env.REDIS_HKKK_PORT || 6379,
	password: process.env.REDIS_HKKK_PASSWORD || ''
    },
    redisHkk: {
        host: process.env.REDIS_HKK_HOST || '127.0.0.1',
        port: process.env.REDIS_HKK_PORT || 6379,
	password: process.env.REDIS_HKK_PASSWORD || ''
    },
*/	
    db: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        port: process.env.DB_PORT || 3306,
        name: process.env.DB_NAME || 'dragontiger',
        pass: process.env.DB_PASS || 'password'
    },

    liveDb : {
        host: process.env.LIVE_DB_HOST,
        user: process.env.LIVE_DB_USER,
        port: process.env.LIVE_DB_PORT,
        name: process.env.LIVE_DB_NAME,
        pass: process.env.LIVE_DB_PASS
    }
};
