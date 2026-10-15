@echo off
title Microservices E-Commerce Cluster (Ports 8000-8004)
cd /d "%~dp0microservices-ecommerce"
echo =======================================================
echo Starting 5 Microservices (Gateway + 4 Autonomous Svcs)...
echo API Gateway:     http://localhost:8000
echo Product Svc:     http://localhost:8001 (product_service.db)
echo User Svc:        http://localhost:8002 (user_service.db)
echo Order Svc:       http://localhost:8003 (order_service.db)
echo Payment Svc:     http://localhost:8004 (payment_service.db)
echo =======================================================
start "" "http://localhost:8000"
node start-all-services.js
pause
