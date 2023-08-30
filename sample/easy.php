<html>

<body>
  <?php
  $query = $_GET['q'];
  $echoString = $query;
  if ($echoString) {
    echo '<div>' . $echoString . '</div>';
  }
  ?>
</body>

</html>