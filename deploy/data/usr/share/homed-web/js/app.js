var websocket, page, zigbeeData, exposeData = [], deviceData, endpoints, logicalType = ['coordinator', 'router', 'end device'], theme = localStorage.getItem('theme') ?? 'light';

// startup

window.onload = function()
{
    websocket = new WebSocket('ws://' + location.host);
    websocket.onopen = function() { subscribe('service/zigbee'); };
    websocket.onmessage = messageReceved;

    document.querySelector('#showDevices').addEventListener('click', function() { showPage('deviceList'); });
    document.querySelector('#showMap').addEventListener('click', function() { showPage('networkMap'); });
    document.querySelector('#permitJoin').addEventListener('click', function() { sendCommand({action: 'setPermitJoin', enabled: zigbeeData.permitJoin ? false : true}); });
    document.querySelector('#toggleTheme').addEventListener('click', function() { theme = theme != 'light' ? 'light' : 'dark'; localStorage.setItem('theme', theme); location.reload(); });

    document.querySelector('body').setAttribute('theme', theme);
    document.querySelector('.homed').setAttribute('theme', theme);
    document.querySelector('#toggleTheme').innerHTML = 'DARK THEME ' + (theme != 'light' ? '<i class="icon-on"></i>' : '<i class="icon-off"></i>');

    window.addEventListener('hashchange', function() { showPage(location.hash.slice(1)); });
    window.addEventListener('mousedown', function(event) { if (event.target == document.querySelector('#modal')) closeModal(); });
};

document.onkeydown = function(event)
{
    if (event.key == 'Esc' || event.key == 'Escape')
        closeModal();
};

function subscribe(topic)
{
    websocket.send(JSON.stringify({'action': 'subscribe', 'topic': topic}));
}

function sendCommand(data)
{
    websocket.send(JSON.stringify({'action': 'publish', 'topic': 'command/zigbee', 'message': data}));
}

function sendData(endpoint, data)
{
    websocket.send(JSON.stringify({'action': 'publish', 'topic': 'td/zigbee/' + (zigbeeData.names ? deviceData.name : deviceData.ieeeAddress) + (isNaN(endpoint) ? '' : '/' + endpoint), 'message': data}));
}

function messageReceved(event)
{
    var data = JSON.parse(event.data);

    if (data.topic == 'service/zigbee')
    {
        if (data.message.status != 'online')
        {
            // mqtt.unsubscribe(settings.prefix + '/status/zigbee');
            // mqtt.unsubscribe(settings.prefix + '/event/zigbee');
            // mqtt.unsubscribe(settings.prefix + '/device/zigbee/#');
            // mqtt.unsubscribe(settings.prefix + '/expose/zigbee/#');
            // mqtt.unsubscribe(settings.prefix + '/fd/zigbee/#');

            clearPage('HOMEd ZigBee Service is OFFLINE');
        }
        else
        {
            subscribe('status/zigbee');
            subscribe('event/zigbee');
        }
    }
    else if (data.topic == 'status/zigbee')
    {
        var check = zigbeeData ? zigbeeData.devices.map(device => new Object({[device.ieeeAddress]: device.removed ?? false})) : [];

        zigbeeData = data.message;
        document.querySelector('#permitJoin').innerHTML = (zigbeeData.permitJoin ? '<i class="icon-enable warning"></i>' : '<i class="icon-enable shade"></i>') + ' PERMIT JOIN';
        document.querySelector('#serviceVersion').innerHTML = zigbeeData.version ?? 'unknown';

        if (JSON.stringify(check) != JSON.stringify(zigbeeData.devices.map(device => new Object({[device.ieeeAddress]: device.removed ?? false}))))
        {
            showPage('deviceList', true);
            return;
        }

        zigbeeData.devices.forEach(device =>
        {
            var row = document.querySelector('tr[data-address="' + device.ieeeAddress + '"], tr[data-name="' + device.name + '"]');

            if (!row)
                return;

            updateLastSeen(row, device.lastSeen);
        });
    }
    else if (data.topic == 'event/zigbee')
    {
        var html = 'Device <b>' + data.message.device + '</b> ';

        switch (data.message.event)
        {
            case 'deviceJoined':
                showToast(html + 'joined network');
                break;

            case 'deviceLeft':
                showToast(html + 'left network', 'warning');
                break;

            case 'deviceNameDuplicate':
                showToast(html + 'rename failed, name already in use', 'error');
                break;

            case 'deviceUpdated':
                showToast(html + 'successfully updated');
                break;

            case 'interviewError':
                showToast(html + 'interview error', 'error');
                break;

            case 'interviewTimeout':
                showToast(html + 'interview timed out', 'error');
                break;

            case 'interviewFinished':
                showToast(html + 'interview finished');
                break;
        }
    }
    else if (data.topic.startsWith('device/zigbee/'))
    {
        var list = data.topic.split('/');
        var row = document.querySelector('tr[data-address="' + list[2] + '"], tr[data-name="' + list[2] + '"]');

        if (!data.message || !row)
            return;

        if (data.message.status == 'online')
        {
            row.classList.remove('unavailable');
            row.querySelector('.availability').innerHTML = '<i class="icon-true success"></i>';
        }
        else
        {
            row.classList.add('unavailable');
            row.querySelector('.availability').innerHTML = '<i class="icon-false error"></i>';
        }
    }
    else if (data.topic.startsWith('expose/zigbee/'))
    {
        var list = data.topic.split('/');

        if (!data.message)
            return;

        exposeData[list[2]] = data.message;
    }
    else if (data.topic.startsWith('fd/zigbee/'))
    {
        var list = data.topic.split('/');
        var row = document.querySelector('.deviceList tr[data-address="' + list[2] + '"], .deviceList tr[data-name="' + list[2] + '"]');

        if (row)
        {
            row.querySelector('.linkQuality').innerHTML = data.message.linkQuality;
            return;
        }

        if (deviceData && ((deviceData.hasOwnProperty('name') && deviceData.name == list[2]) || deviceData.ieeeAddress == list[2]))
            Object.keys(data.message).forEach(item => { updateExpose(list[3], item, data.message[item]); });
    }
}

// page

function showPage(name, force = false)
{
    var container = document.querySelector('.content .container');


    if (!zigbeeData || (page == name && !force))
        return;

    location.hash = name;
    page = name;

    switch (name)
    {
        case 'deviceInfo':


            fetch('html/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                var exposes = exposeData[deviceData.ieeeAddress] ?? exposeData[deviceData.name];

                console.log(deviceData.ieeeAddress, deviceData.name, exposes);

                container.innerHTML = html;
                container.querySelector('.rename').addEventListener('click', function() { showModal('deviceRename'); });
                container.querySelector('.remove').addEventListener('click', function() { showModal('deviceRemove'); });
                container.querySelector('.data').addEventListener('click', function() { showModal('deviceData'); });
                container.querySelector('.topics').addEventListener('click', function() { showModal('deviceTopics'); });

                for (var key in deviceData)
                {
                    var cell = document.querySelector(' .' + key);

                    if (!cell)
                        continue;

                    cell.innerHTML = parseValue(key, deviceData[key]);
                }

                if (!deviceData.logicalType)
                {
                    container.querySelector('.rename').style.display = 'none';
                    container.querySelector('.remove').style.display = 'none';
                    container.querySelector('.exposes').style.display = 'none';
                    return;
                }

                endpoints = {fd: [], td: []};

                Object.keys(exposes).forEach(endpoint =>
                {
                    if (!isNaN(endpoint))
                        subscribe('fd/zigbee/' + (zigbeeData.names ? deviceData.name : deviceData.ieeeAddress) + '/' + endpoint);

                    exposes[endpoint].items.forEach(expose => { addExpose(endpoint, expose, exposes[endpoint].options, endpoints); });
                });

                addExpose('common', 'linkQuality');
                sendCommand({action: 'getProperties', device: deviceData.ieeeAddress});
            });

            break;

        case 'networkMap':

            fetch('html/networkMap.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                var map, width, height, link, text, node, routerLinks = false;
                var data = {nodes: [], links: []};
                var drag = d3.drag();
                var simulation = d3.forceSimulation();
                var symbol = [d3.symbolStar, d3.symbolTriangle, d3.symbolCircle];

                container.innerHTML = html;
                container.querySelector('input[name="routerLinks"]').addEventListener('change', function() { routerLinks = this.checked; simulation.restart(); });

                map = d3.select('#map');
                width = parseInt(map.style('width'));
                height = parseInt(map.style('height'));

                zigbeeData.devices.forEach(device =>
                {
                    if (device.hasOwnProperty('removed'))
                        return;

                    data.nodes.push({id: device.networkAddress, name: device.name, type: device.logicalType});

                    if (!device.hasOwnProperty('neighbors'))
                        return;

                    device.neighbors.forEach(neighbor =>
                    {
                        if (!zigbeeData.devices.find(item => { return !item.removed && item.networkAddress == neighbor.networkAddress; }))
                            return;

                        data.links.push({linkQuality: neighbor.linkQuality, source: neighbor.networkAddress, target: device.networkAddress});
                    });
                });

                link = map.selectAll('.link').data(data.links).enter().append('path').attr('class', 'link').attr('id', function(d, i) { return 'link' + i; });
                text = map.selectAll('.text').data(data.links).enter().append('text').attr('class', 'text').attr('dy', -1);
                text.append('textPath').style('text-anchor', 'middle').attr('startOffset', '50%').attr('href', function(d, i) { return '#link' + i; }).text(function(d) { return d.linkQuality; });

                node = map.append('g').selectAll('g').data(data.nodes).enter().append('g');
                node.append('path').attr('class', 'node').attr('d', d3.symbol().size(100).type(function(d) { return symbol[d.type ?? 2]; }));
                node.append('text').text(function(d) { return d.name; }).attr('x', 12).attr('y', 3);

                node.select('path').on('mouseenter', function(d)
                {
                    text.attr('display', 'none').filter(i => i.source.id == d.id || i.target.id == d.id).attr('display', 'block');
                    link.attr('display', 'none').filter(i => i.source.id == d.id || i.target.id == d.id).attr('display', 'block').classed('highlight', true);
                });

                node.select('path').on('mouseleave', function() { text.attr('display', 'block'); link.attr('display', 'block').classed('highlight', false); });
                node.select('text').on('click', function(d) { deviceData = zigbeeData.devices.filter(i => i.networkAddress == d.id)[0]; showPage('deviceInfo'); });

                drag.on('start', function(d) { if (!d3.event.active) simulation.alphaTarget(0.1).restart(); d.fx = d.x; d.fy = d.y; });
                drag.on('drag', function(d) { d.fx = d3.event.x; d.fy = d3.event.y; });
                drag.on('end', function(d) { if (!d3.event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });

                simulation.force('center', d3.forceCenter(width / 2, height / 2));
                simulation.force('charge', d3.forceManyBody().strength(-2000));
                simulation.force('radial', d3.forceRadial(function(d) { return d.type * 100; }, width / 2, height / 2).strength(1));
                simulation.force('link', d3.forceLink().id(function(d) { return d.id; }));

                simulation.nodes(data.nodes).on('tick', function()
                {
                    link.attr('d', function(d) { if (routerLinks || d.source.type != d.target.type) return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + d.target.x + ' ' + d.target.y; });
                    node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
                });

                simulation.force('link').links(data.links);
                drag(node);
            });

            break;

        default:

            fetch('html/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                container.innerHTML = html;

                zigbeeData.devices.forEach(device =>
                {
                    if (!device.hasOwnProperty('removed'))
                    {
                        var row = container.querySelector('.deviceList tbody').insertRow(device.logicalType ? -1 : 0);

                        if (!device.name)
                            device.name = device.ieeeAddress;

                        row.addEventListener('click', function() { deviceData = device; showPage('deviceInfo'); });
                        row.dataset.address = device.ieeeAddress;
                        row.dataset.name = device.name;

                        for (var i = 0; i < 9; i++)
                        {
                            var cell = row.insertCell();

                            switch (i)
                            {
                                case 0: cell.innerHTML = device.name; break;
                                case 1: cell.innerHTML = device.manufacturerName ?? '-'; break;
                                case 2: cell.innerHTML = device.modelName ?? '-'; break;
                                case 3: cell.innerHTML = logicalType[device.logicalType]; break;
                                case 4: cell.innerHTML = parseValue('powerSource', device.powerSource); cell.classList.add('center'); break;
                                case 5: cell.innerHTML = parseValue('supported', device.supported); cell.classList.add('center'); break;
                                case 6: cell.innerHTML = '-'; cell.classList.add('availability', 'center'); break;
                                case 7: cell.innerHTML = device.linkQuality ?? '-'; cell.classList.add('linkQuality', 'right'); break;
                                case 8: cell.innerHTML = '-'; cell.classList.add('lastSeen', 'right'); break;
                            }
                        }

                        updateLastSeen(row, device.lastSeen);

                        if (device.logicalType)
                        {
                            var item = zigbeeData.names ? device.name : device.ieeeAddress;

                            subscribe('device/zigbee/' + item);
                            subscribe('expose/zigbee/' + item);
                            subscribe('fd/zigbee/'     + item);
                        }
                    }
                });

                container.querySelectorAll('.deviceList th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(this.dataset.index); }) );
                sortTable(localStorage.getItem('sort') ?? 0);
            });

            break;
    }
}

function clearPage(warning = null)
{
    var container = document.querySelector('.content .container');

    fetch('html/loader.html?' + Date.now()).then(response => response.text()).then(html =>
    {
        container.innerHTML = html;

        if (warning)
        {
            container.querySelector('.warning').innerHTML = warning;
            console.log(warning);
        }

        zigbeeData = undefined;
        closeModal();
    });
}

// modal

function showModal(name)
{
    var modal = document.querySelector('#modal');

    switch (name)
    {
        case 'deviceRename':

            fetch('html/deviceRename.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;

                modal.querySelector('.title').innerHTML = 'Renaming "' + deviceData.name + '"...';
                modal.querySelector('input[name="name"]').value = deviceData.name;
                modal.querySelector('.save').addEventListener('click', function() { renameDevice(deviceData.ieeeAddress, modal.querySelector('input[name="name"]').value); });
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });

                modal.addEventListener('keypress', function(event) { if (event.key == 'Enter') { event.preventDefault(); modal.querySelector('.save').click(); }});

                modal.style.display = 'block';
                modal.querySelector('input[name="name"]').focus();
            });

            break;

        case 'deviceRemove':

            fetch('html/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;

                modal.querySelector('.title').innerHTML = 'Remove "' + deviceData.name + '"?';
                modal.querySelector('.graceful').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, false); });
                modal.querySelector('.force').addEventListener('click', function() { removeDevice(deviceData.ieeeAddress, true); });
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });

                modal.style.display = 'block';
            });

            break;

        case 'deviceData':

            fetch('html/deviceData.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                modal.querySelector('.data').innerHTML = html;

                modal.querySelector('.title').innerHTML = deviceData.name;
                modal.querySelector('.json').innerHTML = JSON.stringify(deviceData, null, 4);
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });

                modal.style.display = 'block';
            });

            break;

        case 'deviceTopics':

            fetch('html/deviceTopics.html?' + Date.now()).then(response => response.text()).then(html =>
            {
                var item = zigbeeData.names ? deviceData.name : deviceData.ieeeAddress;
                var list;

                modal.querySelector('.data').innerHTML = html;

                list = modal.querySelector('.list');
                list.innerHTML += '<label>Availability:</label><pre>{prefix}/device/zigbee/' + item + '</pre>';
                list.innerHTML += '<label>Exposes:</label><pre>{prefix}/expose/zigbee/' + item + '</pre>';

                if (endpoints.fd.length)
                {
                    list.innerHTML += '<label>From device:</label><pre class="fd"></pre>';
                    endpoints.fd.forEach(endpoint => { list.querySelector('pre.fd').innerHTML += '{prefix}/fd/zigbee/' + item + (isNaN(endpoint) ? '' : '/' + endpoint) + '\n'; });
                }

                if (endpoints.td.length)
                {
                    list.innerHTML += '<label>To device:</label><pre class="td"></pre>';
                    endpoints.td.forEach(endpoint => { list.querySelector('pre.td').innerHTML += '{prefix}/td/zigbee/' + item + (isNaN(endpoint) ? '' : '/' + endpoint) + '\n'; });
                }

                modal.querySelector('.title').innerHTML = 'Topics for "' + deviceData.name + '":';
                modal.querySelector('.cancel').addEventListener('click', function() { closeModal(); });

                modal.style.display = 'block';
            });

            break;

        default:
            return;
    }

}

function closeModal()
{
    document.querySelector('#modal').style.display = 'none';
}

// toast

function showToast(message, style = 'success')
{
    var item = document.createElement('div');

    item.innerHTML = '<div class="message">' + message + '</div>';
    item.classList.add('item', 'fade-in', style);
    item.addEventListener('click', function() { closeToast(this); });

    document.querySelector('#toast').appendChild(item);
    setTimeout(closeToast, 5000, item);
}

function closeToast(item)
{
    var toast = document.querySelector('#toast');

    if (toast.contains(item))
    {
        setTimeout(function() { toast.removeChild(item); }, 200);
        item.classList.add('fade-out');
    }
}

// action

function renameDevice(ieeeAddress, name)
{
    clearPage();
    sendCommand({action: 'setDeviceName', device: ieeeAddress, name: name});
}

function removeDevice(ieeeAddress, force)
{
    clearPage();
    sendCommand({action: 'removeDevice', device: ieeeAddress, force: force});
}

// misc

function formData(form)
{
    var data = {};
    Array.from(form).forEach((input) => { data[input.name] =  input.type == 'checkbox' ? input.checked : input.value; });
    return data;
}

function parseValue(key, value)
{
    switch (key)
    {
        case 'logicalType': return logicalType[value];
        case 'powerSource': return value != undefined ? '<i class="icon-' + (value != 0 && value != 3 ? 'plug' : 'battery') + '"></i>' : '-';

        case 'networkAddress':
        case 'manufacturerCode':
            return '0x' + ('0000' + value.toString(16)).slice(-4);

        case 'supported':
        case 'interviewFinished':
            return value != undefined ? '<i class="icon-' + (value ? 'true' : 'false') + ' ' + (value ? 'success' : 'warning') + '"></i>' : '-';

        default: return value;
    }
}

function updateLastSeen(row, lastSeen)
{
    var cell = row.querySelector('.lastSeen');
    var interval = Date.now() / 1000 - lastSeen;

    switch (true)
    {
        case interval >= 86400: cell.innerHTML = Math.round(interval / 86400) + ' day'; break;
        case interval >= 3600:  cell.innerHTML = Math.round(interval / 3600) + ' hrs'; break;
        case interval >= 60:    cell.innerHTML = Math.round(interval / 60) + ' min'; break;
        default:                cell.innerHTML = 'now'; break;
    }
}

function sortTable(index)
{
    var table = document.querySelector('.deviceList')
    var check = true;

    while (check)
    {
        var rows = table.rows;

        check = false;

        for (var i = 2; i < rows.length - 1; i++)
        {
            if (rows[i].querySelectorAll('td')[index].innerHTML.toLowerCase() > rows[i + 1].querySelectorAll('td')[index].innerHTML.toLowerCase())
            {
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                check = true;
                break;
            }
        }
    }

    table.querySelectorAll('th.sort').forEach(cell => cell.classList.remove('warning') );
    table.querySelector('th[data-index="' + index + '"]').classList.add('warning');

    localStorage.setItem('sort', index);
}
