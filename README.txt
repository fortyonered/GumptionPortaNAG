Gumption PortaNAG

Changes in this build:
- Supports failed objectives:
  - objective.failed: true
  - rendered red, struck through, with an X box
- Supports failed paths:
  - path.failed: true
  - path.failedIcon: "icons/path-failed.bmp"
  - path tile becomes red-tinted
  - failed icon is displayed beside the normal path icon
  - path title, progress text, and integrity labels/values glitch like unknown objectives

Host with:
  py -m http.server 8000
