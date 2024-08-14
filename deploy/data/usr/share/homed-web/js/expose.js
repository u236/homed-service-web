let colorPicker;

function temperatureToColor(value)
{
    let color = new Array();
    let k = 10000 / value;

    color.push(parseInt((k > 66 ? 1.292936 * Math.pow(k - 60, -0.133205) : 1) * 255));
    color.push(parseInt((k > 66 ? 1.129891 * Math.pow(k - 60, -0.075515) : 0.390082 * Math.log(k) - 0.631841) * 255));
    color.push(parseInt((k < 66 ? 0.543207 * Math.log(k - 10) -1.1962540 : 1) * 255));

    return color;
}

function exposeTitle(name, endpoint = 'common')
{
    let title = name.replace('_', ' ').replace(/([A-Z])/g, ' $1').toLowerCase().split(' ');

    switch (title[0])
    {
        case 'co2':    title[0] = 'CO2'; break;
        case 'eco2':   title[0] = 'eCO2'; break;
        case 'pm1':    title[0] = 'PM1'; break;
        case 'pm10':   title[0] = 'PM10'; break;
        case 'pm25':   title[0] = 'PM2.5'; break;
        case 'voc':    title[0] = 'VOC'; break;
        default:       title[0] = title[0].charAt(0).toUpperCase() + title[0].slice(1).toLowerCase(); break;
    }

    if (['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].includes(title[1]))
        title[1] = title[1].toUpperCase();

    return title.join(' ') + (endpoint != 'common' ? ' ' + endpoint.toLowerCase() : '');
}

function exposeList(expose, options)
{
    let part = expose.split('_');
    let list = new Array();

    switch (part[0])
    {
        case 'cover':
            list = ['cover', 'position'];
            break;

        case 'light':
            list = ['status'].concat(options[part[1] ? 'light_' + part[1] : 'light'] ?? new Array());
            break;

        case 'lock':
        case 'switch':
            list = ['status'];
            break;

        case 'thermostat':
            let controls = ['systemMode', 'operationMode', 'targetTemperature'];
            controls.forEach(function(item) { if (options[item]) { list.push(item); options[item] = {...options[item], ...(item == 'targetTemperature' ? {type: 'number', unit: '°C'} : {type: 'select'})}; } });
            list = list.concat(options.runningStatus ? ['temperature', 'running'] : ['temperature']);
            options['temperature'] = {type:'sensor', unit: '°C'};
            break;

        case 'thermostatProgram':

            let option = options.targetTemperature ?? {};

            if (isNaN(option.min) || isNaN(option.max))
                break;

            switch (options.thermostatProgram)
            {
                case 'daily':
                {
                    let types = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

                    for (let i = 0; i < 28; i++)
                    {
                        let item = types[parseInt(i / 4)] + 'P' + parseInt(i % 4 + 1);
                        list.push(item + 'Time');
                        list.push(item + 'Temperature');
                        options[item + 'Temperature'] = option;
                    }

                    break;
                }

                case 'moes':
                {
                    let types = ['weekday', 'saturday', 'sunday'];

                    for (let i = 0; i < 12; i++)
                    {
                        let item = types[parseInt(i / 4)] + 'P' + parseInt(i % 4 + 1);
                        list.push(item + 'Time');
                        list.push(item + 'Temperature');
                        options[item + 'Temperature'] = option;
                    }

                    break;
                }

                default:
                {
                    let types = ['weekday', 'holiday'];

                    for (let i = 0; i < 12; i++)
                    {
                        let item = types[parseInt(i / 6)] + 'P' + parseInt(i % 6 + 1);
                        list.push(item + 'Time');
                        list.push(item + 'Temperature');
                        options[item + 'Temperature'] = option;
                    }

                    break;
                }
            }

            break;

        default:
            list.push(part[0]);
            break;
    }

    if (part[1])
        list.forEach((item, index) => { list[index] = item + '_' + part[1]; });

    return list;
}

function addExpose(table, device, endpoint, expose)
{
    let options = device.options(endpoint);
    let properties = device.properties(endpoint);
    let list = exposeList(expose, options);

    list.forEach(name =>
    {
        let item = name.split('_')[0];
        let row = table.insertRow();
        let labelCell = row.insertCell();
        let valueCell = row.insertCell();
        let controlCell;

        row.dataset.device = device.service + '/' + device.id;
        row.dataset.endpoint = endpoint;

        labelCell.innerHTML = exposeTitle(name, options.name ?? endpoint);
        labelCell.classList.add('label');

        valueCell.dataset.property = name;
        valueCell.innerHTML = empty;
        valueCell.classList.add('value');

        controller.services.recorder?.status.items?.forEach((data, index) =>
        {
            var item = device.service.split('/')[0] + '/' + device.id;

            if (endpoint != 'common')
                item += '/' + endpoint;

            if (data.endpoint != item || data.property != name)
                return;

            labelCell.innerHTML += ' <i class="icon-chart shade"></i>';
            labelCell.querySelector('i').addEventListener('click', function() { controller.showPage('recorder?index=' + index); showModal(false); });
        });

        if (name != 'irCode')
        {
            controlCell = row.insertCell();
            controlCell.classList.add('control');
        }

        switch (item)
        {
            case 'color':
            {
                colorPicker = new iro.ColorPicker(controlCell, {layout: [{component: iro.ui.Wheel}], width: 150});
                colorPicker.on('input:end', function() { deviceCommand(device, endpoint, {[name]: [colorPicker.color.rgb.r, colorPicker.color.rgb.g, colorPicker.color.rgb.b]}); });
                break;
            }

            case 'colorTemperature':
            {
                let option = options.colorTemperature ?? {};
                let min = option.min ?? 150;
                let max = option.max ?? 500;

                valueCell.dataset.type = 'number';
                controlCell.innerHTML = '<input type="range" min="' + min + '" max="' + max + '" class="colorTemperature">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) deviceCommand(device, endpoint, {[name]: parseInt(this.value)}); });
                controlCell.querySelector('input').style.background = 'linear-gradient(to right, rgb(' + temperatureToColor(min).join(', ') + '), rgb(' + temperatureToColor(max).join(', ') + '))';
                break;
            }

            case 'cover':
            {
                controlCell.innerHTML = '<span>open</span>/<span>stop</span>/<span>close</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; deviceCommand(device, endpoint, {[name]: item.innerHTML}); }) );
                break;
            }

            case 'irCode':
            {
                valueCell.innerHTML = '<textarea></textarea><div class "buttons"><button class="learn">Learn</button><button class="send">Send</button></div>';
                valueCell.colSpan = 2;
                valueCell.querySelector(".learn").addEventListener('click', function() { valueCell.querySelector('textarea').value = null; valueCell.dataset.mode = 'learn'; deviceCommand(device, endpoint, {learn: true}); });
                valueCell.querySelector(".send").addEventListener('click', function() { valueCell.dataset.mode = 'send'; deviceCommand(device, endpoint, {irCode: valueCell.querySelector('textarea').value}); });
                break;
            }

            case 'level':
            case 'position':
            {
                valueCell.dataset.type = 'number';
                valueCell.dataset.unit = '%';
                controlCell.innerHTML = '<input type="range" min="0" max="100" class="' + name + '">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + ' %</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) deviceCommand(device, endpoint, {[name]: item == 'level' ? Math.round(this.value * 255 / 100) : parseInt(this.value)}); });
                break;
            }

            case 'status':
            {
                controlCell.innerHTML = '<span>on</span>/<span>off</span>/<span>toggle</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { deviceCommand(device, endpoint, {[name]: item.innerHTML}); }) );
                break;
            }

            default:
            {
                let option = options[name] ?? new Object();

                switch (option.type)
                {
                    case 'button':
                        controlCell.innerHTML = '<span>trigger</span>';
                        controlCell.querySelector('span').addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">true</span>'; deviceCommand(device, endpoint, {[name]: true}); });
                        break;

                    case 'number':

                        if (isNaN(option.min) || isNaN(option.max))
                            break;

                        valueCell.dataset.type = 'number';

                        if (option.unit)
                            valueCell.dataset.unit = option.unit;

                        if ((option.max - option.min) / (option.step ?? 1) <= 1000)
                        {
                            controlCell.innerHTML = '<input type="range" min="' + option.min + '" max="' + option.max + '" step="' + (option.step ?? 1) + '">';
                            controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + (option.unit ? ' ' + option.unit : '') + '</span>'; });
                            controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) deviceCommand(device, endpoint, {[name]: parseFloat(this.value)}); });
                        }
                        else
                        {
                            controlCell.innerHTML = '<input type="number" min="' + option.min + '" max="' + option.max + '" step="' + (option.step ?? 1) + '" value="0"><button>Set</button>';
                            controlCell.querySelector('button').addEventListener('click', function() { let value = controlCell.querySelector('input[type="number"]').value; if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + (option.unit ? ' ' + option.unit : '') + '</span>'; deviceCommand(device, endpoint, {[name]: parseFloat(value)}); } });
                        }

                        break;

                    case 'select':

                        let items = Array.isArray(option.enum) ? option.enum : Object.values(option.enum);

                        if (!items.length)
                            break;

                        items.forEach((item, index) => { controlCell.innerHTML += (index ? '/' : '') + '<span class="control">' + item + '</span>'; });
                        controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { if (valueCell.dataset.value != item.innerHTML) { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; deviceCommand(device, endpoint, {[name]: item.innerHTML}); } }) );
                        break;

                    case 'sensor':

                        if (option.unit)
                            valueCell.dataset.unit = option.unit;

                        break;

                    case 'toggle':
                        controlCell.innerHTML = '<span>enable</span>/<span>disable</span>';
                        controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { let value = item.innerHTML == 'enable' ? 'true' : 'false'; if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; deviceCommand(device, endpoint, {[name]: value}); } }) );
                        break;

                    default:

                        if (name.includes('P1') || name.includes('P2') || name.includes('P3') || name.includes('P4') || name.includes('P5') || name.includes('P6'))
                        {
                            controlCell.innerHTML = '<input type="time" value="00:00"><button>Set</button>';
                            controlCell.querySelector('button').addEventListener('click', function() { let value = controlCell.querySelector('input[type="time"]').value; let data = value.split(':'); if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; deviceCommand(device, endpoint, {[name.replace('Time', 'Hour')]: parseInt(data[0]), [name.replace('Time', 'Minute')]: parseInt(data[1])}); } });
                        }

                        break;
                }

                break;
            }
        }
    });

    Object.keys(properties).forEach(name => { updateExpose(device, endpoint, name, properties[name]); });
}

function updateExpose(device, endpoint, name, value)
{
    document.querySelectorAll('tr[data-device="' + device.service + '/' + device.id + '"][data-endpoint="' + endpoint + '"]').forEach(row =>
    {
        let cell;

        if ((name.includes('P1') || name.includes('P2') || name.includes('P3') || name.includes('P4') || name.includes('P5') || name.includes('P6')) && (name.endsWith('Hour') || name.endsWith('Minute')))
        {
            let item = name.replace('Hour', 'Time').replace('Minute', 'Time');

            cell = row.querySelector('td.value[data-property="' + item + '"]');

            if (cell)
            {
                let input = row.querySelector('td.control input[type="time"]');
                let time;

                if (!input)
                    return;

                if (value < 10)
                    value = '0' + value;

                time = input.value.split(':');
                input.value = name.endsWith('Hour') ? value + ':' + time[1] : time[0] + ':' + value;

                cell.dataset.value = input.value;
                cell.innerHTML = input.value;
            }

            return;
        }

        cell = row.querySelector('td.value[data-property="' + name + '"]');

        if (cell)
        {
            switch (name.split('_')[0])
            {
                case 'color':
                    colorPicker.color.rgb = {r: value[0], g: value[1], b: value[2]};
                    cell.innerHTML = '<div class="color" style="background-color: rgb(' + value[0] + ', ' + value[1] + ', ' + value[2] + ');"></div>';
                    break;

                case 'irCode':

                    if (cell.dataset.mode == 'learn')
                    {
                        cell.querySelector('textarea').value = value;
                        cell.dataset.mode == 'send';
                    }

                    break;

                case 'status':
                    cell.innerHTML = '<i class="icon-enable ' + (value == 'on' ? 'warning' : 'shade') + '"></i>';
                    break;

                default:

                    if (cell.dataset.type == 'number')
                    {
                        let input = row.querySelector('td.control input');

                        if (name == 'level')
                            value = Math.round(value * 100 / 255);

                        if (cell.dataset.value == value)
                            break;

                        if (input)
                            input.value = value;
                    }

                    cell.innerHTML = typeof value == 'number' ? Math.round(value * 1000) / 1000 + (cell.dataset.unit ? ' ' + cell.dataset.unit : '') : value;
                    break;
            }

            cell.dataset.value = value;
        }
    });
}
