@echo off
cd /d "%~dp0"
start node proxy.js
live-server --port=3000 --no-browser
