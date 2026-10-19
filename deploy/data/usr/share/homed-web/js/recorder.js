class Recorder
{
    duration = {second: 1000, minute: 60000, hour: 3600000, day: 86400000};

    intervals = [setInterval(function() { document.querySelectorAll('canvas').forEach(canvas => { if (canvas.interval != 'custom' && Date.now() - canvas.timestamp >= this.updatePeriod(canvas)) this.dataRequest(canvas); }); }.bind(this), 5000)];
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
            on:    'rgb(243, 168, 59)',
            off:   'rgba(127, 127, 127, 0.2)',
            empty: 'rgba(63, 63, 63, 0.2)',
            error: 'rgba(255, 0, 0, 0.5)'
        };

        Chart.defaults.font.family = 'Open Sans';
        Chart.defaults.color = '#888888';
        Chart.Tooltip.positioners.custom = function(data) { return data.length ? { x: data[0].element.x - data[0].element.width / 2, y: data[0].element.y} : false; };
    }

    updatePage()
    {
        document.querySelector('#serviceVersion').innerHTML = 'Recorder ' + this.status.version;
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

    parseData(message) // TODO: refactor this spaghetti
    {
        let item, device, name, cell, aggregation, shift, counter, unit, options;
        let list = message.id.split('/');
        let index = list[1] ?? 0;
        let canvas = document.querySelector('canvas#' + list[0]);
        let status = document.querySelector('.status#' + list[0]);
        let total = document.querySelector('.total#' + list[0]);
        let table = document.querySelector('.log#' + list[0]);
        let chart = Chart.getChart(canvas);
        let datasets = new Array();
        let numeric = true;
        let average = false;

        if (!canvas)
            return;

        if (status)
            status.innerHTML = '<span class="mobileHidden">' + message.timestamp.length + ' records, ' + message.time + ' ms</span>';

        item = canvas.items[index];
        device = this.controller.findDevice(item);
        name = item.name ?? (device.info ? device.info.name : item.endpoint) + ' - ' + exposeTitle(device, item.endpoint, item.property);
        cell = canvas.closest('table') ? item.row?.querySelector('td.value') : null;
        aggregation = this.aggregation(canvas);
        shift = this.shift(canvas, item);
        counter = this.counter(item);
        unit = this.unit(item);

        if (shift && cell && (!canvas.change || list[2]))
        {
            let value = (message.value ?? (list[2] ? message.max : message.avg))?.[message.timestamp.length - 1] ?? empty;
            let endpointId = item.endpoint.split('/')[2] ?? 'common';

            if (value == empty)
                delete cell.dataset.unit;
            else
                cell.dataset.unit = unit;

            item.row.value = ['true', 'false'].includes(value) ? value == 'true' : !isNaN(value) ? parseFloat(value) : value;
            updateExpose(device, endpointId, item.property, device.properties(endpointId)[item.property]);
        }

        if (list[2])
            return;

        if (!message.timestamp.length)
        {
            if (table)
            {
                canvas.closest('div').style.display = 'none';
                table.innerHTML = '<tr><td><div class="placeholder"></div><div class="center shade">no data available for selected period</div></td></tr>';
            }

            if (canvas.items.length > 1 && !this.text(item))
            {
                canvas.cache[index] = [{data: new Array(), label: name, index: index, shift: shift, empty: true}];
                this.style(canvas, canvas.cache[index][0]);

                if (chart)
                {
                    chart.data.datasets = canvas.cache.reduce((result, value) => result.concat(value), new Array());
                    chart.update();
                }

                return;
            }

            delete canvas.cache[index];
            return;
        }

        if (canvas.style.display == 'none')
        {
            canvas.closest('div').querySelector('.placeholder').remove();
            canvas.style.display = 'block';
        }

        if (shift)
            message.timestamp = message.timestamp.map(timestamp => timestamp + shift);

        if (message.change)
        {
            let first = this.truncate(message.timestamp[0], aggregation);
            let last = this.truncate(message.timestamp[message.timestamp.length - 1], aggregation);

            if (first != last && last == this.truncate(canvas.end, aggregation))
            {
                while (first == this.truncate(message.timestamp[0], aggregation))
                {
                    message.timestamp.shift();
                    message.value.shift();
                }
            }
        }

        if (total)
        {
            let value;

            if (message.change && message.value?.length)
                value = message.value.reduce((value, item) => value + parseFloat(item), 0);
            else if (counter && message.value?.length)
                value = parseFloat(message.value[message.value.length - 1]) - parseFloat(message.value[0]);
            else if (counter && message.max?.length)
                value = parseFloat(message.max[message.max.length - 1]) - parseFloat(message.min[0]);

            total.innerHTML = isNaN(value) ? '' : '<span class="value">' + Number(value.toFixed(2)) + (unit ? ' ' + unit : '') + '</span>';
        }

        if (table && (table.interval != canvas.interval || table.offset != canvas.offset || table.rows[0]?.querySelector('.placeholder')))
        {
            canvas.closest('div').style.display = 'block';
            table.interval = canvas.interval;
            table.offset = canvas.offset;
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
                    time: {unit: aggregation, displayFormats: {hour: 'HH:mm'}},
                    ticks: {maxRotation: 0, major: {enabled: true}, font: function(context) { return context.tick?.major ? {weight: 'bold'} : new Object(); }},
                    min: new Date(canvas.start),
                    max: new Date(canvas.end),
                    border: {display: false},
                    grid: {color: function(context) { return context.tick?.major ? this.color.major() : this.color.grid(); }.bind(this)}
                }
            }
        };

        if (message.hasOwnProperty('value'))
        {
            numeric = this.text(item) ? false : true;

            if (numeric)
            {
                let data = new Array();

                if (message.change)
                {
                    let value = 0;
                    let current;

                    message.timestamp.forEach((timestamp, index) =>
                    {
                        let date = this.truncate(timestamp, aggregation);

                        if (current && current != date)
                        {
                            data.push({x: current, y: Number(value.toFixed(2))});
                            value = 0;
                        }

                        value += parseFloat(message.value[index]);
                        current = date;
                    });

                    data.push({x: current, y: Number(value.toFixed(2))});
                }
                else
                {
                    message.timestamp.forEach((timestamp, index) =>
                    {
                        let value = message.value[index];

                        if (!value && index)
                            data.push({x: timestamp, y: Number(parseFloat(message.value[index - 1]).toFixed(2))});

                        data.push({x: timestamp, y: Number(parseFloat(value).toFixed(2))});
                    });
                }

                if (!message.change)
                {
                    data.push({x: options.scales.x.max, y: data[data.length - 1].y});
                    datasets.push({data: data, borderWidth: 1.5, borderColor: paletteColor(0), pointRadius: 0, stepped: true, label: name, unit: unit});
                }
                else
                    datasets.push({data: data, backgroundColor: paletteColor(0, shift ? 0.4 : 0.8), borderRadius: 3, label: name, unit: unit, total: Number(message.value.reduce((value, item) => value + parseFloat(item), 0).toFixed(2)) + (unit ? ' ' + unit : '')});
            }
            else
            {
                let count = 0;

                if (message.timestamp[0] > canvas.start)
                    datasets.push({data: [{x: [canvas.start, message.timestamp[0]], y: name}], timestamp: canvas.start, label: 'no data available', barThickness: 25, minBarLength: 1, backgroundColor: this.color.empty, empty: true});

                message.timestamp.forEach((timestamp, index) =>
                {
                    let value = message.value[index];
                    let data =
                    {
                        data: [{x: [Math.max(timestamp, canvas.start), message.timestamp[index + 1] ? message.timestamp[index + 1] : options.scales.x.max], y: name}],
                        timestamp: timestamp,
                        label: value ?? 'UNAVAILABLE',
                        barThickness: 25,
                        minBarLength: 1
                    };

                    if (!value)
                        data.backgroundColor = this.color.error;
                    else if (['on', 'off', 'true', 'false'].includes(value))
                        data.backgroundColor = ['on', 'true'].includes(value) ? this.color.on : this.color.off;
                    else
                        data.backgroundColor = paletteColor(count++, 0.5);

                    datasets.push(data);
                });
            }
        }
        else
        {
            let hole = (canvas.end - canvas.start) / 100;
            let avg = new Array();
            let min = new Array();
            let max = new Array();

            message.timestamp.forEach((timestamp, index) =>
            {
                let avgTooltip = 'avg: ' + Number(message.avg[index].toFixed(2)) + (unit ? ' ' + unit : '');
                let minTooltip = 'min: ' + Number(message.min[index].toFixed(2)) + (unit ? ' ' + unit : '');
                let maxTooltip = 'max: ' + Number(message.max[index].toFixed(2)) + (unit ? ' ' + unit : '');

                if (message.min[index] != message.max[index])
                {
                    let tooltip = new Array(avgTooltip, minTooltip, maxTooltip);
                    avgTooltip = tooltip;
                    minTooltip = tooltip;
                    maxTooltip = tooltip;
                }

                if (index && timestamp - message.timestamp[index - 1] > hole)
                {
                    let x = message.timestamp[index - 1] + (message.daily ? this.duration.day : this.duration.hour);
                    avg.push({x: x, y: null});
                    min.push({x: x, y: null});
                    max.push({x: x, y: null});
                }

                avg.push({x: timestamp, y: message.avg[index], tooltip: avgTooltip});
                min.push({x: timestamp, y: message.min[index], tooltip: minTooltip});
                max.push({x: timestamp, y: message.max[index], tooltip: maxTooltip});
            });

            datasets.push({data: avg, borderWidth: 1.5, borderColor: paletteColor(0), pointRadius: 0, label: name});
            datasets.push({data: min, borderWidth: 0, backgroundColor: paletteColor(0, 0.4), pointRadius: 0, fill: '-1'});
            datasets.push({data: max, borderWidth: 0, backgroundColor: paletteColor(0, 0.4), pointRadius: 0, fill: '-2'});

            average = true;
        }

        if (numeric)
        {
            let type = message.change ? 'bar' : 'line';

            options.interaction =
            {
                intersect: false,
                mode: 'nearest'
            };
            options.plugins.tooltip =
            {
                backgroundColor: 'rgba(40, 40, 40, 0.8)',
                caretPadding: 10,
                displayColors: canvas.items.length > 1,
                usePointStyle: true,
                boxHeight: 8,
                boxPadding: 3,
                multiKeyBackground: 'transparent',
                xAlign: 'center',
                yAlign: 'bottom',
                callbacks: {title: function(context) { return this.timestampString(context[0].dataset.data[context[0].dataIndex].x - (context[0].dataset.shift ?? 0), average ? false : true); }.bind(this), label: function(context) { return context.parsed.y + (context.dataset.unit ? ' ' + context.dataset.unit : ''); }, labelColor: function(context) { return {backgroundColor: context.dataset.backgroundColor}; }}
            };
            options.scales.y =
            {
                grace: '10%',
                border: {display: false},
                grid: {color: function() { return this.color.grid(); }.bind(this)},
                ticks: {callback: function(value, index) { return !index && unit ? unit : parseFloat(value.toPrecision(12)); }, font: function(context) { return !context.index && unit ? {weight: 'bold'} : new Object(); }}
            };

            if (average)
                options.plugins.tooltip.callbacks.label = function(context) { return context.dataset.data[context.dataIndex].tooltip; };

            if (shift)
                datasets.forEach(dataset => { dataset.borderDash = [4, 4]; dataset.shift = shift; });

            if (canvas.items.length > 1)
            {
                let update = function(chart) { chart.data.datasets.forEach(dataset => this.style(canvas, dataset)); chart.update(); }.bind(this);
                let units = canvas.items.map(value => this.unit(value)).filter((value, index, array) => canvas.overlay || array.indexOf(value) == index);

                units.forEach((value, index) =>
                {
                    options.scales['y' + index] = {...options.scales.y, display: index < 2, ticks: {callback: function(tick, index) { return !index && value ? value : parseFloat(tick.toPrecision(12)); }, font: function(context) { return !context.index && value ? {weight: 'bold'} : new Object(); }}};

                    if (index != 1)
                        return;

                    options.scales.y1.grid = {display: false};
                    options.scales.y1.position = 'right';
                });

                datasets = datasets.filter(dataset => !dataset.fill);
                datasets.forEach(dataset => { dataset.index = index; dataset.yAxisID = 'y' + (canvas.overlay ? index : units.indexOf(unit)); this.style(canvas, dataset); });

                options.plugins.legend =
                {
                    position: 'bottom',
                    labels: {usePointStyle: true, boxWidth: 8, boxHeight: 5, generateLabels: function(chart) { return Chart.defaults.plugins.legend.labels.generateLabels(chart).map(item => { let dataset = chart.data.datasets[item.datasetIndex]; return {...item, text: dataset.total ? item.text + ' · ' + dataset.total : item.text, fontColor: item.hidden ? 'rgba(136, 136, 136, 0.5)' : item.fontColor, hidden: dataset.empty ?? false, fillStyle: dataset.shift ? 'transparent' : item.fillStyle, lineWidth: 1}; }); }},
                    onClick: function(event, item, legend) { let index = legend.chart.data.datasets[item.datasetIndex].index; canvas.disabled[index] = canvas.disabled[index] ? false : true; update(legend.chart); }
                };

                if (window.matchMedia('(hover: hover)').matches)
                {
                    options.plugins.legend.onHover = function(event, item, legend) { legend.chart.canvas.style.cursor = 'pointer'; canvas.highlight = legend.chart.data.datasets[item.datasetIndex].index; update(legend.chart); };
                    options.plugins.legend.onLeave = function(event, item, legend) { legend.chart.canvas.style.cursor = 'default'; delete canvas.highlight; update(legend.chart); };
                }

                delete options.scales.y;
            }
            else if (message.change && !total)
                options.plugins.legend = {position: 'bottom', labels: {boxWidth: 0, generateLabels: function(chart) { return [{text: chart.data.datasets[0].total, fontColor: Chart.defaults.color, lineWidth: 0}]; }}, onClick: null};

            if (chart && chart.config.type != type)
            {
                chart.destroy();
                chart = null;
            }

            if (!chart)
                chart = new Chart(canvas, {type: type, data: {datasets: datasets}, options: options});
        }
        else
        {
            options.indexAxis = 'y';
            options.plugins.tooltip =
            {
                backgroundColor: 'rgba(40, 40, 40, 0.8)',
                displayColors: false,
                xAlign: 'center',
                yAlign: 'top',
                position: 'custom',
                callbacks: {title: function(context) { return this.timestampString(context[0].dataset.timestamp - (context[0].dataset.shift ?? 0)); }.bind(this), label: function(context) { return context.dataset.label + ', ' + timeInterval((context.raw.x[1] - context.dataset.timestamp) / 1000, false) + ' long'; }}
            };
            options.scales.y =
            {
                display: canvas.items.length > 1,
                stacked: true,
                grid: {display: false}
            };

            if (canvas.items.length > 1)
            {
                options.scales.y.ticks = {mirror: true, labelOffset: -22, padding: 0};
                options.scales.y.grid.drawTicks = false;
            }

            if (shift)
                datasets.forEach(dataset => { dataset.backgroundColor = Chart.helpers.color(dataset.backgroundColor).clearer(0.5).rgbString(); dataset.shift = shift; });

            if (!chart)
                chart = new Chart(canvas, {type: 'bar'});

            chart.data.labels[index] = name;
        }

        canvas.cache[index] = datasets;
        chart.data.datasets = canvas.cache.reduce((result, value) => result.concat(value), new Array());

        if (message.change)
        {
            options.scales.x.min = Math.min(...chart.data.datasets.filter(dataset => !dataset.empty).map(dataset => dataset.data[0].x));
            options.scales.x.max = Math.max(...chart.data.datasets.filter(dataset => !dataset.empty).map(dataset => dataset.data[dataset.data.length - 1].x));
        }

        chart.options = options;
        chart.update();

        if (numeric)
        {
            if (canvas.size)
                canvas.closest('div').style.height = (canvas.size == 'small' ? 100 : canvas.size == 'large' ? 200 : 150) + chart.legend.height + 'px';

            if (!message.change && cell)
                cell.dataset.trend = this.trend(canvas, datasets[0].data);

            return;
        }

        canvas.closest('div').style.height = (canvas.items.length > 1 ? 45 * canvas.items.length + 40 : 80) + 'px';

        if (!table)
            return;

        datasets.forEach((record, index) =>
        {
            let row = table.querySelector('tr[data-timestamp="' + record.timestamp + '"');
            let interval = timeInterval((Date.now() - record.timestamp) / 1000);
            let timestamp = this.timestampString(record.timestamp, true, true) + ', ' + interval;
            let next = datasets[index + 1];

            if (record.empty)
                return;

            if (interval != 'now')
                timestamp += ' ago, ' + (next ? timeInterval((next.timestamp - record.timestamp) / 1000, false) : interval) + ' long';

            if (!row)
            {
                let circleCell, recordCell;

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

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':
            {
                let check = false;

                this.status = message;

                if (this.item && this.status.items)
                {
                    this.status.items.forEach(item =>
                    {
                        if (item.endpoint != this.item.endpoint || item.property != this.item.property)
                            return;

                        this.controller.showPage('recorder?item=' + item.endpoint + '/' + item.property);
                        check = true;
                    });
                }

                if (check || this.controller.service == 'recorder')
                {
                    if (!check)
                        this.controller.showPage(this.controller.page);

                    this.updatePage();
                }

                delete this.item;
                break;
            }

            // TODO: add events
        }
    }

    timestampString(timestamp, seconds = true)
    {
        let date = new Date(timestamp);
        let data = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getDate() + ', ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);

        if (seconds)
            data += ':' + ('0' + date.getSeconds()).slice(-2);

        return data;
    }

    truncate(timestamp, aggregation)
    {
        let date = new Date(new Date(timestamp - 1).setMinutes(0, 0, 0));

        if (aggregation != 'hour')
            date.setHours(0);

        if (aggregation == 'month')
            date.setDate(1);

        return date.getTime();
    }

    aggregation(canvas)
    {
        let days = (canvas.end - canvas.start) / this.duration.day;
        return days >= 90 ? 'month' : days >= 7 ? 'day' : 'hour';
    }

    shift(canvas, item)
    {
        let date = new Date(canvas.end);
        let day = date.getDate();
        let check = false;

        switch (item.shift)
        {
            case '1 hour':  date.setHours(date.getHours() - 1); break;
            case '1 day':   date.setDate(date.getDate() - 1); break;
            case '1 week':  date.setDate(date.getDate() - 7); break;
            case '1 month': date.setMonth(date.getMonth() - 1); check = true; break;
            case '1 year':  date.setFullYear(date.getFullYear() - 1); check = true; break;
        }

        if (check && date.getDate() != day)
            date.setDate(0);

        return canvas.end - date.getTime();
    }

    updatePeriod(canvas)
    {
        switch (canvas.interval)
        {
            case '2h':    return this.duration.second * 5;
            case '8h':    return this.duration.second * 10;
            case '24h':   return this.duration.second * 30;
            case 'week':  return this.duration.minute * 5;
            case 'month': return this.duration.minute * 10;
            case 'year':  return this.duration.minute * 30;
        }
    }

    trend(canvas, data)
    {
        let period, change;
        let points = data.filter(point => point.y != null && !isNaN(point.y));
        let values = new Array();
        let smooth = new Array();
        let count = 1;

        if (!points.length)
            return 'flat';

        switch (canvas.interval)
        {
            case '2h':     period = this.duration.minute * 30; break;
            case '8h':     period = this.duration.hour; break;
            case '24h':    period = this.duration.hour * 3; break;
            case 'week':   period = this.duration.day * 2; count = 30; break;
            case 'month':  period = this.duration.day * 7; count = 26; break;
            case 'year':   period = this.duration.day * 60; count = 7; break;
            case 'custom': period = (canvas.end - canvas.start) * 0.15; break;
        }

        period /= 60;

        for (let i = 0; i < count + 60; i++)
            values.push((points.findLast(point => point.x <= canvas.end - period * (count + 59 - i)) ?? points[0]).y);

        for (let i = 0; i < 61; i++)
            smooth.push(values.slice(i, count + i).reduce((result, value) => result + value, 0) / count);

        change = smooth.reduce((result, value, index) => result + (index - 30) * value, 0) / smooth.reduce((result, value, index) => result + Math.pow(index - 30, 2), 0) * 60;
        return Math.abs(change) < (Math.max(...points.map(point => point.y)) - Math.min(...points.map(point => point.y))) * 0.1 || Math.abs(change) <= (Math.max(...smooth) - Math.min(...smooth)) * 0.5 ? 'flat' : change > 0 ? 'up' : 'down';
    }

    style(canvas, dataset)
    {
        let color = paletteColor(dataset.index, canvas.disabled[dataset.index] || (canvas.highlight != undefined && canvas.highlight != dataset.index) ? 0.2 : null);
        dataset.backgroundColor = dataset.shift ? Chart.helpers.color(color).clearer(0.5).rgbString() : color;
        dataset.borderColor = color;
        dataset.hidden = canvas.disabled[dataset.index] ?? false;
    }

    counter(item)
    {
        return ['increasing', 'total_increasing'].includes(this.controller.findDevice(item)?.options(item.endpoint.split('/')[2] ?? 'common')?.[item.property]?.state); // TODO: remove backward compatibility for legacy total_increasing
    }

    unit(item)
    {
        return this.controller.findDevice(item)?.options(item.endpoint.split('/')[2] ?? 'common')?.[item.property]?.unit ?? '';
    }

    text(item)
    {
        return this.status.items?.find(value => value.endpoint == item.endpoint && value.property == item.property)?.text ?? false;
    }

    dataRequest(canvas)
    {
        let aggregation, request;

        if (canvas.interval != 'custom')
        {
            let date = new Date();
            let offset = canvas.offset ?? 0;

            switch (canvas.interval)
            {
                case '2h':    date.setHours(date.getHours() - 2); break;
                case '8h':    date.setHours(date.getHours() - 8); break;
                case '24h':   date.setHours(date.getHours() - 24); break;
                case 'week':  date.setDate(date.getDate() - 7); break;
                case 'month': date.setMonth(date.getMonth() - 1); break;
                case 'year':  date.setFullYear(date.getFullYear() - 1); break;
            }

            offset *= Math.max((Date.now() - date.getTime()) / 10, this.duration.hour * 2);
            canvas.start = date.getTime() - offset;
            canvas.end = Date.now() - offset;
        }

        if (canvas.change)
            aggregation = this.aggregation(canvas);

        request = {action: 'getData', start: aggregation ? this.truncate(canvas.start, aggregation) : canvas.start, end: canvas.end, change: canvas.change};
        canvas.timestamp = Date.now();

        canvas.items.forEach((item, index) =>
        {
            let shift = this.shift(canvas, item);

            if (canvas.change && shift)
                this.controller.socket.publish('command/recorder', {...request, id: canvas.id + '/' + index + '/value', endpoint: item.endpoint, property: item.property, start: request.end - shift - this.duration.hour, end: request.end - shift, change: false});

            this.controller.socket.publish('command/recorder', {...request, id: canvas.id + (index ? '/' + index : ''), endpoint: item.endpoint, property: item.property, start: request.start - shift, end: request.end - shift});
        });
    }

    chartQuery(items, element, interval, shift, start, end)
    {
        let canvas = element.querySelector('canvas');
        let offset = canvas.offset ?? 0;

        if (interval == 'custom')
        {
            canvas.start = start;
            canvas.end = end;
        }

        switch (shift)
        {
            case 'left': offset += 1; break;
            case 'right': if (offset > 0) offset -= 1; break;
            default: offset = 0; break;
        }

        canvas.cache = new Array();
        canvas.items = items;
        canvas.interval = interval ?? '24h';
        canvas.offset = offset;

        this.dataRequest(canvas);
    }

    devicePromise(data, cell, icon = false, info = false, table)
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

            cell.innerHTML = (icon ? exposeIcon(device, data.endpoint, data.property) : '') + '<span>' + device.info.name + '</span> <i class="mdi-arrow-right"></i> ' + title;

            if (!guest && info)
            {
                cell.querySelector('span').classList.add('info');
                cell.querySelector('span').addEventListener('click', function() { this.controller.showPage(device.service + '?device=' + device.id); }.bind(this));
            }

            if (!table)
                return;

            sortTable(table, 0);

        }.bind(this));
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split(/=(.*)/) : new Array();
        let item;

        if (!guest)
        {
            menu.innerHTML  = '<span id="list"><i class="mdi-menu"></i> List</span>';
            menu.innerHTML += '<span id="add"><i class="mdi-plus"></i> Add</span>';

            menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage('recorder'); }.bind(this));
            menu.querySelector('#add').addEventListener('click', function() { this.showItemEdit(true); }.bind(this));
        }
        else
            menu.innerHTML = null;

        if (!this.status.version)
            return;

        if (list[0] == 'item')
            item = this.status.items?.find(value => value.endpoint + '/' + value.property == list[1]);

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
        this.controller.setPage('recorder');

        if (!this.status.items?.length)
        {
            this.content.innerHTML = '<div class="emptyList">recorder items list is empty</div>';
            return;
        }

        loadHTML('html/recorder/itemList.html', this, this.content, function()
        {
            let table = this.content.querySelector('.itemList table');

            this.status.items.forEach(item =>
            {
                let row = table.querySelector('tbody').insertRow();

                row.addEventListener('click', function() { this.controller.showPage('recorder?item=' + item.endpoint + '/' + item.property); }.bind(this));

                for (let i = 0; i < 3; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:
                            cell.innerHTML = '<span class="shade">' + item.endpoint + ' <i class="mdi-arrow-right"></i> ' + item.property + '</span>';
                            cell.colSpan = 2;
                            this.devicePromise(item, cell, true, false, table);
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
        loadHTML('html/recorder/itemInfo.html', this, this.content, function()
        {
            let current, name, datepicker, chart;
            let interval = localStorage.getItem('homedRecorderInterval') ?? '24h';
            let start = localStorage.getItem('homedRecorderStart');
            let end = localStorage.getItem('homedRecorderEnd');
            let id = 'chart-' + randomString(8);
            let items = new Array();
            let list = new Array();

            this.status.items.forEach(item => { items.push([item.endpoint + '/' + item.property, item.name ? item.name.toLowerCase() : item.endpoint + ' - ' + item.property]); });

            items.sort(function(a, b) { return a[1] < b[1] ? -1 : 1; }).forEach((item, index) =>
            {
                if (item[1] == this.data.name?.toLowerCase() || item[1] == this.data.endpoint + ' - ' + this.data.property)
                    current = index;

                list.push(item[0]);
            });

            handleArrowButtons(this.content, list, current, function(key) { this.controller.showPage('recorder?item=' + key); }.bind(this));

            name = this.content.querySelector('.name');
            datepicker = this.content.querySelector('.datepicker');
            chart = this.content.querySelector('.chart');

            name.innerHTML = this.data.endpoint + ' <i class="mdi-arrow-right"></i> ' + this.data.property;
            datepicker.querySelector('input[name="start"]').value = start;
            datepicker.querySelector('input[name="end"]').value = end;

            if (!guest)
            {
                this.content.querySelector('.edit').addEventListener('click', function() { this.showItemEdit(); }.bind(this));
                this.content.querySelector('.remove').addEventListener('click', function() { this.showItemRemove(); }.bind(this));
            }
            else
                this.content.querySelectorAll('.edit, .remove').forEach(item => item.remove());

            this.content.querySelector('.debounce').innerHTML = '<span class="value">' + this.data.debounce + '</span> seconds';
            this.content.querySelector('.threshold').innerHTML = '<span class="value">' + this.data.threshold + '</span>';

            this.content.querySelector('.interval').querySelectorAll('span').forEach(element =>
            {
                if (element.innerHTML == interval)
                    element.classList.add('warning');

                element.addEventListener('click', function()
                {
                    this.content.querySelector('.interval').querySelectorAll('span').forEach(element => element.classList.remove('warning'));
                    element.classList.add('warning');

                    datepicker.style.display = element.innerHTML == 'custom' ? 'block' : 'none';

                    if (datepicker.style.display == 'block')
                        return;

                    localStorage.setItem('homedRecorderInterval', element.innerHTML);

                    this.content.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';
                    this.chartQuery([this.data], chart, element.innerHTML);

                }.bind(this));
            });

            this.content.querySelector('.shift').querySelectorAll('span').forEach(element =>
            {
                element.addEventListener('click', function()
                {
                    this.content.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';
                    this.chartQuery([this.data], chart, chart.querySelector('canvas').interval, element.id);

                }.bind(this))
            });

            datepicker.querySelector('.apply').addEventListener('click', function()
            {
                start = datepicker.querySelector('input[name="start"]').value;
                end = datepicker.querySelector('input[name="end"]').value;

                if (!start || !end)
                    return;

                datepicker.style.display = 'none';

                localStorage.setItem('homedRecorderInterval', 'custom');
                localStorage.setItem('homedRecorderStart', start);
                localStorage.setItem('homedRecorderEnd', end);

                this.content.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';
                this.chartQuery([this.data], chart, 'custom', null, new Date(start).getTime(), new Date(end).getTime());

            }.bind(this));

            this.content.querySelectorAll('#data').forEach(item => { item.id = id; });

            if (this.counter(this.data))
            {
                let canvas = chart.querySelector('canvas');
                let element = this.content.querySelector('.change');

                canvas.change = true;
                element.innerHTML = '<i class="mdi-toggle-switch toggleIcon"></i> SHOW CHANGE';

                element.addEventListener('click', function()
                {
                    canvas.change = canvas.change ? false : true;
                    element.innerHTML = '<i class="' + (canvas.change ? 'mdi-toggle-switch' : 'mdi-toggle-switch-off') + ' toggleIcon"></i> SHOW CHANGE';
                    this.content.querySelector('.status').innerHTML = '<div class="dataLoader"></div>';
                    this.chartQuery([this.data], chart, canvas.interval);

                }.bind(this));
            }
            else
                this.content.querySelector('.change').closest('.title').remove();

            this.devicePromise(this.data, name, false, true);
            this.chartQuery([this.data], chart, interval, null, start ? new Date(start).getTime() : null, end ? new Date(end).getTime() : null);
        });
    }

    showItemEdit(add, data)
    {
        loadHTML('html/recorder/itemEdit.html', this, modal.querySelector('.data'), function()
        {
            let name = modal.querySelector('.name');
            let item;

            if (data)
            {
                let element = modal.querySelector('.property');
                element.innerHTML = data.endpoint + ' <i class="mdi-arrow-right"></i> ' + data.property;
                this.devicePromise(data, element);
            }

            if (add)
            {
                let properties = this.controller.propertiesList();

                item = new Object();
                name.innerHTML = 'New recorder item';

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
                name.innerHTML = item.endpoint + ' <i class="mdi-arrow-right"></i> ' + item.property;
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

                this.item = item;
                this.controller.socket.publish('command/recorder', {...{action: 'updateItem'}, ...item});
                this.controller.clearPage();

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }

    showItemRemove()
    {
        loadHTML('html/recorder/itemRemove.html', this, modal.querySelector('.data'), function()
        {
            let name = modal.querySelector('.name');

            name.innerHTML = this.data.endpoint + ' <i class="mdi-arrow-right"></i> ' + this.data.property;
            modal.querySelector('.remove').addEventListener('click', function() { this.controller.socket.publish('command/recorder', {action: 'removeItem', endpoint: this.data.endpoint, property: this.data.property}); this.controller.clearPage(); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.devicePromise(this.data, name);
            showModal(true);
        });
    }
}
