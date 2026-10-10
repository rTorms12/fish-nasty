#!/bin/bash
# Double-click this file (or run it in Terminal) to start Fish Nasty on your Mac.
cd "$(dirname "$0")"
open "http://localhost:8765" 2>/dev/null
python3 serve.py 8765
