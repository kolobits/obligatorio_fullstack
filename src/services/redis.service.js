const { Redis } = require("@upstash/redis");

const REDIS_URL = process.env.REDIS_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN;

let redisClient = null;

const connectToRedis = () => {
    if(!redisClient){
        const connectionOpts = {
            url: REDIS_URL,
            token:REDIS_TOKEN
        };
        redisClient = new Redis(connectionOpts);
    }
    return redisClient;
}

module.exports = connectToRedis;