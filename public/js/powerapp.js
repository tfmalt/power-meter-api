/**
 * Angular controller to set and update the form to enter the actual power 
 * meter reading.
 *
 * Copyright (c) 2013 Thomas Malt
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thomas Malt <thomas@malt.no>
 */

var powerApp = angular.module('powerApp', ['ngTouch', 'ui.bootstrap']);
powerApp.controller('PowerCtrl', function ($scope, $http, $interval) {
    $scope.meterTotal          = 0;
    $scope.meterTotalWithDelta = 0.0;
    $scope.meterTotalTimestamp = 0;
    $scope.kwhYesterday        = 0;
    $scope.kwhToday            = 0;

    $http.get("/meter/total").then(function (result) {
        console.log("initial load of meter total got result from get", result);
        var value = result.data.value;
        var delta = result.data.delta;

        $scope.meterTotal          = value;
        $scope.meterTotalWithDelta = (value + parseFloat(delta)).toFixed(2);
        $scope.meterTotalTimestamp = result.data.timestamp;
    });

    $http.get("/kwh/day/1").then(function (res) {
        $scope.kwhYesterday = res.data.items[0].kwh.toFixed(2);
    });

    $http.get("/kwh/today").then(function (res) {
        $scope.kwhToday = res.data.kwh.toFixed(2);
    });
    power.watt.now.draw($http);
    power.watt.hour.draw($http);
    power.kwh.day.hour.draw($http);
    power.kwh.month.day.draw($http);


    /**
     * Updates the metertotal with delta field every ten seconds
     */
    var stopMeter = $interval(function () {
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

    var stopKwhToday = $interval(function () {
        $http.get("/kwh/today").then(function (res) {
            $scope.kwhToday = res.data.kwh.toFixed(2);
        });
    }, 60000);

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

    $scope.handleTotalClick = function (e) {
        angular.element(e.target).toggleClass("onOrange");
    };
});

/* enquire.register("screen and (max-device-width: 320px)", {
    match: function () {
        // alert("Got match for ios device");
        $('div.navbar-fixed-top').removeClass('navbar-fixed-top');
    }, 
    unmatch: function () {
        alert("Got unmatch for ios device");
    }
});
*/
