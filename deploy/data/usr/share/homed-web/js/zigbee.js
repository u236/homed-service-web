class ZigBee
{
    logicalType = ['coordinator', 'router', 'end device'];
    content = document.querySelector('.content .container');
    modal = document.querySelector('#modal');

    constructor(controller)
    {
        var zigbee = this;
        zigbee.controller = controller;
        setInterval(function() { zigbee.updateLastSeen(); }, 100);
    }

    updateLastSeen()
    {
        var status = this.controller.status.zigbee ?? new Object();

        if (!status.devices)
            return;

        status.devices.forEach(device =>
        {
            var row = document.querySelector('tr[data-device="' + (status.names ? device.name : device.ieeeAddress) + '"]');

            if (!row)
                return;

            row.querySelector('.lastSeen').innerHTML = timeInterval(Date.now() / 1000 - device.lastSeen);
        });
    }

    parseValue(key, value)
    {
        switch (key)
        {
            case 'active':
            case 'cloud':
            case 'discovery':
            case 'interviewFinished':
            case 'supported':
                return value != undefined ? '<i class="icon-' + (value ? 'true' : 'false') + ' ' + (value ? 'success' : 'shade') + '"></i>' : empty;

            case 'logicalType': return this.logicalType[value];
            case 'powerSource': return value != undefined ? '<i class="icon-' + (value != 0 && value != 3 ? 'plug' : 'battery') + '"></i>' : empty;

            case 'manufacturerCode':
            case 'networkAddress':
                return '0x' + ('0000' + value.toString(16)).slice(-4);

            default: return value;
        }
    }

    event(message)
    {
        switch(message.event)
        {
            case 'clusterRequest':
            case 'globalRequest':
            {
                var item = this.modal.querySelector('.debugResult');

                if (!item)
                    return;

                item.innerHTML = JSON.stringify(message, null, 2);
            }

            case 'requestFinished':
            {
                var item = this.modal.querySelector('.debugStatus');
                var status = parseInt(message.status);

                if (!item)
                    return;

                item.innerHTML = 'status: ' + (status ? '<span class="error">failed (' + status + ')</span>' : '<span class="success">success</span>');
            }
        }
    }

    showDeviceList()
    {
        var status = this.controller.status.zigbee ?? new Object();

        this.controller.setService('zigbee');
        this.controller.setPage('zigbee');

        if (!status.devices)
        {
            this.controller.clearPage('zigbee', 'zigbee service devices list is empty');
            return;
        }

        fetch('html/zigbee/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;
            var table;

            zigbee.content.innerHTML = html;
            table = zigbee.content.querySelector('.deviceList table');

            status.devices.forEach(device =>
            {
                if (!device.hasOwnProperty('removed'))
                {
                    var row = table.querySelector('tbody').insertRow(device.logicalType ? -1 : 0);

                    if (!device.name)
                        device.name = device.ieeeAddress;

                    row.addEventListener('click', function() { zigbee.device = device; zigbee.showDeviceInfo(); });
                    row.dataset.device = status.names ? device.name : device.ieeeAddress;

                    for (var i = 0; i < 10; i++)
                    {
                        var cell = row.insertCell();

                        switch (i)
                        {
                            case 0: cell.innerHTML = device.name; break;
                            case 1: cell.innerHTML = device.manufacturerName ?? empty; break;
                            case 2: cell.innerHTML = device.modelName ?? empty; break;
                            case 3: cell.innerHTML = zigbee.parseValue('powerSource', device.powerSource); cell.classList.add('center'); break;
                            case 4: cell.innerHTML = zigbee.parseValue('supported', device.supported); cell.classList.add('center'); break;
                            case 5: cell.innerHTML = empty; cell.classList.add('availability', 'center'); break;
                            case 6: cell.innerHTML = zigbee.parseValue('discovery', device.discovery); cell.classList.add('center'); break;
                            case 7: cell.innerHTML = zigbee.parseValue('cloud', device.cloud); cell.classList.add('center'); break;
                            case 8: cell.innerHTML = device.linkQuality ?? empty; cell.classList.add('linkQuality', 'center'); break;
                            case 9: cell.innerHTML = empty; cell.classList.add('lastSeen', 'right'); break;
                        }
                    }

                    zigbee.controller.socket.subscribe('device/zigbee/' + (status.names ? device.name : device.ieeeAddress));
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index, false); localStorage.setItem('zigbeeSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('zigbeeSort') ?? 0, false);
        });
    }

    showDeviceMap()
    {
        var status = this.controller.status.zigbee ?? new Object();

        this.controller.setService('zigbee');
        this.controller.setPage('zigbeeMap');

        if (!status.devices)
        {
            this.controller.clearPage('zigbee', 'zigbee service devices list is empty');
            return;
        }

        fetch('html/zigbee/deviceMap.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;
            var map, width, height, link, text, node, routerLinks = false;
            var data = {nodes: new Array(), links: new Array()};
            var drag = d3.drag();
            var simulation = d3.forceSimulation();
            var symbol = [d3.symbolStar, d3.symbolTriangle, d3.symbolCircle];

            zigbee.content.innerHTML = html;
            zigbee.content.querySelector('input[name="routerLinks"]').addEventListener('change', function() { routerLinks = this.checked; simulation.restart(); });

            map = d3.select('.deviceMap svg');
            width = parseInt(map.style('width'));
            height = parseInt(map.style('height'));

            status.devices.forEach(device =>
            {
                if (device.hasOwnProperty('removed') || (device.hasOwnProperty('active') && !device.active))
                    return;

                data.nodes.push({id: device.networkAddress, name: device.name, type: device.logicalType});

                if (!device.hasOwnProperty('neighbors'))
                    return;

                device.neighbors.forEach(neighbor =>
                {
                    if (!status.devices.find(item => { return item.networkAddress == neighbor.networkAddress && !item.removed && (!item.hasOwnProperty('active') || item.active); }))
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
            node.select('text').on('click', function(d) { zigbee.device = status.devices.filter(i => i.networkAddress == d.id)[0]; zigbee.showDeviceInfo(); });

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
    }

    showDeviceInfo()
    {
        var names = this.controller.status.zigbee.names;
        var expose = this.device.active ? this.controller.expose.zigbee[names ? this.device.name : this.device.ieeeAddress] : undefined;

        this.controller.setService('zigbee');
        this.controller.setPage('zigbeeDevice');

        if (!this.device)
        {
            this.controller.clearPage('zigbee', 'zigbee device data is empty');
            return;
        }

        fetch('html/zigbee/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;

            zigbee.content.innerHTML = html;
            zigbee.content.querySelector('.edit').addEventListener('click', function() { zigbee.showDeviceEdit(); });
            zigbee.content.querySelector('.remove').addEventListener('click', function() { zigbee.showDeviceRemove(); });
            zigbee.content.querySelector('.data').addEventListener('click', function() { zigbee.showDeviceData(); });
            zigbee.content.querySelector('.debug').addEventListener('click', function() { zigbee.showDeviceDebug(); });
            zigbee.content.querySelector('.topics').addEventListener('click', function() { zigbee.showDeviceTopics(); });

            for (var key in zigbee.device)
            {
                var cell = document.querySelector('.' + key);
                var row = cell ? cell.closest('tr') : undefined;

                if (cell)
                    cell.innerHTML = zigbee.parseValue(key, zigbee.device[key]);

                if (row)
                    row.style.display = 'table-row';
            }

            if (!zigbee.device.logicalType)
            {
                zigbee.content.querySelector('.edit').style.display = 'none';
                zigbee.content.querySelector('.remove').style.display = 'none';
                zigbee.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            if (!expose)
            {
                zigbee.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            zigbee.endpoints = {fd: new Array(), td: new Array()}; // TODO: refactor this

            Object.keys(expose).forEach(endpoint =>
            {
                if (!isNaN(endpoint))
                    zigbee.controller.socket.subscribe('fd/zigbee/' + (names ? zigbee.device.name : zigbee.device.ieeeAddress) + '/' + endpoint);

                expose[endpoint].items.forEach(item => { addExpose(endpoint, item, expose[endpoint].options, zigbee.endpoints); });
            });

            addExpose('common', 'linkQuality');
            zigbee.controller.socket.publish('command/zigbee', {action: 'getProperties', device: zigbee.device.ieeeAddress});
        });
    }

    showDeviceEdit()
    {
        fetch('html/zigbee/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;

            zigbee.modal.querySelector('.data').innerHTML = html;
            zigbee.modal.querySelector('.name').innerHTML = zigbee.device.name;
            zigbee.modal.querySelector('input[name="name"]').value = zigbee.device.name;
            zigbee.modal.querySelector('input[name="active"]').checked = zigbee.device.active;
            zigbee.modal.querySelector('input[name="discovery"]').checked = zigbee.device.discovery;
            zigbee.modal.querySelector('input[name="cloud"]').checked = zigbee.device.cloud;
            zigbee.modal.querySelector('.save').addEventListener('click', function() { zigbee.controller.socket.publish('command/zigbee', {...{action: 'updateDevice', device: zigbee.device.name}, ...formData(zigbee.modal.querySelector('form'))}); });
            zigbee.modal.querySelector('.cancel').addEventListener('click', function() { showModal(zigbee.modal, false); });

            zigbee.modal.removeEventListener('keypress', handleSave);
            zigbee.modal.addEventListener('keypress', handleSave);
            showModal(zigbee.modal, true);

            zigbee.modal.querySelector('input[name="name"]').focus();
        });
    }

    showDeviceRemove()
    {
        fetch('html/zigbee/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;

            zigbee.modal.querySelector('.data').innerHTML = html;
            zigbee.modal.querySelector('.name').innerHTML = zigbee.device.name;
            zigbee.modal.querySelector('.graceful').addEventListener('click', function() { zigbee.controller.socket.publish('command/zigbee', {action: 'removeDevice', device: zigbee.device.name}); zigbee.controller.clearPage('zigbee'); });
            zigbee.modal.querySelector('.force').addEventListener('click', function() { zigbee.controller.socket.publish('command/zigbee', {action: 'removeDevice', device: zigbee.device.name, force: true}); zigbee.controller.clearPage('zigbee'); });
            zigbee.modal.querySelector('.cancel').addEventListener('click', function() { showModal(zigbee.modal, false); });

            showModal(zigbee.modal, true);
        });
    }

    showDeviceData()
    {
        fetch('html/zigbee/deviceData.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;

            zigbee.modal.querySelector('.data').innerHTML = html;
            zigbee.modal.querySelector('.name').innerHTML = zigbee.device.name;
            zigbee.modal.querySelector('.json').innerHTML = JSON.stringify(zigbee.device, null, 2);
            zigbee.modal.querySelector('.cancel').addEventListener('click', function() { showModal(zigbee.modal, false); });

            showModal(zigbee.modal, true);
        });
    }

    showDeviceDebug()
    {
        console.log('here');

        fetch('html/zigbee/deviceDebug.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;

            zigbee.modal.querySelector('.data').innerHTML = html;
            zigbee.modal.querySelector('.name').innerHTML = zigbee.device.name;

            zigbee.device.endpoints.forEach(item =>
            {
                var option = document.createElement('option');
                option.innerHTML = item.endpointId;
                zigbee.modal.querySelector('select[name="endpointId"]').append(option);
            });

            zigbee.modal.querySelector('.send').addEventListener('click', function()
            {
                var data = formData(zigbee.modal.querySelector('form'));
                var request = new Object();

                request.action = data.clusterSpecific ? 'clusterRequest' : 'globalRequest';
                request.device = zigbee.device.ieeeAddress;
                request.endpointId = parseInt(data.endpointId);
                request.clusterId = parseInt(data.clusterId) || 0;
                request.commandId = parseInt(data.commandId) || 0;
                request.payload = data.payload;

                if (data.manufacturerCode && !isNaN(data.manufacturerCode))
                    request.manufacturerCode = parseInt(data.manufacturerCode);

                zigbee.modal.querySelector('.debugStatus').innerHTML = 'status: pending';
                zigbee.controller.socket.publish('command/zigbee', request);
            });

            zigbee.modal.querySelector('.cancel').addEventListener('click', function() { showModal(zigbee.modal, false); });

            zigbee.modal.removeEventListener('keypress', handleSend);
            zigbee.modal.addEventListener('keypress', handleSend);
            showModal(zigbee.modal, true);
        });
    }

    showDeviceTopics() // TODO: refactor and add prefix?
    {
        fetch('html/zigbee/deviceTopics.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var zigbee = this;
            var item = zigbee.controller.status.zigbee.names ? zigbee.device.name : zigbee.device.ieeeAddress;
            var list;

            zigbee.modal.querySelector('.data').innerHTML = html;

            list = modal.querySelector('.list');
            list.innerHTML += '<label>Availability:</label><pre>{prefix}/device/zigbee/' + item + '</pre>';
            list.innerHTML += '<label>Exposes:</label><pre>{prefix}/expose/zigbee/' + item + '</pre>';

            if (zigbee.endpoints.fd.length)
            {
                list.innerHTML += '<label>From device:</label><pre class="fd"></pre>';
                zigbee.endpoints.fd.forEach(endpoint => { list.querySelector('pre.fd').innerHTML += '{prefix}/fd/zigbee/' + item + (isNaN(endpoint) ? '' : '/' + endpoint) + '\n'; });
            }

            if (zigbee.endpoints.td.length)
            {
                list.innerHTML += '<label>To device:</label><pre class="td"></pre>';
                zigbee.endpoints.td.forEach(endpoint => { list.querySelector('pre.td').innerHTML += '{prefix}/td/zigbee/' + item + (isNaN(endpoint) ? '' : '/' + endpoint) + '\n'; });
            }

            zigbee.modal.querySelector('.name').innerHTML = zigbee.device.name;
            zigbee.modal.querySelector('.cancel').addEventListener('click', function() { showModal(zigbee.modal, false); });

            showModal(zigbee.modal, true);
        });
    }
}
