class ZigBee extends DeviceService
{
    logicalType = ['coordinator', 'router', 'end device'];

    constructor(controller, instance)
    {
        super(controller, 'zigbee', instance);
        this.intervals.push(setInterval(function() { this.updateLastSeen(); }.bind(this), 100));
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

    updatePage()
    {
        document.querySelector('#permitJoin i').className = 'icon-enable ' + (this.permitJoin ? 'warning' : 'shade');
        document.querySelector('#serviceVersion').innerHTML = this.version ? 'ZigBee ' + this.version : '<i>unknown</i>';
    }

    updateOtaData(device)
    {
        let ota = device.info.ota ?? new Object();

        modal.querySelector('.dataLoader').style.display = 'none';
        modal.querySelector('.manufacturerCode').innerHTML = ota.manufacturerCode != undefined ? this.parseValue('manufacturerCode', ota.manufacturerCode) : empty;
        modal.querySelector('.imageType').innerHTML = ota.imageType != undefined  ? this.parseValue('imageType', ota.imageType) : empty;
        modal.querySelector('.currentVersion').innerHTML = ota.currentVersion != undefined ? this.parseValue('currentVersion', ota.currentVersion) : empty;
        modal.querySelector('.fileName').innerHTML = ota.fileName ?? empty;
        modal.querySelector('.fileVersion').innerHTML = ota.fileVersion != undefined ? this.parseValue('fileVersion', ota.fileVersion) : empty;
        modal.querySelector('.upgrade').style.display = ota.fileName && ota.currentVersion != ota.fileVersion ? 'block' : 'none';
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

                    if (device.ieeeAddress != this.otaDevice)
                        return;

                    this.updateOtaData(this.devices[device.ieeeAddress]);
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

                if (this.controller.service == this.service && message.event == 'deviceUpdated')
                {
                    this.controller.clearPage();
                    this.devices = new Object();
                }

                switch (message.event)
                {
                    case 'deviceJoined':        this.controller.showToast(html + 'joined network'); break;
                    case 'deviceLeft':          this.controller.showToast(html + 'left network', 'warning');  break;
                    case 'deviceNameDuplicate': this.controller.showToast(html + 'new name is already in use', 'error'); break;
                    case 'deviceUpdated':       this.controller.showToast(html + 'successfully updated'); break;
                    case 'interviewError':      this.controller.showToast(html + 'interview error', 'error'); break;
                    case 'interviewTimeout':    this.controller.showToast(html + 'interview timed out', 'error'); break;
                    case 'interviewFinished':   this.controller.showToast(html + 'interview finished'); break;
                    case 'otaUpgradeFinished':  this.controller.showToast(html + 'OTA upgrade finished'); break;
                    case 'otaUpgradeError':     this.controller.showToast(html + 'OTA upgrade error', 'error'); break;

                    case 'otaUpgradeStarted':
                    {
                        let device = this.findDevice(message.device);
                        let cell = modal.querySelector('.progress');

                        if (device && cell && this.otaDevice == device.id)
                            cell.innerHTML = '0 %';

                        this.controller.showToast(html + 'OTA upgrade started', 'warning');
                        break;
                    }

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
                    let endpoint = (this.instance ? list[4] : list[3]) ?? 'common';
                    let row = document.querySelector('tr[data-device="' + this.service + '/' + device.id + '"]');

                    device.setProperties(endpoint, message);

                    if (this.controller.page == this.service && message.linkQuality != undefined && row)
                    {
                        row.querySelector('.linkQuality').innerHTML = message.linkQuality;
                        break;
                    }

                    Object.keys(message).forEach(name => { updateExpose(device, endpoint, name, message[name]); });
                }

                break;

            default:
                super.parseMessage(list, message);
                break;
        }
    }

    parseValue(key, value)
    {
        switch (key)
        {
            case 'logicalType': return this.logicalType[value];
            case 'powerSource': return value != undefined ? '<i class="icon-' + (value != 1 && value != 4 ? 'battery' : 'plug') + '"></i>' : empty;

            case 'currentVersion':
            case 'fileVersion':
                return '0x' + ('00000000' + value.toString(16)).slice(-8);

            case 'imageType':
            case 'manufacturerCode':
            case 'networkAddress':
                return '0x' + ('0000' + value.toString(16)).slice(-4);

            default: return super.parseValue(key, value);
        }
    }

    showPage(data)
    {
        let menu = document.querySelector('.menu');
        let list = data ? data.split('=') : new Array();

        menu.innerHTML  = '<span id="list"><i class="icon-list"></i> List</span>';
        menu.innerHTML += '<span id="map"><i class="icon-map"></i> Map</span>';
        menu.innerHTML += '<span id="permitJoin"><i class="icon-enable"></i> Permit Join</span>';

        menu.querySelector('#list').addEventListener('click', function() { this.controller.showPage(this.service); }.bind(this));
        menu.querySelector('#map').addEventListener('click', function() { this.controller.showPage(this.service + '?map'); }.bind(this));
        menu.querySelector('#permitJoin').addEventListener('click', function() { menu.querySelector('#permitJoin i').className = 'icon-enable'; this.serviceCommand({'action': 'togglePermitJoin'}); }.bind(this));

        switch (list[0])
        {
            case 'device':

                let device = this.devices[list[1]];

                if (device)
                    this.showDeviceInfo(device);
                else
                    this.showDeviceList();

                break;

            case 'map': this.showDeviceMap(); break;
            default: this.showDeviceList(); break;
        }

        this.updatePage();
    }

    showDeviceList()
    {
        fetch('html/zigbee/deviceList.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;
            let count = 0;

            this.content.innerHTML = html;
            table = this.content.querySelector('.deviceList table');

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

                            if (device.info.note)
                            {
                                cell.innerHTML += '<span class="note">' + device.info.note + '</span>';
                                row.classList.add('tooltip');
                            }

                            break;

                        case 1: cell.innerHTML = device.info.modelName ?? empty; cell.classList.add('mobileHidden'); break;
                        case 2: cell.innerHTML = this.parseValue('powerSource', device.info.powerSource); cell.classList.add('center'); break;
                        case 3: cell.innerHTML = this.parseValue('discovery', device.info.discovery); cell.classList.add('center', 'mobileHidden'); break;
                        case 4: cell.innerHTML = this.parseValue('cloud', device.info.cloud); cell.classList.add('center', 'mobileHidden'); break;
                        case 5: cell.innerHTML = device.properties('common').linkQuality ?? device.info.linkQuality ?? empty; cell.classList.add('linkQuality', 'center'); break;
                        case 6: cell.innerHTML = empty; cell.classList.add('lastSeen', 'right'); break;
                    }
                }

                count++;
            });

            table.querySelectorAll('th.sort').forEach(cell => cell.addEventListener('click', function() { let once = cell.classList.contains('once'); sortTable(table, this.dataset.index, false, once); if (!once) localStorage.setItem('zigbeeSort', this.dataset.index); }) );
            sortTable(table, localStorage.getItem('zigbeeSort') ?? 0, false);

            table.querySelector('tfoot').innerHTML='<tr><th colspan="10">' + count + (count > 1 ? ' devices ' : ' device ') + 'total</th></tr>';
        });
    }

    showDeviceMap()
    {
        fetch('html/zigbee/deviceMap.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let map, width, height, link, text, node, routerLinks = false;
            let data = {nodes: new Array(), links: new Array()};
            let drag = d3.drag();
            let simulation = d3.forceSimulation();
            let symbol = [d3.symbolStar, d3.symbolTriangle, d3.symbolCircle];

            this.content.innerHTML = html;
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
        fetch('html/zigbee/deviceInfo.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let table;
            let ota;

            this.content.innerHTML = html;
            table = this.content.querySelector('table.exposes');

            this.content.querySelector('.edit').addEventListener('click', function() { this.showDeviceEdit(device); }.bind(this));
            this.content.querySelector('.remove').addEventListener('click', function() { this.showDeviceRemove(device); }.bind(this));
            this.content.querySelector('.upgrade').addEventListener('click', function() { this.showDeviceUpgrade(device); }.bind(this));
            this.content.querySelector('.data').addEventListener('click', function() { this.showDeviceData(device); }.bind(this));
            this.content.querySelector('.debug').addEventListener('click', function() { this.showDeviceDebug(device); }.bind(this));

            Object.keys(device.info).forEach(key =>
            {
                let cell = document.querySelector('.' + key + ':not(button)');
                let row = cell ? cell.closest('tr') : undefined;

                if (cell)
                    cell.innerHTML = this.parseValue(key, device.info[key]);

                if (!row)
                    return;

                if (key == 'lastSeen')
                    row.dataset.device = this.service + '/' + device.id;

                row.style.display = 'table-row';
            });

            if (!device.info.logicalType)
            {
                this.content.querySelector('.edit').style.display = 'none';
                this.content.querySelector('.remove').style.display = 'none';
                this.content.querySelector('.upgrade').style.display = 'none';
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            if (!device.info.active)
            {
                this.content.querySelector('.upgrade').style.display = 'none';
                this.content.querySelector('.exposes').style.display = 'none';
                return;
            }

            device.info.endpoints.forEach(endpoint => { if (endpoint.outClusters?.includes(25)) ota = true; });

            if (!ota)
                this.content.querySelector('.upgrade').style.display = 'none';

            Object.keys(device.endpoints).forEach(endpoint => { device.items(endpoint).forEach(expose => { addExpose(table, device, endpoint, expose); }); });
            addExpose(table, device, 'common', 'linkQuality');
        });
    }

    showDeviceEdit(device)
    {
        fetch('html/zigbee/deviceEdit.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('input[name="name"]').value = device.info.name;
            modal.querySelector('textarea[name="note"]').value = device.info.note ?? '';
            modal.querySelector('input[name="discovery"]').checked = device.info.discovery;
            modal.querySelector('input[name="cloud"]').checked = device.info.cloud;
            modal.querySelector('input[name="active"]').checked = device.info.active;
            modal.querySelector('.save').addEventListener('click', function() { this.serviceCommand({...{action: 'updateDevice', device: this.names ? device.info.name : device.id}, ...formData(modal.querySelector('form'))}); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSave);
            modal.addEventListener('keypress', handleSave);
            showModal(true);

            modal.querySelector('input[name="name"]').focus();
        });
    }

    showDeviceRemove(device)
    {
        fetch('html/zigbee/deviceRemove.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let item = this.names ? device.info.name : device.id;

            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.graceful').addEventListener('click', function() { this.serviceCommand({action: 'removeDevice', device: item}, true); }.bind(this));
            modal.querySelector('.force').addEventListener('click', function() { this.serviceCommand({action: 'removeDevice', device: item, force: true}, true); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showDeviceUpgrade(device)
    {
        fetch('html/zigbee/deviceUpgrade.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            let item = this.names ? device.info.name : device.id;

            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.progress').innerHTML = empty;

            modal.querySelector('.refresh').addEventListener('click', function()
            {
                modal.querySelector('.dataLoader').style.display = 'block';
                modal.querySelectorAll('.otaData').forEach(cell => { cell.innerHTML = empty; });
                this.serviceCommand({action: 'otaRefresh', device: item});

            }.bind(this));

            modal.querySelector('.upgrade').addEventListener('click', function() { this.serviceCommand({action: 'otaUpgrade', device: item}); }.bind(this));
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            this.otaDevice = device.id;
            this.updateOtaData(device);

            showModal(true);
        });
    }

    showDeviceData(device)
    {
        fetch('html/zigbee/deviceData.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;
            modal.querySelector('.json').innerHTML = JSON.stringify(device.info, null, 2);
            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            showModal(true);
        });
    }

    showDeviceDebug(device)
    {
        fetch('html/zigbee/deviceDebug.html?' + Date.now()).then(response => response.text()).then(html =>
        {
            modal.querySelector('.data').innerHTML = html;
            modal.querySelector('.name').innerHTML = device.info.name;

            device.info.endpoints.forEach(item =>
            {
                let option = document.createElement('option');
                option.innerHTML = item.endpointId;
                modal.querySelector('select[name="endpointId"]').append(option);
            });

            modal.querySelector('.send').addEventListener('click', function()
            {
                let form = formData(modal.querySelector('form'));
                let request = new Object();

                // TODO: use number inputs in form
                request.action = form.clusterSpecific ? 'clusterRequest' : 'globalRequest';
                request.device = this.names ? device.info.name : device.id;
                request.endpointId = parseInt(form.endpointId);
                request.clusterId = parseInt(form.clusterId) || 0;
                request.commandId = parseInt(form.commandId) || 0;
                request.payload = form.payload;

                if (form.manufacturerCode && !isNaN(form.manufacturerCode))
                    request.manufacturerCode = parseInt(form.manufacturerCode);

                modal.querySelector('.debugStatus').innerHTML = 'status: pending';
                this.serviceCommand(request);

            }.bind(this));

            modal.querySelector('.cancel').addEventListener('click', function() { showModal(false); });

            modal.removeEventListener('keypress', handleSend);
            modal.addEventListener('keypress', handleSend);
            showModal(true);
        });
    }
}
