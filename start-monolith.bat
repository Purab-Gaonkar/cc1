@echo off
title Monolithic E-Commerce Server (Port 5000)
cd /d "%~dp0monolithic-ecommerce"
echo =======================================================
echo Starting Monolithic E-Commerce Server on Port 5000...
echo Single Shared Database: monolith_ecommerce.db
echo =======================================================
start "" "http://localhost:5000"
node server.js
pause
