import sys
import json

data = {}
with open(sys.argv[1]) as json_file:
    data = json.load(json_file)