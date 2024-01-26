class ZigBee
{
    logicalType = ['coordinator', 'router', 'end device'];
    content = document.querySelector('.content .container');

    status = new Object();
    expose = new Object();

    constructor(controller)
    {
        setInterval(function() { this.updateLastSeen(); }.bind(this), 100);
        this.controller = controller;
    }

    updateLastSeen()
    {
        if (!this.status.devices)
            return;

        this.status.devices.forEach(device =>
        {
            var interval = timeInterval(Date.now() / 1000 - device.lastSeen);

            switch (this.controller.page)
            {
                case 'zigbee':

                    var row = document.querySelector('tr[data-device="' + (this.status.names ? device.name : device.ieeeAddress) + '"]');

                    if (row)
                        row.querySelector('.lastSeen').innerHTML = interval;

                    break;

                case 'zigbeeDevice':

                    if (this.device.ieeeAddress == device.ieeeAddress)
                        document.querySelector('.lastSeen').innerHTML = interval;

                    break;
            }
        });
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                var check = this.status.devices ? this.status.devices.map(device => new Object({[device.ieeeAddress]: device.removed ?? false})) : null;

                this.status = message;

                if (this.controller.service == 'zigbee')
                {
                    if (JSON.stringify(check) != JSON.stringify(this.status.devices.map(device => new Object({[device.ieeeAddress]: device.removed ?? false}))))
                        this.showDeviceList();

                    document.querySelector('#permitJoin i').className = 'icon-enable ' + (this.status.permitJoin ? 'warning' : 'shade');
                    document.querySelector('#serviceVersion').innerHTML = this.status.version;
                }

                this.status.devices.forEach(device =>
                {
                    var item = this.status.names && device.name ? device.name : device.ieeeAddress;
                    this.controller.socket.subscribe('expose/zigbee/' + item);
                    this.controller.socket.subscribe('fd/zigbee/' + item);
                });

                break;

            case 'event':

                var html = 'Device <b>' + message.device + '</b> ';

                if (message.event == 'deviceUpdated')
                    this.controller.clearPage('zigbee');

                switch (message.event)
                {
                    case 'deviceJoined':        this.controller.showToast(html + 'joined network'); return;
                    case 'deviceLeft':          this.controller.showToast(html + 'left network', 'warning');  return;
                    case 'deviceNameDuplicate': this.controller.showToast(html + 'name is already in use', 'error'); return;
                    case 'deviceUpdated':       this.controller.showToast(html + 'successfully updated'); return;
                    case 'interviewError':      this.controller.showToast(html + 'interview error', 'error'); return;
                    case 'interviewTimeout':    this.controller.showToast(html + 'interview timed out', 'error'); return;
                    case 'interviewFinished':   this.controller.showToast(html + 'interview finished'); return;

                    case 'clusterRequest':
                    case 'globalRequest':

                        var item = modal.querySelector('.debugResult');

                        if (!item)
                            return;

                        item.innerHTML = JSON.stringify(message, null, 2);
                        break;

                    case 'requestFinished':

                        var item = modal.querySelector('.debugStatus');
                        var status = parseInt(message.status);

                        if (!item)
                            return;

                        item.innerHTML = 'status: ' + (status ? '<span class="error">failed: (' + status + ')</span>' : '<span class="success">success</span>');
                        break;
                }

                break;

            case 'device':

                var device = this.status.devices.find(item => this.status.names ? item.name == list[2] : item.ieeeAddress == list[2]);
                var row = document.querySelector('tr[data-device="' + list[2] + '"]');

                if (message)
                    device.lastSeen = message.lastSeen;

                if (this.controller.page == 'zigbee' && row)
                {
                    row.classList.remove('online', 'offline', 'inactive');

                    if (device.active)
                    {
                        row.classList.add(message.status);
                        row.querySelector('.availability').innerHTML = '<i class="' + (message.status == "online" ? 'icon-true success' : 'icon-false error') + '"></i>';
                    }
                    else
                    {
                        row.classList.add('inactive');
                        row.querySelector('.availability').innerHTML = '<i class="icon-false shade"></i>';
                    }
                }

                break;

            case 'expose':
                this.expose[list[2]] = message;
                break;

            case 'fd':

                var row = document.querySelector('tr[data-device="' + list[2] + '"]');

                if (this.controller.page == 'zigbee' && row)
                {
                    row.querySelector('.linkQuality').innerHTML = message.linkQuality;
                    break;
                }

                if (this.device && (this.status.names ? this.device.name == list[2] : this.device.ieeeAddress == list[2]))
                    Object.keys(message).forEach(item => { updateExpose(list[3], item, message[item]); });

                break;
        }
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

    showMenu()
    {
        var menu = document.querySelector('.menu');

        menu.innerHTML = null;

        menu.innerHTML += '<span id="list"><i class="icon-list"></i> Devices</span>';
        menu.innerHTML += '<span id="map"><i class="icon-map"></i> Map</span>';
        menu.innerHTML += '<span id="permitJoin"><i class="icon-false"></i> Permit Join</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.showDeviceList(); }.bind(this));
        menu.querySelector('#map').addEventListener('click', function() { this.showDeviceMap(); }.bind(this));
        menu.querySelector('#permitJoin').addEventListener('click', function() { this.controller.socket.publish('command/zigbee', {'action': 'togglePermitJoin'}); }.bind(this));

        if (!this.status)
            return;

        document.querySelector('#permitJoin i').className = 'icon-enable ' + (this.status.permitJoin ? 'warning' : 'shade');
        document.querySelector('#serviceVersion').innerHTML = this.status.version;
    }

    showDeviceList()
    {
        this.controller.setService('zigbee');
        this.controller.setPage('zigbee');

        if (!this.status.devices || !this.status.devices.length)
        {
            this.controller.clearPage('zigbee', 'zigbee service devices list is empty');
            return;
        }

        fetch('html/zigbee/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var table;

            this.content.innerHTML = html;
            table = this.content.querySelector('.deviceList table');

            this.status.devices.forEach(device =>
            {
                if (!device.hasOwnProperty('removed'))
                {
                    var row = table.querySelector('tbody').insertRow(device.logicalType ? -1 : 0);

                    if (!device.name)
                        device.name = device.ieeeAddress;

                    row.addEventListener('click', function() { this.device = device; this.showDeviceInfo(); }.bind(this));
                    row.dataset.device = this.status.names ? device.name : device.ieeeAddress;

                    for (var i = 0; i < 10; i++)
                    {
                        var cell = row.insertCell();

                        switch (i)
                        {
                            case 0: cell.innerHTML = device.name; break;
                            case 1: cell.innerHTML = device.manufacturerName ?? empty; break;
                            case 2: cell.innerHTML = device.modelName ?? empty; break;
                            case 3: cell.innerHTML = this.parseValue('powerSource', device.powerSource); cell.classList.add('center'); break;
                            case 4: cell.innerHTML = this.parseValue('supported', device.supported); cell.classList.add('center'); break;
                            case 5: cell.innerHTML = empty; cell.classList.add('availability', 'center'); break;
                            case 6: cell.innerHTML = this.parseValue('discovery', device.discovery); cell.classList.add('center'); break;
                            case 7: cell.innerHTML = this.parseValue('cloud', device.cloud); cell.classList.add('center'); break;
                            case 8: cell.innerHTML = device.linkQuality ?? empty; cell.classList.add('linkQuality', 'center'); break;
                            case 9: cell.innerHTML = empty; cell.classList.add('lastSeen', 'right'); break;
                        }
                    }

                    this.controller.socket.subscribe('device/zigbee/' + (this.status.names ? device.name : device.ieeeAddress));
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { sortTable(table, this.dataset.index, false); localStorage.setItem('zigbeeSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('zigbeeSort') ?? 0, false);
        });
    }

    showDeviceMap()
    {
        this.controller.setService('zigbee');
        this.controller.setPage('zigbeeMap');

        if (!this.status.devices)
        {
            this.controller.clearPage('zigbee', 'zigbee service devices list is empty');
            return;
        }

        fetch('html/zigbee/deviceMap.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var map, width, height, link, text, node, routerLinks = false;
            var data = {nodes: new Array(), links: new Array()};
            var drag = d3.drag();
            var simulation = d3.forceSimulation();
            var symbol = [d3.symbolStar, d3.symbolTriangle, d3.symbolCircle];

            this.content.innerHTML = html;
            this.content.querySelector('input[name="routerLinks"]').addEventListener('change', function() { routerLinks = this.checked; simulation.restart(); });

            map = d3.select('.deviceMap svg');
            width = parseInt(map.style('width'));
            height = parseInt(map.style('height'));

            this.status.devices.forEach(device =>
            {
                if (device.hasOwnProperty('removed') || (device.hasOwnProperty('active') && !device.active))
                    return;

                data.nodes.push({id: device.networkAddress, name: device.name, type: device.logicalType});

                if (!device.hasOwnProperty('neighbors'))
                    return;

                device.neighbors.forEach(neighbor =>
                {
                    if (!this.status.devices.find(item => { return item.networkAddress == neighbor.networkAddress && !item.removed && (!item.hasOwnProperty('active') || item.active); }))
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
            node.select('text').on('click', function(d) { this.device = this.status.devices.filter(i => i.networkAddress == d.id)[0]; this.showDeviceInfo(); }.bind(this));

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
        var expose = this.device.active ? this.expose[this.status.names ? this.device.name : this.device.ieeeAddress] : undefined;

        this.controller.setService('zigbee');
        this.controller.setPage('zigbeeDevice');

        if (!this.device)
        {
            this.controller.clearPage('zigbee', 'zigbee device data is empty');
            return;
        }

        fetch('html/zigbee/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            this.content.innerHTML = html;
            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(); }.bind(this));
            this.content.querySelector('.data').addEventListener('click', function() { this.showDeviceData(); }.bind(this));
            this.content.querySelector('.debug').addEventListener('click', function() { this.showDeviceDebug(); }.bind(this));
            this.content.querySelector('.topics').addEventListener('click', function() { this.showDeviceTopics(); }.bind(this));

            for (var key in this.device)
            {
                var cell = document.querySelector('.' + key);
                var row = cell ? cell.closest('tr') : undefined;

                if (cell)
                    cell.innerHTML = this.parseValue(key, this.device[key]);

                if (row)
                    row.style.display = 'table-row';
            }

            if (!this.device.logicalType)
            {
                this.content.querySelector('.edit').style.display = 'none';
                this.content.querySelector('.remove').style.display = 'none';
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            if (!expose)
            {
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            this.endpoints = {fd: new Array(), td: new Array()}; // TODO: refactor this

            Object.keys(expose).forEach(endpoint =>
            {
                if (!isNaN(endpoint))
                    this.controller.socket.subscribe('fd/zigbee/' + (this.status.names ? this.device.name : this.device.ieeeAddress) + '/' + endpoint);

                expose[endpoint].items.forEach(item => { addExpose(endpoint, item, expose[endpoint].options, this.endpoints); });
            });

            addExpose('common', 'linkQuality');
            this.controller.socket.publish('command/zigbee', {action: 'getProperties', device: this.device.ieeeAddress});
        });
    }

    showDeviceEdit()
    {
        fetch('html/zigbee/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.device.name;
            modal.querySelector('input[name="name"]').value = this.device.name;
            modal.querySelector('input[name="active"]').checked = this.device.active;
            modal.querySelector('input[name="discovery"]').checked = this.device.discovery;
            modal.querySelector('input[name="cloud"]').checked = this.device.cloud;
            modal.querySelector('.save').addEventListener('click', function() { this.controller.socket.publish('command/zigbee', {...{action: 'updateDevice', device: this.device.name}, ...formData(modal.querySelector('form'))}); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }

    showDeviceRemove()
    {
        fetch('html/zigbee/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.device.name;
            modal.querySelector('.graceful').addEventListener('click', function() { this.controller.socket.publish('command/zigbee', {action: 'removeDevice', device: this.device.name}); this.controller.clearPage('zigbee'); }.bind(this));
            modal.querySelector('.force').addEventListener('click', function() { this.controller.socket.publish('command/zigbee', {action: 'removeDevice', device: this.device.name, force: true}); this.controller.clearPage('zigbee'); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showDeviceData()
    {
        fetch('html/zigbee/deviceData.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.device.name;
            modal.querySelector('.json').innerHTML = JSON.stringify(this.device, null, 2);
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showDeviceDebug()
    {
        fetch('html/zigbee/deviceDebug.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = this.device.name;

            this.device.endpoints.forEach(item =>
            {
                var option = document.createElement('option');
                option.innerHTML = item.endpointId;
                modal.querySelector('select[name="endpointId"]').append(option);
            });

            modal.querySelector('.send').addEventListener('click', function()
            {
                var data = formData(modal.querySelector('form'));
                var request = new Object();

                request.action = data.clusterSpecific ? 'clusterRequest' : 'globalRequest';
                request.device = this.device.ieeeAddress;
                request.endpointId = parseInt(data.endpointId);
                request.clusterId = parseInt(data.clusterId) || 0;
                request.commandId = parseInt(data.commandId) || 0;
                request.payload = data.payload;

                if (data.manufacturerCode && !isNaN(data.manufacturerCode))
                    request.manufacturerCode = parseInt(data.manufacturerCode);

                modal.querySelector('.debugStatus').innerHTML = 'status: pending';
                this.controller.socket.publish('command/zigbee', request);

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSend);
            modal.addEventListener('keypress', handleSend);
            showModal(true);
        });
    }

    showDeviceTopics() // TODO: refactor and add prefix?
    {
        fetch('html/zigbee/deviceTopics.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            var item = this.status.names ? this.device.name : this.device.ieeeAddress;
            var list;

            modal.querySelector('.data').innerHTML = html;

            list = modal.querySelector('.list');
            list.innerHTML += '<label>Availability:</label><pre>{prefix}/device/zigbee/' + item + '</pre>';
            list.innerHTML += '<label>Exposes:</label><pre>{prefix}/expose/zigbee/' + item + '</pre>';

            if (this.endpoints.fd.length)
            {
                list.innerHTML += '<label>From device:</label><pre class="fd"></pre>';
                this.endpoints.fd.forEach(endpoint => { list.querySelector('pre.fd').innerHTML += '{prefix}/fd/zigbee/' + item + (isNaN(endpoint) ? '' : '/' + endpoint) + '\n'; });
            }

            if (this.endpoints.td.length)
            {
                list.innerHTML += '<label>To device:</label><pre class="td"></pre>';
                this.endpoints.td.forEach(endpoint => { list.querySelector('pre.td').innerHTML += '{prefix}/td/zigbee/' + item + (isNaN(endpoint) ? '' : '/' + endpoint) + '\n'; });
            }

            modal.querySelector('.name').innerHTML = this.device.name;
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }
}
