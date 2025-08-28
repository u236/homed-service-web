class ZigBee extends DeviceService
{
    logicalTypes = ['coordinator', 'router', 'end device'];
    clusterNames =
    {
        0:    'basic',
        1:    'powerConfiguration',
        2:    'temperatureConfiguration',
        3:    'identify',
        4:    'groups',
        5:    'scenes',
        6:    'onOff',
        7:    'switchConfiguration',
        8:    'levelControl',
        10:   'time',
        12:   'analogInput',
        13:   'analogOutput',
        16:   'binaryOutput',
        18:   'multistateInput',
        20:   'multistateValue',
        25:   'otaUpgrade',
        26:   'powerProfile',
        32:   'pollControl',
        33:   'greenPower',
        257:  'doorLock',
        258:  'windowCovering',
        513:  'thermostat',
        514:  'fanControl',
        516:  'uiConfiguration',
        768:  'colorControl',
        1024: 'illuminanceMeasurement',
        1026: 'temperatureMeasurement',
        1027: 'pressureMeasurement',
        1029: 'humidityMeasurement',
        1030: 'occupancySensing',
        1032: 'moistureMeasurement',
        1033: 'phMeasurement',
        1037: 'co2Concentration',
        1066: 'co2Concentration',
        1280: 'iasZone',
        1281: 'iasAce',
        1282: 'iasWd',
        1794: 'smartEnergyMetering',
        2820: 'electricalMeasurement',
        4096: 'touchLink'
    };

    constructor(controller, instance)
    {
        super(controller, 'zigbee', instance);
        this.intervals.push(setInterval(function() { this.updateBattery(); this.updateLastSeen(); }.bind(this), 100));
    }

    updateBattery()
    {
        if (this.controller.service != this.service)
            return;

        Object.keys(this.devices).forEach(id =>
        {
            let cell = document.querySelector('tr[data-device="' + this.service + '/' + id + '"] .powerSource');
            let value = this.devices[id].properties('common').battery;

            if (isNaN(value) || !cell || cell.dataset.value == value)
                return;

            cell.dataset.value = value;
            checkBattery(cell, value);
        });
    }

    updateLastSeen()
    {
        if (this.controller.service != this.service)
            return;

        Object.keys(this.devices).forEach(id =>
        {
            let cell = document.querySelector('tr[data-device="' + this.service + '/' + id + '"] .lastSeen');
            let value = timeInterval(Date.now() / 1000 - this.devices[id].lastSeen);

            if (!cell || cell.innerHTML == value)
                return;

            cell.dataset.value = this.devices[id].lastSeen;
            cell.innerHTML = value;
        });
    }

    updateGroups(device)
    {
        let table = modal.querySelector('table.groups');
        let list = new Array();

        if (!table)
            return;

        device.info.endpoints?.forEach(item => { item.groups?.forEach(groupId =>
        {
            let id = item.endpointId + '/' + groupId;
            let row = table.querySelector('tr[data-id="' + id + '"]');

            list.push(id);

            if (row)
                return;

            row = table.querySelector('tbody').insertRow();
            row.dataset.id = id;

            for (let i = 0; i < 3; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0: cell.innerHTML = '<span class="value">' + item.endpointId + '</span>'; break;
                        case 1: cell.innerHTML = '<span class="value">' + groupId + '</span>'; break;

                        case 2:
                            cell.innerHTML = '<i class="icon-trash"></i>';
                            cell.classList.add('remove');
                            cell.addEventListener('click', function() { cell.innerHTML = '<div class="dataLoader"></div>'; this.serviceCommand({action: 'removeGroup', device: device.id, endpointId: parseInt(item.endpointId), groupId: groupId}); }.bind(this));
                            break;
                    }
                }

        }); });

        modal.querySelector('.dataLoader').style.display = 'none';
        table.querySelectorAll('tr').forEach(row => { if (row.dataset.id && !list.includes(row.dataset.id)) row.remove(); });
        table.style.display = list.length ? 'table' : 'none';
        sortTable(table, 0);
    }

    updateBindings(device)
    {
        let table = modal.querySelector('table.bindings');
        let list = new Array();

        if (!table)
            return;

        device.info.endpoints?.forEach(item => { item.bindings?.forEach(binding =>
        {
            let id = item.endpointId + '/' + binding.clusterId + '/' + (isNaN(binding.groupId) ? binding.device + '/' + binding.endpointId : 'group/' + binding.groupId);
            let row = table.querySelector('tr[data-id="' + id + '"]');

            list.push(id);

            if (row)
                return;

            row = table.querySelector('tbody').insertRow();
            row.dataset.id = id;

            for (let i = 0; i < 4; i++)
            {
                let cell = row.insertCell();

                switch (i)
                {
                    case 0: cell.innerHTML = '<span class="value">' + item.endpointId + '</span>'; break;
                    case 1: cell.innerHTML = '<span class="value">' + (this.clusterNames[binding.clusterId] ?? '[' + binding.clusterId + ']') + '</span>'; break;
                    case 2: cell.innerHTML = isNaN(binding.groupId) ? (this.devices[binding.device]?.info.name ?? binding.device) + ' [' + binding.endpointId + ']' : 'Group ' + binding.groupId; break;

                    case 3:

                        cell.innerHTML = '<i class="icon-trash"></i>';
                        cell.classList.add('remove');

                        cell.addEventListener('click', function()
                        {
                            let request = {action: 'unbindDevice', device: device.id, endpointId: item.endpointId, clusterId: binding.clusterId};

                            if (isNaN(binding.groupId))
                            {
                                request.dstDevice = binding.device;
                                request.dstEndpointId = binding.endpointId;
                            }
                            else
                                request.groupId = binding.groupId;

                            cell.innerHTML = '<div class="dataLoader"></div>';
                            this.serviceCommand(request);

                        }.bind(this));

                        break;
                }
            }

        }); });

        modal.querySelector('.dataLoader').style.display = 'none';
        table.querySelectorAll('tr').forEach(row => { if (row.dataset.id && !list.includes(row.dataset.id)) row.remove(); });
        table.style.display = list.length ? 'table' : 'none';
        sortTable(table, 0);
    }

    updatePage()
    {
        document.querySelector('#permitJoin i').className = 'icon-enable ' + (this.permitJoin ? 'warning' : 'shade');
        document.querySelector('#serviceVersion').innerHTML = this.version ? 'ZigBee ' + this.version : '<i>unknown</i>';
    }

    updateOtaData(device)
    {
        let ota = device.info.ota ?? new Object();

        modal.querySelector('.dataLoader').style.display = ota.running ? 'block' : 'none';
        modal.querySelector('.manufacturerCode').innerHTML = ota.manufacturerCode != undefined ? this.parseValue(ota, 'manufacturerCode') : empty;
        modal.querySelector('.imageType').innerHTML = ota.imageType != undefined  ? this.parseValue(ota, 'imageType') : empty;
        modal.querySelector('.currentVersion').innerHTML = ota.currentVersion != undefined ? this.parseValue(ota, 'currentVersion') : empty;
        modal.querySelector('.fileVersion').innerHTML = ota.fileVersion != undefined ? this.parseValue(ota, 'fileVersion') : empty;
        modal.querySelector('.fileName').innerHTML = ota.fileName ? '<span title="' + ota.fileName + '">' + ota.fileName + '</span>' : empty;
        modal.querySelector('.progress').innerHTML = ota.running ? '0 %' : 'not running';
        modal.querySelector('.refresh').disabled = ota.running ? true : false;
        modal.querySelector('.upgrade').disabled = ota.fileName && ota.currentVersion != ota.fileVersion && !ota.running ? false : true;

        if (!ota.fileName || ota.currentVersion == ota.fileVersion)
        {
            modal.querySelector('.fileVersion').classList.remove('success', 'warning');
            return;
        }

        modal.querySelector('.fileVersion').classList.add(ota.currentVersion < ota.fileVersion ? 'success' : 'warning');
    }

    parseMessage(list, message)
    {
        switch (list[0])
        {
            case 'status':

                let check = false;

                this.names = message.names;
                this.version = message.version;
                this.permitJoin = message.permitJoin;

                message.devices.forEach(device =>
                {
                    if (device.removed)
                        return;

                    if (!device.name)
                        device.name = device.ieeeAddress;

                    if (!this.devices[device.ieeeAddress])
                    {
                        this.devices[device.ieeeAddress] = new Device(this.service, device.ieeeAddress);

                        if (device.logicalType)
                        {
                            let item = this.names ? device.name : device.ieeeAddress;
                            this.controller.socket.subscribe('expose/' + this.service + '/' + item);
                            this.controller.socket.subscribe('device/' + this.service + '/' + item);
                        }

                        check = true;
                    }

                    this.devices[device.ieeeAddress].info = device;

                    if (this.controller.service != this.service || this.devices[device.ieeeAddress] != this.device)
                        return;

                    if (!this.device.info.ota?.running)
                        document.querySelector('.title button.upgrade').innerHTML = ' OTA';

                    this.showDeviceInfo(this.device);

                    if (!modal.dataset.ota)
                        return;

                    this.updateOtaData(this.device);
                });

                Object.keys(this.devices).forEach(id =>
                {
                    let device = message.devices.filter(device => device.ieeeAddress == id)[0];

                    if (device && !device.removed)
                        return;

                    delete this.devices[id];
                    check = true;
                });

                if (this.controller.service == this.service)
                {
                    if (check)
                        this.controller.showPage(this.service);

                    this.updatePage();
                }

                break;

            case 'event':

                let html = 'Device <b>' + message.device + '</b> ';

                if (this.controller.service != this.service)
                    break;

                switch (message.event)
                {
                    case 'deviceJoined':        this.controller.showToast(html + 'joined network'); break;
                    case 'deviceLeft':          this.controller.showToast(html + 'left network', 'warning');  break;
                    case 'deviceNameDuplicate': this.controller.showToast(html + 'new name is already in use', 'error'); break;
                    case 'interviewError':      this.controller.showToast(html + 'interview error', 'error'); break;
                    case 'interviewTimeout':    this.controller.showToast(html + 'interview timed out', 'error'); break;
                    case 'interviewFinished':   this.controller.showToast(html + 'interview finished'); break;
                    case 'otaUpgradeStarted':   this.controller.showToast(html + 'OTA upgrade started', 'warning'); break;
                    case 'otaUpgradeFinished':  this.controller.showToast(html + 'OTA upgrade finished'); break;
                    case 'otaUpgradeError':     this.controller.showToast(html + 'OTA upgrade error', 'error'); break;

                    case 'deviceUpdated':
                        this.controller.showToast(html + 'successfully updated');
                        showModal(false);
                        break;

                    case 'groupRequest':
                    case 'bindingRequest':
                        this.controller.showToast(html + message.event.replace('Request', ' request ') + (message.success ? 'finished successfully' : 'faled'), message.success ? 'success' : 'error');
                        break;

                    case 'clusterRequest':
                    case 'globalRequest':
                    {
                        let item = modal.querySelector('.debugResult');

                        if (!item)
                            break;

                        item.innerHTML = JSON.stringify(message, null, 2);
                        break;
                    }

                    case 'requestFinished':
                    {
                        let item = modal.querySelector('.debugStatus');
                        let status = parseInt(message.status);

                        if (!item)
                            return;

                        item.innerHTML = 'status: ' + (status ? '<span class="error">failed: (' + status + ')</span>' : '<span class="success">success</span>');
                        break;
                    }
                }

                break;

            case 'fd':

                let device = this.findDevice(this.instance ? list[3] : list[2]);

                if (device)
                {
                    let endpointId = (this.instance ? list[4] : list[3]) ?? 'common';
                    let row = document.querySelector('tr[data-device="' + this.service + '/' + device.id + '"]');

                    device.setProperties(endpointId, message);

                    if (this.controller.page == this.service && message.linkQuality != undefined && row)
                    {
                        row.querySelector('.linkQuality').innerHTML = message.linkQuality;
                        break;
                    }

                    Object.keys(message).forEach(property => { updateExpose(device, endpointId, property, message[property]); });
                }

                break;

            default:
                super.parseMessage(list, message);
                break;
        }
    }

    parseValue(data, key, summary)
    {
        let value = data[key];

        switch (key)
        {
            case 'logicalType': return this.logicalTypes[value];
            case 'powerSource': return value != undefined ? '<i class="icon-' + (value != 1 && value != 4 ? 'battery' : 'plug') + '"></i>' : empty;

            case 'currentVersion':
            case 'fileVersion':
                return '0x' + ('00000000' + value.toString(16)).slice(-8);

            case 'imageType':
            case 'manufacturerCode':
            case 'networkAddress':
                return '0x' + ('0000' + value.toString(16)).slice(-4);

            default: return super.parseValue(data, key, summary);
        }
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();
        let device;

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="map"><i class="icon-map"></i> Map</span>';
        menu.innerHTML += '<span id="permitJoin"><i class="icon-enable"></i> Permit Join</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage(this.service); }.bind(this));
        menu.querySelector('#map').addEventListener('click', function() { this.controller.showPage(this.service + '?map'); }.bind(this));
        menu.querySelector('#permitJoin').addEventListener('click', function() { menu.querySelector('#permitJoin i').className = 'icon-enable'; this.serviceCommand({action: 'togglePermitJoin'}); }.bind(this));

        switch (list[0])
        {
            case 'device':

                device = this.devices[list[1]];

                if (device)
                    this.showDeviceInfo(device);
                else
                    this.showDeviceList();

                break;

            case 'map': this.showDeviceMap(); break;
            default: this.showDeviceList(); break;
        }

        this.device = device;
        this.updatePage();
    }

    showDeviceList()
    {
        loadHTML('html/zigbee/deviceList.html', this, this.content, function()
        {
            let table = this.content.querySelector('.deviceList table');

            Object.keys(this.devices).forEach(ieeeAddress =>
            {
                let device = this.devices[ieeeAddress];
                let row = table.querySelector('tbody').insertRow(device.info.logicalType ? -1 : 0);

                row.dataset.device = this.service + '/' + device.id;
                row.addEventListener('click', function() { this.controller.showPage(this.service + '?device=' + device.id); }.bind(this));

                for (let i = 0; i < 7; i++)
                {
                    let cell = row.insertCell();

                    switch (i)
                    {
                        case 0:

                            cell.innerHTML = device.info.name;
                            cell.colSpan = 2;

                            if (device.info.note)
                                row.title = device.info.note;

                            break;

                        case 1:

                            cell.innerHTML = device.info.modelName ?? empty;
                            cell.classList.add('mobileHidden');

                            if (device.info.logicalType && !device.info.supported)
                                cell.classList.add('shade');

                            break;

                        case 2: cell.innerHTML = this.parseValue(device.info, 'powerSource'); cell.classList.add('powerSource', 'center'); break;
                        case 3: cell.innerHTML = this.parseValue(device.info, 'discovery'); cell.classList.add('center', 'mobileHidden'); break;
                        case 4: cell.innerHTML = this.parseValue(device.info, 'cloud'); cell.classList.add('center', 'mobileHidden'); break;
                        case 5: cell.innerHTML = device.properties('common').linkQuality ?? device.info.linkQuality ?? empty; cell.classList.add('linkQuality', 'center'); break;
                        case 6: cell.innerHTML = empty; cell.classList.add('lastSeen', 'right'); break;
                    }
                }
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { let once = cell.classList.contains('once'); sortTable(table, this.dataset.index, false, once); if (!once) localStorage.setItem('zigbeeSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('zigbeeSort') ?? 0, false);
            addTableSearch(table, 'devices', 'device', 8, [0, 1]);
        });
    }

    showDeviceMap()
    {
        loadHTML('html/zigbee/deviceMap.html', this, this.content, function()
        {
            let map, width, height, link, text, node, routerLinks = false;
            let data = {nodes: new Array(), links: new Array()};
            let drag = d3.drag();
            let simulation = d3.forceSimulation();
            let symbol = [d3.symbolStar, d3.symbolTriangle, d3.symbolCircle];

            this.content.querySelector('input[name="routerLinks"]').addEventListener('change', function() { routerLinks = this.checked; simulation.restart(); });

            map = d3.select('.deviceMap svg');
            width = parseInt(map.style('width'));
            height = parseInt(map.style('height'));

            Object.keys(this.devices).forEach(ieeeAddress =>
            {
                let device = this.devices[ieeeAddress];

                if (device.info.hasOwnProperty('active') && !device.info.active)
                    return;

                data.nodes.push({id: device.info.networkAddress, name: device.info.name, type: device.info.logicalType});

                if (!device.info.neighbors)
                    return;

                device.info.neighbors.forEach(neighbor =>
                {
                    if (!Object.values(this.devices).find(item => item.info.networkAddress == neighbor.networkAddress && (!item.info.hasOwnProperty('active') || item.info.active)))
                        return;

                    data.links.push({linkQuality: neighbor.linkQuality, source: neighbor.networkAddress, target: device.info.networkAddress});
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
            node.select('text').on('click', function(d) { this.controller.showPage(this.service + '?device=' + Object.values(this.devices).filter(i => i.info.networkAddress == d.id)[0].id); }.bind(this));

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

    showDeviceInfo(device)
    {
        loadHTML('html/zigbee/deviceInfo.html', this, this.content, function()
        {
            let ota;
            let table;

            this.content.querySelector('.name').innerHTML = device.info.name;
            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));
            this.content.querySelector('.upgrade').addEventListener('click', function() { this.showDeviceUpgrade(device); }.bind(this));
            this.content.querySelector('.data').addEventListener('click', function() { this.showDeviceData(device); }.bind(this));
            this.content.querySelector('.groups').addEventListener('click', function() { this.showDeviceGroups(device); }.bind(this));
            this.content.querySelector('.bindings').addEventListener('click', function() { this.showDeviceBinding(device); }.bind(this));
            this.content.querySelector('.debug').addEventListener('click', function() { this.showDeviceDebug(device); }.bind(this));

            this.updateDeviceInfo(device);
            this.updateGroups(device);
            this.updateBindings(device);

            if (!device.info.logicalType)
            {
                this.content.querySelector('.edit').style.display = 'none';
                this.content.querySelector('.remove').style.display = 'none';
                this.content.querySelector('.upgrade').style.display = 'none';
                this.content.querySelector('.previous').style.display = 'none';
                this.content.querySelector('.next').style.display = 'none';
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            this.updateArrowButtons(device);

            if (!device.info.active)
            {
                this.content.querySelector('.upgrade').style.display = 'none';
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            device.info.endpoints?.forEach(item => { if (item.outClusters?.includes(25)) ota = true; });

            if (!ota)
                this.content.querySelector('.upgrade').style.display = 'none';

            table = this.content.querySelector('table.exposes');
            Object.keys(device.endpoints).forEach(endpointId => { device.items(endpointId).forEach(expose => { addExpose(table, device, endpointId, expose); }); });
        });
    }

    showDeviceEdit(device)
    {
        if (!device.info.logicalType)
            return;

        loadHTML('html/zigbee/deviceEdit.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').placeholder = device.info.ieeeAddress;
            modal.querySelector('input[name="name"]').value = device.info.name != device.info.ieeeAddress ? device.info.name : '';
            modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;
            modal.querySelector('.save').addEventListener('click', function() { this.serviceCommand({...{action: 'updateDevice', device: device.id}, ...formData(modal.querySelector('form'))}); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true, 'input[name="name"]');
        });
    }

    showDeviceRemove(device)
    {
        if (!device.info.logicalType)
            return;

        loadHTML('html/zigbee/deviceRemove.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.battery').style.display = device.info.powerSource != 1 && device.info.powerSource != 4 ? 'block' : 'none';
            modal.querySelector('.graceful').addEventListener('click', function() { this.serviceCommand({action: 'removeDevice', device: device.id}, true); }.bind(this));
            modal.querySelector('.force').addEventListener('click', function() { this.serviceCommand({action: 'removeDevice', device: device.id, force: true}, true); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }

    showDeviceUpgrade(device)
    {
        if (!device.info.logicalType)
            return;

        loadHTML('html/zigbee/deviceUpgrade.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.battery').style.display = device.info.powerSource != 1 && device.info.powerSource != 4 ? 'block' : 'none';
            modal.querySelector('.refresh').addEventListener('click', function() { modal.querySelector('.dataLoader').style.display = 'block'; modal.querySelectorAll('.otaData').forEach(cell => { cell.innerHTML = empty; }); this.serviceCommand({action: 'otaRefresh', device: device.id}); }.bind(this));
            modal.querySelector('.upgrade').addEventListener('click', function() { modal.querySelector('.dataLoader').style.display = 'block'; this.serviceCommand({action: 'otaUpgrade', device: device.id}); }.bind(this));
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });

            modal.dataset.ota = true;
            this.updateOtaData(device);

            showModal(true);
        });
    }

    showDeviceData(device)
    {
        loadHTML('html/zigbee/deviceData.html', this, modal.querySelector('.data'), function()
        {
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.json').innerHTML = JSON.stringify(device.info, null, 2);
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }

    showDeviceGroups(device)
    {
        loadHTML('html/zigbee/deviceGroups.html', this, modal.querySelector('.data'), function()
        {
            let select = modal.querySelector('select[name="endpointId"]');
            let input = modal.querySelector('input[name="groupId"]');

            modal.querySelector('.name').innerHTML = device.info.name;

            device.info.endpoints?.forEach(item =>
            {
                let option = document.createElement('option');

                if (!item.inClusters || !item.inClusters.includes(4))
                    return;

                option.innerHTML = item.endpointId;
                select.append(option);
            });

            if (!select.innerHTML)
            {
                let option = document.createElement('option');

                option.innerHTML = '-';
                option.disabled = true;
                select.append(option);

                input.type = 'text';
                input.value = '-';
                input.disabled = true;

                modal.querySelector('.add').disabled = true;
            }

            modal.querySelector('.add').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                modal.querySelector('.dataLoader').style.display = 'block';
                this.serviceCommand({action: 'addGroup', device: device.id, endpointId: parseInt(form.endpointId), groupId: parseInt(form.groupId)});

            }.bind(this));

            modal.querySelector('.battery').style.display = device.info.powerSource != 1 && device.info.powerSource != 4 ? 'block' : 'none';
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            this.updateGroups(device);
            showModal(true);
        });
    }

    showDeviceBinding(device)
    {
        function updateClusterList(clusterNames, deviceList, endpointId)
        {
            let select = modal.querySelector('select[name="clusterId"]');
            let exclude = [0, 3, 4, 5, 25, 33, 4096];

            select.innerHTML = null;

            device.info.endpoints?.filter(item => item.endpointId == endpointId)[0]?.outClusters?.filter(item => !exclude.includes(item)).forEach(item =>
            {
                let option = document.createElement('option');
                option.innerHTML = clusterNames[item] ?? '[' + item + ']';
                option.value = item;
                select.append(option);
            });

            if (!select.innerHTML)
            {
                let option = document.createElement('option');
                option.innerHTML = '-';
                option.disabled = true;
                select.append(option);
            }

            updateDestinationList(deviceList, select.value);
        }

        function updateDestinationList(deviceList, clusterId)
        {
            let select = modal.querySelector('select[name="destination"]');
            let list = new Object();
            let groups = new Array();
            let disabled = false;

            select.innerHTML = null;

            Object.keys(deviceList).forEach(id =>
            {
                let info = deviceList[id].info;

                if (id == device.id)
                    return;

                info.endpoints?.forEach(item =>
                {
                    if (item.inClusters?.includes(parseInt(clusterId)))
                        list[id + '/' + item.endpointId] = info.name + ' [' + item.endpointId + ']';

                    item.groups?.forEach(group => { if (!groups.includes(group)) groups.push(group); });
                });
            });

            if (!isNaN(clusterId))
                groups.sort().forEach(group => { list['group/' + group] = 'Group ' + group; });

            Object.keys(list).forEach(item =>
            {
                let option = document.createElement('option');
                option.innerHTML = list[item];
                option.value = item;
                select.append(option);
            });

            if (!select.innerHTML)
            {
                let option = document.createElement('option');
                option.innerHTML = '-';
                option.disabled = true;
                select.append(option);
                disabled = true;
            }

            modal.querySelector('.bind').disabled = disabled;
        }

        loadHTML('html/zigbee/deviceBinding.html', this, modal.querySelector('.data'), function()
        {
            let endpointList = modal.querySelector('select[name="endpointId"]');
            let clusterList = modal.querySelector('select[name="clusterId"]');

            modal.querySelector('.name').innerHTML = device.info.name;

            device.info.endpoints?.forEach(item =>
            {
                let option = document.createElement('option');
                option.innerHTML = item.endpointId;
                endpointList.append(option);
            });

            if (!endpointList.innerHTML)
            {
                let option = document.createElement('option');
                option.innerHTML = '-';
                option.disabled = true;
                endpointList.append(option);
            }

            endpointList.addEventListener('change', function() { updateClusterList(this.clusterNames, this.devices, endpointList.value); }.bind(this));
            clusterList.addEventListener('change', function() { updateDestinationList(this.devices, clusterList.value); }.bind(this));

            updateClusterList(this.clusterNames, this.devices, endpointList.value);

            modal.querySelector('.bind').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let destination = form.destination.split('/');
                let request = {action: 'bindDevice', device: device.id, endpointId: parseInt(form.endpointId), clusterId: parseInt(form.clusterId)};

                if (destination[0] != 'group')
                {
                    request.dstDevice = destination[0];
                    request.dstEndpointId = parseInt(destination[1]);
                }
                else
                    request.groupId = parseInt(destination[1]);

                modal.querySelector('.dataLoader').style.display = 'block';
                this.serviceCommand(request);

            }.bind(this));

            modal.querySelector('.battery').style.display = device.info.powerSource != 1 && device.info.powerSource != 4 ? 'block' : 'none';
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            this.updateBindings(device);
            showModal(true);
        });
    }

    showDeviceDebug(device)
    {
        loadHTML('html/zigbee/deviceDebug.html', this, modal.querySelector('.data'), function()
        {
            let select = modal.querySelector('select[name="endpointId"]');

            modal.querySelector('.name').innerHTML = device.info.name;

            device.info.endpoints?.forEach(item =>
            {
                let option = document.createElement('option');
                option.innerHTML = item.endpointId;
                select.append(option);
            });

            if (!select.innerHTML)
            {
                let option = document.createElement('option');
                option.innerHTML = '1';
                select.append(option);
            }

            modal.querySelector('.send').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let request = {action: form.clusterSpecific ? 'clusterRequest' : 'globalRequest', device: device.id, endpointId: parseInt(form.endpointId), clusterId: parseInt(form.clusterId) || 0, commandId: parseInt(form.commandId) || 0, payload: form.payload};

                if (form.manufacturerCode && !isNaN(form.manufacturerCode))
                    request.manufacturerCode = parseInt(form.manufacturerCode);

                modal.querySelector('.debugStatus').innerHTML = 'status: pending';
                this.serviceCommand(request);

            }.bind(this));

            modal.querySelector('.battery').style.display = device.info.powerSource != 1 && device.info.powerSource != 4 ? 'block' : 'none';
            modal.querySelector('.close').addEventListener('click', function() { showModal(false); });
            showModal(true);
        });
    }
}
