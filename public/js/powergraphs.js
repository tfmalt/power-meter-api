
google.load('visualization', '1', {packages:["gauge", "corechart"]});
// google.setOnLoadCallback(drawGaugeChart);

/* var power = $({});

$(window).on("pageshow", function (e) {
    // alert("Got pageshow!");
    console.log("pageshow; ", e);
});
*/

var power = {};
power.kwh = {};
power.kwh.day = {};
power.kwh.month = {};
power.watt      = {};
power.watt.hour = {};
power.watt.now  = {};
power.kwh.day.hour = {};
power.kwh.month.day = {};
power.kwh.day.total = {};
power.kwh.day.today = {};
power.watt.hour.stored = {};

power.watt.hour.options = {
    title: '',
    animation: {
        duration: 1000,
        easing: "inAndOut"
    },
    height: "320",
    width: "100%",
    chartArea: {
        left: "11%",
        width: "84%",
        height: "80%"
    },
    lineWidth: 2,
    pointSize: 0,
    hAxis: {
        showTextEvery: 60,
        slatedText: true,
        slantedTextAngle: 60
    },
    vAxis: {
        minValue: 0,
        maxValue: 12000,
    },
    legend: { position: "none" },
    colors: ['#f6b26b', '#93c47d']
};


power.watt.now.options = {
    animation: { 
        duration: 400,
        easing: "inAndOut"
    },
    max:         12000,
    min:         0,
    width:       "100%", 
    height:      "100%",
    redFrom:     10000, 
    redTo:       12000,
    yellowFrom:  8000, 
    yellowTo:    10000,
    greenFrom:   0, 
    greenTo:     2000,
    greenColor:  "#93C47D",
    yellowColor: "#f6b26b",
    redColor:    "#cc4125",
    majorTicks: [
        "0", "2 kW", "4 kW", "6 kW", "8 kW", "10 kW", "12 kW"
    ],
    minorTicks: 10
};


power.kwh.month.day.options = {
    colors: [ "#f6b26b",],
    legend: {
        position: "none"
    },
    height: "320",
    width:  "100%",
    chartArea: {
        width: "90%",
        height: "220"
    },
    hAxis: {
        slantedText: true,
        slantedTextAngle: 60
    }
};
              
power.kwh.month.day.draw = function (res) {
    var data = res.data;
    var items = [['Date', 'kWh']];

    for (var i = 0; i < data.items.length; i++) {
        if (data.items[i] == null) {
            items.push(['', 0]);
            continue;
        }

        var date = new Date(data.items[i].timestamp);
        var str  = "" + (date.getMonth()+1) + "/" + date.getDate();

        items.push([str, data.items[i].kwh]);
    }

    var d = google.visualization.arrayToDataTable(items);
    var o = power.kwh.month.day.options;
    var c = power.kwh.month.day.chart;

    c.draw(d, o);
};

power.kwh.day.hour.options = {
    colors: [ "#f6b26b",],
    legend: {
        position: "none"
    },
    height: "320",
    width:  "100%",
    chartArea: {
        width: "90%",
        height: "220"
    },
    hAxis: {
        slantedText: true,
        slantedTextAngle: 60
    }
};

power.initialize = function () {
    power.kwh.day.hour.chart = new google.visualization.ColumnChart(
        document.getElementById("kwh-hour-25")
    );

    power.watt.now.chart = new google.visualization.Gauge(
        document.getElementById('usage-chart-now')
    );

    power.watt.hour.chart = new google.visualization.AreaChart(
        document.getElementById('usage-chart-hour')
    );
    
    power.kwh.month.day.chart = new google.visualization.ColumnChart(
        document.getElementById("kwh-day-31")
    );
}

power.kwh.day.hour.draw = function (res) {
    var data = res.data;

    var items = [['Time', 'kWh']];

    for (var i = 0; i < data.items.length; i++) {
        if (data.items[i] == null) {
            items.push(['', 0]);
            continue;
        }

        var date = new Date(data.items[i].timestamp);
        var str  = "" + date.getHours() + ":00";
        items.push([str, data.items[i].kwh]);
    }

    var d = google.visualization.arrayToDataTable(items);
    var o = power.kwh.day.hour.options;
    var c = power.kwh.day.hour.chart;

    c.draw(d, o);
};

power.watt.now.draw = function (res) {
    var options = power.watt.now.options;
    var data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['Watt', res.data.watt]
    ]);

    power.watt.now.chart.draw(data, options);
};

power.watt.hour.draw = function (res) {
        res.data.items.unshift(['Label', 'Value']);

        var data    = google.visualization.arrayToDataTable(res.data.items);
        var options = power.watt.hour.options; 
        var chart   = power.watt.hour.chart;

        chart.draw(data, options);
};
    
