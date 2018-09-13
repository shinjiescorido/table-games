require('node-env-file')(`${__dirname}/../.env`);

module.exports = {
    redis: {
        client: {
            port: process.env.REDIS_PORT || 6379,
            host: process.env.REDIS_HOST || '127.0.0.1',
            password: process.env.REDIS_PASSWORD ||  undefined
        },

        game: {
            port: process.env.GAME_SERVER_REDIS_PORT || 6379,
            host: process.env.GAME_SERVER_REDIS_HOST || '127.0.0.1',
            password: process.env.GAME_SERVER_REDIS_PASSWORD || undefined
        }
    },

    socketServers: {
        ports: {
            http: process.env.HTTP_PORT || 8000,
            tcp: process.env.TCP_PORT || 8001
        },
        serverName: process.env.APP_NAME || 'SERVER 1',
        host: process.env.APP_HOST || '127.0.0.1'
    }
};
