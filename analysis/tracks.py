import sys
import json

def avg(lst):
    return sum(lst) / len(lst)

def stdev(lst):
    mean = avg(lst)
    return (sum([(x - mean)**2 for x in lst]) / len(lst)) ** 0.5

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
    "danceability": [avg(danceabilities), stdev(danceabilities)],
    "energy": [avg(energies), stdev(energies)],
    "speechiness": [avg(speechinesses), stdev(speechinesses)],
    "acousticness": [avg(acousticnesses), stdev(acousticnesses)],
    "instrumentalness": [avg(instrumentalnesses), stdev(instrumentalnesses)],
    "valence": [avg(valences), stdev(valences)]
}

print(final)

sys.stdout.flush()