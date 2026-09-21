const statusBtn = document.getElementById('statusBtn');
const hostnameButton = document.getElementById('hostnameBtn')
const result = document.getElementById('result');

statusBtn.addEventListener('click', checkStatus);
hostnameButton.addEventListener('click', runHostnameModule);

async function checkStatus() {
    result.textContent = 'Connecting...';

    try {
        const response = await fetch('http://127.0.0.1:5000/status');

        const data = await response.json();

        result.textContent = JSON.stringify(data, null, 4);
    }
    catch (error) {
        result.textContent = 'Connection failed:\n' + error;
    }
}

async function runHostnameModule() {
    result.textContent = 'Running module...';

    try {
        const response = await fetch('api/run.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                module: 'hostname'
            })
        });

        const data = await response.json();

        result.textContent = JSON.stringify(data, null, 4);
    }
    catch (error) {
        result.textContent = 'Connection failed:\n' + error;
    }
}