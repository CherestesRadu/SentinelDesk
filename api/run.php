<?php

header('Content-Type: application/json');

$input = file_get_contents('php://input');

$options = [
    'http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/json\r\n",
        'content' => $input
    ]
];

$context = stream_context_create($options);

$response = file_get_contents(
    'http://192.168.0.3:5000/run',
    false,
    $context
);

echo $response;