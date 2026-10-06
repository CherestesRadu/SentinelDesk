<?php

header('Content-Type: application/json; charset=utf-8');

$response = file_get_contents(
    'http://127.0.0.1:5000/audit'
);

if ($response === false) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'error' => 'Agent unavailable'
    ]);

    exit;
}

echo $response;