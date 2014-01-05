
google.load('visualization', '1', {packages:["gauge", "corechart"]});
// google.setOnLoadCallback(drawGaugeChart);

var power = $({});

$(window).on("pageshow", function (e) {
    // alert("Got pageshow!");
    console.log("pageshow; ", e);
});

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


power.initialize = function () {
    this.watt.hour.draw();
    this.watt.now.draw();
    this.kwh.day.hour.draw();
    this.kwh.day.total.draw();
    this.kwh.day.today.draw();
    this.kwh.month.day.draw();
};


power.watt.hour.options = {
    title: '',
    animation: {
        duration: 1000,
        easing: "inAndOut"
    },
    height: "98%",
    width: "100%",
    chartArea: {
        left: 72,
        width: "86%",
        height: "76%"
    },
    lineWidth: 2,
    pointSize: 0,
    hAxis: {
        showTextEvery: 30,
    },
    vAxis: {
        minValue: 0,
        maxValue: 12000       
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
              

power.kwh.month.day.draw = function () {
    var chart = new google.visualization.ColumnChart(
        document.getElementById("kwh-day-31")
    );
    power.kwh.month.day.chart = chart;

    $.getJSON(
        "/kwh/day/31",
        power.kwh.month.day.__draw        
    );
};

power.kwh.month.day.__draw = function (data) {
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

power.kwh.day.hour.draw = function () {
    var chart = new google.visualization.ColumnChart(
        document.getElementById("kwh-hour-25")
    );
    power.kwh.day.hour.chart = chart;

    $.getJSON(
        "/kwh/hour/25",
        power.kwh.day.hour.__draw
    );

    setInterval( function () {
        $.getJSON(
            "/kwh/hour/25", 
            power.kwh.day.hour.__draw
        )
    }, 5*60*1000);
};

power.kwh.day.hour.__draw = function (data) {
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

power.kwh.day.total.draw = function () {
    $.getJSON("/kwh/day/1", function (data) {
        $("#total-day-value").text(data.items[0].kwh.toFixed(2) + " kWh");
    });
};

power.kwh.day.today.draw = function () {
    $.getJSON("/kwh/today", function (data) {
        $("#total-today-value").text(data.kwh.toFixed(2) + " kWh");
    });
    setInterval(function () {
        $.getJSON("/kwh/today", function (data) {
            $("#total-today-value").text(data.kwh.toFixed(2) + " kWh");
        });
    }, 60000);
};


power.watt.now.draw = function () {
    power.watt.now.chart = new google.visualization.Gauge(
        document.getElementById('usage-chart-now')
    );

    var options = power.watt.now.options;
    var data = google.visualization.arrayToDataTable([
        ['Label', 'Value'],
        ['Watt', 0]
    ]);

    power.watt.now.chart.draw(data, options);

    setInterval(function () {
        $.getJSON("/usage/10", function (meter) {
            // console.log("data:", data);
            var mydata = google.visualization.arrayToDataTable([
                ['Label', 'Value'],
                ['Watt', meter.watt]
            ]);
            power.watt.now.chart.draw(mydata, options);
        });
    }, 1000);
};


power.watt.hour.draw =  function () {
    power.watt.hour.chart = new google.visualization.AreaChart(
        document.getElementById('usage-chart-hour')
    );

    var options = power.watt.hour.options;
    var data    = power.watt.hour.dummyData();

    power.watt.hour.chart.draw(data, options);

    power.watt.hour.stored = {'timestamp': new Date()};
    power.watt.hour.__draw();

    setInterval(function () {
        var now    = new Date();
        var stored = power.watt.hour.stored;
        var chart  = power.watt.hour.chart;

        if ((now.getTime() - stored.timestamp.getTime()) < 60*1000) {
            chart.draw(stored.data, options);
            return true;
        }
        
        power.watt.hour.__draw();
    }, 2000);
};

power.watt.hour.__draw = function () {
    $.getJSON("/hour/watts", function (meter) {
        meter.items.unshift(['Label', 'Value']);
        var data    = google.visualization.arrayToDataTable(meter.items);
        var options = power.watt.hour.options; 
        var stored  = power.watt.hour.stored;
        var chart   = power.watt.hour.chart;

        stored.timestamp = new Date();
        stored.data      = data;

        chart.draw(data, options);
    });
};
    
power.watt.hour.dummyData = function () {
    var data = google.visualization.arrayToDataTable([
        ['Label', 'Value'], // 'Expenses'],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000], //       400],
        ['00:00',    1000] //       400],
    ]);

    return data;
};
