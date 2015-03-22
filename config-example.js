
exports.server = {
    port: 3001
};

exports.redis = {
    read: {
        host: "localhost",
        port: 6379,
        password: null
    },
    write: {
        host: "lolcahost",
        port: 6379,
        password: null
    }
};

exports.corsDomains = [
    'https://power.malt.no',
    'http://localhost'
];

