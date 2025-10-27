<?php
// download.php — auto-MAP: découvre automatiquement les PDF dans private_docs

session_start();
if (($_SESSION['role'] ?? 'public') !== 'admin') {
  $_SESSION['next'] = $_SERVER['REQUEST_URI'] ?? '/';
  header('Location: /login.php');
  exit;
}

// --- Helpers ---
function slugify($s) {
  $s = (string)$s;
  $s = strtolower($s);
  // translittération pour supprimer les accents
  if (function_exists('iconv')) {
    $tmp = @iconv('UTF-8', 'ASCII//TRANSLIT', $s);
    if ($tmp !== false) { $s = $tmp; }
  }
  $s = preg_replace('/[^a-z0-9]+/', '_', $s);
  $s = trim($s, '_');
  return $s !== '' ? $s : 'file';
}

function buildMap($baseDir) {
  $map = [];
  if (!$baseDir || !is_dir($baseDir)) return $map;
  $flags = FilesystemIterator::SKIP_DOTS;
  $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($baseDir, $flags));
  foreach ($it as $f) {
    if ($f->isDir()) continue;
    if (strtolower($f->getExtension()) !== 'pdf') continue; // PDF uniquement
    $full = $f->getPathname();
    $rel  = substr($full, strlen($baseDir) + 1);
    $id   = slugify(pathinfo($rel, PATHINFO_FILENAME));
    // Gestion des collisions d'ID
    if (isset($map[$id])) {
      $id = slugify(str_replace(['\\','/'], '_', $rel));
      if (isset($map[$id])) {
        $id .= '_' . substr(md5($rel), 0, 6);
      }
    }
    $map[$id] = $full; // on stocke le chemin absolu
  }
  return $map;
}

// Bases possibles : hors webroot puis sous webroot
$outside = realpath($_SERVER['DOCUMENT_ROOT'] . '/../private_docs');
$inside  = realpath($_SERVER['DOCUMENT_ROOT'] . '/private_docs');

$MAP = [];
foreach ([$outside, $inside] as $base) {
  $MAP = $MAP + buildMap($base);
}

// --- Debug: /download.php?debug=1&id=<ID> renvoie l'état du fichier
if (isset($_GET['debug'])) {
  header('Content-Type: application/json; charset=utf-8');
  $id = $_GET['id'] ?? '';
  $outside = realpath($_SERVER['DOCUMENT_ROOT'] . '/../private_docs');
  $inside  = realpath($_SERVER['DOCUMENT_ROOT'] . '/private_docs');
  $resp = [
    'id' => $id,
    'outside_base' => $outside,
    'inside_base' => $inside,
    'ids_available' => array_keys($MAP),
    'mapped' => isset($MAP[$id]),
  ];
  if (isset($MAP[$id])) {
    $path = $MAP[$id];
    $resp['path'] = $path;
    $resp['exists'] = file_exists($path);
    $resp['readable'] = is_readable($path);
    if (file_exists($path)) {
      $resp['size'] = filesize($path);
      $resp['basename'] = basename($path);
    }
  }
  echo json_encode($resp, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

// Diagnostic optionnel: lister les IDs disponibles
if (isset($_GET['list'])) {
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(array_keys($MAP));
  exit;
}

$id = $_GET['id'] ?? '';
if (!isset($MAP[$id])) { http_response_code(404); exit('Introuvable'); }
$path = $MAP[$id];
if (!is_readable($path)) { http_response_code(404); exit('Introuvable'); }

$filename = basename($path);
header('Content-Type: application/pdf');
header('Content-Disposition: inline; filename="'.$filename.'"');
header('Content-Length: ' . filesize($path));
readfile($path);
exit;