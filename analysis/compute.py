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
sum_genre_scores = 0

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
        base_genre_scores[base_genre] += int(1 + int(multiplier - 1) / 2) * genre_genre_scores[genre_genre]
    if base_genre_scores[base_genre] == 0:
        base_genre_scores.pop(base_genre)
    else:
        sum_genre_scores += base_genre_scores[base_genre]

public_base_genre_scores = {}
for base_genre in base_genre_scores:
    if (((base_genre[0] == 'j') or (base_genre[0] == 'k')) and base_genre[1] == '-'):
        base_genre_mod = base_genre
    elif base_genre == "r-n-b":
        base_genre_mod = "r&b"
    else:
        base_genre_mod = base_genre.replace("-", " ")
    public_base_genre_scores[base_genre_mod] = base_genre_scores[base_genre] / sum_genre_scores * 100
base_genre_scores_arr = sorted(public_base_genre_scores.items(), key=lambda item: item[1], reverse=True)

print(dict(base_genre_scores_arr))
sys.stdout.flush()