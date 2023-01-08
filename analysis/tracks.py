import sys
import json

def avg(lst):
    return sum(lst) / len(lst)

def stdev(lst):
    mean = avg(lst)
    return (sum([(x - mean)**2 for x in lst]) / len(lst)) ** 0.5

def interval(qty, val):
    if qty > val:
        return [1 - val, 1]
    else:
        return [0, 1]

data = {}
with open(sys.argv[1]) as json_file:
    data = json.load(json_file)

danceabilities = []
energies = []
speechinesses = []
acousticnesses = []
instrumentalnesses = []
valences = []

tracks = {}
for i, item in enumerate(data["audio_features"]):
    danceabilities.append(item["danceability"])
    energies.append(item["energy"])
    speechinesses.append(item["speechiness"])
    acousticnesses.append(item["acousticness"])
    instrumentalnesses.append(item["instrumentalness"])
    valences.append(item["valence"])

final = {
    "danceability": [max(0, avg(danceabilities) - stdev(danceabilities)), min(1, avg(danceabilities) + stdev(danceabilities))],
    "energy": [max(0, avg(energies) - stdev(energies)), min(1, avg(energies) + stdev(energies))],
    "valence": [max(0, avg(valences) - stdev(valences)), min(1, avg(valences) + stdev(valences))],
    "speechiness": interval(avg(speechinesses), 0.66),
    "acousticness": interval(avg(acousticnesses), 0.5),
    "instrumentalness": interval(avg(acousticnesses), 0.5)
}

print(final)

sys.stdout.flush()