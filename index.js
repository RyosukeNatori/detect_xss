echo("<!-- <html>\n<body>\n<script>\n  var options = ");
echo(JSON.stringify(["1234", "hello"]));
echo("</script>\n</body>\n</html> -->\n\n<html>\n  <body>\n    ");
if (undefined !== _GET.q) {
  echo("<div>" + _GET.q + "</div>");
}
echo("  </body>\n</html>");
