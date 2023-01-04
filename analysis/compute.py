import sys
import json

data = {}
with open(sys.argv[1]) as json_file:
    data = json.load(json_file)

bases = {}
with open("analysis/base_genres.json") as json_file:
    bases = json.load(json_file)

genres = {}
for i, item in enumerate(data["items"]):
    to_add = 50 / int(i / 5 + 1)
    for genre in item["genres"]:
        if genre not in genres:
            genres[genre] = 0
        genres[genre] += to_add

genre_genre_scores = {}
base_genre_scores = {}

for base_genre in bases:
    multiplier = bases[base_genre][0]
    genre_genres = bases[base_genre][1:]
    for genre_genre in genre_genres:
        if genre_genre not in genre_genre_scores:
            genre_genre_scores[genre_genre] = 0
            for loop_genre in genres:
                if genre_genre in loop_genre:
                    genre_genre_scores[genre_genre] += genres[loop_genre]
        if base_genre not in base_genre_scores:
            base_genre_scores[base_genre] = 0
        base_genre_scores[base_genre] += int(multiplier) * genre_genre_scores[genre_genre]
        

print(dict(sorted(base_genre_scores.items(), key=lambda item: item[1], reverse=True)))
sys.stdout.flush()