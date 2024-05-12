class Recorder
{
    content = document.querySelector('.content .container');
    status = new Object();

    constructor(controller)
    {
        var dark = theme == 'dark';

        this.controller = controller;
        this.color =
        {
            line:   'rgba(54, 162, 235, 1.0)',
            area:   'rgba(54, 162, 235, 0.4)',
            on:     'rgba(243, 168, 59, 1.0)',
            off:    dark ? 'rgba(68, 68, 68, 0.5)' : 'rgba(204, 204, 204, 0.5)',
            grid:   dark ? 'rgba(51, 51, 51, 1.0)' : 'rgba(221, 221, 221, 1.0)',
            major:  dark ? 'rgba(68, 68, 68, 1.0)' : 'rgba(204, 204, 204, 1.0)',
        };

        Chart.Tooltip.positioners.custom = function(data) { return data.length ? { x: data[0].element.x - data[0].element.width / 2, y: data[0].element.y} : false; };
    }

    findDevice(item)
    {
        var list = item.endpoint.split('/');
        var devices = this.controller[list[0]].devices ?? new Object();

        if (devices.hasOwnProperty(list[1]))
            return devices[list[1]];

        return Object.values(devices).find(device => device.info.name == list[1]) ?? new Object();
    }

    devicePromise(item, cell)
    {
        var list = item.endpoint.split('/');
        var endpoint = list[2] ?? 'common';
        var device;

        function wait(resolve)
        {
            device = this.findDevice(item);

            if (!device.endpoints || !device.endpoints[endpoint] || !device.endpoints[endpoint].exposes || !device.endpoints[endpoint].properties)
            {
                setTimeout(wait.bind(this, resolve), 10);
                return;
            }

            resolve();
        }

        new Promise(wait.bind(this)).then(function() { cell.innerHTML = device.info.name + ' &rarr; ' + exposeTitle(item.property, endpoint); }.bind(this));
    }

    chartQuery(item, element, interval)
    {
        var canvas = element.querySelector('canvas');
        var date = new Date();

        switch (interval)
        {
            case '2h':    date.setHours(date.getHours() - 2); break;
            case '8h':    date.setHours(date.getHours() - 8); break;
            case 'week':  date.setDate(date.getDate() - 7); break;
            case 'month': date.setMonth(date.getMonth() - 1); break;
            default:      date.setHours(date.getHours() - 24); break;
        }

        canvas.dataset.start = date.getTime();
        canvas.dataset.property = item.property;
        canvas.style.display = 'none';

        this.controller.socket.publish('command/recorder', {action: 'getData', id: canvas.id, endpoint: item.endpoint, property: item.property, start: date.getTime(), end: Date.now()});
    }

    parseData(message)
    {
        var canvas = document.getElementById(message.id);
        var status = document.querySelector('.status');
        var table = document.querySelector('.log');
        var chart = Chart.getChart(canvas);
        var datasets = new Array();
        var numeric = true;
        var options;

        if (!canvas)
            return;

        if (status)
            status.innerHTML = message.timestamp.length + ' records, ' + message.time + ' ms';

        if (table)
            table.innerHTML = null;

        if (chart)
            chart.destroy();

        if (!message.timestamp.length) // TODO: use canvas placeholder here
            return;

        options =
        {
            animation: false,
            maintainAspectRatio: false,
            plugins: {legend: {display: false}},
            scales:
            {
                x:
                {
                    type: 'time',
                    time: {unit: 'hour', displayFormats: {hour: 'HH:mm'}},
                    ticks: {maxRotation: 0, major: {enabled: true}, font: (context) => context.tick && context.tick.major ? {weight: 'bold'} : new Object()},
                    min: new Date(parseInt(canvas.dataset.start)),
                    max: new Date(),
                    border: {display: false},
                    grid: {color: (context) => context.tick && context.tick.major ? this.color.major : this.color.grid},
                }
            }
        };

        if (message.hasOwnProperty('value'))
        {
            for (var i = 0; i < message.value.length; i++)
            {
                if (message.value[i] && isNaN(message.value[i]))
                {
                    numeric = false;
                    break;
                }
            }

            if (numeric)
            {
                var data = new Array();
                message.timestamp.forEach((timestamp, index) => { data.push({x: timestamp, y: message.value[index]}); });
                data.push({x: options.scales.x.max, y: data[data.length - 1].y});
                datasets.push({data: data, borderWidth: 1.5, borderColor: this.color.line, pointRadius: 0, stepped: true});
            }
            else
            {
                message.timestamp.forEach((timestamp, index) =>
                {
                    var value = message.value[index];
                    var data =
                    {
                        data: [[index ? timestamp : options.scales.x.min, message.timestamp[index + 1] ? message.timestamp[index + 1] : options.scales.x.max]],
                        timestamp: timestamp,
                        label: value,
                        barThickness: 25,
                        minBarLength: 2,
                    }

                    if (value == null)
                        return;

                    if (canvas.dataset.property == 'status' || ['true', 'false'].includes(value))
                        data.backgroundColor = ['on', 'true'].includes(value) ? this.color.on : this.color.off;

                    datasets.push(data);
                });
            }
        }
        else
        {
            var avg = new Array();
            var min = new Array();
            var max = new Array();

            message.timestamp.forEach((timestamp, index) => // TODO: check for empty hours?
            {
                avg.push({x: timestamp, y: message.avg[index]});
                min.push({x: timestamp, y: message.min[index]});
                max.push({x: timestamp, y: message.max[index]});
            });

            datasets.push({data: avg, borderWidth: 1.5, borderColor: this.color.line, pointRadius: 0});
            datasets.push({data: min, borderWidth: 0, backgroundColor: this.color.area, pointRadius: 0, fill: '-1'});
            datasets.push({data: max, borderWidth: 0, backgroundColor: this.color.area, pointRadius: 0, fill: '-2'});
        }

        if (numeric)
        {
            options.interaction =
            {
                intersect: false,
                mode: 'nearest'
            };
            options.plugins.tooltip =
            {
                backgroundColor: 'rgba(40, 40, 40, 0.8)',
                caretPadding: 10,
                displayColors: false,
                xAlign: 'center',
                yAlign: 'bottom'
            };
            options.scales.y =
            {
                grace: '50%',
                border: {display: false},
                grid: {color: this.color.grid}
            };

            new Chart(canvas, {type: 'line', data: {datasets: datasets}, options: options});
        }
        else
        {

            canvas.closest('div').style.height = '80px';

            options.indexAxis = 'y';
            options.plugins.tooltip =
            {
                backgroundColor: 'rgba(40, 40, 40, 0.8)',
                displayColors: false,
                xAlign: 'center',
                yAlign: 'top',
                position: 'custom',
                callbacks: {title: (context) => context[0].dataset.label, label: (context) => new Date(context.dataset.timestamp).toLocaleString('RU')}
            }
            options.scales.y =
            {
                stacked: true,
                grid: {display: false}
            };

            new Chart(canvas, {type: 'bar', data: {labels: [exposeTitle(canvas.dataset.property)], datasets: datasets}, options: options});

            if (table)
            {
                datasets.slice().reverse().forEach((record) =>
                {
                    var row = table.insertRow();
                    var circleCell = row.insertCell();
                    var recordCell = row.insertCell();

                    circleCell.innerHTML = '<div class="circle"></div>';
                    recordCell.innerHTML = record.label + '<div class="timestamp">' + new Date(record.timestamp).toLocaleString('RU') + ' (' + timeInterval((Date.now() - record.timestamp) / 1000) + ')</div>';

                    circleCell.querySelector('.circle').style.backgroundColor = record.backgroundColor;
                });
            }
        }

        canvas.style.display = 'block';
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                this.status = message;

                if (this.controller.service == 'recorder')
                {
                    document.querySelector('#serviceVersion').innerHTML = 'Recorder ' + this.status.version;
                    this.showItemList();
                }

                break;
        }
    }

    showMenu()
    {
        var menu = document.querySelector('.menu');

        menu.innerHTML  = null;
        menu.innerHTML += '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.showItemList(); }.bind(this));
        menu.querySelector('#add').addEventListener('click', function() { this.showItemEdit(true); }.bind(this));

        if (!this.status)
            return;

        document.querySelector('#serviceVersion').innerHTML = 'Recorder ' + this.status.version;
    }

    showItemList()
    {
        this.controller.setService('recorder');
        this.controller.setPage('recorder');

        if (!this.status.items || !this.status.items.length)
        {
            this.content.innerHTML = '<div class="emptyList">recorder items list is empty</div>';
            return;
        }

        fetch('html/recorder/itemList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var table;

            this.content.innerHTML = html;
            table = this.content.querySelector('.itemList table');

            this.status.items.forEach(item =>
            {
                var row = table.querySelector('tbody').insertRow();

                row.addEventListener('click', function() { this.data = item; this.showItemInfo(); }.bind(this));

                for (var i = 0; i < 3; i++)
                {
                    var cell = row.insertCell();

                    switch (i)
                    {
                        case 0:
                            cell.innerHTML = '<span class="shade">' + item.endpoint + ' &rarr; ' + item.property + '</span>';
                            this.devicePromise(item, cell);
                            break;

                        case 1: cell.innerHTML = '<span class="value">' + item.debounce + '</span>'; cell.classList.add('center'); break;
                        case 2: cell.innerHTML = '<span class="value">' + item.threshold + '</span>'; cell.classList.add('center'); break;
                    }
                }
            });
        });
    }

    showItemInfo()
    {
        this.controller.setService('recorder');
        this.controller.setPage('recorderItem');

        fetch('html/recorder/itemInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var name;
            var chart;

            this.content.innerHTML = html;
            name = this.content.querySelector('.name');
            chart = this.content.querySelector('.chart');
            name.innerHTML = this.data.endpoint + ' &rarr; ' + this.data.property;

            this.content.querySelector('.edit').addEventListener('click', function() { this.showItemEdit(); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showItemRemove(); }.bind(this));
            this.content.querySelector('.debounce').innerHTML = '<span class="value">' + this.data.debounce + '</span> seconds';
            this.content.querySelector('.threshold').innerHTML = '<span class="value">' + this.data.threshold + '</span>';

            this.content.querySelector('.interval').querySelectorAll('span').forEach(item => item.addEventListener('click', function()
            {
                this.content.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';
                this.chartQuery(this.data, chart, item.innerHTML);

            }.bind(this)));

            this.devicePromise(this.data, name);
            this.chartQuery(this.data, chart);
        });
    }

    showItemEdit(add = false)
    {
        console.log('edit');
    }

    showItemRemove()
    {
        console.log('remove');
    }
}
