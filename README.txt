PORTA-NAG objective tracker
===========================

Files
-----
- index.html       Main page
- styles.css       Visual styling
- script.js        UI logic / refresh / local persistence
- objectives.json  Objective data feed (edit this during play)

How to use
----------
1. Put all files in the same folder on your web host.
2. Open index.html through a normal web server.
   - Because the page fetches objectives.json, some browsers will block it if you open index.html directly from the filesystem.
   - Any simple static host works.
3. During session, update objectives.json on the host.
4. Players click the refresh button in the upper-right corner to pull the latest data without reloading the page.

What is persisted locally
-------------------------
- Which paths are currently tracked
- Which objective nodes are collapsed
- Which tab is currently open

JSON structure
--------------
Top-level format:
{
  "systemStatus": {
    "threadLock": "STABLE"
  },
  "paths": [ ... ]
}

Each path:
{
  "id": "unique-id",
  "title": "Displayed Name",
  "tags": ["optional", "metadata"],
  "objectives": [ ...nested objective nodes... ]
}

Each objective node:
{
  "text": "Objective text",
  "complete": false,
  "unknown": false,
  "flags": ["OPT"],
  "children": []
}

Notes
-----
- "unknown": true styles entries like ??? as hidden/uncertain leads.
- "flags": ["OPT"] adds a small optional marker.
- Objective completion on parent nodes is manual in the JSON. The page does not auto-complete parents.
