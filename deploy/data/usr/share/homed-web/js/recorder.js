class Recorder
{
    content = document.querySelector('.content .container');
    status = new Object();
    data = new Object();

    constructor(controller)
    {
        this.controller = controller;
        this.color =
        {
            grid:  function() { return theme == 'dark' ? 'rgb(51, 51, 51)' : 'rgb(221, 221, 221)'; },
            major: function() { return theme == 'dark' ? 'rgb(68, 68, 68)' : 'rgb(204, 204, 204)'; },
            error: 'rgba(255, 0, 0, 0.5)',
            line:  'rgb(54, 162, 235)',
            area:  'rgba(54, 162, 235, 0.4)',
            on:    'rgb(243, 168, 59)',
            off:   'rgba(127, 127, 127, 0.2)',
            bar:
            [
                'rgba(54, 162, 235, 0.5)',
                'rgba(255, 99, 132, 0.5)',
                'rgba(75, 192, 192, 0.5)',
                'rgba(255, 159, 64, 0.5)',
                'rgba(153, 102, 255, 0.5)',
                'rgba(255, 205, 86, 0.5)',
                'rgba(201, 203, 207, 0.5)'
            ]
        };

        Chart.defaults.color = '#888888';
        Chart.Tooltip.positioners.custom = function(data) { return data.length ? { x: data[0].element.x - data[0].element.width / 2, y: data[0].element.y} : false; };

        setInterval(function() { document.querySelectorAll('canvas').forEach(canvas => { if (canvas.dataset.interval != 'custom') this.dataRequest(canvas); }); }.bind(this), 5000);
    }

    updateCharts()
    {
        document.querySelectorAll('canvas').forEach(canvas =>
        {
            let chart = Chart.getChart(canvas);

            if (!chart)
                return;

            chart.update();
        });
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = 'Recorder ' + this.status.version;
    }

    timestampString(timestamp, seconds = true)
    {
        let date = new Date(timestamp);
        let data = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getDate() + ', ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);

        if (seconds)
            data += ':' + ('0' + date.getSeconds()).slice(-2);

        return data;
    }

    devicePromise(data, cell, table)
    {
        let device;

        function wait(resolve)
        {
            device = this.controller.findDevice(data);

            if (!device.endpoints?.[data.endpoint.split('/')[2] ?? 'common']?.exposes)
            {
                setTimeout(wait.bind(this, resolve), 10);
                return;
            }

            resolve();
        }

        new Promise(wait.bind(this)).then(function()
        {
            let title = exposeTitle(device, data.endpoint, data.property);

            this.status.items.forEach(item =>
            {
                if (item.endpoint != data.endpoint || item.property != data.property || item.name)
                    return;

                item.name = device.info.name + ' - ' + title;
            });

            cell.innerHTML = device.info.name + ' <i class="icon-right"></i> ' + title;

            if (!table)
                return;

            sortTable(table, 0);

        }.bind(this));
    }

    dataRequest(canvas)
    {
        if (canvas.dataset.interval != 'custom')
        {
            let date = new Date();
            let offset = parseInt(canvas.dataset.offset) || 0;

            switch (canvas.dataset.interval)
            {
                case '2h':    date.setHours(date.getHours() - 2); break;
                case '8h':    date.setHours(date.getHours() - 8); break;
                case 'week':  date.setDate(date.getDate() - 7); break;
                case 'month': date.setMonth(date.getMonth() - 1); break;
                default:      date.setHours(date.getHours() - 24); break;
            }

            offset *= (Date.now() - date.getTime()) / 10;
            canvas.dataset.start = date.getTime() - offset;
            canvas.dataset.end = Date.now() - offset;
        }

        this.controller.socket.publish('command/recorder', {action: 'getData', id: canvas.id, endpoint: canvas.dataset.endpoint, property: canvas.dataset.property, start: canvas.dataset.start, end: canvas.dataset.end});
    }

    chartQuery(item, element, interval, shift, start, end)
    {
        let canvas = element.querySelector('canvas');
        let offset = parseInt(canvas.dataset.offset) || 0;

        if (interval)
            canvas.dataset.interval = interval;

        if (interval == 'custom')
        {
            canvas.dataset.start = start;
            canvas.dataset.end = end;
        }

        switch (shift)
        {
            case 'left': offset += 1; break;
            case 'right': if (offset > 0) offset -= 1; break;
            default: offset = 0; break;
        }

        canvas.dataset.offset = offset;
        canvas.dataset.endpoint = item.endpoint;
        canvas.dataset.property = item.property;
        // canvas.style.display = 'none';

        this.dataRequest(canvas);
    }

    parseData(message)
    {
        let canvas = document.querySelector('canvas#' + message.id);
        let status = document.querySelector('.status#' + message.id);
        let table = document.querySelector('.log#' + message.id);
        let chart = Chart.getChart(canvas);
        let datasets = new Array();
        let numeric = true;
        let average = false;
        let options;

        if (!canvas)
            return;

        if (status)
            status.innerHTML = message.timestamp.length + ' records, ' + message.time + ' ms';

        if (!message.timestamp.length)
        {
            if (table)
            {
                canvas.closest('div').style.display = 'none';
                table.innerHTML = '<tr><td><div class="placeholder"></div><div class="center shade">no data available for selected period</div></td></tr>';
            }

            return;
        }

        if (table && (table.dataset.interval != canvas.dataset.interval || table.dataset.offset != canvas.dataset.offset || table.rows[0]?.querySelector('.placeholder')))
        {
            canvas.closest('div').style.display = 'block';
            table.dataset.interval = canvas.dataset.interval;
            table.dataset.offset = canvas.dataset.offset;
            table.innerHTML = null;
        }

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
                    ticks: {maxRotation: 0, major: {enabled: true}, font: function(context) { return context.tick?.major ? {weight: 'bold'} : new Object(); }},
                    min: new Date(parseInt(canvas.dataset.start)),
                    max: new Date(parseInt(canvas.dataset.end)),
                    border: {display: false},
                    grid: {color: function(context) { return context.tick?.major ? this.color.major() : this.color.grid(); }.bind(this)},
                }
            }
        };

        if (message.hasOwnProperty('value'))
        {
            for (let i = 0; i < message.value.length; i++)
            {
                if (message.value[i] && isNaN(message.value[i]))
                {
                    numeric = false;
                    break;
                }
            }

            if (numeric)
            {
                let data = new Array();

                message.timestamp.forEach((timestamp, index) =>
                {
                    let value = message.value[index];

                    if (!value && index)
                        data.push({x: timestamp, y: Number(parseFloat(message.value[index - 1]).toFixed(2)) });

                    data.push({x: timestamp, y: Number(parseFloat(value).toFixed(2)) });
                });

                data.push({x: options.scales.x.max, y: data[data.length - 1].y});
                datasets.push({data: data, borderWidth: 1.5, borderColor: this.color.line, pointRadius: 0, stepped: true});
            }
            else
            {
                let count = 0;

                message.timestamp.forEach((timestamp, index) =>
                {
                    let value = message.value[index];
                    let data =
                    {
                        data: [[index ? timestamp : options.scales.x.min, message.timestamp[index + 1] ? message.timestamp[index + 1] : options.scales.x.max]],
                        timestamp: timestamp,
                        label: value ?? 'UNAVAILABLE',
                        barThickness: 25,
                        minBarLength: 2
                    };

                    if (!value)
                        data.backgroundColor = this.color.error;
                    else if (canvas.dataset.property.split('_')[0] == 'status' || ['true', 'false'].includes(value))
                        data.backgroundColor = ['on', 'true'].includes(value) ? this.color.on : this.color.off;
                    else
                        data.backgroundColor = this.color.bar[count++];

                    if (count == this.color.bar.length)
                        count = 0;

                    datasets.push(data);
                });
            }
        }
        else
        {
            let avg = new Array();
            let min = new Array();
            let max = new Array();

            message.timestamp.forEach((timestamp, index) => // TODO: check for empty hours?
            {
                let avgTooltip = 'avg: ' + Number(message.avg[index].toFixed(2));
                let minTooltip = 'min: ' + Number(message.min[index].toFixed(2));
                let maxTooltip = 'max: ' + Number(message.max[index].toFixed(2));

                if (message.min[index] != message.max[index])
                {
                    let tooltip = new Array(avgTooltip, minTooltip, maxTooltip);
                    avgTooltip = tooltip;
                    minTooltip = tooltip;
                    maxTooltip = tooltip;
                }

                avg.push({x: timestamp, y: message.avg[index], tooltip: avgTooltip});
                min.push({x: timestamp, y: message.min[index], tooltip: minTooltip});
                max.push({x: timestamp, y: message.max[index], tooltip: maxTooltip});
            });

            datasets.push({data: avg, borderWidth: 1.5, borderColor: this.color.line, pointRadius: 0});
            datasets.push({data: min, borderWidth: 0, backgroundColor: this.color.area, pointRadius: 0, fill: '-1'});
            datasets.push({data: max, borderWidth: 0, backgroundColor: this.color.area, pointRadius: 0, fill: '-2'});

            average = true;
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
                yAlign: 'bottom',
                callbacks: {title: function(context) { return this.timestampString(context[0].dataset.data[context[0].dataIndex].x, average ? false : true); }.bind(this)}
            };
            options.scales.y =
            {
                grace: '10%',
                border: {display: false},
                grid: {color: function() { return this.color.grid(); }.bind(this)}
            };

            if (average)
                options.plugins.tooltip.callbacks.label = function(context) { return context.dataset.data[context.dataIndex].tooltip; };

            if (!chart)
                chart = new Chart(canvas, {type: 'line', data: {datasets: datasets}, options: options});
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
                callbacks: {title: function(context) { return this.timestampString(context[0].dataset.timestamp); }.bind(this), label: function(context) { return context.dataset.label + ', ' + timeInterval((context.raw[1] - context.dataset.timestamp) / 1000, false) + ' long'; }}
            };
            options.scales.y =
            {
                stacked: true,
                grid: {display: false}
            };

            if (!chart)
                chart = new Chart(canvas, {type: 'bar', data: {labels: [exposeTitle(this.controller.findDevice({endpoint: canvas.dataset.endpoint}), canvas.dataset.endpoint, canvas.dataset.property)]}});
        }

        chart.data.datasets = datasets;
        chart.options = options;
        chart.update();

        if (!numeric && table)
        {
            datasets.forEach((record, index) =>
            {
                let row = table.querySelector('tr[data-timestamp="' + record.timestamp + '"');
                let interval = timeInterval((Date.now() - record.timestamp) / 1000);
                let timestamp = this.timestampString(record.timestamp, true, true) + ', ' + interval;
                let next = datasets[index + 1];

                if (interval != 'now')
                    timestamp += ' ago, ' + (next ? timeInterval((next.timestamp - record.timestamp) / 1000, false) : interval) + ' long';

                if (!row)
                {
                    let circleCell;
                    let recordCell;

                    row = table.insertRow(0);
                    row.dataset.timestamp = record.timestamp;

                    circleCell = row.insertCell();
                    circleCell.innerHTML = '<div class="circle"></div>';
                    circleCell.querySelector('.circle').style.backgroundColor = record.backgroundColor;

                    recordCell = row.insertCell();
                    recordCell.innerHTML = record.label + '<div class="timestamp">' + timestamp + '</div>';

                    row.addEventListener('mouseover', function()
                    {
                        let index = chart.data.datasets.length - this.rowIndex - 1;

                        if (index < 0)
                            return;

                        chart.tooltip.setActiveElements([{datasetIndex: index, index: 0}]);
                        chart.update();
                    });

                    row.addEventListener('mouseleave', function()
                    {
                        chart.tooltip.setActiveElements(new Array());
                        chart.update();
                    });

                    return;
                }

                row.querySelector('.timestamp').innerHTML = timestamp;
            });
        }

        // canvas.style.display = 'block';
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                this.status = message;

                if (this.controller.service == 'recorder')
                {
                    this.controller.showPage('recorder');
                    this.updatePage();
                }

                break;

            // TODO: add events
        }
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let item;

        if (!guest)
        {
            menu.innerHTML  = '<span id="list"><i class="icon-list"></i> List</span>';
            menu.innerHTML += '<span id="add"><i class="icon-plus"></i> Add</span>';

            menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage('recorder'); }.bind(this));
            menu.querySelector('#add').addEventListener('click', function() { this.showItemEdit(true); }.bind(this));
        }
        else
            menu.innerHTML = null;

        if (!this.status.version)
            return;

        if (list[0] == 'index')
            item = this.status.items?.[list[1]];

        if (item)
        {
            this.data = item;
            this.showItemInfo();
        }
        else
            this.showItemList();

        this.updatePage();
    }

    showItemList()
    {
        if (!this.status.items?.length)
        {
            this.content.innerHTML = '<div class="emptyList">recorder items list is empty</div>';
            return;
        }

        fetch('html/recorder/itemList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;

            this.content.innerHTML = html;
            table = this.content.querySelector('.itemList table');

            this.status.items.forEach((item, index) =>
            {
                let row = table.querySelector('tbody').insertRow();

                row.addEventListener('click', function() { this.controller.showPage('recorder?index=' + index); }.bind(this));

                for (let i = 0; i < 3; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:
                            cell.innerHTML = '<span class="shade">' + item.endpoint + ' <i class="icon-right"></i> ' + item.property + '</span>';
                            cell.colSpan = 2;
                            this.devicePromise(item, cell, table);
                            break;

                        case 1: cell.innerHTML = '<span class="value">' + item.debounce + '</span>'; cell.classList.add('center'); break;
                        case 2: cell.innerHTML = '<span class="value">' + item.threshold + '</span>'; cell.classList.add('center'); break;
                    }
                }
            });

            addTableSearch(table, 'items', 'item', 4);
        });
    }

    showItemInfo()
    {
        fetch('html/recorder/itemInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let start = localStorage.getItem('recorderStart');
            let end = localStorage.getItem('recorderEnd');
            let id = 'chart-' + randomString(8);
            let items = new Array();
            let list = new Array();
            let current;
            let name;
            let datepicker;
            let chart;

            this.content.innerHTML = html;
            this.status.items.forEach((item, index) => { items.push([index, item.name ? item.name.toLowerCase() : item.endpoint + ' - ' + item.property]); });

            items.sort(function(a, b) { return a[1] < b[1] ? -1 : 1; }).forEach((item, index) =>
            {
                if (item[1] == this.data.name?.toLowerCase() || item[1] == this.data.endpoint + ' - ' + this.data.property)
                    current = index;

                list.push(item[0]);
            });

            handleArrowButtons(this.content, list, current, function(index) { this.controller.showPage('recorder?index=' + index); }.bind(this));

            name = this.content.querySelector('.name');
            datepicker = this.content.querySelector('.datepicker');
            chart = this.content.querySelector('.chart');

            name.innerHTML = this.data.endpoint + ' <i class="icon-right"></i> ' + this.data.property;
            datepicker.querySelector('input[name="start"]').value = start;
            datepicker.querySelector('input[name="end"]').value = end;

            if (!guest)
            {
                this.content.querySelector('.edit').addEventListener('click', function() { this.showItemEdit(); }.bind(this));
                this.content.querySelector('.remove').addEventListener('click', function() { this.showItemRemove(); }.bind(this));
            }
            else
                this.content.querySelectorAll('.edit, .remove').forEach(element => element.style.display = 'none');

            this.content.querySelector('.debounce').innerHTML = '<span class="value">' + this.data.debounce + '</span> seconds';
            this.content.querySelector('.threshold').innerHTML = '<span class="value">' + this.data.threshold + '</span>';

            this.content.querySelector('.interval').querySelectorAll('span').forEach(element => element.addEventListener('click', function()
            {
                datepicker.style.display = element.innerHTML == 'custom' ? 'block' : 'none';

                if (datepicker.style.display == 'block')
                    return;

                localStorage.setItem('recorderInterval', element.innerHTML);

                this.content.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';
                this.chartQuery(this.data, chart, element.innerHTML);

            }.bind(this)));
            
            this.content.querySelector('.shift').querySelectorAll('span').forEach(element => element.addEventListener('click', function() { this.chartQuery(this.data, chart, chart.querySelector('canvas').dataset.interval, element.id); }.bind(this)));

            datepicker.querySelector('.apply').addEventListener('click', function()
            {
                start = datepicker.querySelector('input[name="start"]').value;
                end = datepicker.querySelector('input[name="end"]').value;

                if (!start || !end)
                    return;

                datepicker.style.display = 'none';

                localStorage.setItem('recorderInterval', 'custom');
                localStorage.setItem('recorderStart', start);
                localStorage.setItem('recorderEnd', end);

                this.content.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';
                this.chartQuery(this.data, chart, 'custom', undefined, new Date(start).getTime(), new Date(end).getTime());

            }.bind(this));

            this.content.querySelectorAll('#data').forEach(item => { item.id = id; });

            this.devicePromise(this.data, name);
            this.chartQuery(this.data, chart, localStorage.getItem('recorderInterval'), undefined, start ? new Date(start).getTime() : undefined, end ? new Date(end).getTime() : undefined);
        });
    }

    showItemEdit(add)
    {
        fetch('html/recorder/itemEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let item;
            let name;
            let data;

            modal.querySelector('.data').innerHTML = html;
            name = modal.querySelector('.name');

            if (add)
            {
                let properties = this.controller.propertiesList();

                item = new Object();
                name.innerHTML = 'New item';

                addDropdown(modal.querySelector('.dropdown'), Object.keys(properties), function(key)
                {
                    data = properties[key];
                    modal.querySelector('.property').innerHTML = key;
                    modal.querySelector('.property').classList.remove('error');

                }.bind(this));
            }
            else
            {
                item = structuredClone(this.data);
                name.innerHTML = item.endpoint + ' <i class="icon-right"></i> ' + item.property;
                this.devicePromise(item, name);
            }

            modal.querySelector('.add').style.display = add ? 'block' : 'none';
            modal.querySelector('input[name="debounce"]').value = item.debounce ?? 0;
            modal.querySelector('input[name="threshold"]').value = item.threshold ?? 0;

            modal.querySelector('.save').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));

                if (add)
                {
                    if (data)
                    {
                        item.endpoint = data.endpoint;
                        item.property = data.property;
                    }

                    if (!item.endpoint || !item.property)
                    {
                        modal.querySelector('.property').classList.add('error');
                        return;
                    }
                }

                item.debounce = form.debounce;
                item.threshold = form.threshold;

                this.controller.socket.publish('command/recorder', {...{action: 'updateItem'}, ...item});
                this.controller.clearPage();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }

    showItemRemove()
    {
        fetch('html/recorder/itemRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let name;

            modal.querySelector('.data').innerHTML = html;
            name = modal.querySelector('.name');
            name.innerHTML = this.data.endpoint + ' <i class="icon-right"></i> ' + this.data.property;

            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/recorder', {action: 'removeItem', endpoint: this.data.endpoint, property: this.data.property}); this.controller.clearPage(); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.devicePromise(this.data, name);
            showModal(true);
        });
    }
}
