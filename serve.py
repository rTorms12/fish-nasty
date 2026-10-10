#!/usr/bin/env python3
"""Tiny local web server for Fish Nasty that tells browsers never to cache files
(so every reload shows the latest code). Run: python3 serve.py [port]"""
import http.server, socketserver, sys, os, subprocess

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.svg': 'image/svg+xml'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()
    def log_message(self, fmt, *args):
        if '200' in fmt % args or '304' in fmt % args:
            return
        super().log_message(fmt, *args)

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

def lan_ip():
    try:
        for dev in ('en0', 'en1'):
            ip = subprocess.run(['ipconfig', 'getifaddr', dev], capture_output=True, text=True).stdout.strip()
            if ip:
                return ip
    except Exception:
        pass
    return None

if __name__ == '__main__':
    with Server(('0.0.0.0', PORT), Handler) as httpd:
        ip = lan_ip()
        print('\n  🐟  Fish Nasty is running\n')
        print(f'  On this Mac:     http://localhost:{PORT}')
        if ip:
            print(f'  On your phone:   http://{ip}:{PORT}   (same Wi-Fi network)')
        print('\n  Press Ctrl+C to stop.\n')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
