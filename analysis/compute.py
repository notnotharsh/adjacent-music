import sys
import json

data = {}
with open('analysis/top_artists.json') as json_file:
    data = json.load(json_file);

genres = {}
for i, item in enumerate(data["items"]):
    to_add = 50 / int(i / 5 + 1)
    for genre in item["genres"]:
        if genre not in genres:
            genres[genre] = 0
        genres[genre] += to_add
print(dict(sorted(genres.items(), key=lambda item: item[1], reverse=True)))
sys.stdout.flush()