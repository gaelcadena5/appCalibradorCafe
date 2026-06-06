#!/usr/bin/env python3
import http.server
import socketserver
import webbrowser
import threading
import time

PORT = 8000
DIRECTORY = "."

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def open_browser(port):
    # Wait a moment for the server to spin up
    time.sleep(1)
    url = f"http://localhost:{port}"
    print(f"Abriendo navegador en {url}...")
    webbrowser.open(url)

def run_server():
    global PORT
    for port in range(8000, 8011):
        try:
            with socketserver.TCPServer(("", port), Handler) as httpd:
                PORT = port
                print(f"Servidor web local corriendo en el puerto {PORT}")
                print("Para detener el servidor presiona Ctrl+C")
                
                # Start browser thread with the successful port
                threading.Thread(target=open_browser, args=(PORT,), daemon=True).start()
                
                httpd.serve_forever()
                break
        except OSError:
            print(f"Puerto {port} ocupado, intentando con el siguiente...")
    else:
        print("Error: No se pudo encontrar ningún puerto libre entre 8000 y 8010.")

if __name__ == "__main__":
    try:
        run_server()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
