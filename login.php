<?php
session_start();
// ↘︎ Remplace le hash ci-dessous
const PASS_HASH = '$2y$10$PEGwDWDfVPlG7jhnmKxlzOq5K8bOmIY.CGwv1v8Ii8Ji3/sBzwoWW';

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $p = $_POST['password'] ?? '';
  if (password_verify($p, PASS_HASH)) {
    $_SESSION['role'] = 'admin';
    $next = $_SESSION['next'] ?? '/';
    unset($_SESSION['next']);
    header('Location: ' . $next);
    exit;
  } else {
    $error = 'Mot de passe incorrect';
  }
}
?><!doctype html><meta charset="utf-8">
<form method="post" style="max-width:320px;margin:40px auto;font-family:sans-serif">
  <h3>Connexion</h3>
  <?php if ($error) echo "<p style='color:red'>$error</p>"; ?>
  <label>Mot de passe<br><input name="password" type="password" required></label><br><br>
  <button>Se connecter</button>
</form>