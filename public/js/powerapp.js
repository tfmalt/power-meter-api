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

    power.initialize();

    $scope.updateGraphs = function (e) {
        console.log("Got event " + e.type, e);

        var usage = angular.element(document.getElementById("usage-chart-now-body"));

        $http.get("/meter/total").then(function (result) {
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

        $http.get("/kwh/hour/73").then(power.kwh.day.hour.draw);
        $http.get("/usage/10").then(power.watt.now.draw);
        $http.get("/hour/watts").then(power.watt.hour.draw);
        $http.get("/kwh/day/62").then(power.kwh.month.day.draw);
    };

    var $w = angular.element(window);
    $w.on("pageshow",          $scope.updateGraphs);
    $w.on("orientationchange", $scope.updateGraphs);
    
    var stopWattNow = $interval(function () {
        $http.get("/usage/10").then(power.watt.now.draw);
    }, 1000);

    var stopKwhDayHour = $interval(function () {
        $http.get("/kwh/hour/73").then(power.kwh.day.hour.draw);
    }, 5*60*1000);

    var stopWattHour = $interval(function () {
        $http.get("/hour/watts").then(power.watt.hour.draw);
    }, 6000);

    /**
     * Updates the metertotal with delta field every ten seconds
     */
    var stopMeter = $interval(function () {
        // console.log("Told to fetch meter/total as part of interval");
        $http.get("/meter/total").then(function (res) {
            var value = res.data.value;
            var delta = res.data.delta;
            var time  = res.data.timestamp;

            var deltaInt = parseInt(parseFloat(delta).toFixed(2));
            var deltaDec = parseFloat((delta-deltaInt));
            var totDelta = value + deltaInt;

            console.log("got meter total: ", res, deltaInt, totDelta, 
                deltaDec.toFixed(2)
            );

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
    $scope.setMeter = function ($event) {
        var data  = {"value": $scope.meterTotal};
        console.log("got told to set meter: ", data, $event);
        $http.put("/meter/total", data).then(function(res) {
            $scope.meterTotal = res.data.value;
            $scope.meterTotalWithDelta = parseFloat(res.data.value).toFixed(2);
        });

        var form  = angular.element(document.getElementById("form-set-meter"));
        var meter = angular.element(document.getElementById("meter-total"));

        form.addClass("hidden");
        meter.removeClass("hidden");

    };

    $scope.handleTotalClick = function (e) {
        var form  = angular.element(document.getElementById("form-set-meter"));
        var meter = angular.element(document.getElementById("meter-total"));
        var input = angular.element(document.getElementById("meter-value"));

        input.attr("value", $scope.meterTotalWithDelta);
        form.removeClass("hidden");
        meter.addClass("hidden");
        // angular.element(e.target).toggleClass("onOrange");
    };

    $scope.handleTotalCancel = function (e) {
        var form  = angular.element(document.getElementById("form-set-meter"));
        var meter = angular.element(document.getElementById("meter-total"));

        form.addClass("hidden");
        meter.removeClass("hidden");
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
