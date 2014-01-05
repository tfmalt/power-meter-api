/**
 * Angular controller to set and update the form to enter the actual power 
 * meter reading.
 *
 * Copyright (c) 2013 Thomas Malt
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thomas Malt <thomas@malt.no>
 */
function PowerCtrl($scope, $http, $interval) {
    $http.get("/meter/total").then(function (result) {
        // console.log("got result from get", result);
        var value = result.data.value;
        var delta = result.data.delta;

        $scope.meterTotal          = value;
        $scope.meterTotalWithDelta = (value + parseFloat(delta)).toFixed(2);
        $scope.meterTotalTimestamp = result.data.timestamp;
    });

    /**
     * Updates the metertotal with delta field every ten seconds
     */
    var stop = $interval(function () {
        // console.log("Told to fetch meter/total as part of interval");
        $http.get("/meter/total").then(function (res) {
            console.log("data from meter total: ", res.data);
            var value = res.data.value;
            var delta = res.data.delta;
            var time  = res.data.timestamp;

            $scope.meterTotalWithDelta = (value + parseFloat(delta)).toFixed(2);
            $scope.meterTotalTimestamp = time;
        });
    }, 10000);

    /**
     * Form handler for the meter input field
     */
    $scope.setMeter = function() {
        // console.log("got told to set meter: " + $scope.meterTotal);
        $http.put("/meter/total", {"value": $scope.meterTotal}).then(function(res) {
            $scope.meterTotal = res.data.value;
            $scope.meterTotalWithDelta = parseFloat(res.data.value).toFixed(2);

        });
    };

    $scope.handleTotalClick = function () {
        alert("got click yeah");
    };
};

enquire.register("screen and (max-device-width: 320px)", {
    match: function () {
        // alert("Got match for ios device");
        $('div.navbar-fixed-top').removeClass('navbar-fixed-top');
    }, 
    unmatch: function () {
        alert("Got unmatch for ios device");
    }
});
