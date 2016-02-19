
exports.server = {
    port: process.env.PORT || 3000
};

exports.environment = process.env.POWER_ENV || "production";
exports.redisUrl    = process.env.REDIS_URL || "redis://localhost:6379";
exports.corsDomains = [];

if (process.env.CORS_DOMAINS) {
    exports.corsDomains = process.env.CORS_DOMAINS.split(' ') || ["http://localhost"];
}
