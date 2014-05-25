
exports.server = {
    port: 3001
};

exports.redis = {
    read: {
        host: "hostname"
        port: 6379,
        auth_pass: null
    },
    write: {
        host: "hostname"
        port: 6379,
        auth_pass: ""
    }
};

exports.corsDomains = [
    'https://power.malt.no',
    'http://localhost'
];

