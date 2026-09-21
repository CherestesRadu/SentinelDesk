const statusBtn = document.getElementById('statusBtn');
const result = document.getElementById('result');

statusBtn.addEventListener('click', checkStatus);

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