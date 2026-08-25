$port = 8080
$ip = [System.Net.IPAddress]::Any

# Zamykanie i ponowne tworzenie gniazda TCP
$listener = $null
try {
    $listener = New-Object System.Net.Sockets.TcpListener($ip, $port)
    $listener.Start()
} catch {
    $port = 8081
    $listener = New-Object System.Net.Sockets.TcpListener($ip, $port)
    $listener.Start()
}

$myIP = "192.168.0.179"

Clear-Host
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "   KALKULATOR PROŚNOŚCI ŚWIŃ - SERWER DOMOWY WI-FI JEST AKTYWNY   " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📱 WPISZ W PRZEGLĄDARCE NA TELEFONIE (połączonym z domowym Wi-Fi):" -ForegroundColor Cyan
Write-Host "   👉 http://$myIP`:$port/" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host ""
Write-Host "⚠️  WAŻNE: Jeśli strona na telefonie się nie ładuje, upewnij się," -ForegroundColor Red
Write-Host "    że w wyskakującym okienku Zapory Windows kliknąłeś 'Zezwalaj na dostęp'." -ForegroundColor Red
Write-Host "==================================================================" -ForegroundColor Green

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
}

$workingDir = Get-Location

while ($true) {
    try {
        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $reader = New-Object System.IO.StreamReader($stream)

        $requestLine = $reader.ReadLine()
        if ($requestLine) {
            $tokens = $requestLine.Split(" ")
            if ($tokens.Length -ge 2) {
                $rawPath = $tokens[1]
                if ($rawPath -eq "/" -or $rawPath -eq "") { $rawPath = "/index.html" }
                $cleanPath = $rawPath.Split("?")[0]
                $localPath = Join-Path $workingDir $cleanPath.TrimStart("/")

                if (Test-Path $localPath -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($localPath).ToLower()
                    $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
                    $bytes = [System.IO.File]::ReadAllBytes($localPath)

                    $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($header)
                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($bytes, 0, $bytes.Length)
                    Write-Host "[OK] Połączenie z telefonu - zserwowano $cleanPath" -ForegroundColor DarkCyan
                } else {
                    $notFound = [System.Text.Encoding]::UTF8.GetBytes("HTTP/1.1 404 Not Found`r`nContent-Length: 9`r`nConnection: close`r`n`r`nNot Found")
                    $stream.Write($notFound, 0, $notFound.Length)
                }
            }
        }
        $stream.Close()
        $client.Close()
    } catch {
        # Kontynuacja pętli
    }
}
