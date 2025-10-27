<?php
// Endpoint minimal pour connaître le rôle courant de l'utilisateur
// Retourne {"role":"admin"|"s2de"|"public", "ts": <timestamp> }

// Détecte si HTTPS pour définir le cookie 'secure'
$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);

session_set_cookie_params([
  'lifetime' => 0,
  'path' => '/',
  'secure' => $secure,
  'httponly' => true,
  'samesite' => 'Lax'
]);

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$role = isset($_SESSION['role']) ? $_SESSION['role'] : 'public';

echo json_encode([
  'role' => $role,
  'ts'   => time()
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
exit;