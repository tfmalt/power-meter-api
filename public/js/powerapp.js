/**
 * Angular controller to set and update the form to enter the actual power 
 * meter reading.
 *
 * Copyright (c) 2013 Thomas Malt
 *
 * @author Thomas Malt <thomas@malt.no>
 * @copyright Thomas Malt <thomas@malt.no>
 */
function PowerCtrl($scope, $http) {
    $http.get("/meter/total").then(function (result) {
        console.log("got result from get", result);
        var value = result.data.value;
        var delta = result.data.delta;

        $scope.meterTotal          = value;
        $scope.meterTotalWithDelta = (value + parseFloat(delta)).toFixed(2);
    });

    $scope.setMeter = function() {
        console.log("got told to set meter: " + $scope.meterTotal);
        $http.put("/meter/total", {"value": $scope.meterTotal}).then(
            function(result) {
                console.log("got result:", result);
            }
        );
    };
};
