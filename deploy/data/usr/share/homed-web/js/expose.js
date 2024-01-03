var colorPicker;

function exposeTitle(name, suffix)
{
    var title = name.replace(/([A-Z])/g, ' $1').toLowerCase().split(' ');

    switch (title[0])
    {
        case 'co2':  title[0] = 'CO2'; break;
        case 'eco2': title[0] = 'eCO2'; break;
        case 'pm1':  title[0] = 'PM1'; break;
        case 'pm10': title[0] = 'PM10'; break;
        case 'pm25': title[0] = 'PM2.5'; break;
        case 'voc':  title[0] = 'VOC'; break;
        default:     title[0] = title[0].charAt(0).toUpperCase() + title[0].slice(1).toLowerCase(); break;
    }

    if (['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].includes(title[1]))
        title[1] = title[1].toUpperCase();

    return title.join(' ') + (suffix != 'common' ? ' ' + suffix : '');
}

function addExpose(endpoint, expose, options = {}, endpoints = undefined)
{
    var suffix = isNaN(endpoint) ? '' : '-' + endpoint;
    var control = true;
    var list = new Array();

    switch(expose)
    {
        case 'cover':
            list = ['cover', 'position'];
            break;

        case 'light':
            list = ['switch'].concat(options.light);
            break;

        case 'thermostat':
            var controls = ['systemMode', 'operationMode', 'targetTemperature'];
            controls.forEach(function(item) { if (options[item]) { list.push(item); options[item] = {...options[item], ...(item == 'targetTemperature' ? {type: 'number', unit: '°C'} : {type: 'select'})}; } });
            list = list.concat(options.heatingStatus ? ['temperature', 'heating'] : ['temperature']);
            options['temperature'] = {type:'sensor', unit: '°C'};
            break;

        case 'thermostatProgram':

            if (options.thermostatProgram.moes)
            {
                var types = ['weekday', 'saturday', 'sunday'];
                var option = options.targetTemperature ?? {};

                if (isNaN(option.min) || isNaN(option.max))
                    break;

                for (var i = 0; i < 12; i++)
                {
                    var item = types[parseInt(i / 4)] + 'P' + parseInt(i % 4 + 1);
                    list.push(item + 'Time');
                    list.push(item + 'Temperature');
                    options[item + 'Temperature'] = option;
                }
            }
            else
            {
                var types = ['weekday', 'holiday'];
                var option = options.targetTemperature ?? {};

                if (isNaN(option.min) || isNaN(option.max))
                    break;

                for (var i = 0; i < 12; i++)
                {
                    var item = types[parseInt(i / 6)] + 'P' + parseInt(i % 6 + 1);
                    list.push(item + 'Time');
                    list.push(item + 'Temperature');
                    options[item + 'Temperature'] = option;
                }
            }

            break;

        default:
            list.push(expose);
            break;
    }

    list.forEach(name =>
    {
        var row = document.querySelector('.deviceInfo table.exposes').insertRow();
        var titleCell = row.insertCell();
        var valueCell = row.insertCell();
        var controlCell = row.insertCell();

        row.dataset.name = name + suffix;
        titleCell.innerHTML = exposeTitle(name.replace('_', ' '), options.name ?? endpoint);
        valueCell.innerHTML = '<span class="shade"><i>unknown</i></span>';
        valueCell.classList.add('value');
        controlCell.classList.add('control');

        if (options[name.split('_')[0]] == 'raw')
            row.dataset.option = 'raw';

        switch (name.split('_')[0])
        {
            case 'co2FactoryReset':
            case 'co2ForceCalibration':
                controlCell.innerHTML = '<span>trigger</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">true</span>'; sendData(endpoint, {[name]: true}) }) );
                break;

            case 'color':
                colorPicker = new iro.ColorPicker(controlCell, {layout: [{component: iro.ui.Wheel}], width: 150});
                colorPicker.on('input:end', function() { sendData(endpoint, {[name]: [colorPicker.color.rgb.r, colorPicker.color.rgb.g, colorPicker.color.rgb.b]}); });
                break;

            case 'colorTemperature':
                var option = options.colorTemperature ?? {};
                valueCell.dataset.type = 'number';
                controlCell.innerHTML = '<input type="range" min="' + (option.min ?? 150) + '" max="' + (option.max ?? 500) + '" class="colorTemperature">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + '</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) sendData(endpoint, {[name]: parseInt(this.value)}); });
                break;

            case 'cover':
                controlCell.innerHTML = '<span>open</span>/<span>stop</span>/<span>close</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; sendData(endpoint, {[name]: item.innerHTML}); }) );
                break;

            case 'setUpperLimit':
            case 'resetLimit':
                controlCell.innerHTML = '<span>open</span>/<span>stop</span>/<span>close</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; sendData(endpoint, {[name]: item.innerHTML}); }) );
                break;
            case 'level':
            case 'position':

                valueCell.dataset.type = 'number';
                valueCell.dataset.unit = '%';

                if (name.startsWith('position') && !list.includes('cover'))
                    break;

                controlCell.innerHTML = '<input type="range" min="0" max="100" class="' + name + '">';
                controlCell.querySelector('input').addEventListener('input', function() { valueCell.innerHTML = '<span' + (valueCell.dataset.value != this.value ? ' class="shade"' : '') + '>' + this.value + ' %</span>'; });
                controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) sendData(endpoint, {[name]: name == 'level' ? Math.round(this.value * 255 / 100) : parseInt(this.value)}); });
                break;

            case 'switch':
                name = name.replace('switch', 'status');
                row.dataset.name = name + suffix;
                controlCell.innerHTML = '<span>on</span>/<span>off</span>/<span>toggle</span>';
                controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { sendData(endpoint, {[name]: item.innerHTML}); }) );
                break;

            default:

                var option = options[name.split('_')[0]] ?? {};

                switch (option.type)
                {
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
                            controlCell.querySelector('input').addEventListener('change', function() { if (valueCell.dataset.value != this.value) sendData(endpoint, {[name]: parseFloat(this.value)}); });
                        }
                        else
                        {
                            controlCell.innerHTML = '<input type="number" min="' + option.min + '" max="' + option.max + '" step="' + (option.step ?? 1) + '" value="0"><button class="inline">Set</button>';
                            controlCell.querySelector('button').addEventListener('click', function() { var value = controlCell.querySelector('input[type="number"]').value; if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; sendData(endpoint, {[name]: parseFloat(value)}); } });
                        }

                        break;

                    case 'select':

                        if (!Array.isArray(option.enum))
                            break;

                        option.enum.forEach((item, index) => { controlCell.innerHTML += (index ? '/' : '') + '<span class="control">' + item + '</span>'; });
                        if (name.split('_')[0] == 'resetLimit' && name.split('_')[0] == 'setUpperLimit') {
                            controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; sendData(endpoint, {[name]: item.innerHTML}); }) );
                        }
                        else {
                            controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { if (valueCell.dataset.value != item.innerHTML) { valueCell.innerHTML = '<span class="shade">' + item.innerHTML + '</span>'; sendData(endpoint, {[name]: item.innerHTML}); } }) );
                        }
                        break;

                    case 'sensor':

                        if (option.unit)
                            valueCell.dataset.unit = option.unit;

                        break;

                    case 'toggle':
                        controlCell.innerHTML = '<span>enable</span>/<span>disable</span>';
                        controlCell.querySelectorAll('span').forEach(item => item.addEventListener('click', function() { var value = item.innerHTML == 'enable' ? 'true' : 'false'; if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; sendData(endpoint, {[name]: value}); } }) );
                        break;

                    default:

                        if (name.startsWith('holiday') || name.startsWith('saturday') || name.startsWith('sunday') || name.startsWith('weekday'))
                        {
                            controlCell.innerHTML = '<input type="time" value="00:00"><button class="inline">Set</button>';
                            controlCell.querySelector('button').addEventListener('click', function() { var value = controlCell.querySelector('input[type="time"]').value; var data = value.split(':'); if (valueCell.dataset.value != value) { valueCell.innerHTML = '<span class="shade">' + value + '</span>'; sendData(endpoint, {[name.replace('Time', 'Hour')]: parseInt(data[0]), [name.replace('Time', 'Minute')]: parseInt(data[1])}); } });
                            break;
                        }

                        control = false;
                        break;
                }

                break;
        }
    });

    if (!endpoints)
        return;

    if (!endpoints.fd.includes(endpoint))
        isNaN(endpoint) ? endpoints.fd.unshift(endpoint) : endpoints.fd.push(endpoint);

    if (!endpoints.td.includes(endpoint) && control)
        isNaN(endpoint) ? endpoints.td.unshift(endpoint) : endpoints.td.push(endpoint);
}

function updateExpose(endpoint, name, value)
{
    var suffix = isNaN(endpoint) ? '' : '-' + endpoint;
    var row = document.querySelector('.deviceInfo table.exposes tr[data-name="' + name + suffix + '"]');
    var cell = row ? row.querySelector('td.value') : null;

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
                    var input = document.querySelector('.deviceInfo .exposes tr[data-name="' + name + suffix + '"] td.control input');

                    if (name == 'level')
                        value = Math.round(value * 100 / 255);

                    if (cell.dataset.value == value)
                        break;

                    if (input)
                        input.value = value;
                }

                cell.innerHTML = typeof value == 'number' ? value + (cell.dataset.unit ? ' ' + cell.dataset.unit : '') : value;
                break;
        }

        cell.dataset.value = value;
        return;
    }

    if (name.startsWith('holiday') || name.startsWith('saturday') || name.startsWith('sunday') || name.startsWith('weekday'))
    {
        var item = name.replace('Hour', 'Time').replace('Minute', 'Time');
        var cell = document.querySelector('.deviceInfo .exposes tr[data-name="' + item + '"] td.value');

        if (cell && (name.endsWith('Hour') || name.endsWith('Minute')))
        {
            var input = document.querySelector('.deviceInfo .exposes tr[data-name="' + item + '"] td.control input[type="time"]');
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
}
