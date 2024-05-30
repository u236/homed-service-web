var colorPicker;

function exposeTitle(name, endpoint = 'common')
{
    var title = name.replace('_', ' ').replace(/([A-Z])/g, ' $1').toLowerCase().split(' ');

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
    var part = expose.split('_');
    var list = new Array();

    switch (part[0])
    {
        case 'cover':
            list = ['cover', 'position'];
            break;

        case 'light':
            list = ['status'].concat(options[part[1] ? 'light_' + part[1] : 'light'] ?? new Array());
            break;

        case 'switch':
            list = ['status'];
            break;

        case 'thermostat':
            var controls = ['systemMode', 'operationMode', 'targetTemperature'];
            controls.forEach(function(item) { if (options[item]) { list.push(item); options[item] = {...options[item], ...(item == 'targetTemperature' ? {type: 'number', unit: '°C'} : {type: 'select'})}; } });
            list = list.concat(options.heatingStatus ? ['temperature', 'heating'] : ['temperature']);
            options['temperature'] = {type:'sensor', unit: '°C'};
            break;

        case 'thermostatProgram':

            var option = options.targetTemperature ?? {};

            if (isNaN(option.min) || isNaN(option.max))
                break;

            switch (options.thermostatProgram)
            {
                case 'daily':

                    var types = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

                    for (var i = 0; i < 28; i++)
                    {
                        var item = types[parseInt(i / 4)] + 'P' + parseInt(i % 4 + 1);
                        list.push(item + 'Time');
                        list.push(item + 'Temperature');
                        options[item + 'Temperature'] = option;
                    }

                    break;

                case 'moes':

                    var types = ['weekday', 'saturday', 'sunday'];

                    for (var i = 0; i < 12; i++)
                    {
                        var item = types[parseInt(i / 4)] + 'P' + parseInt(i % 4 + 1);
                        list.push(item + 'Time');
                        list.push(item + 'Temperature');
                        options[item + 'Temperature'] = option;
                    }

                    break;

                default:

                    var types = ['weekday', 'holiday'];

                    for (var i = 0; i < 12; i++)
                    {
                        var item = types[parseInt(i / 6)] + 'P' + parseInt(i % 6 + 1);
                        list.push(item + 'Time');
                        list.push(item + 'Temperature');
                        options[item + 'Temperature'] = option;
                    }

                    break;
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
    var options = device.options(endpoint);
    var properties = device.properties(endpoint);
    var list = exposeList(expose, options);

    list.forEach(name =>
    {
        var row = table.insertRow();
        var titleCell = row.insertCell();
        var valueCell = row.insertCell();
        var controlCell = row.insertCell();

        row.dataset.expose = device.service + '/' + device.id + '/' + endpoint + '/' + name;
        titleCell.innerHTML = exposeTitle(name, options.name ?? endpoint);
        valueCell.innerHTML = empty;
        valueCell.classList.add('value');
        controlCell.classList.add('control');

        switch (name.split('_')[0])
        {
            case 'color':
                colorPicker = new iro.ColorPicker(controlCell, {layout: [{component: iro.ui.Wheel}], width: 150});
                colorPicker.on('input:end', function() { deviceCommand(device, endpoint, {[name]: [colorPicker.color.rgb.r, colorPicker.color.rgb.g, colorPicker.color.rgb.b]}); });
                break;

            case 'colorTemperature':
                var option = options.colorTemperature ?? {};
                valueCell.dataset.type = 'number';
                controlCell.innerHTML = '<input type="range" min="' + (option.min ?? 150) + '" max="' + (option.max ?? 500) + '" class="colorTemperature">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) deviceCommand(device, endpoint, {[name]: parseInt(this.value)}); });
                break;

            case 'cover':
                controlCell.innerHTML = '<span>open</span>/<span>stop</span>/<span>close</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; deviceCommand(device, endpoint, {[name]: item.innerHTML}); }) );
                break;

            case 'level':
            case 'position':
                valueCell.dataset.type = 'number';
                valueCell.dataset.unit = '%';
                controlCell.innerHTML = '<input type="range" min="0" max="100" class="' + name + '">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + ' %</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) deviceCommand(device, endpoint, {[name]: name == 'level' ? Math.round(this.value * 255 / 100) : parseInt(this.value)}); });
                break;

            case 'status':
                controlCell.innerHTML = '<span>on</span>/<span>off</span>/<span>toggle</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { deviceCommand(device, endpoint, {[name]: item.innerHTML}); }) );
                break;

            default:

                var option = options[name.split('_')[0]] ?? new Object();

                switch (option.type)
                {
                    case 'button':
                        controlCell.innerHTML = '<span>trigger</span>';
                        controlCell.querySelector('span').addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">true</span>'; deviceCommand(device, endpoint, {[name]: true}) });
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
                            controlCell.innerHTML = '<input type="number" min="' + option.min + '" max="' + option.max + '" step="' + (option.step ?? 1) + '" value="0"><button class="inline">Set</button>';
                            controlCell.querySelector('button').addEventListener('click', function() { var value = controlCell.querySelector('input[type="number"]').value; if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + (option.unit ? ' ' + option.unit : '') + '</span>'; deviceCommand(device, endpoint, {[name]: parseFloat(value)}); } });
                        }

                        break;

                    case 'select':

                        var items = Array.isArray(option.enum) ? option.enum : Object.values(option.enum);

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
                        controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { var value = item.innerHTML == 'enable' ? 'true' : 'false'; if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; deviceCommand(device, endpoint, {[name]: value}); } }) );
                        break;

                    default:

                        if (name.includes('P1') || name.includes('P2') || name.includes('P3') || name.includes('P4') || name.includes('P5') || name.includes('P6'))
                        {
                            controlCell.innerHTML = '<input type="time" value="00:00"><button class="inline">Set</button>';
                            controlCell.querySelector('button').addEventListener('click', function() { var value = controlCell.querySelector('input[type="time"]').value; var data = value.split(':'); if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; deviceCommand(device, endpoint, {[name.replace('Time', 'Hour')]: parseInt(data[0]), [name.replace('Time', 'Minute')]: parseInt(data[1])}); } });
                        }

                        break;
                }

                break;
        }
    });

    Object.keys(properties).forEach(name => { updateExpose(device, endpoint, name, properties[name]); });
}

function updateExpose(device, endpoint, name, value)
{
    if (name.includes('P1') || name.includes('P2') || name.includes('P3') || name.includes('P4') || name.includes('P5') || name.includes('P6'))
    {
        var item = name.replace('Hour', 'Time').replace('Minute', 'Time');
        var row = document.querySelector('tr[data-expose="' + device.service + '/' + device.id + '/' + endpoint + '/' + item + '"]');
        var cell = row ? row.querySelector('td.value') : undefined;

        if (cell && (name.endsWith('Hour') || name.endsWith('Minute')))
        {
            var input = row.querySelector('td.control input[type="time"]');
            var time;

            if (!input)
                return;

            if (value < 10)
                value = '0' + value;

            time = input.value.split(':');
            input.value = name.endsWith('Hour') ? value + ':' + time[1] : time[0] + ':' + value;

            cell.dataset.value = input.value;
            cell.innerHTML = input.value;
        }
    }

    document.querySelectorAll('tr[data-expose="' + device.service + '/' + device.id + '/' + endpoint + '/' + name + '"]').forEach(row =>
    {
        var cell = row ? row.querySelector('td.value') : undefined;

        if (cell)
        {
            switch (name.split('_')[0])
            {
                case 'color':
                    colorPicker.color.rgb = {r: value[0], g: value[1], b: value[2]};
                    cell.innerHTML = '<div class="color" style="background-color: rgb(' + value[0] + ', ' + value[1] + ', ' + value[2] + ');"></div>';
                    break;

                case 'status':
                    cell.innerHTML = '<i class="icon-enable ' + (value == 'on' ? 'warning' : 'shade') + '"></i>';
                    break;

                default:

                    if (cell.dataset.type == 'number')
                    {
                        var input = row.querySelector('td.control input');

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
            return;
        }
    });
}
