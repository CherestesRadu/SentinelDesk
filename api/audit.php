<?php

header('Content-Type: application/json; charset=utf-8');

$logPath = __DIR__ . '/../agent/logs/audit.log';
$contents = is_file($logPath) ? file_get_contents($logPath) : '';

if ($contents === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Audit log could not be read']);
    exit;
}

if (substr($contents, 0, 2) === "\xff\xfe") {
    $contents = mb_convert_encoding(substr($contents, 2), 'UTF-8', 'UTF-16LE');
} else {
    $contents = mb_convert_encoding($contents, 'UTF-8', 'UTF-8');
}

$entries = [];
$lines = preg_split('/\r\n|\r|\n/', trim($contents));

foreach ($lines as $line) {
    if (preg_match('/^\[\s*((?:\d{2}\.\d{2}\.\d{4}\s+)?\d{2}:\d{2}:\d{2})\s*\]:\s*(.+)$/u', trim($line), $matches)) {
        $message = trim($matches[2]);
        $entries[] = [
            'time' => preg_replace('/\s+/', ' ', $matches[1]),
            'level' => preg_match('/warn|error|fail/i', $message) ? 'warn' : 'ok',
            'message' => $message
        ];
    }
}

echo json_encode(['success' => true, 'entries' => array_reverse($entries)], JSON_UNESCAPED_UNICODE);
