
exports.server = {
    port: 3001
};

exports.redis = {
    read: {
        host: "hostname"
        port: 6379,
        password: null
    },
    write: {
        host: "hostname"
        port: 6379,
        password: null
    }
};

exports.corsDomains = [
    'https://power.malt.no',
    'http://localhost'
];

