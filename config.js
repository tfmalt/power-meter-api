
exports.server = {
    port: process.env.PORT || 3000
};

exports.redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
exports.corsDomains = process.env.CORS_DOMAINS.split(' ') || "http://localhost";

