function generateGenreHTML() {
    to_return = "<h1>your top genres</h1>";
    for (var i = 0; i < 50; i++) {
        to_return += `<p>{{items.${i}.name}} {{items.${i}.genres}}`;
    }
    return to_return;
  }