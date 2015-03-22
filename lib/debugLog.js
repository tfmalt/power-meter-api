/**
 * Created by tm on 22/03/15.
 *
 * @author tm
 * @copyright 2015 (c) tm
 */

var debug = {};

debug.log = function(mesg) {
    "use strict";
    if (process.env.POWER_ENV === "test") {
        return null;
    }

    console.log(mesg);
    for (var i = 1; i < arguments.length; i++) {
        console.log( arguments[i]);
    }
};

exports.debug = debug;