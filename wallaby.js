module.exports = function () {
    console.log(process.cwd());
    return {
        files: [
            "config.js",
            "config-dev.js",
            "package.json",
            "lib/*.js"
        ],

        tests: [
            "test/*Test.js"
        ],

        env: {
            type: "node",
            runner: "/usr/local/bin/node",
            params: {
                env: "POWER_ENV=test; TZ=Europe/Oslo"
            }
        },

        workers: {
            recycle: false
        }
    }
};